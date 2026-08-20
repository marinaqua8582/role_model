import * as XLSX from 'xlsx';
import { RosterItem, RosterValidationError, RosterDiff, StudentProgress } from '../types';

/**
 * Generate a blank Roster template XLSX for teachers to download
 */
export function generateRosterTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const sampleData = [
    { 학년: 3, 반: 1, 번호: 1, 이름: '김민준' },
    { 학년: 3, 반: 1, 번호: 2, 이름: '이서연' },
    { 학년: 3, 반: 1, 번호: 3, 이름: '박도현' },
    { 학년: 3, 반: 2, 번호: 1, 이름: '정하은' },
    { 학년: 3, 반: 2, 번호: 2, 이름: '최유준' },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Download blank roster template directly from browser
 */
export function downloadRosterTemplateFile() {
  const data = generateRosterTemplate();
  const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '롤모델챗봇_학생명단_양식.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded Excel file and validate rows
 */
export function parseAndValidateRosterFile(fileData: ArrayBuffer): {
  validItems: RosterItem[];
  errors: RosterValidationError[];
} {
  const wb = XLSX.read(fileData, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { validItems: [], errors: [{ row: 0, reason: '엑셀 파일 내 시트가 없습니다.' }] };
  }

  const ws = wb.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rows.length === 0) {
    return { validItems: [], errors: [{ row: 0, reason: '엑셀 파일에 데이터가 없습니다.' }] };
  }

  const validItems: RosterItem[] = [];
  const errors: RosterValidationError[] = [];
  const seenKeys = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1, 1-indexed

    // Check possible column names in Korean or English
    const gradeRaw = row['학년'] ?? row['grade'] ?? row['Grade'];
    const classRaw = row['반'] ?? row['class'] ?? row['Class'] ?? row['classNum'];
    const numberRaw = row['번호'] ?? row['number'] ?? row['Number'] ?? row['num'];
    const nameRaw = row['이름'] ?? row['name'] ?? row['Name'] ?? row['학생이름'];

    if (gradeRaw === undefined || classRaw === undefined || numberRaw === undefined || nameRaw === undefined) {
      errors.push({
        row: rowNum,
        reason: '필수 열(학년, 반, 번호, 이름) 중 일부가 누락되었습니다.',
        data: { grade: gradeRaw, classNum: classRaw, number: numberRaw, name: nameRaw }
      });
      return;
    }

    const grade = parseInt(String(gradeRaw).trim(), 10);
    const classNum = parseInt(String(classRaw).trim(), 10);
    const number = parseInt(String(numberRaw).trim(), 10);
    const name = String(nameRaw).trim();

    if (isNaN(grade) || grade <= 0) {
      errors.push({ row: rowNum, reason: `학년 번호가 올바른 숫자가 아닙니다 (${gradeRaw})`, data: { grade, classNum, number, name } });
      return;
    }

    if (isNaN(classNum) || classNum <= 0) {
      errors.push({ row: rowNum, reason: `반 번호가 올바른 숫자가 아닙니다 (${classRaw})`, data: { grade, classNum, number, name } });
      return;
    }

    if (isNaN(number) || number <= 0) {
      errors.push({ row: rowNum, reason: `학생 번호가 올바른 숫자가 아닙니다 (${numberRaw})`, data: { grade, classNum, number, name } });
      return;
    }

    if (!name) {
      errors.push({ row: rowNum, reason: '학생 이름이 비어 있습니다.', data: { grade, classNum, number, name } });
      return;
    }

    const key = `${grade}-${classNum}-${number}`;
    if (seenKeys.has(key)) {
      errors.push({ row: rowNum, reason: `동일한 학년-반-번호(${grade}학년 ${classNum}반 ${number}번)가 엑셀 파일 내에 중복되어 있습니다.`, data: { grade, classNum, number, name } });
      return;
    }
    seenKeys.add(key);

    validItems.push({ grade, classNum, number, name });
  });

  return { validItems, errors };
}

/**
 * Compare newly uploaded roster against existing roster
 */
