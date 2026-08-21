import React, { useState } from 'react';
import { StudentProgress, RosterItem } from '../../types';
import {
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Code2,
  Eye,
  Sparkles,
} from 'lucide-react';
import { exportProgressToExcel, exportSubmissionsToExcel, getStudentPrompt } from '../../utils/excel';
import { STEP_NAMES } from '../common/StepProgressBar';

interface AdminStudentListProps {
  students: StudentProgress[];
  roster: RosterItem[];
  selectedGrade: number | 'all';
  selectedClass: number | 'all';
  onFilterClass: (grade: number | 'all', classNum: number | 'all') => void;
  onSelectStudentDetail: (student: StudentProgress) => void;
  onPreviewStudentMode: (student: StudentProgress) => void;
  onPrintStudent: (student: StudentProgress) => void;
  onPrintMultiple: (students: StudentProgress[], title: string) => void;
  onOpenRosterManager: () => void;
  onOpenGasIntegration: () => void;
}

export const AdminStudentList: React.FC<AdminStudentListProps> = ({
  students,
  roster,
  selectedGrade,
  selectedClass,
  onFilterClass,
  onSelectStudentDetail,
  onPreviewStudentMode,
  onPrintStudent,
  onPrintMultiple,
  onOpenRosterManager,
  onOpenGasIntegration,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'promptDone' | 'inProgress' | 'notStarted'>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Distinct grades and classes for filter dropdowns (from roster or loaded students)
  const allGrades = Array.from(
    new Set<number>([
      ...roster.map((r) => r.grade),
      ...students.map((s) => s.grade),
    ].filter(Boolean))
  ).sort((a, b) => a - b);
  const grades = allGrades.length > 0 ? allGrades : [1, 2, 3];

  const classesForGrade = Array.from(
    new Set<number>(
      [...roster, ...students]
        .filter((r) => (selectedGrade === 'all' ? true : r.grade === selectedGrade))
        .map((r) => r.classNum)
        .filter(Boolean)
    )
  ).sort((a, b) => a - b);

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
    if (selectedClass !== 'all' && s.classNum !== selectedClass) return false;

    if (stepFilter !== 'all' && s.currentStep !== Number(stepFilter)) return false;

    const hasStarted = Boolean(s.step1?.roleModelName || s.currentStep > 1);
    if (statusFilter === 'submitted' && !s.isFinalSubmitted) return false;
    if (statusFilter === 'promptDone' && !s.isPromptCompleted) return false;
    if (statusFilter === 'inProgress' && (!hasStarted || s.isFinalSubmitted)) return false;
    if (statusFilter === 'notStarted' && hasStarted) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchRoleModel = (s.step1?.roleModelName || '').toLowerCase().includes(q);
      const matchJob = (s.step1?.roleModelJob || '').toLowerCase().includes(q);
      const matchBot = (s.step6?.chatbotName || '').toLowerCase().includes(q);
      if (!matchName && !matchRoleModel && !matchJob && !matchBot) return false;
    }

    return true;
  });

  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filteredStudents.map((s) => s.studentKey)));
    }
  };

  const toggleSelectOne = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handlePrintSelected = () => {
    const selectedList = students.filter((s) => selectedKeys.has(s.studentKey));
    if (selectedList.length === 0) return;

    const finishedStudents = selectedList.filter((s) => Boolean(getStudentPrompt(s)));
    const uncompletedCount = selectedList.length - finishedStudents.length;

    if (finishedStudents.length === 0) {
      alert(`선택한 학생 ${selectedList.length}명 중 작성된 프롬프트가 있는 학생이 없습니다.`);
      return;
    }

    const message =
      `선택 학생 ${selectedList.length}명 중\n` +
      `프롬프트 완성 ${finishedStudents.length}명\n` +
      `미완성 ${uncompletedCount}명\n\n` +
      `${finishedStudents.length}명의 결과물을 인쇄하시겠습니까?`;

    if (window.confirm(message)) {
      onPrintMultiple(
        finishedStudents,
        `선택 학생 (${finishedStudents.length}명) 롤모델 챗봇 결과 보고서`
      );
    }
  };

  const handlePrintCurrentClass = () => {
    if (selectedGrade === 'all' || selectedClass === 'all') {
      alert('반 필터를 먼저 선택해 주세요.');
      return;
    }
    const classStudents = students.filter(
      (s) => s.grade === selectedGrade && s.classNum === selectedClass
    );
    if (classStudents.length === 0) {
      alert(`${selectedGrade}학년 ${selectedClass}반에 해당하는 학생 데이터가 없습니다.`);
      return;
    }

    const finishedStudents = classStudents.filter((s) => Boolean(getStudentPrompt(s)));
    const uncompletedCount = classStudents.length - finishedStudents.length;

    if (finishedStudents.length === 0) {
      alert(`${selectedGrade}학년 ${selectedClass}반 총 ${classStudents.length}명 중 작성된 프롬프트가 있는 학생이 없습니다.`);
      return;
    }

    const message =
      `${selectedGrade}학년 ${selectedClass}반 총 ${classStudents.length}명 중\n` +
      `프롬프트 완성 ${finishedStudents.length}명\n` +
      `미완성 ${uncompletedCount}명\n\n` +
      `${finishedStudents.length}명의 결과물을 인쇄하시겠습니까?`;

    if (window.confirm(message)) {
      onPrintMultiple(
        finishedStudents,
        `${selectedGrade}학년 ${selectedClass}반 롤모델 챗봇 결과 보고서`
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search & Filter row */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="학생 이름, 롤모델, 챗봇명 검색..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none transition-all"
            />
          </div>

          {/* Grade Selector */}
          <select
            value={selectedGrade}
            onChange={(e) => onFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value), 'all')}
            className="px-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none cursor-pointer"
          >
            <option value="all">전체 학년</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                {g}학년
              </option>
            ))}
          </select>

          {/* Class Selector */}
          <select
            value={selectedClass}
            onChange={(e) => onFilterClass(selectedGrade, e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none cursor-pointer"
          >
            <option value="all">전체 반</option>
            {classesForGrade.map((c) => (
              <option key={c} value={c}>
                {c}반
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none cursor-pointer"
          >
            <option value="all">전체 상태</option>
            <option value="submitted">최종 제출 완료</option>
            <option value="promptDone">프롬프트 완성</option>
            <option value="inProgress">작성 진행 중</option>
            <option value="notStarted">미시작</option>
          </select>

          {/* Step Filter */}
          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none cursor-pointer"
          >
            <option value="all">전체 단계 (STEP)</option>
            {STEP_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                STEP {idx + 1}. {name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Current Class */}
          {selectedGrade !== 'all' && selectedClass !== 'all' && (
            <button
              type="button"
              onClick={handlePrintCurrentClass}
              className="px-3.5 py-2.5 bg-[#F1F4EF] hover:bg-[#EAECE6] text-[#4B6344] border border-[#DCE2D7] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="현재 선택된 반의 프롬프트 완성 학생 일괄 인쇄"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>현재 반 전체 프롬프트 인쇄</span>
            </button>
          )}

          {/* Print Selected Batch */}
          {selectedKeys.size > 0 && (
            <button
              type="button"
              onClick={handlePrintSelected}
              className="px-3.5 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="선택한 학생 중 프롬프트 완성 학생 일괄 인쇄"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>선택 학생 프롬프트 인쇄 ({selectedKeys.size}명)</span>
            </button>
          )}

          {/* Excel Export Progress */}
          <button
            type="button"
            onClick={() => exportProgressToExcel(students)}
            className="px-3.5 py-2.5 bg-[#F9FAF8] hover:bg-[#F1F4EF] text-[#2C362B] border border-[#E1E4D8] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="전체 학생 진행 현황 다운로드 (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-[#4B6344]" />
            <span>진행 현황 .xlsx</span>
          </button>

          {/* Excel Export Submissions */}
          <button
            type="button"
            onClick={() => exportSubmissionsToExcel(students)}
            className="px-3.5 py-2.5 bg-[#F9FAF8] hover:bg-[#F1F4EF] text-[#2C362B] border border-[#E1E4D8] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="최종 제출 결과 다운로드 (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-[#4B6344]" />
            <span>제출 결과 .xlsx</span>
          </button>

          {/* Roster Management Button */}
          <button
            type="button"
            onClick={onOpenRosterManager}
            className="px-3.5 py-2.5 bg-[#2C362B] hover:bg-[#1F271E] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>학생 명단 관리</span>
          </button>

          {/* Google Apps Script Integration Button */}
          <button
            type="button"
            onClick={onOpenGasIntegration}
            className="px-3.5 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Google 시트 연동</span>
          </button>
        </div>
      </div>

      {/* Student List Table Card */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9FAF8] border-b border-[#E1E4D8] text-[#5D6B58] font-bold">
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="cursor-pointer text-[#6B7280] hover:text-[#4B6344]"
                  >
                    {selectedKeys.size === filteredStudents.length && filteredStudents.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-[#4B6344]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">학번</th>
                <th className="py-3 px-3">이름</th>
                <th className="py-3 px-3">롤모델</th>
                <th className="py-3 px-3">챗봇 이름</th>
                <th className="py-3 px-3 text-center">진행 단계</th>
                <th className="py-3 px-3 text-center">프롬프트</th>
                <th className="py-3 px-3 text-center">Gem 테스트</th>
                <th className="py-3 px-3 text-center">최종 제출</th>
                <th className="py-3 px-3 text-right">마지막 저장</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E4D8]/60 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[#6B7280]">
                    조건에 해당하는 학생 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const isChecked = selectedKeys.has(s.studentKey);
                  const hasStarted = Boolean(s.step1?.roleModelName || s.currentStep > 1);

                  return (
                    <tr
                      key={s.studentKey}
                      className={`hover:bg-[#F9FAF8] transition-colors ${
                        isChecked ? 'bg-[#F1F4EF]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(s.studentKey)}
                          className="cursor-pointer text-[#6B7280] hover:text-[#4B6344]"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#4B6344]" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Number */}
                      <td className="py-3 px-3 text-[#5D6B58] font-mono">
                        {s.grade}-{s.classNum}-{String(s.number).padStart(2, '0')}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-3 font-bold text-[#2C362B]">
                        <button
                          type="button"
                          onClick={() => onSelectStudentDetail(s)}
                          className="hover:text-[#4B6344] hover:underline cursor-pointer"
                        >
                          {s.name}
                        </button>
                      </td>

                      {/* Role Model */}
                      <td className="py-3 px-3 text-[#2C362B]">
                        {s.step1?.roleModelName ? (
                          <span>
                            <strong className="text-[#2C362B]">{s.step1.roleModelName}</strong>
                            <span className="text-[11px] text-[#6B7280] ml-1">
                              ({s.step1.roleModelJob || '직업 미입력'})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#AAB5A5]">-</span>
                        )}
                      </td>

                      {/* Chatbot Name */}
                      <td className="py-3 px-3 text-[#5D6B58] truncate max-w-[150px]">
                        {s.step6?.chatbotName || <span className="text-[#AAB5A5]">-</span>}
                      </td>

                      {/* Current Step */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F1F4EF] text-[#4B6344]">
                          STEP {s.currentStep}
                        </span>
                      </td>

                      {/* Prompt status */}
                      <td className="py-3 px-3 text-center">
                        {s.isPromptCompleted ? (
                          <span className="px-2 py-0.5 bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7] rounded-md font-bold text-[11px]">
                            완성
                          </span>
                        ) : hasStarted ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-[#9E6B38] rounded-md font-bold text-[11px]">
                            작성 중
                          </span>
                        ) : (
                          <span className="text-[#AAB5A5]">-</span>
                        )}
                      </td>

                      {/* Test status */}
                      <td className="py-3 px-3 text-center">
                        {s.isTestCompleted ? (
                          <span className="px-2 py-0.5 bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7] rounded-md font-bold text-[11px]">
                            완료
                          </span>
                        ) : s.currentStep >= 8 ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-[#9E6B38] rounded-md font-bold text-[11px]">
                            진행 중
                          </span>
                        ) : (
                          <span className="text-[#AAB5A5]">-</span>
                        )}
                      </td>

                      {/* Final submission status */}
                      <td className="py-3 px-3 text-center">
                        {s.isFinalSubmitted ? (
                          <span className="px-2 py-0.5 bg-[#4B6344] text-white rounded-md font-bold text-[11px]">
                            제출 완료
                          </span>
                        ) : s.step10?.gemUrl ? (
                          <span className="px-2 py-0.5 bg-[#F1F4EF] text-[#4B6344] rounded-md font-bold text-[11px]">
                            링크 등록
                          </span>
                        ) : (
                          <span className="text-[#AAB5A5]">-</span>
                        )}
                      </td>

                      {/* Last Saved */}
                      <td className="py-3 px-3 text-right text-[#6B7280] text-[11px]">
                        {s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectStudentDetail(s)}
                            title="상세 보기"
                            className="p-1.5 text-[#5D6B58] hover:text-[#4B6344] hover:bg-[#F1F4EF] rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPreviewStudentMode(s)}
                            title="학생 화면으로 미리보기"
                            className="p-1.5 text-[#5D6B58] hover:text-[#4B6344] hover:bg-[#F1F4EF] rounded-lg transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintStudent(s)}
                            title="프롬프트 인쇄"
                            className="p-1.5 text-[#5D6B58] hover:text-[#4B6344] hover:bg-[#F1F4EF] rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
