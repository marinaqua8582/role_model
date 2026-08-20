import {
  StudentInfo,
  StudentProgress,
  RosterItem,
  DashboardStats,
  FinalSubmissionData,
  TestData,
} from '../types';

const STORAGE_PREFIX = 'rolemodel_chatbot_';
const ROSTER_KEY = `${STORAGE_PREFIX}roster`;
const PROGRESS_MAP_KEY = `${STORAGE_PREFIX}progress_map`;
const GAS_URL_KEY = `${STORAGE_PREFIX}gas_url`;

// Default roster starts empty (no dummy data)
export const DEFAULT_ROSTER: RosterItem[] = [];

function getStoredRoster(): RosterItem[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // If legacy storage still contains default 56 dummy students (starts with 강민서 and ends with 황지민), clear it
      if (Array.isArray(parsed) && parsed.length === 56 && parsed[0]?.name === '강민서' && parsed[27]?.name === '조유진') {
        localStorage.removeItem(ROSTER_KEY);
        return [];
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error reading roster from storage', e);
  }
  return DEFAULT_ROSTER;
}

function saveStoredRoster(roster: RosterItem[]) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Error saving roster to storage', e);
  }
}

function getStoredProgressMap(): Record<string, StudentProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_MAP_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading progress map', e);
  }
  return {};
}

function saveStoredProgressMap(map: Record<string, StudentProgress>) {
  try {
    localStorage.setItem(PROGRESS_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving progress map', e);
  }
}

export function createInitialStudentProgress(student: StudentInfo): StudentProgress {
  const now = new Date().toISOString();
  return {
    studentKey: student.studentKey,
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
    createdAt: now,
    updatedAt: now,
    isPromptCompleted: false,
    isTestCompleted: false,
    isGemSubmitted: false,
    isFinalSubmitted: false,
  };
}

export function normalizeKoreanName(name: string): string {
  return String(name || '').trim().normalize('NFC').replace(/\s+/g, '');
}

/**
 * Get Roster selection options (Grades, Classes, Numbers) without leaking student names
 */
export async function getRosterOptions(): Promise<{
  grades: number[];
  classesByGrade: Record<number, number[]>;
  numbersByClass: Record<string, number[]>;
}> {
  try {
    const res = await fetch('/api/roster/options');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data && json.data.grades && json.data.grades.length > 0) {
        return json.data;
      }
    }
  } catch (e) {
    // Fallback to local storage
  }

  const roster = getStoredRoster();
  const gradesSet = new Set<number>();
  const classesByGrade: Record<number, Set<number>> = {};
  const numbersByClass: Record<string, Set<number>> = {};

  roster.forEach(item => {
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

  return { grades, classesByGrade: classesMap, numbersByClass: numbersMap };
}

/**
 * Verify Student identity
 */
export async function verifyStudentAuth(params: {
  grade: number;
  classNum: number;
  number: number;
  name: string;
}): Promise<{
  success: boolean;
  message?: string;
  student?: StudentInfo;
  hasExisting?: boolean;
  progress?: StudentProgress;
}> {
  const cleanName = params.name.trim();
  const normalizedInputName = normalizeKoreanName(cleanName);
  const studentKey = `${params.grade}-${params.classNum}-${params.number}`;
  const localMap = getStoredProgressMap();
  const localExisting = localMap[studentKey];

  // Try server API first
  try {
    const res = await fetch('/api/auth/student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, name: cleanName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.student) {
        let finalProgress = data.progress;
        if (!finalProgress && localExisting) {
          finalProgress = localExisting;
        } else if (localExisting && finalProgress) {
          const localTime = new Date(localExisting.updatedAt || 0).getTime();
          const serverTime = new Date(finalProgress.updatedAt || 0).getTime();
          if (localTime > serverTime) {
            finalProgress = localExisting;
          }
        }

        if (!finalProgress) {
          finalProgress = createInitialStudentProgress(data.student);
        }

        // Cache in local storage as well
        localMap[data.student.studentKey] = finalProgress;
        saveStoredProgressMap(localMap);

        const hasExisting = Boolean(
          finalProgress && (finalProgress.step1?.roleModelName || finalProgress.currentStep > 1)
        );

        return {
          success: true,
          student: data.student,
          hasExisting,
          progress: finalProgress,
        };
      }
    }
  } catch (e) {
    // offline / fallback
  }

  // Fallback to local roster and local progress map
  const roster = getStoredRoster();
  const matchedRoster = roster.find(
    r => r.grade === params.grade &&
         r.classNum === params.classNum &&
         r.number === params.number &&
         normalizeKoreanName(r.name) === normalizedInputName
  );

  const matchedLocalProgress = localExisting && normalizeKoreanName(localExisting.name) === normalizedInputName;

  if (!matchedRoster && !matchedLocalProgress) {
    return {
      success: false,
      message: '입력한 학생 정보를 확인할 수 없습니다.\n학년, 반, 번호, 이름을 다시 확인해 주세요.',
    };
  }

  const student: StudentInfo = {
    grade: params.grade,
    classNum: params.classNum,
    number: params.number,
    name: matchedRoster ? matchedRoster.name : (localExisting ? localExisting.name : cleanName),
    studentKey,
  };

  const progress = localExisting || createInitialStudentProgress(student);
  const hasExisting = Boolean(progress && (progress.step1?.roleModelName || progress.currentStep > 1));

  // Save to local map
  localMap[studentKey] = progress;
  saveStoredProgressMap(localMap);

  return {
    success: true,
    student,
    hasExisting,
    progress,
  };
}

