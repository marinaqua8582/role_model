import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RosterItem, StudentProgress, StudentInfo } from './src/types/index';
import {
  generateAdminSessionToken,
  verifyAdminSessionToken,
  extractAdminToken,
  callServerGas,
} from './api/_lib.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory store initialized empty (for fallback or local sync)
let rosterStore: RosterItem[] = [];
const progressStore = new Map<string, StudentProgress>();

/**
 * Server-side Admin Auth Middleware
 * Reads HttpOnly cookie 'admin_session' or 'Authorization: Bearer <token>'
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractAdminToken(req);
  const result = verifyAdminSessionToken(token);

  if (!result.valid) {
    return res.status(401).json({
      success: false,
      message: result.message || '관리자 인증이 필요합니다. 다시 로그인해 주세요.',
    });
  }

  next();
}

function normalizeName(name: any): string {
  return String(name || '').trim().normalize('NFC').replace(/\s+/g, '');
}

// -------------------------------------------------------------
// Public & Student Endpoints
// -------------------------------------------------------------

// 0. Student GAS Proxy (Students only access non-admin actions)
app.post('/api/gas-proxy', async (req, res) => {
  try {
    const payload = req.body || {};
    const action = payload.action;

    // Block client attempts to run admin actions through public proxy
    if (
      action === 'getAdminDashboard' ||
      action === 'getStudentDetail' ||
      action === 'updateRoster' ||
      action === 'deleteRosterStudents' ||
      action === 'getAllProgress'
    ) {
      return res.status(403).json({
        success: false,
        message: '관리자 전용 기능은 클라이언트에서 직접 호출할 수 없습니다.',
      });
    }

    const targetUrl = process.env.GAS_URL || process.env.VITE_GAS_URL;

    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return res.status(500).json({
        success: false,
        message: 'GAS_URL 환경변수가 설정되지 않았습니다.',
      });
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch {
      return res.status(response.status).send(text);
    }
  } catch (err: any) {
    console.error('GAS proxy error:', err);
    return res.status(500).json({
      success: false,
      message: 'Google Apps Script 연결 중 오류가 발생했습니다: ' + (err?.message || 'Server error'),
    });
  }
});

// 1. Dropdown Options (grades, classes, numbers) strictly from saved roster
app.get('/api/roster/options', (req, res) => {
  const gradesSet = new Set<number>();
  const classesByGrade: Record<number, Set<number>> = {};
  const numbersByClass: Record<string, Set<number>> = {};

  rosterStore.forEach((item) => {
    if (item.grade) {
      gradesSet.add(item.grade);
      if (!classesByGrade[item.grade]) classesByGrade[item.grade] = new Set();
      classesByGrade[item.grade].add(item.classNum);

      const classKey = `${item.grade}-${item.classNum}`;
      if (!numbersByClass[classKey]) numbersByClass[classKey] = new Set();
      numbersByClass[classKey].add(item.number);
    }
  });

  const grades = Array.from(gradesSet).sort((a, b) => a - b);
  const classesMap: Record<number, number[]> = {};
  grades.forEach((g) => {
    classesMap[g] = Array.from(classesByGrade[g] || []).sort((a, b) => a - b);
  });

  const numbersMap: Record<string, number[]> = {};
  grades.forEach((g) => {
    (classesMap[g] || []).forEach((c) => {
      const classKey = `${g}-${c}`;
      numbersMap[classKey] = Array.from(numbersByClass[classKey] || []).sort((a, b) => a - b);
    });
  });

  res.json({
    success: true,
    data: {
      grades,
      classesByGrade: classesMap,
      numbersByClass: numbersMap,
    },
  });
});

// 2. Verify Student
app.post('/api/auth/student', (req, res) => {
  const { grade, classNum, number, name } = req.body;
  const cleanName = String(name || '').trim();
  const normalizedInputName = normalizeName(cleanName);
  const studentKey = `${Number(grade)}-${Number(classNum)}-${Number(number)}`;

  const existing = progressStore.get(studentKey);

  const matchedRoster = rosterStore.find(
    (r) =>
      r.grade === Number(grade) &&
      r.classNum === Number(classNum) &&
      r.number === Number(number) &&
      normalizeName(r.name) === normalizedInputName
  );

  const matchedExisting = existing && normalizeName(existing.name) === normalizedInputName;

  if (!matchedRoster && !matchedExisting) {
    return res.status(401).json({
      success: false,
      message: '입력한 학생 정보를 확인할 수 없습니다.\n학년, 반, 번호, 이름을 다시 확인해 주세요.',
    });
  }

  const student: StudentInfo = {
    grade: Number(grade),
    classNum: Number(classNum),
    number: Number(number),
    name: matchedRoster ? matchedRoster.name : existing ? existing.name : cleanName,
    studentKey,
  };

  const hasExisting = Boolean(existing && (existing.step1?.roleModelName || existing.currentStep > 1));

  const progress: StudentProgress = existing || {
    studentKey,
    grade: student.grade,
    classNum: student.classNum,
    number: student.number,
    name: student.name,
    currentStep: 1,
    step1: {
      roleModelName: '',
      roleModelJob: '',
      roleModelReason: '',
      jobDescription: '',
      competencies: [],
      competencyCustom: '',
      careerHistory: '',
      strengths: [],
      strengthCustom: '',
      values: [],
      valueCustom: '',
      challengeExperience: '',
    },
    step2: {
      chatbotPurposes: [],
      targetUser: '이 직업에 관심 있는 중학생',
      targetUserCustom: '',
      expectedOutcome: '',
      purposeSummarySentence: '',
    },
    step3: {
      personalities: [],
      speakingStyle: '선배처럼 조언하듯이',
      honorificStyle: '친근한 존댓말',
      desiredFeeling: '',
      personalityRulesSummary: '',
    },
    step4: {
      answerLength: 'medium',
      answerElements: ['질문에 대한 핵심 답부터 말하기', '롤모델의 경험이나 사례 연결하기', '학생이 생각할 질문 던지기'],
    },
    step5: {
      quizAnswer: '',
      quizPassed: false,
      agreedToRules: false,
      checkedFactualityRules: [false, false, false, false, false],
      checkedDisclaimer: false,
      checkedSafetyRules: [false, false, false, false],
      allRulesChecked: false,
    },
    step6: {
      chatbotName: '',
      initialPrompt: '',
      revisedPrompt: '',
      finalPrompt: '',
      isConfirmed: false,
    },
    step8: {
      tests: {
        test1: { result: '', note: '' },
        test2: { result: '', note: '' },
        test3: { result: '', note: '' },
        test4: { result: '', note: '' },
        test5: { result: '', note: '' },
        test6: { result: '', note: '' },
      },
      problemDescription: '',
      revisionNote: '',
    },
    step10: {
      gemUrl: '',
      barrierAnswer: '',
      barrierReflection: '',
      decisionAnswer: '',
      decisionReflection: '',
      educationAnswer: '',
      educationReflection: '',
      finalCareerReflection: '',
      revisionSummary: '',
      sampleQuestion1: '',
      sampleAnswer1: '',
      sampleQuestion2: '',
      sampleAnswer2: '',
      sampleQuestion3: '',
      sampleAnswer3: '',
      reflection: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPromptCompleted: false,
    isTestCompleted: false,
    isGemSubmitted: false,
    isFinalSubmitted: false,
  };

  res.json({
    success: true,
    student,
    hasExisting,
    progress,
  });
});

// 3. Save Student Progress
app.post('/api/student/save-step', (req, res) => {
  const { progress } = req.body;
  if (!progress || !progress.studentKey) {
    return res.status(400).json({ success: false, message: 'Invalid data' });
  }

  const now = new Date().toISOString();
  progress.updatedAt = now;

  progressStore.set(progress.studentKey, progress);

  res.json({
    success: true,
    savedAt: now,
  });
});

// 4. Reset Student Progress
app.post('/api/student/reset', (req, res) => {
  const { studentKey } = req.body;
  if (studentKey) {
    progressStore.delete(studentKey);
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// Admin Authentication & Session Management Endpoints
// -------------------------------------------------------------

// Admin Login: verifies ADMIN_PASSWORD from process.env strictly
app.post('/api/admin/login', (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredPassword || typeof configuredPassword !== 'string' || configuredPassword.trim() === '') {
    return res.status(500).json({
      success: false,
      message: '서버에 관리자 비밀번호(ADMIN_PASSWORD) 설정이 필요합니다. Vercel 환경변수를 설정해 주세요.',
    });
  }

  const { password } = req.body || {};
  if (!password || String(password) !== String(configuredPassword)) {
    return res.status(401).json({
      success: false,
      message: '관리자 비밀번호가 올바르지 않습니다.',
    });
  }

  const sessionToken = generateAdminSessionToken();
  const maxAge = 8 * 60 * 60; // 8 hours in seconds
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  const cookieOptions = [
    `admin_session=${sessionToken}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isProd) {
    cookieOptions.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieOptions.join('; '));

  return res.json({
    success: true,
    token: sessionToken,
    message: '관리자 로그인이 완료되었습니다.',
  });
});

// Admin Session Check
app.get('/api/admin/session', (req, res) => {
  const token = extractAdminToken(req);
  const result = verifyAdminSessionToken(token);

  if (!result.valid) {
    return res.status(401).json({
      authenticated: false,
      message: result.message || '인증되지 않았습니다.',
    });
  }

  return res.json({
    authenticated: true,
  });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax');
  return res.json({ success: true, message: '로그아웃되었습니다.' });
});

// -------------------------------------------------------------
// Protected Admin Endpoints (Require requireAdminAuth)
// -------------------------------------------------------------

// Admin Dashboard & Student List: calls Google Apps Script via server with ADMIN_API_SECRET
app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const gasData = await callServerGas({ action: 'getAdminDashboard' });
    if (gasData && gasData.success) {
      return res.json(gasData);
    }
    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script에서 대시보드 데이터를 가져오지 못했습니다.',
    });
  } catch (err: any) {
    console.error('Admin dashboard fetch error:', err);
    return res.status(500).json({
      success: false,
      message: '관리자 대시보드 조회 실패: ' + (err?.message || 'Server error'),
    });
  }
});

// Admin Student Detail: calls Google Apps Script getStudentDetail
app.get('/api/admin/student-detail', requireAdminAuth, async (req, res) => {
  try {
    const studentKey = String(req.query.studentKey || '').trim();
    if (!studentKey) {
      return res.status(400).json({ success: false, message: 'studentKey 파라미터가 필요합니다.' });
    }

    const gasData = await callServerGas({
      action: 'getStudentDetail',
      studentKey,
    });

    if (gasData && gasData.success) {
      return res.json(gasData);
    }
    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script에서 학생 상세 정보를 가져오지 못했습니다.',
    });
  } catch (err: any) {
    console.error('Admin student-detail fetch error:', err);
    return res.status(500).json({
      success: false,
      message: '학생 상세 조회 실패: ' + (err?.message || 'Server error'),
    });
  }
});

// Admin Update Roster: modifies Google Sheets Roster securely
app.post('/api/admin/update-roster', requireAdminAuth, async (req, res) => {
  try {
    const { students, mode } = req.body || {};
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: '학생 명단(students) 배열이 필요합니다.' });
    }

    const gasData = await callServerGas({
      action: 'updateRoster',
      students,
      mode: mode || 'replace',
    });

    if (gasData && gasData.success) {
      // Sync in-memory store
      if (mode === 'replace') {
        rosterStore = students;
      } else {
        const existingKeys = new Set(rosterStore.map((e) => `${e.grade}-${e.classNum}-${e.number}`));
        students.forEach((item: any) => {
          const key = `${item.grade}-${item.classNum || item.class}-${item.number}`;
          if (!existingKeys.has(key)) {
            rosterStore.push({
              grade: item.grade,
              classNum: item.classNum || item.class,
              number: item.number,
              name: item.name,
            });
          }
        });
      }

      return res.json(gasData);
    }

    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script 학생 명단 수정에 실패했습니다.',
    });
  } catch (err: any) {
    console.error('Admin update-roster error:', err);
    return res.status(500).json({
      success: false,
      message: '학생 명단 저장 실패: ' + (err?.message || 'Server error'),
    });
  }
});

// Admin Delete Roster Students: deletes specified students from Google Sheets Roster securely
app.post('/api/admin/delete-roster', requireAdminAuth, async (req, res) => {
  try {
    const { students } = req.body || {};
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: '삭제할 학생 명단(students) 배열이 필요합니다.' });
    }

    const gasData = await callServerGas({
      action: 'deleteRosterStudents',
      students,
    });

    if (gasData && gasData.success) {
      // Sync in-memory rosterStore
      const deleteKeys = new Set(
        students.map((s: any) => `${Number(s.grade)}-${Number(s.classNum !== undefined ? s.classNum : s.class)}-${Number(s.number)}`)
      );
      rosterStore = rosterStore.filter(
        (r) => !deleteKeys.has(`${Number(r.grade)}-${Number(r.classNum)}-${Number(r.number)}`)
      );

      return res.json(gasData);
    }

    return res.status(502).json({
      success: false,
      message: gasData?.message || 'Google Apps Script 학생 명단 삭제에 실패했습니다.',
    });
  } catch (err: any) {
    console.error('Admin delete-roster error:', err);
    return res.status(500).json({
      success: false,
      message: '학생 명단 삭제 실패: ' + (err?.message || 'Server error'),
    });
  }
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start server when run directly as the main process
if (process.env.RUN_SERVER === 'true' || (process.argv[1] && process.argv[1].endsWith('server.ts'))) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
