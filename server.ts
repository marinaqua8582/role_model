import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { RosterItem, StudentProgress, StudentInfo, DashboardStats } from './src/types/index';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

app.use(express.json({ limit: '10mb' }));

// In-memory store initialized empty (no dummy student data)
let rosterStore: RosterItem[] = [];

const progressStore = new Map<string, StudentProgress>();

function normalizeName(name: any): string {
  return String(name || '').trim().normalize('NFC').replace(/\s+/g, '');
}

// API Routes

// 1. Get Dropdown Options (grades, classes, numbers) strictly from saved roster - No student names returned
app.get('/api/roster/options', (req, res) => {
  const gradesSet = new Set<number>();
  const classesByGrade: Record<number, Set<number>> = {};
  const numbersByClass: Record<string, Set<number>> = {};

  rosterStore.forEach(item => {
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
  grades.forEach(g => {
    classesMap[g] = Array.from(classesByGrade[g] || []).sort((a, b) => a - b);
  });

  const numbersMap: Record<string, number[]> = {};
  grades.forEach(g => {
    (classesMap[g] || []).forEach(c => {
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
    r => r.grade === Number(grade) &&
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
    name: matchedRoster ? matchedRoster.name : (existing ? existing.name : cleanName),
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
      sampleQuestion1: '',
      sampleAnswer1: '',
      sampleQuestion2: '',
      sampleAnswer2: '',
      sampleQuestion3: '',
      sampleAnswer3: '',
      revisionSummary: '',
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

// 5. Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: '관리자 비밀번호가 올바르지 않습니다.' });
});

// 6. Admin Data (Dashboard Stats & Student List)
app.get('/api/admin/data', (req, res) => {
  const students: StudentProgress[] = rosterStore.map(r => {
    const key = `${r.grade}-${r.classNum}-${r.number}`;
    if (progressStore.has(key)) {
      return progressStore.get(key)!;
    }
    const now = new Date().toISOString();
    return {
      studentKey: key,
      grade: r.grade,
      classNum: r.classNum,
      number: r.number,
      name: r.name,
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
        sampleQuestion1: '',
        sampleAnswer1: '',
        sampleQuestion2: '',
        sampleAnswer2: '',
        sampleQuestion3: '',
        sampleAnswer3: '',
        revisionSummary: '',
        reflection: '',
      },
      createdAt: now,
      updatedAt: now,
      isPromptCompleted: false,
      isTestCompleted: false,
      isGemSubmitted: false,
      isFinalSubmitted: false,
    };
  });

  const totalStudents = students.length;
  let startedStudents = 0;
  let inProgressStudents = 0;
  let promptCompletedStudents = 0;
  let gemCreatedStudents = 0;
  let testCompletedStudents = 0;
  let finalSubmittedStudents = 0;

  const classMap = new Map<string, {
    grade: number;
    classNum: number;
    total: number;
    notStarted: number;
    inProgress: number;
    promptCompleted: number;
    testing: number;
    submitted: number;
  }>();

  students.forEach(s => {
    const cKey = `${s.grade}-${s.classNum}`;
    if (!classMap.has(cKey)) {
      classMap.set(cKey, {
        grade: s.grade,
        classNum: s.classNum,
        total: 0,
        notStarted: 0,
        inProgress: 0,
        promptCompleted: 0,
        testing: 0,
        submitted: 0,
      });
    }
    const cStat = classMap.get(cKey)!;
    cStat.total++;

    const hasStarted = Boolean(s.step1?.roleModelName || s.currentStep > 1);
    if (hasStarted) {
      startedStudents++;
    } else {
      cStat.notStarted++;
    }

    if (s.isFinalSubmitted) {
      finalSubmittedStudents++;
      cStat.submitted++;
    } else if (s.isTestCompleted || s.currentStep >= 8) {
      testCompletedStudents++;
      cStat.testing++;
    } else if (s.isPromptCompleted || s.currentStep >= 6) {
      promptCompletedStudents++;
      cStat.promptCompleted++;
    } else if (hasStarted) {
      inProgressStudents++;
      cStat.inProgress++;
    }
  });

  const byClass = Array.from(classMap.values()).sort((a, b) => {
    if (a.grade !== b.grade) return a.grade - b.grade;
    return a.classNum - b.classNum;
  });

  const stats: DashboardStats = {
    totalStudents,
    startedStudents,
    inProgressStudents,
    promptCompletedStudents,
    gemCreatedStudents: students.filter(s => s.currentStep >= 7).length,
    testCompletedStudents,
    finalSubmittedStudents,
    byClass,
  };

  res.json({
    success: true,
    data: {
      stats,
      students,
      roster: rosterStore,
    },
  });
});

// 7. Admin Apply Roster
app.post('/api/admin/roster/apply', (req, res) => {
  const { roster } = req.body;
  if (Array.isArray(roster)) {
    rosterStore = roster;
    res.json({ success: true, count: rosterStore.length });
  } else {
    res.status(400).json({ success: false, message: 'Invalid roster data' });
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
