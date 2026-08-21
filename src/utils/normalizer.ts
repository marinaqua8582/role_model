import { parseCommaArray } from '../api/client';

export const PURPOSE_OPTIONS = [
  '롤모델의 직업을 소개한다.',
  '이 직업에서 하는 일을 알려 준다.',
  '이 직업에 필요한 역량을 알려 준다.',
  '롤모델의 노력과 성장 과정을 소개한다.',
  '실패나 어려움을 극복한 경험을 소개한다.',
  '진로 준비 방법을 알려 준다.',
  '진로 고민에 조언한다.',
  '학생이 자신의 진로를 생각하도록 질문한다.',
] as const;

export const COMPETENCY_OPTIONS = [
  '의사소통',
  '창의성',
  '문제 해결',
  '책임감',
  '협업',
  '끈기',
  '리더십',
  '자기관리',
  '전문 지식',
  '체력',
] as const;

export const STRENGTH_OPTIONS = [
  '끈기',
  '도전 정신',
  '전문성',
  '성실함',
  '통찰력',
  '공감 능력',
  '추진력',
  '긍정적 사고',
] as const;

export const VALUE_OPTIONS = [
  '노력',
  '책임',
  '성장',
  '도전',
  '협력',
  '창의',
  '배려',
  '정직',
  '성취',
  '사회적 기여',
] as const;

export const PERSONALITY_OPTIONS = [
  '친절한',
  '따뜻한',
  '차분한',
  '진지한',
  '긍정적인',
  '자신감 있는',
  '유쾌한',
  '솔직한',
  '겸손한',
  '열정적인',
  '현실적인',
  '응원해 주는',
  '논리적인',
  '도전적인',
] as const;

export const COMPOSITION_OPTIONS = [
  '질문에 대한 핵심 답부터 말하기',
  '롤모델의 경험이나 사례 연결하기',
  '직업의 실제 모습 설명하기',
  '필요한 역량과 연결하기',
  '준비 방법 알려 주기',
  '장점뿐 아니라 어려운 점도 설명하기',
  '학생이 생각할 질문 던지기',
  '마지막에 격려 한마디 하기',
] as const;

/**
 * Normalize single chatbot purpose string to valid PURPOSE_OPTIONS
 */