/**
 * Save Student Progress (Auto-save)
 */
export async function saveStudentProgress(progress: StudentProgress): Promise<{ success: boolean; savedAt: string }> {
  const now = new Date().toISOString();
  progress.updatedAt = now;

  // Determine completion flags
  progress.isPromptCompleted = Boolean(progress.step6?.finalPrompt && progress.step6.finalPrompt.length > 50);
  const tests = progress.step8?.tests;
  progress.isTestCompleted = Boolean(
    tests && tests.test1?.result && tests.test2?.result && tests.test3?.result && tests.test4?.result && tests.test5?.result && tests.test6?.result
  );
  progress.isGemSubmitted = Boolean(progress.step10?.gemUrl && progress.step10.gemUrl.trim());
  progress.isFinalSubmitted = Boolean(progress.isGemSubmitted && progress.step10?.sampleQuestion1 && progress.step10?.reflection);

  // Update local storage
  const map = getStoredProgressMap();
  map[progress.studentKey] = progress;
  saveStoredProgressMap(map);

  // Attempt server sync
  try {
    const res = await fetch('/api/student/save-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, savedAt: data.savedAt || now };
    }
  } catch (e) {
    // local saved is fine
  }

  return { success: true, savedAt: now };
}

/**
 * Reset student progress back to step 1
 */
export async function resetStudentProgress(student: StudentInfo): Promise<StudentProgress> {
  const newProgress = createInitialStudentProgress(student);
  const map = getStoredProgressMap();
  map[student.studentKey] = newProgress;
  saveStoredProgressMap(map);

  try {
    await fetch('/api/student/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentKey: student.studentKey }),
    });
  } catch (e) {}

  return newProgress;
}

/**
 * Admin: Verify password
 */
export async function verifyAdminPassword(password: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {}

  // Fallback check
  if (password === 'admin') {
    return { success: true };
  }
  return { success: false, message: '관리자 비밀번호가 올바르지 않습니다.' };
}

/**
 * Admin: Get Dashboard Stats & Student List
 */
export async function getAdminData(): Promise<{
  stats: DashboardStats;
  students: StudentProgress[];
  roster: RosterItem[];
}> {
  try {
    const res = await fetch('/api/admin/data');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return data.data;
      }
    }
  } catch (e) {}

  // Compute from local storage
  const roster = getStoredRoster();
  const map = getStoredProgressMap();

  const students: StudentProgress[] = roster.map(r => {
    const key = `${r.grade}-${r.classNum}-${r.number}`;
    if (map[key]) return map[key];
    const initial = createInitialStudentProgress({ ...r, studentKey: key });
    return initial;
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

  return {
    stats: {
      totalStudents,
      startedStudents,
      inProgressStudents,
      promptCompletedStudents,
      gemCreatedStudents: students.filter(s => s.currentStep >= 7).length,
      testCompletedStudents,
      finalSubmittedStudents,
      byClass,
    },
    students,
    roster,
  };
}

/**
 * Admin: Update Roster (Replace or Append)
 */
export async function updateAdminRoster(newRoster: RosterItem[], mode: 'replace' | 'append'): Promise<{ success: boolean; count: number }> {
  let finalRoster: RosterItem[] = [];
  if (mode === 'replace') {
    finalRoster = newRoster;
  } else {
    const existing = getStoredRoster();
    const existingKeys = new Set(existing.map(e => `${e.grade}-${e.classNum}-${e.number}`));
    finalRoster = [...existing];
    newRoster.forEach(item => {
      const key = `${item.grade}-${item.classNum}-${item.number}`;
      if (!existingKeys.has(key)) {
        finalRoster.push(item);
      }
    });
  }

  saveStoredRoster(finalRoster);

  try {
    await fetch('/api/admin/roster/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: finalRoster, mode }),
    });
  } catch (e) {}

  return { success: true, count: finalRoster.length };
}

/**
 * Optional Google Apps Script URL configuration
 */
export async function fetchRoster(): Promise<RosterItem[]> {
  const data = await getAdminData();
  return data.roster || getStoredRoster();
}

export async function fetchStudentProgress(studentKey: string): Promise<StudentProgress | null> {
  const map = getStoredProgressMap();
  return map[studentKey] || null;
}

export async function fetchAdminOverview(): Promise<{
  stats: DashboardStats;
  students: StudentProgress[];
  roster: RosterItem[];
}> {
  return getAdminData();
}

export function getStoredGasUrl(): string {
  return localStorage.getItem(GAS_URL_KEY) || '';
}

export function setStoredGasUrl(url: string) {
  localStorage.setItem(GAS_URL_KEY, url.trim());
}
