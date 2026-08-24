import * as XLSX from 'xlsx';
import {
  RosterItem,
  RosterValidationError,
  RosterDiff,
  RosterValidationResult,
  RosterRowPreview,
  StudentProgress,
} from '../types';

/**
 * Generate a blank Roster template XLSX for teachers to download
 * Row 1 header: 학년, 반, 번호, 이름 (No dummy example data rows)
 */
export function generateRosterTemplate(): Uint8Array {
  const wb = XLSX.utils.book_new();
  const headers = [['학년', '반', '번호', '이름']];
  const ws = XLSX.utils.aoa_to_sheet(headers);
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Download blank roster template directly from browser
 */
export function downloadRosterTemplateFile() {
  const data = generateRosterTemplate();
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
 * Parse an uploaded Excel file, validate all rows, and return preview metadata
 */
export function parseAndValidateRosterFile(fileData: ArrayBuffer): RosterValidationResult {
  const wb = XLSX.read(fileData, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return {
      totalCount: 0,
      validCount: 0,
      errorCount: 1,
      rows: [],
      validItems: [],
      errors: [{ row: 0, reason: '엑셀 파일 내 시트를 찾을 수 없습니다.' }],
    };
  }

  const ws = wb.Sheets[sheetName];
  // Get raw 2D array of rows to reliably check header and row contents
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rawRows.length === 0) {
    return {
      totalCount: 0,
      validCount: 0,
      errorCount: 1,
      rows: [],
      validItems: [],
      errors: [{ row: 0, reason: '엑셀 파일에 데이터가 없습니다.' }],
    };
  }

  // Find header row (usually first non-empty row)
  let headerIndex = -1;
  let gradeCol = -1;
  let classCol = -1;
  let numberCol = -1;
  let nameCol = -1;

  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const gIdx = row.findIndex((c) => /^(학년|grade)$/i.test(String(c).trim()));
    const cIdx = row.findIndex((c) => /^(반|class|classNum)$/i.test(String(c).trim()));
    const numIdx = row.findIndex((c) => /^(번호|number|num)$/i.test(String(c).trim()));
    const nameIdx = row.findIndex((c) => /^(이름|name|학생이름)$/i.test(String(c).trim()));

    if (gIdx !== -1 && cIdx !== -1 && numIdx !== -1 && nameIdx !== -1) {
      headerIndex = i;
      gradeCol = gIdx;
      classCol = cIdx;
      numberCol = numIdx;
      nameCol = nameIdx;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      totalCount: 0,
      validCount: 0,
      errorCount: 1,
      rows: [],
      validItems: [],
      errors: [
        {
          row: 1,
          reason: '엑셀 첫 행의 열 이름이 올바르지 않습니다. 반드시 [학년, 반, 번호, 이름] 열이 포함되어야 합니다.',
        },
      ],
    };
  }

  const rows: RosterRowPreview[] = [];
  const validItems: RosterItem[] = [];
  const errors: RosterValidationError[] = [];
  const seenKeys = new Map<string, number>(); // studentKey -> first seen row number
  const seenIdentical = new Map<string, number>(); // studentKey + name -> first seen row number

  let dataRowCount = 0;

  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (!Array.isArray(rawRow)) continue;

    const gradeRaw = rawRow[gradeCol];
    const classRaw = rawRow[classCol];
    const numberRaw = rawRow[numberCol];
    const nameRaw = rawRow[nameCol];

    const isGradeEmpty = gradeRaw === undefined || String(gradeRaw).trim() === '';
    const isClassEmpty = classRaw === undefined || String(classRaw).trim() === '';
    const isNumberEmpty = numberRaw === undefined || String(numberRaw).trim() === '';
    const isNameEmpty = nameRaw === undefined || String(nameRaw).trim() === '';

    // Ignore completely empty rows
    if (isGradeEmpty && isClassEmpty && isNumberEmpty && isNameEmpty) {
      continue;
    }

    dataRowCount++;
    const excelRowNum = i + 1; // 1-indexed Excel row number

    let errorReason: string | undefined;

    // Check missing fields
    if (isGradeEmpty) {
      errorReason = '학년이 입력되지 않았습니다.';
    } else if (isClassEmpty) {
      errorReason = '반이 입력되지 않았습니다.';
    } else if (isNumberEmpty) {
      errorReason = '번호가 입력되지 않았습니다.';
    } else if (isNameEmpty) {
      errorReason = '이름이 입력되지 않았습니다.';
    }

    // Number validation
    let grade = 0;
    let classNum = 0;
    let number = 0;
    const name = String(nameRaw || '').trim();

    if (!errorReason) {
      grade = Number(gradeRaw);
      classNum = Number(classRaw);
      number = Number(numberRaw);

      if (isNaN(grade) || !Number.isInteger(grade) || grade <= 0) {
        errorReason = `학년이 올바른 숫자가 아닙니다. ('${gradeRaw}')`;
      } else if (isNaN(classNum) || !Number.isInteger(classNum) || classNum <= 0) {
        errorReason = `반이 올바른 숫자가 아닙니다. ('${classRaw}')`;
      } else if (isNaN(number) || !Number.isInteger(number) || number <= 0) {
        errorReason = `번호가 올바른 숫자가 아닙니다. ('${numberRaw}')`;
      }
    }

    // Duplicate check within uploaded file
    if (!errorReason) {
      const key = `${grade}-${classNum}-${number}`;
      const fullKey = `${grade}-${classNum}-${number}-${name}`;

      if (seenIdentical.has(fullKey)) {
        const prevRow = seenIdentical.get(fullKey)!;
        errorReason = `${grade}학년 ${classNum}반 ${number}번 (${name}) - ${prevRow}행과 완전히 동일한 학생이 중복 등록되어 있습니다.`;
      } else if (seenKeys.has(key)) {
        const prevRow = seenKeys.get(key)!;
        errorReason = `${grade}학년 ${classNum}반 ${number}번 - ${prevRow}행과 같은 학년/반/번호가 중복되어 있습니다.`;
      } else {
        seenKeys.set(key, excelRowNum);
        seenIdentical.set(fullKey, excelRowNum);
      }
    }

    const isValid = !errorReason;

    const rowPreview: RosterRowPreview = {
      rowNum: excelRowNum,
      gradeRaw: String(gradeRaw ?? ''),
      classRaw: String(classRaw ?? ''),
      numberRaw: String(numberRaw ?? ''),
      nameRaw: String(nameRaw ?? ''),
      isValid,
      errorReason,
      item: isValid ? { grade, classNum, number, name } : undefined,
    };

    rows.push(rowPreview);

    if (isValid) {
      validItems.push({ grade, classNum, number, name });
    } else {
      errors.push({
        row: excelRowNum,
        reason: errorReason || '알 수 없는 오류',
        data: { grade, classNum, number, name },
      });
    }
  }

  return {
    totalCount: dataRowCount,
    validCount: validItems.length,
    errorCount: errors.length,
    rows,
    validItems,
    errors,
  };
}

