export interface StudentInfo {
  grade: number;
  classNum: number;
  number: number;
  name: string;
  studentKey: string; // e.g. "3-1-1"
}

export interface RoleModelData {
  roleModelName: string;
  roleModelJob: string;
  roleModelReason: string;
  jobDescription: string;
  competencies: string[];
  competencyCustom: string;
  careerHistory: string;
  strengths: string[];
  strengthCustom: string;
  values: string[];
  valueCustom: string;
  challengeExperience: string;
}

export interface ChatbotPurposeData {
  chatbotPurposes: string[]; // max 4
  targetUser: string;
  targetUserCustom: string;
  expectedOutcome: string;
  purposeSummarySentence: string;
}

export interface PersonalityData {
  personalities: string[]; // 2~3
  speakingStyle: string;
  honorificStyle: '친근한 존댓말' | '차분한 존댓말' | '정중한 존댓말';
  desiredFeeling: string;
  personalityRulesSummary: string;
}

export interface ResponseStyleData {
  answerLength: 'short' | 'medium' | 'detailed'; // 2~3문장, 4~6문장, 필요시 자세히
  answerElements: string[]; // max 4
}

export interface SafetyRuleData {
  quizAnswer: string;
  quizPassed: boolean;
  agreedToRules: boolean;
  checkedFactualityRules?: boolean[];
  checkedDisclaimer?: boolean;
  checkedSafetyRules?: boolean[];
  allRulesChecked?: boolean;
}

export interface PromptData {
  chatbotName: string;
  initialPrompt: string;
  revisedPrompt: string;
  finalPrompt: string;
  isConfirmed: boolean;
}

export interface TestItem {
  id: number;
  title: string;
  question: string;
  purpose: string;
  result: 'good' | 'needs_fix' | '';
  note: string;
}

export interface TestData {
  tests: {
    test1?: { result: 'good' | 'needs_fix' | ''; note: string };
    test2?: { result: 'good' | 'needs_fix' | ''; note: string };
    test3?: { result: 'good' | 'needs_fix' | ''; note: string };
    test4?: { result: 'good' | 'needs_fix' | ''; note: string };
    test5?: { result: 'good' | 'needs_fix' | ''; note: string };
    test6?: { result: 'good' | 'needs_fix' | ''; note: string };
    test7?: { result: 'good' | 'needs_fix' | ''; note: string };
    test8?: { result: 'good' | 'needs_fix' | ''; note: string };
    [key: string]: { result: 'good' | 'needs_fix' | ''; note: string } | undefined;
  };
  problemDescription: string;
  revisionNote: string;
  testedAt?: string;
}

export interface FinalSubmissionData {
  gemUrl: string;
  sampleQuestion1: string;
  sampleAnswer1: string;
  sampleQuestion2: string;
  sampleAnswer2: string;
  sampleQuestion3: string;
  sampleAnswer3: string;
  revisionSummary: string;
  reflection: string;
  submittedAt?: string;
}

export interface Step11CounselingData {
  barrierAnswer: string;
  barrierReflection: string;
  decisionAnswer: string;
  decisionReflection: string;
  educationAnswer: string;
  educationReflection: string;
  finalCareerReflection: string;
  completedAt?: string;
}

export interface StudentProgress {
  studentKey: string;
  grade: number;
  classNum: number;
  number: number;
  name: string;
  currentStep: number; // 1 to 11
  step1: RoleModelData;
  step2: ChatbotPurposeData;
  step3: PersonalityData;
  step4: ResponseStyleData;
  step5: SafetyRuleData;
  step6: PromptData;
  step8: TestData;
  step10: FinalSubmissionData;
  step11: Step11CounselingData;
  createdAt: string;
  updatedAt: string;
  isPromptCompleted: boolean;
  isTestCompleted: boolean;
  isGemSubmitted: boolean;
  isFinalSubmitted: boolean;
  isCounselingCompleted?: boolean;
}

export interface RosterItem {
  grade: number;
  classNum: number;
  number: number;
  name: string;
}

export interface RosterValidationError {
  row: number;
  reason: string;
  data?: Partial<RosterItem>;
}

export interface RosterRowPreview {
  rowNum: number;
  gradeRaw: any;
  classRaw: any;
  numberRaw: any;
  nameRaw: any;
  isValid: boolean;
  errorReason?: string;
  item?: RosterItem;
}

export interface RosterDiff {
  totalExisting: number;
  totalNew: number;
  toAdd: RosterItem[];
  toRemove: RosterItem[];
  unchanged: RosterItem[];
  changed: { before: RosterItem; after: RosterItem }[];
}

export interface RosterValidationResult {
  totalCount: number;
  validCount: number;
  errorCount: number;
  rows: RosterRowPreview[];
  validItems: RosterItem[];
  errors: RosterValidationError[];
}

export interface DashboardStats {
  totalStudents: number;
  startedStudents: number;
  inProgressStudents: number;
  promptCompletedStudents: number;
  gemCreatedStudents: number;
  testCompletedStudents: number;
  finalSubmittedStudents: number;
  byClass: {
    grade: number;
    classNum: number;
    total: number;
    notStarted: number;
    inProgress: number;
    promptCompleted: number;
    testing: number;
    submitted: number;
  }[];
}