export function normalizeSinglePurpose(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((PURPOSE_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('직업 소개') || s.includes('직업소개') || s.includes('직업을 소개') || s.includes('롤모델의 직업') || s === '직업') {
    return '롤모델의 직업을 소개한다.';
  }
  if (s.includes('하는 일') || s.includes('하는일') || s.includes('직업의 하는 일') || s.includes('업무') || s.includes('일을 알려')) {
    return '이 직업에서 하는 일을 알려 준다.';
  }
  if (s.includes('역량 안내') || s.includes('역량안내') || s.includes('필요한 역량') || s.includes('역량을 알려') || s.includes('역량')) {
    return '이 직업에 필요한 역량을 알려 준다.';
  }
  if (s.includes('성장') || s.includes('노력') || s.includes('성장 과정') || s.includes('성장과정') || s.includes('노력과 성장')) {
    return '롤모델의 노력과 성장 과정을 소개한다.';
  }
  if (s.includes('실패') || s.includes('어려움') || s.includes('극복')) {
    return '실패나 어려움을 극복한 경험을 소개한다.';
  }
  if (s.includes('진로 준비') || s.includes('진로준비') || s.includes('준비 방법') || s.includes('준비방법')) {
    return '진로 준비 방법을 알려 준다.';
  }
  if (s.includes('진로 조언') || s.includes('진로조언') || s.includes('진로 고민') || s.includes('진로고민') || s.includes('조언')) {
    return '진로 고민에 조언한다.';
  }
  if (s.includes('성찰') || s.includes('질문') || s.includes('생각하도록') || s.includes('진로를 생각')) {
    return '학생이 자신의 진로를 생각하도록 질문한다.';
  }

  return null;
}

export function normalizeChatbotPurposes(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSinglePurpose(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}

/**
 * Normalize single competency
 */
export function normalizeSingleCompetency(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((COMPETENCY_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('의사소통') || s.includes('소통') || s.includes('커뮤니케이션')) return '의사소통';
  if (s.includes('창의성') || s.includes('창의력') || s.includes('창의적')) return '창의성';
  if (s.includes('문제 해결') || s.includes('문제해결')) return '문제 해결';
  if (s.includes('책임감') || s.includes('책임')) return '책임감';
  if (s.includes('협업') || s.includes('협동') || s.includes('팀워크')) return '협업';
  if (s.includes('끈기') || s.includes('인내')) return '끈기';
  if (s.includes('리더십') || s.includes('리더쉽') || s.includes('지도력')) return '리더십';
  if (s.includes('자기관리') || s.includes('자기 관리')) return '자기관리';
  if (s.includes('전문 지식') || s.includes('전문지식') || s.includes('전문성')) return '전문 지식';
  if (s.includes('체력') || s.includes('건강')) return '체력';

  return null;
}

export function normalizeCompetencies(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSingleCompetency(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}

/**
 * Normalize single strength
 */
export function normalizeSingleStrength(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((STRENGTH_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('끈기') || s.includes('인내')) return '끈기';
  if (s.includes('도전 정신') || s.includes('도전정신') || s.includes('도전')) return '도전 정신';
  if (s.includes('전문성') || s.includes('전문 지식') || s.includes('전문지식')) return '전문성';
  if (s.includes('성실함') || s.includes('성실') || s.includes('성실성')) return '성실함';
  if (s.includes('통찰력') || s.includes('통찰')) return '통찰력';
  if (s.includes('공감 능력') || s.includes('공감능력') || s.includes('공감')) return '공감 능력';
  if (s.includes('추진력') || s.includes('실행력')) return '추진력';
  if (s.includes('긍정적 사고') || s.includes('긍정적사고') || s.includes('긍정적인 사고') || s.includes('긍정')) return '긍정적 사고';

  return null;
}

export function normalizeStrengths(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSingleStrength(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}

/**
 * Normalize single value
 */
export function normalizeSingleValue(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((VALUE_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('노력') || s.includes('성실')) return '노력';
  if (s.includes('책임') || s.includes('책임감')) return '책임';
  if (s.includes('성장') || s.includes('자기발전')) return '성장';
  if (s.includes('도전') || s.includes('도전정신')) return '도전';
  if (s.includes('협력') || s.includes('협업') || s.includes('팀워크')) return '협력';
  if (s.includes('창의') || s.includes('창의성') || s.includes('창의력')) return '창의';
  if (s.includes('배려') || s.includes('봉사') || s.includes('나눔')) return '배려';
  if (s.includes('정직') || s.includes('도덕') || s.includes('신뢰')) return '정직';
  if (s.includes('성취') || s.includes('성공')) return '성취';
  if (s.includes('사회적 기여') || s.includes('사회적기여') || s.includes('사회 기여') || s.includes('공헌')) return '사회적 기여';

  return null;
}

export function normalizeValues(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSingleValue(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}

/**
 * Normalize single personality
 */
export function normalizeSinglePersonality(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((PERSONALITY_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('친절')) return '친절한';
  if (s.includes('따뜻')) return '따뜻한';
  if (s.includes('차분')) return '차분한';
  if (s.includes('진지') || s.includes('진중')) return '진지한';
  if (s.includes('긍정')) return '긍정적인';
  if (s.includes('자신감') || s.includes('당당')) return '자신감 있는';
  if (s.includes('유쾌') || s.includes('재미') || s.includes('유머')) return '유쾌한';
  if (s.includes('솔직')) return '솔직한';
  if (s.includes('겸손')) return '겸손한';
  if (s.includes('열정')) return '열정적인';
  if (s.includes('현실적') || s.includes('현실')) return '현실적인';
  if (s.includes('응원') || s.includes('격려')) return '응원해 주는';
  if (s.includes('논리')) return '논리적인';
  if (s.includes('도전')) return '도전적인';

  return null;
}

export function normalizePersonalities(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSinglePersonality(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}

/**
 * Normalize single answer composition element
 */
export function normalizeSingleAnswerElement(item: string): string | null {
  const s = String(item || '').trim();
  if (!s) return null;
  if ((COMPOSITION_OPTIONS as readonly string[]).includes(s)) return s;

  if (s.includes('핵심 답') || s.includes('핵심 답변') || s.includes('두괄식') || s.includes('답부터 말하기')) {
    return '질문에 대한 핵심 답부터 말하기';
  }
  if (s.includes('경험') || s.includes('사례') || s.includes('롤모델의 경험')) {
    return '롤모델의 경험이나 사례 연결하기';
  }
  if (s.includes('직업의 실제') || s.includes('실제 모습') || s.includes('직업의 모습') || s.includes('직업 설명')) {
    return '직업의 실제 모습 설명하기';
  }
  if (s.includes('역량') || s.includes('필요한 역량')) {
    return '필요한 역량과 연결하기';
  }
  if (s.includes('준비 방법') || s.includes('준비방법') || s.includes('진로 준비')) {
    return '준비 방법 알려 주기';
  }
  if (s.includes('어려운 점') || s.includes('장단점') || s.includes('단점')) {
    return '장점뿐 아니라 어려운 점도 설명하기';
  }
  if (s.includes('생각할 질문') || s.includes('질문 던지기') || s.includes('성찰 질문')) {
    return '학생이 생각할 질문 던지기';
  }
  if (s.includes('격려') || s.includes('따뜻한 격려') || s.includes('응원')) {
    return '마지막에 격려 한마디 하기';
  }

  return null;
}

export function normalizeAnswerElements(rawList: unknown): string[] {
  const items = parseCommaArray(rawList);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const matched = normalizeSingleAnswerElement(item);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      normalized.push(matched);
    }
  }

  return normalized;
}
