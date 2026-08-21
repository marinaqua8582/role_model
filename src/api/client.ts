import {
  StudentInfo,
  StudentProgress,
  RoleModelData,
  ChatbotPurposeData,
  PersonalityData,
  ResponseStyleData,
  SafetyRuleData,
  PromptData,
  RosterItem,
  DashboardStats,
  FinalSubmissionData,
  TestData,
} from '../types';
import {
  normalizeCompetencies,
  normalizeStrengths,
  normalizeValues,
  normalizeChatbotPurposes,
  normalizePersonalities,
  normalizeAnswerElements,
} from '../utils/normalizer';

const STORAGE_PREFIX = 'rolemodel_chatbot_';
const ROSTER_KEY = `${STORAGE_PREFIX}roster`;
const PROGRESS_MAP_KEY = `${STORAGE_PREFIX}progress_map`;
const GAS_URL_KEY = `${STORAGE_PREFIX}gas_url`;

// Default roster starts empty (no dummy data)
export const DEFAULT_ROSTER: RosterItem[] = [];

export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzmtB28cj27SglDkQepd1DGlRRrv57LIRLipACLXRS1rSSiT0fPVtdrcNebKFg9X3nl/exec';

export function getEffectiveGasUrl(): string {
  const envUrl = ((import.meta as any)?.env?.VITE_GAS_URL as string | undefined)?.trim();
  if (envUrl) return envUrl;

  const stored = getStoredGasUrl().trim();
  if (stored) return stored;

  return DEFAULT_GAS_URL;
}

/**
 * Execute request to Google Apps Script
 * Tries server-side proxy first (bypasses browser CORS & 302 redirect blocking),
 * and falls back to direct client fetch if needed.
 */