export function computeRosterDiff(existing: RosterItem[], incoming: RosterItem[]): RosterDiff {
  const existingMap = new Map<string, RosterItem>();
  existing.forEach(item => existingMap.set(`${item.grade}-${item.classNum}-${item.number}`, item));

  const incomingMap = new Map<string, RosterItem>();
  incoming.forEach(item => incomingMap.set(`${item.grade}-${item.classNum}-${item.number}`, item));

  const toAdd: RosterItem[] = [];
  const unchanged: RosterItem[] = [];
  const changed: { before: RosterItem; after: RosterItem }[] = [];

  incoming.forEach(item => {
    const key = `${item.grade}-${item.classNum}-${item.number}`;
    const old = existingMap.get(key);
    if (!old) {
      toAdd.push(item);
    } else if (old.name !== item.name) {
      changed.push({ before: old, after: item });
    } else {
      unchanged.push(item);
    }
  });

  const toRemove: RosterItem[] = [];
  existing.forEach(item => {
    const key = `${item.grade}-${item.classNum}-${item.number}`;
    if (!incomingMap.has(key)) {
      toRemove.push(item);
    }
  });

  return {
    totalExisting: existing.length,
    totalNew: incoming.length,
    toAdd,
    toRemove,
    unchanged,
    changed,
  };
}

/**
 * Export progress list to Excel file
 */
export function exportProgressToExcel(students: StudentProgress[], filename = '롤모델챗봇_전체학생_진행현황.xlsx') {
  const rows = students.map(s => {
    const stepLabels: Record<number, string> = {
      1: 'STEP 1 (롤모델 정보)',
      2: 'STEP 2 (챗봇 목적)',
      3: 'STEP 3 (성격/말투)',
      4: 'STEP 4 (답변 방식)',
      5: 'STEP 5 (안전 규칙)',
      6: 'STEP 6 (프롬프트 완성)',
      7: 'STEP 7 (Gemini 제작 안내)',
      8: 'STEP 8 (챗봇 테스트)',
      9: 'STEP 9 (프롬프트 수정)',
      10: 'STEP 10 (최종 제출)',
    };

    return {
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.number,
      '이름': s.name,
      '현재 단계': stepLabels[s.currentStep] || `STEP ${s.currentStep}`,
      '롤모델 이름': s.step1?.roleModelName || '',
      '롤모델 직업': s.step1?.roleModelJob || '',
      '챗봇 이름': s.step6?.chatbotName || '',
      '프롬프트 완성': s.isPromptCompleted ? '완료' : '미완료',
      'Gem 테스트': s.isTestCompleted ? '완료' : '미완료',
      'Gem 링크 제출': s.isGemSubmitted ? '제출' : '미제출',
      '최종 제출': s.isFinalSubmitted ? '제출 완료' : '진행 중',
      '마지막 저장 시각': s.updatedAt ? new Date(s.updatedAt).toLocaleString('ko-KR') : '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '진행현황');
  XLSX.writeFile(wb, filename);
}

/**
 * Export final submissions to Excel file
 */
export function exportSubmissionsToExcel(students: StudentProgress[], filename = '롤모델챗봇_최종제출_결과.xlsx') {
  const submittedStudents = students.filter(s => s.isFinalSubmitted || s.step10?.gemUrl);

  const rows = submittedStudents.map(s => {
    return {
      '제출 시각': s.step10?.submittedAt ? new Date(s.step10.submittedAt).toLocaleString('ko-KR') : '',
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.number,
      '이름': s.name,
      '롤모델 이름': s.step1?.roleModelName || '',
      '롤모델 직업': s.step1?.roleModelJob || '',
      '챗봇 이름': s.step6?.chatbotName || '',
      'Gemini Gem 링크': s.step10?.gemUrl || '',
      '대표 질문 1': s.step10?.sampleQuestion1 || '',
      '대표 답변 1': s.step10?.sampleAnswer1 || '',
      '대표 질문 2': s.step10?.sampleQuestion2 || '',
      '대표 답변 2': s.step10?.sampleAnswer2 || '',
      '대표 질문 3': s.step10?.sampleQuestion3 || '',
      '대표 답변 3': s.step10?.sampleAnswer3 || '',
      '수정한 점': s.step10?.revisionSummary || s.step8?.revisionNote || '',
      '제작 소감': s.step10?.reflection || '',
      '최종 프롬프트': s.step6?.finalPrompt || '',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '최종제출물');
  XLSX.writeFile(wb, filename);
}