/**
 * Compare newly uploaded roster against existing Google Sheets roster
 */
export function computeRosterDiff(existing: RosterItem[], incoming: RosterItem[]): RosterDiff {
  const existingMap = new Map<string, RosterItem>();
  existing.forEach((item) => {
    existingMap.set(`${item.grade}-${item.classNum}-${item.number}`, item);
  });

  const incomingMap = new Map<string, RosterItem>();
  incoming.forEach((item) => {
    incomingMap.set(`${item.grade}-${item.classNum}-${item.number}`, item);
  });

  const toAdd: RosterItem[] = [];
  const unchanged: RosterItem[] = [];
  const changed: { before: RosterItem; after: RosterItem }[] = [];

  incoming.forEach((item) => {
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
  existing.forEach((item) => {
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
 * Helper to get today's date formatted as YYYYMMDD
 */
export function getFormattedDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Priority helper to resolve the effective prompt
 */
export function getStudentPrompt(s: StudentProgress): string {
  return (
    s.step6?.finalPrompt ||
    s.step6?.revisedPrompt ||
    s.step6?.initialPrompt ||
    ''
  ).trim();
}

/**
 * Export progress list to Excel file
 * Columns: 학년, 반, 번호, 이름, 롤모델, 롤모델 직업, 챗봇 이름, 현재 STEP, 마지막 저장 시각, 프롬프트 완성 여부, 테스트 완료 여부, Gem 링크 제출 여부, 최종 제출 여부
 * File name: 롤모델챗봇_진행현황_YYYYMMDD.xlsx
 */
export function exportProgressToExcel(
  students: StudentProgress[],
  filename = `롤모델챗봇_진행현황_${getFormattedDateString()}.xlsx`
) {
  const rows = students.map((s) => {
    const prompt = getStudentPrompt(s);
    const hasPrompt = Boolean(s.isPromptCompleted || prompt);
    const hasTest = Boolean(s.isTestCompleted || s.step8?.testedAt || s.currentStep >= 9);
    const hasGem = Boolean(s.isGemSubmitted || s.step10?.gemUrl);
    const isSubmitted = Boolean(
      s.isFinalSubmitted ||
      (s.step10?.barrierAnswer && s.step10?.finalCareerReflection) ||
      (s.step11?.barrierAnswer && s.step11?.finalCareerReflection)
    );

    return {
      학년: s.grade,
      반: s.classNum,
      번호: s.number,
      이름: s.name,
      롤모델: s.step1?.roleModelName || '',
      '롤모델 직업': s.step1?.roleModelJob || '',
      '챗봇 이름': s.step6?.chatbotName || '',
      '현재 STEP': `STEP ${s.currentStep}`,
      '마지막 저장 시각': s.updatedAt ? new Date(s.updatedAt).toLocaleString('ko-KR') : '',
      '프롬프트 완성 여부': hasPrompt ? '완료' : '미완료',
      '테스트 완료 여부': hasTest ? '완료' : '미완료',
      'Gem 링크 제출 여부': hasGem ? '제출' : '미제출',
      '최종 완료 여부': isSubmitted ? '최종 완료' : '진행 중',
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '진행현황');
  XLSX.writeFile(wb, filename);
}

/**
 * Export final submissions & counseling data to Excel file
 * Columns: 학년, 반, 번호, 이름, 롤모델 이름, 롤모델 직업, 챗봇 이름, 최종 프롬프트, Gemini Gem 공유 링크, 상담 문답, 최종 성찰, 제출 시각
 * File name: 롤모델챗봇_최종결과_YYYYMMDD.xlsx
 */
export function exportSubmissionsToExcel(
  students: StudentProgress[],
  filename = `롤모델챗봇_최종결과_${getFormattedDateString()}.xlsx`
) {
  // Target students who have final submissions or completed prompts/gem links
  const targetStudents = students.filter(
    (s) =>
      s.isFinalSubmitted ||
      s.step10?.gemUrl ||
      s.step10?.barrierAnswer ||
      s.step11?.barrierAnswer ||
      getStudentPrompt(s) ||
      s.step10?.submittedAt
  );

  const studentsToExport = targetStudents.length > 0 ? targetStudents : students;

  const rows = studentsToExport.map((s) => {
    const finalPrompt = getStudentPrompt(s);
    const revisionContent =
      s.step10?.revisionSummary ||
      s.step8?.revisionNote ||
      (s.step8?.problemDescription ? `문제점: ${s.step8.problemDescription}` : '');

    const submissionTime = s.step10?.submittedAt
      ? new Date(s.step10.submittedAt).toLocaleString('ko-KR')
      : s.step11?.completedAt
      ? new Date(s.step11.completedAt).toLocaleString('ko-KR')
      : s.updatedAt
      ? new Date(s.updatedAt).toLocaleString('ko-KR')
      : '';

    const barrierAns = s.step10?.barrierAnswer || s.step11?.barrierAnswer || '';
    const barrierRef = s.step10?.barrierReflection || s.step11?.barrierReflection || '';
    const decisionAns = s.step10?.decisionAnswer || s.step11?.decisionAnswer || '';
    const decisionRef = s.step10?.decisionReflection || s.step11?.decisionReflection || '';
    const educationAns = s.step10?.educationAnswer || s.step11?.educationAnswer || '';
    const educationRef = s.step10?.educationReflection || s.step11?.educationReflection || '';
    const finalCareerRef = s.step10?.finalCareerReflection || s.step11?.finalCareerReflection || '';

    const isSubmitted = Boolean(
      s.isFinalSubmitted ||
      (barrierAns && decisionAns && educationAns && finalCareerRef)
    );

    return {
      학년: s.grade,
      반: s.classNum,
      번호: s.number,
      이름: s.name,
      '롤모델 이름': s.step1?.roleModelName || '',
      '롤모델 직업': s.step1?.roleModelJob || '',
      '챗봇 이름': s.step6?.chatbotName || '',
      '최종 프롬프트': finalPrompt,
      'Gemini Gem 공유 링크': s.step10?.gemUrl || '',
      '상담1_장벽극복_답변': barrierAns,
      '상담1_장벽극복_알게된점': barrierRef,
      '상담2_의사결정_답변': decisionAns,
      '상담2_의사결정_알게된점': decisionRef,
      '상담3_진학설계_답변': educationAns,
      '상담3_진학설계_알게된점': educationRef,
      '상담후_나의_진로생각': finalCareerRef,
      '수정 내용': revisionContent,
      '최종 완료 여부': isSubmitted ? '최종 완료' : '진행 중',
      '제출 시각': submissionTime,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '최종평가결과');
  XLSX.writeFile(wb, filename);
}