export async function callGasApi(payload: Record<string, any>): Promise<any> {
  const gasUrl = getEffectiveGasUrl();
  if (!gasUrl) {
    throw new Error('Google Apps Script URL이 설정되지 않았습니다.');
  }

  // 1. Primary: Use backend server proxy to reliably handle Google Apps Script 302 redirect & CORS
  try {
    const proxyRes = await fetch('/api/gas-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gasUrl,
        ...payload,
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      return data;
    }
  } catch (proxyErr) {
    console.warn('Backend GAS proxy failed, attempting direct fetch fallback:', proxyErr);
  }

  // 2. Direct browser fetch fallback
  const directRes = await fetch(gasUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (directRes.ok) {
    return await directRes.json();
  }

  throw new Error(`Google Apps Script 서버 응답 오류 (HTTP ${directRes.status})`);
}

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
  const gasUrl = getEffectiveGasUrl();

  // 1. Primary: Query Google Apps Script (Google Sheets Roster)
  if (gasUrl) {
    try {
      const json = await callGasApi({ action: 'getRosterOptions' });

      // Standard format: { success: true, data: { grades, classesByGrade, numbersByClass } }
      if (json && json.success && json.data && Array.isArray(json.data.grades)) {
        const grades = json.data.grades.map(Number).sort((a: number, b: number) => a - b);
        const classesByGrade: Record<number, number[]> = {};
        Object.keys(json.data.classesByGrade || {}).forEach((k) => {
          classesByGrade[Number(k)] = (json.data.classesByGrade[k] || [])
            .map(Number)
            .sort((a: number, b: number) => a - b);
        });
        const numbersByClass: Record<string, number[]> = {};
        Object.keys(json.data.numbersByClass || {}).forEach((k) => {
          numbersByClass[k] = (json.data.numbersByClass[k] || [])
            .map(Number)
            .sort((a: number, b: number) => a - b);
        });

        if (grades.length > 0) {
          return { grades, classesByGrade, numbersByClass };
        }
      }

      // Alternative format: { success: true, options: { [grade]: { [class]: [numbers] } } }
      if (json && json.success && json.options && typeof json.options === 'object') {
        const grades = Object.keys(json.options)
          .map(Number)
          .sort((a, b) => a - b);
        const classesByGrade: Record<number, number[]> = {};
        const numbersByClass: Record<string, number[]> = {};

        grades.forEach((g) => {
          const classKeys = Object.keys(json.options[g] || {})
            .map(Number)
            .sort((a, b) => a - b);
          classesByGrade[g] = classKeys;
          classKeys.forEach((c) => {
            const classKey = `${g}-${c}`;
            numbersByClass[classKey] = (json.options[g][c] || [])
              .map(Number)
              .sort((a, b) => a - b);
          });
        });

        if (grades.length > 0) {
          return { grades, classesByGrade, numbersByClass };
        }
      }
    } catch (e) {
      console.warn('Error fetching roster options from Google Apps Script:', e);
    }
  }

  // 2. Fallback: check local server API or local storage
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

  roster.forEach((item) => {
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

  return { grades, classesByGrade: classesMap, numbersByClass: numbersMap };
}

/**
 * Verify Student identity
 */
export function parseCommaArray(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function mapSheetDataToProgress(raw: any): StudentProgress {
  const grade = Number(raw.grade) || 1;
  const classNum = Number(raw.class !== undefined ? raw.class : raw.classNum) || 1;
  const number = Number(raw.number) || 1;
  const name = String(raw.name || '').trim();
  const studentKey = String(raw.studentKey || `${grade}-${classNum}-${number}`);

  const competencies = normalizeCompetencies(raw.competencies);
  const strengths = normalizeStrengths(raw.strengths);
  const values = normalizeValues(raw.values);
  const chatbotPurposes = normalizeChatbotPurposes(raw.chatbotPurposes);
  const personalities = normalizePersonalities(raw.personality || raw.personalities);
  const answerElements = normalizeAnswerElements(raw.answerElements);

  let answerLength: 'short' | 'medium' | 'detailed' = 'medium';
  const rawLen = String(raw.answerLength || '');
  if (rawLen.includes('short') || rawLen.includes('2~3') || rawLen.includes('짧고')) {
    answerLength = 'short';
  } else if (rawLen.includes('detailed') || rawLen.includes('자세')) {
    answerLength = 'detailed';
  } else {
    answerLength = 'medium';
  }

  let honorificStyle: '친근한 존댓말' | '차분한 존댓말' | '정중한 존댓말' = '친근한 존댓말';
  const rawHon = String(raw.honorificStyle || '');
  if (rawHon.includes('차분한')) {
    honorificStyle = '차분한 존댓말';
  } else if (rawHon.includes('정중한')) {
    honorificStyle = '정중한 존댓말';
  } else {
    honorificStyle = '친근한 존댓말';
  }

  const currentStep = Number(raw.currentStep) || 1;

  const targetUserRaw = String(raw.targetUser || '').trim();
  let targetUser = targetUserRaw || '이 직업에 관심 있는 중학생';
  let targetUserCustom = '';
  const knownTargets = [
    '이 직업에 관심 있는 중학생',
    '진로를 아직 정하지 못한 중학생',
    '롤모델의 삶과 경험이 궁금한 학생',
    '나와 비슷한 고민을 하는 학생',
  ];
  if (targetUserRaw && !knownTargets.includes(targetUserRaw)) {
    targetUser = '기타';
    targetUserCustom = targetUserRaw;
  }

  const initialPrompt = String(raw.initialPrompt || '').trim();
  const revisedPrompt = String(raw.revisedPrompt || '').trim();
  const finalPrompt = String(raw.finalPrompt || '').trim();
  const chatbotName = String(raw.chatbotName || '').trim();

  return {
    studentKey,
    grade,
    classNum,
    number,
    name,
    currentStep,
    step1: {
      roleModelName: String(raw.roleModelName || '').trim(),
      roleModelJob: String(raw.roleModelJob || '').trim(),
      roleModelReason: String(raw.roleModelReason || '').trim(),
      jobDescription: String(raw.jobDescription || '').trim(),
      competencies,
      competencyCustom: '',
      careerHistory: String(raw.careerHistory || '').trim(),
      strengths,
      strengthCustom: '',
      values,
      valueCustom: '',
      challengeExperience: String(raw.challengeExperience || '').trim(),
    },
    step2: {
      chatbotPurposes,
      targetUser,
      targetUserCustom,
      expectedOutcome: String(raw.expectedOutcome || '').trim(),
      purposeSummarySentence: String(raw.purposeSummarySentence || '').trim(),
    },
    step3: {
      personalities,
      speakingStyle: String(raw.speakingStyle || '멘토처럼 따뜻하게').trim(),
      honorificStyle,
      desiredFeeling: String(raw.desiredFeeling || '').trim(),
      personalityRulesSummary: '',
    },
    step4: {
      answerLength,
      answerElements,
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
      chatbotName,
      initialPrompt,
      revisedPrompt,
      finalPrompt,
      isConfirmed: Boolean(finalPrompt),
    },
    step8: {
      tests: {},
      problemDescription: '',
      revisionNote: '',
      testedAt: '',
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
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    isPromptCompleted: Boolean(finalPrompt || currentStep >= 6),
    isTestCompleted: false,
    isGemSubmitted: false,
    isFinalSubmitted: false,
  };
}

/**
 * Load student progress directly from Google Apps Script (loadProgress action)
 */
export async function loadStudentProgress(
  studentKey: string
): Promise<{ success: boolean; found: boolean; progress?: StudentProgress; message?: string }> {
  const gasUrl = getEffectiveGasUrl();
  if (gasUrl) {
    try {
      const res = await callGasApi({
        action: 'loadProgress',
        studentKey,
      });

      if (res && res.success) {
        if (res.found && res.data) {
          const raw = res.data;
          const restoredProgress = mapSheetDataToProgress(raw);
          // Sync local storage cache
          const localMap = getStoredProgressMap();
          localMap[studentKey] = restoredProgress;
          saveStoredProgressMap(localMap);

          return {
            success: true,
            found: true,
            progress: restoredProgress,
          };
        } else {
          return {
            success: true,
            found: false,
          };
        }
      }
    } catch (err) {
      console.warn('Error loading progress from GAS:', err);
    }
  }

  // Fallback to local cache if no GAS or GAS not reachable
  const localMap = getStoredProgressMap();
  const local = localMap[studentKey];
  if (local && (local.step1?.roleModelName || local.currentStep > 1)) {
    return {
      success: true,
      found: true,
      progress: local,
    };
  }

  return {
    success: true,
    found: false,
  };
}

/**
 * Verify Student Auth and load existing progress
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
  const studentKey = `${params.grade}-${params.classNum}-${params.number}`;
  const gasUrl = getEffectiveGasUrl();

  // 1. When Google Apps Script URL is set: Authenticate directly against Google Sheets Roster
  if (gasUrl) {
    try {
      const payload = {
        action: 'verifyStudent',
        grade: Number(params.grade),
        classNo: Number(params.classNum),
        classNum: Number(params.classNum),
        number: Number(params.number),
        name: cleanName,
      };

      const data = await callGasApi(payload);

      if (data && data.success && data.student) {
        const student: StudentInfo = {
          grade: Number(data.student.grade || params.grade),
          classNum: Number(data.student.classNum || data.student.classNo || params.classNum),
          number: Number(data.student.number || params.number),
          name: data.student.name || cleanName,
          studentKey: data.student.studentKey || studentKey,
        };

        // Call loadProgress action to get fresh progress from Progress sheet
        const loadRes = await loadStudentProgress(student.studentKey);

        let finalProgress = loadRes.progress;
        const localMap = getStoredProgressMap();
        const localExisting = localMap[student.studentKey];

        if (!finalProgress && data.progress) {
          finalProgress = mapSheetDataToProgress(data.progress);
        } else if (!finalProgress && localExisting) {
          finalProgress = localExisting;
        }

        const hasExisting = Boolean(
          loadRes.found ||
            data.hasExisting ||
            (finalProgress && (finalProgress.step1?.roleModelName || finalProgress.currentStep > 1))
        );

        if (!finalProgress) {
          finalProgress = createInitialStudentProgress(student);
        }

        // Cache verified progress in local storage
        localMap[student.studentKey] = finalProgress;
        saveStoredProgressMap(localMap);

        return {
          success: true,
          student,
          hasExisting,
          progress: finalProgress,
        };
      } else {
        // Explicit failure from Google Sheets verification
        return {
          success: false,
          message: data?.message || '학생 정보를 확인할 수 없습니다.\n학년, 반, 번호, 이름을 다시 확인해 주세요.',
        };
      }
    } catch (err: any) {
      console.error('Error verifying student with Google Apps Script:', err);
      return {
        success: false,
        message: 'Google Apps Script 연결 중 오류가 발생했습니다: ' + (err?.message || '잠시 후 다시 시도해 주세요.'),
      };
    }
  }

  // 2. Standalone fallback (only if NO GAS URL is configured)
  const normalizedInputName = normalizeKoreanName(cleanName);
  const localMap = getStoredProgressMap();
  const localExisting = localMap[studentKey];

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

  const roster = getStoredRoster();
  const matchedRoster = roster.find(
    (r) =>
      r.grade === params.grade &&
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
 * Common internal function to save progress payload to Google Apps Script
 */
export async function saveProgressPayload(
  payload: Record<string, any>
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const gasUrl = getEffectiveGasUrl();
  const studentKey = payload.studentKey;

  // 1. Google Apps Script is configured: Must verify real Google Sheets response
  if (gasUrl) {
    try {
      const res = await callGasApi({
        action: 'saveProgress',
        ...payload,
      });

      if (res && res.success) {
        return {
          success: true,
          message: res.message || '진행 상황이 저장되었습니다.',
          studentKey,
        };
      } else {
        return {
          success: false,
          message: res?.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        };
      }
    } catch (err: any) {
      console.error('Error saving progress to Google Apps Script:', err);
      return {
        success: false,
        message: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }

  // 2. Standalone fallback (only when no GAS URL is set)
  return {
    success: true,
    message: '진행 상황이 저장되었습니다.',
    studentKey,
  };
}

/**
 * Save STEP 1 Role Model Progress directly to Google Apps Script (Google Sheets Progress sheet)
 */
export async function saveStep1Progress(
  student: StudentInfo,
  data: RoleModelData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  // Clean and combine custom values with array selections
  const competencies = [...(data.competencies || [])];
  if (data.competencyCustom?.trim() && !competencies.includes(data.competencyCustom.trim())) {
    competencies.push(data.competencyCustom.trim());
  }

  const strengths = [...(data.strengths || [])];
  if (data.strengthCustom?.trim() && !strengths.includes(data.strengthCustom.trim())) {
    strengths.push(data.strengthCustom.trim());
  }

  const values = [...(data.values || [])];
  if (data.valueCustom?.trim() && !values.includes(data.valueCustom.trim())) {
    values.push(data.valueCustom.trim());
  }

  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 1,
    roleModelName: (data.roleModelName || '').trim(),
    roleModelJob: (data.roleModelJob || '').trim(),
    roleModelReason: (data.roleModelReason || '').trim(),
    jobDescription: (data.jobDescription || '').trim(),
    competencies,
    careerHistory: (data.careerHistory || '').trim(),
    strengths,
    values,
    challengeExperience: (data.challengeExperience || '').trim(),
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 1);
    existing.step1 = {
      ...data,
      competencies,
      strengths,
      values,
    };
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 2 Chatbot Purpose directly to Google Apps Script
 */
export async function saveStep2Progress(
  student: StudentInfo,
  data: ChatbotPurposeData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const targetUser =
    data.targetUser === '기타' && data.targetUserCustom?.trim()
      ? data.targetUserCustom.trim()
      : data.targetUser || '';

  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 2,
    chatbotPurposes: data.chatbotPurposes || [],
    targetUser,
    expectedOutcome: (data.expectedOutcome || '').trim(),
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 2);
    existing.step2 = { ...data };
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 3 Personality & Speaking Style directly to Google Apps Script
 */
export async function saveStep3Progress(
  student: StudentInfo,
  data: PersonalityData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 3,
    personality: data.personalities || [],
    speakingStyle: (data.speakingStyle || '').trim(),
    honorificStyle: data.honorificStyle || '친근한 존댓말',
    desiredFeeling: (data.desiredFeeling || '').trim(),
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 3);
    existing.step3 = { ...data };
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 4 Response Rules directly to Google Apps Script
 */
export async function saveStep4Progress(
  student: StudentInfo,
  data: ResponseStyleData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const lengthLabelMap: Record<string, string> = {
    short: '2~3문장',
    medium: '4~6문장',
    detailed: '필요할 때 자세하게',
  };
  const answerLengthStr = lengthLabelMap[data.answerLength] || data.answerLength;

  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 4,
    answerLength: answerLengthStr,
    answerElements: data.answerElements || [],
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 4);
    existing.step4 = { ...data };
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 5 Safety & Factuality completion to Google Apps Script
 */
export async function saveStep5Progress(
  student: StudentInfo,
  data?: SafetyRuleData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 5,
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 5);
    existing.step5 = {
      ...(data || existing.step5),
      agreedToRules: true,
      quizPassed: true,
      allRulesChecked: true,
    };
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 6 Final Prompt directly to Google Apps Script
 */
export async function saveStep6Progress(
  student: StudentInfo,
  data: PromptData
): Promise<{ success: boolean; message?: string; studentKey?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const initialPrompt = (data.initialPrompt || '').trim();
  const revisedPrompt = (data.revisedPrompt || '').trim();
  const finalPrompt = (data.finalPrompt || data.revisedPrompt || data.initialPrompt || '').trim();

  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 6,
    chatbotName: (data.chatbotName || '').trim(),
    initialPrompt,
    revisedPrompt,
    finalPrompt,
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, 6);
    existing.step6 = {
      ...data,
      chatbotName: data.chatbotName,
      initialPrompt,
      revisedPrompt,
      finalPrompt,
      isConfirmed: true,
    };
    existing.isPromptCompleted = true;
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Update Student's Current Step in Google Apps Script and local storage
 */
export async function updateCurrentStep(
  student: StudentInfo,
  step: number
): Promise<{ success: boolean; message?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const payload = {
    action: 'saveProgress',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: step,
  };

  const res = await saveProgressPayload(payload);
  if (res.success) {
    const localMap = getStoredProgressMap();
    const existing = localMap[studentKey] || createInitialStudentProgress(student);
    existing.currentStep = Math.max(existing.currentStep, step);
    existing.updatedAt = new Date().toISOString();
    localMap[studentKey] = existing;
    saveStoredProgressMap(localMap);
  }
  return res;
}

/**
 * Save STEP 8 Chatbot 6 Tests to Google Apps Script Tests sheet
 */
export async function saveTests(
  student: StudentInfo,
  data: TestData
): Promise<{ success: boolean; message?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  
  const formatResult = (res?: string) => {
    if (res === 'good') return '잘 작동함';
    if (res === 'needs_fix') return '수정 필요';
    return '';
  };

  const now = new Date().toISOString();
  const payload = {
    action: 'saveTests',
    studentKey,
    test1Result: formatResult(data.tests?.test1?.result),
    test2Result: formatResult(data.tests?.test2?.result),
    test3Result: formatResult(data.tests?.test3?.result),
    test4Result: formatResult(data.tests?.test4?.result),
    test5Result: formatResult(data.tests?.test5?.result),
    test6Result: formatResult(data.tests?.test6?.result),
    problemDescription: (data.problemDescription || '').trim(),
    revisionNote: (data.revisionNote || '').trim(),
    testedAt: now,
  };

  const gasUrl = getEffectiveGasUrl();
  if (gasUrl) {
    try {
      const res = await callGasApi(payload);
      if (!res || !res.success) {
        return {
          success: false,
          message: res?.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        };
      }
    } catch (err: any) {
      console.error('Error saving tests to GAS:', err);
      return {
        success: false,
        message: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }

  // Update local storage
  const localMap = getStoredProgressMap();
  const existing = localMap[studentKey] || createInitialStudentProgress(student);
  existing.currentStep = Math.max(existing.currentStep, 8);
  existing.step8 = {
    ...data,
    testedAt: now,
  };
  existing.isTestCompleted = true;
  existing.updatedAt = now;
  localMap[studentKey] = existing;
  saveStoredProgressMap(localMap);

  return { success: true, message: '테스트 결과가 저장되었습니다.' };
}

/**
 * Save STEP 9 Prompt Revision to Google Apps Script (Progress & Tests sheet)
 */
export async function updateRevision(
  student: StudentInfo,
  promptData: PromptData,
  testData: TestData
): Promise<{ success: boolean; message?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const revisedPrompt = (promptData.revisedPrompt || promptData.finalPrompt || promptData.initialPrompt || '').trim();
  const finalPrompt = (promptData.finalPrompt || promptData.revisedPrompt || promptData.initialPrompt || '').trim();
  const chatbotName = (promptData.chatbotName || '').trim();
  const problemDescription = (testData.problemDescription || '').trim();
  const revisionNote = (testData.revisionNote || '').trim();

  const payload = {
    action: 'updateRevision',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    currentStep: 9,
    chatbotName,
    initialPrompt: promptData.initialPrompt || '',
    revisedPrompt,
    finalPrompt,
    problemDescription,
    revisionNote,
  };

  const gasUrl = getEffectiveGasUrl();
  if (gasUrl) {
    try {
      const res = await callGasApi(payload);
      if (!res || !res.success) {
        // Fallback: try saveProgress if updateRevision is not explicitly in older GAS
        const fallbackRes = await saveProgressPayload({
          action: 'saveProgress',
          studentKey,
          grade: Number(student.grade),
          class: Number(student.classNum),
          number: Number(student.number),
          name: (student.name || '').trim(),
          currentStep: 9,
          chatbotName,
          revisedPrompt,
          finalPrompt,
        });
        if (!fallbackRes.success) {
          return {
            success: false,
            message: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
          };
        }
      }
    } catch (err: any) {
      console.error('Error saving revision to GAS:', err);
      return {
        success: false,
        message: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }

  // Update local storage
  const now = new Date().toISOString();
  const localMap = getStoredProgressMap();
  const existing = localMap[studentKey] || createInitialStudentProgress(student);
  existing.currentStep = Math.max(existing.currentStep, 9);
  existing.step6 = {
    ...promptData,
    chatbotName,
    revisedPrompt,
    finalPrompt,
    isConfirmed: true,
  };
  existing.step8 = {
    ...existing.step8,
    problemDescription,
    revisionNote,
  };
  existing.updatedAt = now;
  localMap[studentKey] = existing;
  saveStoredProgressMap(localMap);

  return { success: true, message: '수정 사항이 저장되었습니다.' };
}

/**
 * Submit STEP 10 Final submission to Google Apps Script Submissions sheet
 */
export async function submitFinal(
  student: StudentInfo,
  submission: FinalSubmissionData,
  progress: StudentProgress
): Promise<{ success: boolean; message?: string; submittedAt?: string }> {
  const studentKey = student.studentKey || `${student.grade}-${student.classNum}-${student.number}`;
  const now = new Date().toISOString();

  const payload = {
    action: 'submitFinal',
    studentKey,
    grade: Number(student.grade),
    class: Number(student.classNum),
    classNum: Number(student.classNum),
    number: Number(student.number),
    name: (student.name || '').trim(),
    roleModelName: (progress.step1?.roleModelName || '').trim(),
    roleModelJob: (progress.step1?.roleModelJob || '').trim(),
    chatbotName: (progress.step6?.chatbotName || '').trim(),
    finalPrompt: (progress.step6?.finalPrompt || progress.step6?.revisedPrompt || progress.step6?.initialPrompt || '').trim(),
    gemUrl: (submission.gemUrl || '').trim(),
    sampleQuestion1: (submission.sampleQuestion1 || '').trim(),
    sampleAnswer1: (submission.sampleAnswer1 || '').trim(),
    sampleQuestion2: (submission.sampleQuestion2 || '').trim(),
    sampleAnswer2: (submission.sampleAnswer2 || '').trim(),
    sampleQuestion3: (submission.sampleQuestion3 || '').trim(),
    sampleAnswer3: (submission.sampleAnswer3 || '').trim(),
    revisionSummary: (submission.revisionSummary || '').trim(),
    reflection: (submission.reflection || '').trim(),
    submittedAt: submission.submittedAt || now,
  };

  const gasUrl = getEffectiveGasUrl();
  if (gasUrl) {
    try {
      const res = await callGasApi(payload);
      if (!res || !res.success) {
        return {
          success: false,
          message: res?.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        };
      }
    } catch (err: any) {
      console.error('Error submitting final to GAS:', err);
      return {
        success: false,
        message: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }
  }

  // Update local storage
  const localMap = getStoredProgressMap();
  const existing = localMap[studentKey] || createInitialStudentProgress(student);
  existing.currentStep = 10;
  existing.step10 = {
    ...submission,
    submittedAt: submission.submittedAt || now,
  };
  existing.isGemSubmitted = Boolean(submission.gemUrl && submission.gemUrl.trim());
  existing.isFinalSubmitted = true;
  existing.updatedAt = now;
  localMap[studentKey] = existing;
  saveStoredProgressMap(localMap);

  return { success: true, message: '제출이 완료되었습니다.', submittedAt: now };
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
 * Admin: Verify password and establish secure session
 */
export async function verifyAdminPassword(password: string): Promise<{ success: boolean; message?: string; token?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.token) {
        sessionStorage.setItem('rolemodel_admin_token', data.token);
      }
      return data;
    }
    return {
      success: false,
      message: data.message || '관리자 비밀번호가 올바르지 않습니다.',
    };
  } catch (e: any) {
    return {
      success: false,
      message: '서버 연결에 실패했습니다: ' + (e?.message || '네트워크 오류'),
    };
  }
}

/**
 * Admin: Check active session validity
 */
export async function checkAdminSession(): Promise<boolean> {
  try {
    const token = sessionStorage.getItem('rolemodel_admin_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/session', {
      method: 'GET',
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.authenticated);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Admin: Logout session
 */
export async function logoutAdmin(): Promise<void> {
  try {
    const token = sessionStorage.getItem('rolemodel_admin_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    sessionStorage.removeItem('rolemodel_admin_token');
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers,
    });
  } catch (e) {
    console.warn('Admin logout fetch failed:', e);
  }
}

/**
 * Map raw data from GAS getStudentDetail / loadProgress / getAdminDashboard to rich StudentProgress
 */
export function mapFullStudentDetail(raw: any): StudentProgress {
  if (!raw) return createInitialStudentProgress({ grade: 1, classNum: 1, number: 1, name: '학생', studentKey: '1-1-1' });

  // Handle various potential nested shapes:
  // 1. { data: { student, progress, tests, submission } } or { student, progress, tests, submission }
  // 2. { step1, step2, ... } (StudentProgress format)
  // 3. Flat row object (from getAdminDashboard or getAllProgress)
  const studentObj = (raw && typeof raw === 'object' && raw.student) ? raw.student : (raw?.data?.student || {});
  const progressObj = (raw && typeof raw === 'object' && raw.progress) ? raw.progress : (raw?.data?.progress || {});
  const testsObjRaw = (raw && typeof raw === 'object' && raw.tests) ? raw.tests : (raw?.data?.tests || {});
  const submissionObj = (raw && typeof raw === 'object' && raw.submission) ? raw.submission : (raw?.data?.submission || {});
  
  const step1Raw = raw.step1 || {};
  const step2Raw = raw.step2 || {};
  const step3Raw = raw.step3 || {};
  const step4Raw = raw.step4 || {};
  const step5Raw = raw.step5 || {};
  const step6Raw = raw.step6 || {};
  const step8Raw = raw.step8 || {};
  const step10Raw = raw.step10 || {};

  // Grade, Class, Number, Name, StudentKey
  const rawKey = String(
    studentObj.studentKey ||
    progressObj.studentKey ||
    submissionObj.studentKey ||
    raw.studentKey ||
    ''
  ).trim();

  const grade = Number(studentObj.grade || progressObj.grade || submissionObj.grade || raw.grade) || 1;
  const classNum = Number(
    studentObj.class !== undefined ? studentObj.class : (studentObj.classNum !== undefined ? studentObj.classNum : (progressObj.class !== undefined ? progressObj.class : (progressObj.classNum !== undefined ? progressObj.classNum : (submissionObj.class !== undefined ? submissionObj.class : (submissionObj.classNum !== undefined ? submissionObj.classNum : (raw.class !== undefined ? raw.class : raw.classNum))))))
  ) || 1;
  const number = Number(studentObj.number || progressObj.number || submissionObj.number || raw.number) || 1;
  const name = String(studentObj.name || progressObj.name || submissionObj.name || raw.name || '').trim();
  const studentKey = rawKey || `${grade}-${classNum}-${number}`;

  // STEP 1: Role Model details
  const roleModelName = String(
    progressObj.roleModelName ||
    step1Raw.roleModelName ||
    submissionObj.roleModelName ||
    raw.roleModelName ||
    ''
  ).trim();

  const roleModelJob = String(
    progressObj.roleModelJob ||
    step1Raw.roleModelJob ||
    submissionObj.roleModelJob ||
    raw.roleModelJob ||
    ''
  ).trim();

  const roleModelReason = String(
    progressObj.roleModelReason ||
    step1Raw.roleModelReason ||
    raw.roleModelReason ||
    ''
  ).trim();

  const jobDescription = String(
    progressObj.jobDescription ||
    step1Raw.jobDescription ||
    raw.jobDescription ||
    ''
  ).trim();

  const competencies = normalizeCompetencies(
    progressObj.competencies ||
    step1Raw.competencies ||
    raw.competencies
  );

  const careerHistory = String(
    progressObj.careerHistory ||
    step1Raw.careerHistory ||
    raw.careerHistory ||
    ''
  ).trim();

  const strengths = normalizeStrengths(
    progressObj.strengths ||
    step1Raw.strengths ||
    raw.strengths
  );

  const values = normalizeValues(
    progressObj.values ||
    step1Raw.values ||
    raw.values
  );

  const challengeExperience = String(
    progressObj.challengeExperience ||
    step1Raw.challengeExperience ||
    raw.challengeExperience ||
    ''
  ).trim();

  // STEP 2: Chatbot Purpose & Target
  const chatbotPurposes = normalizeChatbotPurposes(
    progressObj.chatbotPurposes ||
    step2Raw.chatbotPurposes ||
    raw.chatbotPurposes
  );

  const targetUserRaw = String(
    progressObj.targetUser ||
    step2Raw.targetUser ||
    raw.targetUser ||
    ''
  ).trim();

  let targetUser = targetUserRaw || '이 직업에 관심 있는 중학생';
  let targetUserCustom = step2Raw.targetUserCustom || '';
  const knownTargets = [
    '이 직업에 관심 있는 중학생',
    '진로를 아직 정하지 못한 중학생',
    '롤모델의 삶과 경험이 궁금한 학생',
    '나와 비슷한 고민을 하는 학생',
  ];
  if (targetUserRaw && !knownTargets.includes(targetUserRaw)) {
    targetUser = '기타';
    targetUserCustom = targetUserRaw;
  }

  const expectedOutcome = String(
    progressObj.expectedOutcome ||
    step2Raw.expectedOutcome ||
    raw.expectedOutcome ||
    ''
  ).trim();

  const purposeSummarySentence = String(
    progressObj.purposeSummarySentence ||
    step2Raw.purposeSummarySentence ||
    raw.purposeSummarySentence ||
    ''
  ).trim();

  // STEP 3: Personality & Tone
  const personalities = normalizePersonalities(
    progressObj.personality ||
    progressObj.personalities ||
    step3Raw.personalities ||
    raw.personality ||
    raw.personalities
  );

  const speakingStyle = String(
    progressObj.speakingStyle ||
    step3Raw.speakingStyle ||
    raw.speakingStyle ||
    '멘토처럼 따뜻하게'
  ).trim();

  let honorificStyle: '친근한 존댓말' | '차분한 존댓말' | '정중한 존댓말' = '친근한 존댓말';
  const rawHon = String(
    progressObj.honorificStyle ||
    step3Raw.honorificStyle ||
    raw.honorificStyle ||
    ''
  );
  if (rawHon.includes('차분한')) {
    honorificStyle = '차분한 존댓말';
  } else if (rawHon.includes('정중한')) {
    honorificStyle = '정중한 존댓말';
  } else {
    honorificStyle = '친근한 존댓말';
  }

  const desiredFeeling = String(
    progressObj.desiredFeeling ||
    step3Raw.desiredFeeling ||
    raw.desiredFeeling ||
    ''
  ).trim();

  // STEP 4: Response Style
  let answerLength: 'short' | 'medium' | 'detailed' = 'medium';
  const rawLen = String(
    progressObj.answerLength ||
    step4Raw.answerLength ||
    raw.answerLength ||
    ''
  );
  if (rawLen.includes('short') || rawLen.includes('2~3') || rawLen.includes('짧고') || rawLen.includes('간결')) {
    answerLength = 'short';
  } else if (rawLen.includes('detailed') || rawLen.includes('자세') || rawLen.includes('풍부')) {
    answerLength = 'detailed';
  } else {
    answerLength = 'medium';
  }

  const answerElements = normalizeAnswerElements(
    progressObj.answerElements ||
    step4Raw.answerElements ||
    raw.answerElements
  );

  // STEP 6: Prompts & Chatbot Name
  const chatbotName = String(
    progressObj.chatbotName ||
    submissionObj.chatbotName ||
    step6Raw.chatbotName ||
    raw.chatbotName ||
    ''
  ).trim();

  const initialPrompt = String(
    progressObj.initialPrompt ||
    step6Raw.initialPrompt ||
    raw.initialPrompt ||
    ''
  ).trim();

  const revisedPrompt = String(
    progressObj.revisedPrompt ||
    step6Raw.revisedPrompt ||
    raw.revisedPrompt ||
    ''
  ).trim();

  // Final Prompt Priority: 1. finalPrompt, 2. revisedPrompt, 3. initialPrompt
  const finalPrompt = String(
    progressObj.finalPrompt ||
    submissionObj.finalPrompt ||
    step6Raw.finalPrompt ||
    raw.finalPrompt ||
    revisedPrompt ||
    initialPrompt ||
    ''
  ).trim();

  // STEP 8: Tests
  const testsObj: Record<string, { result: 'good' | 'needs_fix' | ''; note: string }> = {};
  const innerTests = testsObjRaw.tests || step8Raw.tests || raw.tests || {};
  for (let i = 1; i <= 6; i++) {
    const key = `test${i}`;
    const item = innerTests[key] || testsObjRaw[key] || {};
    const rawResult = String(
      testsObjRaw[`${key}Result`] ||
      raw[`${key}Result`] ||
      item.result ||
      ''
    ).trim();

    let result: 'good' | 'needs_fix' | '' = '';
    if (
      rawResult === 'good' ||
      rawResult === 'well' ||
      rawResult === 'pass' ||
      rawResult === '잘 작동함' ||
      rawResult.includes('잘 작동') ||
      rawResult.includes('성공')
    ) {
      result = 'good';
    } else if (
      rawResult === 'needs_fix' ||
      rawResult === 'fail' ||
      rawResult === '수정 필요' ||
      rawResult.includes('수정') ||
      rawResult.includes('실패')
    ) {
      result = 'needs_fix';
    }

    const note = String(
      item.note ||
      testsObjRaw[`${key}Note`] ||
      raw[`${key}Note`] ||
      ''
    ).trim();

    testsObj[key] = { result, note };
  }

  const problemDescription = String(
    testsObjRaw.problemDescription ||
    step8Raw.problemDescription ||
    raw.problemDescription ||
    ''
  ).trim();

  const revisionNote = String(
    testsObjRaw.revisionNote ||
    step8Raw.revisionNote ||
    raw.revisionNote ||
    submissionObj.revisionSummary ||
    ''
  ).trim();

  const testedAt = String(
    testsObjRaw.testedAt ||
    step8Raw.testedAt ||
    raw.testedAt ||
    ''
  ).trim();

  // STEP 10: Final Submission
  const gemUrl = String(
    submissionObj.gemUrl ||
    step10Raw.gemUrl ||
    raw.gemUrl ||
    ''
  ).trim();

  const sampleQuestion1 = String(
    submissionObj.sampleQuestion1 ||
    step10Raw.sampleQuestion1 ||
    raw.sampleQuestion1 ||
    ''
  ).trim();

  const sampleAnswer1 = String(
    submissionObj.sampleAnswer1 ||
    step10Raw.sampleAnswer1 ||
    raw.sampleAnswer1 ||
    ''
  ).trim();

  const sampleQuestion2 = String(
    submissionObj.sampleQuestion2 ||
    step10Raw.sampleQuestion2 ||
    raw.sampleQuestion2 ||
    ''
  ).trim();

  const sampleAnswer2 = String(
    submissionObj.sampleAnswer2 ||
    step10Raw.sampleAnswer2 ||
    raw.sampleAnswer2 ||
    ''
  ).trim();

  const sampleQuestion3 = String(
    submissionObj.sampleQuestion3 ||
    step10Raw.sampleQuestion3 ||
    raw.sampleQuestion3 ||
    ''
  ).trim();

  const sampleAnswer3 = String(
    submissionObj.sampleAnswer3 ||
    step10Raw.sampleAnswer3 ||
    raw.sampleAnswer3 ||
    ''
  ).trim();

  const revisionSummary = String(
    submissionObj.revisionSummary ||
    step10Raw.revisionSummary ||
    raw.revisionSummary ||
    revisionNote ||
    ''
  ).trim();

  const reflection = String(
    submissionObj.reflection ||
    step10Raw.reflection ||
    raw.reflection ||
    ''
  ).trim();

  const submittedAt = String(
    submissionObj.submittedAt ||
    step10Raw.submittedAt ||
    raw.submittedAt ||
    ''
  ).trim();

  // Determine currentStep priority:
  // 1. data.progress.currentStep (exact progress from DB)
  // 2. root raw.currentStep
  // 3. Fallback estimations based on submitted status
  let currentStep = 1;
  if (progressObj.currentStep !== undefined && progressObj.currentStep !== null && Number(progressObj.currentStep) > 0) {
    currentStep = Number(progressObj.currentStep);
  } else if (raw.currentStep !== undefined && raw.currentStep !== null && Number(raw.currentStep) > 0) {
    currentStep = Number(raw.currentStep);
  } else if (gemUrl || submittedAt) {
    currentStep = 10;
  } else if (testedAt) {
    currentStep = 8;
  } else if (finalPrompt || initialPrompt) {
    currentStep = 6;
  }

  const isFinalSubmitted = Boolean(
    submissionObj.submittedAt ||
    submissionObj.gemUrl ||
    raw.isFinalSubmitted ||
    raw.submitted ||
    submittedAt ||
    gemUrl
  );

  const hasAnyTestEvaluated = Object.values(testsObj).some((t) => t.result !== '');
  const isTestCompleted = Boolean(
    raw.isTestCompleted ||
    raw.testCompleted ||
    hasAnyTestEvaluated ||
    testedAt ||
    currentStep >= 9 ||
    isFinalSubmitted
  );

  const isPromptCompleted = Boolean(
    raw.isPromptCompleted ||
    raw.promptCompleted ||
    finalPrompt ||
    revisedPrompt ||
    initialPrompt ||
    currentStep >= 6 ||
    isFinalSubmitted
  );

  return {
    studentKey,
    grade,
    classNum,
    number,
    name,
    currentStep,
    step1: {
      roleModelName,
      roleModelJob,
      roleModelReason,
      jobDescription,
      competencies,
      competencyCustom: step1Raw.competencyCustom || '',
      careerHistory,
      strengths,
      strengthCustom: step1Raw.strengthCustom || '',
      values,
      valueCustom: step1Raw.valueCustom || '',
      challengeExperience,
    },
    step2: {
      chatbotPurposes,
      targetUser,
      targetUserCustom,
      expectedOutcome,
      purposeSummarySentence,
    },
    step3: {
      personalities,
      speakingStyle,
      honorificStyle,
      desiredFeeling,
      personalityRulesSummary: '',
    },
    step4: {
      answerLength,
      answerElements,
    },
    step5: {
      quizAnswer: step5Raw.quizAnswer || 'C',
      quizPassed: step5Raw.quizPassed !== undefined ? step5Raw.quizPassed : currentStep >= 5,
      agreedToRules: step5Raw.agreedToRules !== undefined ? step5Raw.agreedToRules : currentStep >= 5,
      checkedFactualityRules: step5Raw.checkedFactualityRules || [true, true, true, true, true],
      checkedDisclaimer: step5Raw.checkedDisclaimer !== undefined ? step5Raw.checkedDisclaimer : true,
      checkedSafetyRules: step5Raw.checkedSafetyRules || [true, true, true, true],
      allRulesChecked: step5Raw.allRulesChecked !== undefined ? step5Raw.allRulesChecked : currentStep >= 5,
    },
    step6: {
      chatbotName,
      initialPrompt,
      revisedPrompt,
      finalPrompt,
      isConfirmed: Boolean(finalPrompt || initialPrompt),
    },
    step8: {
      tests: testsObj,
      problemDescription,
      revisionNote,
      testedAt,
    },
    step10: {
      gemUrl,
      sampleQuestion1,
      sampleAnswer1,
      sampleQuestion2,
      sampleAnswer2,
      sampleQuestion3,
      sampleAnswer3,
      revisionSummary,
      reflection,
      submittedAt,
    },
    createdAt: progressObj.createdAt || raw.createdAt || submittedAt || new Date().toISOString(),
    updatedAt: submittedAt || progressObj.updatedAt || testedAt || raw.updatedAt || new Date().toISOString(),
    isPromptCompleted,
    isTestCompleted,
    isGemSubmitted: Boolean(gemUrl),
    isFinalSubmitted,
  };
}

/**
 * Admin: Fetch complete student detail via Vercel Server API (/api/admin/student-detail)
 */
export async function fetchStudentDetail(studentKey: string): Promise<StudentProgress> {
  const cleanKey = String(studentKey || '').trim();
  if (!cleanKey) {
    throw new Error('학생 식별자가 전달되지 않았습니다.');
  }

  const token = sessionStorage.getItem('rolemodel_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/admin/student-detail?studentKey=${encodeURIComponent(cleanKey)}`, {
    method: 'GET',
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem('rolemodel_admin_token');
    throw new Error('관리자 인증이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const json = await res.json().catch(() => ({}));
  if (res.ok && json.success) {
    const rawData = json.data !== undefined ? json.data : json;
    const mapped = mapFullStudentDetail(rawData);
    if (cleanKey && (!mapped.studentKey || mapped.studentKey === '1-1-1')) {
      mapped.studentKey = cleanKey;
    }
    return mapped;
  }

  throw new Error(json.message || '학생 상세 정보를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
}

/**
 * Admin: Get Dashboard Stats & Student List via Vercel Server API (/api/admin/dashboard)
 */
export async function getAdminData(): Promise<{
  stats: DashboardStats;
  students: StudentProgress[];
  roster: RosterItem[];
}> {
  const token = sessionStorage.getItem('rolemodel_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/admin/dashboard', {
    method: 'GET',
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem('rolemodel_admin_token');
    throw new Error('관리자 인증이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const json = await res.json().catch(() => ({}));
  if (res.ok && json.success && json.data) {
    const rawData = json.data;
    const rawStudents = Array.isArray(rawData.students) ? rawData.students : [];
    const students: StudentProgress[] = rawStudents.map((s: any) => mapFullStudentDetail(s));

    const roster: RosterItem[] = students.map((s) => ({
      grade: s.grade,
      classNum: s.classNum,
      number: s.number,
      name: s.name,
    }));

    let byClass = rawData.byClass;
    if (!byClass || !Array.isArray(byClass) || byClass.length === 0) {
      const classMap = new Map<string, any>();
      students.forEach((s) => {
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
        if (s.isFinalSubmitted) {
          cStat.submitted++;
        } else if (s.isTestCompleted || s.currentStep >= 8) {
          cStat.testing++;
        } else if (s.isPromptCompleted || s.currentStep >= 6) {
          cStat.promptCompleted++;
        } else if (hasStarted) {
          cStat.inProgress++;
        } else {
          cStat.notStarted++;
        }
      });
      byClass = Array.from(classMap.values()).sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.classNum - b.classNum;
      });
    }

    const totalStudents = rawData.totalStudents !== undefined ? rawData.totalStudents : students.length;
    const startedStudents =
      rawData.startedStudents !== undefined
        ? rawData.startedStudents
        : students.filter((s) => s.step1?.roleModelName || s.currentStep > 1).length;
    const promptCompletedStudents =
      rawData.promptCompletedStudents !== undefined
        ? rawData.promptCompletedStudents
        : students.filter((s) => s.isPromptCompleted).length;
    const testCompletedStudents =
      rawData.testingStudents !== undefined
        ? rawData.testingStudents
        : rawData.testCompletedStudents !== undefined
        ? rawData.testCompletedStudents
        : students.filter((s) => s.isTestCompleted).length;
    const finalSubmittedStudents =
      rawData.submittedStudents !== undefined
        ? rawData.submittedStudents
        : rawData.finalSubmittedStudents !== undefined
        ? rawData.finalSubmittedStudents
        : students.filter((s) => s.isFinalSubmitted).length;
    const inProgressStudents =
      rawData.inProgressStudents !== undefined
        ? rawData.inProgressStudents
        : Math.max(0, startedStudents - promptCompletedStudents - finalSubmittedStudents);

    const stats: DashboardStats = {
      totalStudents,
      startedStudents,
      inProgressStudents,
      promptCompletedStudents,
      gemCreatedStudents: rawData.gemCreatedStudents ?? students.filter((s) => s.currentStep >= 7).length,
      testCompletedStudents,
      finalSubmittedStudents,
      byClass,
    };

    return {
      stats,
      students,
      roster,
    };
  }

  throw new Error(json.message || '관리자 대시보드 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.');
}

/**
 * Admin: Update Roster (Replace or Append) via Vercel Server API (/api/admin/update-roster)
 */
export async function updateAdminRoster(
  newRoster: RosterItem[],
  mode: 'replace' | 'append'
): Promise<{ success: boolean; count: number; message: string }> {
  const token = sessionStorage.getItem('rolemodel_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch('/api/admin/update-roster', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode,
      students: newRoster.map((item) => ({
        grade: Number(item.grade),
        class: Number(item.classNum),
        number: Number(item.number),
        name: String(item.name).trim(),
      })),
    }),
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem('rolemodel_admin_token');
    throw new Error('관리자 인증이 만료되었습니다. 다시 로그인해 주세요.');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json?.message || '학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  // Sync to local student view cache if needed
  let finalRoster: RosterItem[] = [];
  if (mode === 'replace') {
    finalRoster = newRoster;
  } else {
    const existing = getStoredRoster();
    const existingKeys = new Set(existing.map((e) => `${e.grade}-${e.classNum}-${e.number}`));
    finalRoster = [...existing];
    newRoster.forEach((item) => {
      const key = `${item.grade}-${item.classNum}-${item.number}`;
      if (!existingKeys.has(key)) {
        finalRoster.push(item);
      }
    });
  }
  saveStoredRoster(finalRoster);

  return {
    success: true,
    count: finalRoster.length,
    message: '학생 명단이 Google Sheets에 정상적으로 반영되었습니다.',
  };
}

/**
 * Safe fetch for student view roster
 */
export async function fetchRoster(): Promise<RosterItem[]> {
  return getStoredRoster();
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
