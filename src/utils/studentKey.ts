/** The existing grade-class-number identity, with consistent numeric formatting. */
export function createStudentKey(student: { grade: unknown; classNum?: unknown; class?: unknown; number: unknown }): string {
  const parts = [student.grade, student.classNum ?? student.class, student.number].map(value =>
    Number(String(value ?? '').normalize('NFKC').trim()));
  if (parts.some(value => !Number.isInteger(value) || value <= 0)) throw new Error('학년, 반, 번호를 확인해 주세요.');
  return parts.join('-');
}
