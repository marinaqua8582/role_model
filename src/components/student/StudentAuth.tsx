import React, { useState, useEffect } from 'react';
import { Sparkles, User, AlertCircle, ArrowRight, RotateCcw, CheckCircle2, BookOpen, ShieldAlert } from 'lucide-react';
import { getRosterOptions, verifyStudentAuth, resetStudentProgress, createInitialStudentProgress } from '../../api/client';
import { StudentInfo, StudentProgress, RosterItem } from '../../types';
import { STEP_NAMES } from '../common/StepProgressBar';

interface StudentAuthProps {
  roster?: RosterItem[];
  onAuthenticated: (studentOrProgress: StudentProgress | StudentInfo, progress?: StudentProgress) => void;
  onOpenAdmin?: () => void;
}

function computeOptionsFromRoster(rosterList: RosterItem[]) {
  const gradesSet = new Set<number>();
  const classesByGrade: Record<number, Set<number>> = {};
  const numbersByClass: Record<string, Set<number>> = {};

  rosterList.forEach((item) => {
    const g = Number(item.grade);
    const c = Number(item.classNum !== undefined ? item.classNum : (item as any).class);
    const n = Number(item.number);
    if (!isNaN(g) && !isNaN(c) && !isNaN(n) && g > 0 && c > 0 && n > 0) {
      gradesSet.add(g);
      if (!classesByGrade[g]) classesByGrade[g] = new Set();
      classesByGrade[g].add(c);

      const classKey = `${g}-${c}`;
      if (!numbersByClass[classKey]) numbersByClass[classKey] = new Set();
      numbersByClass[classKey].add(n);
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

export const StudentAuth: React.FC<StudentAuthProps> = ({ roster, onAuthenticated, onOpenAdmin }) => {
  const [options, setOptions] = useState<{
    grades: number[];
    classesByGrade: Record<number, number[]>;
    numbersByClass: Record<string, number[]>;
  }>({
    grades: [],
    classesByGrade: {},
    numbersByClass: {},
  });

  const [selectedGrade, setSelectedGrade] = useState<number | ''>('');
  const [selectedClass, setSelectedClass] = useState<number | ''>('');
  const [selectedNumber, setSelectedNumber] = useState<number | ''>('');
  const [name, setName] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingOptions, setIsFetchingOptions] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Confirmation modal state for existing vs new
  const [verifiedState, setVerifiedState] = useState<{
    student: StudentInfo;
    hasExisting: boolean;
    progress: StudentProgress;
  } | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const applyNewOptions = (data: {
    grades: number[];
    classesByGrade: Record<number, number[]>;
    numbersByClass: Record<string, number[]>;
  }) => {
    if (!data || !Array.isArray(data.grades) || data.grades.length === 0) return;
    setOptions(data);

    setSelectedGrade((prevGrade) => {
      if (prevGrade !== '' && data.grades.includes(prevGrade)) {
        return prevGrade;
      }
      if (data.grades.length === 1) {
        return data.grades[0];
      }
      return '';
    });
  };

  // Always fetch fresh Roster options directly from Google Sheets / server on mount
  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setIsFetchingOptions(true);
      try {
        const data = await getRosterOptions();
        if (isMounted && data && Array.isArray(data.grades) && data.grades.length > 0) {
          applyNewOptions(data);
        } else if (isMounted && roster && roster.length > 0) {
          // Fallback to roster prop only if server options returned empty
          const computed = computeOptionsFromRoster(roster);
          applyNewOptions(computed);
        }
      } catch (e) {
        console.error('Failed to load roster options', e);
        if (isMounted && roster && roster.length > 0) {
          const computed = computeOptionsFromRoster(roster);
          applyNewOptions(computed);
        }
      } finally {
        if (isMounted) {
          setIsFetchingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  // If roster prop is updated after mount (e.g. from admin roster manager), update options
  useEffect(() => {
    if (roster && roster.length > 0) {
      const computed = computeOptionsFromRoster(roster);
      if (computed.grades.length > 0) {
        applyNewOptions(computed);
      }
    }
  }, [roster]);

  const handleGradeChange = (val: string) => {
    if (!val) {
      setSelectedGrade('');
      setSelectedClass('');
      setSelectedNumber('');
      return;
    }
    const gradeNum = Number(val);
    setSelectedGrade(gradeNum);
    setSelectedClass('');
    setSelectedNumber('');
  };

  const handleClassChange = (val: string) => {
    if (!val) {
      setSelectedClass('');
      setSelectedNumber('');
      return;
    }
    const classNum = Number(val);
    setSelectedClass(classNum);
    setSelectedNumber('');
  };

  const handleNumberChange = (val: string) => {
    if (!val) {
      setSelectedNumber('');
      return;
    }
    setSelectedNumber(Number(val));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedGrade === '' || selectedClass === '' || selectedNumber === '') {
      setErrorMessage('학년, 반, 번호를 모두 선택해 주세요.');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('이름을 입력해 주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await verifyStudentAuth({
        grade: Number(selectedGrade),
        classNum: Number(selectedClass),
        number: Number(selectedNumber),
        name: name.trim(),
      });

      if (res.success && res.student) {
        const progress = res.progress || createInitialStudentProgress(res.student);
        if (res.student.googleId) {
          progress.googleId = res.student.googleId;
        }
        setVerifiedState({
          student: res.student,
          hasExisting: Boolean(res.hasExisting),
          progress,
        });
      } else {
        setErrorMessage(
          res.message || '입력한 학생 정보를 확인할 수 없습니다.\n학년, 반, 번호, 이름을 다시 확인해 주세요.'
        );
      }
    } catch (err) {
      setErrorMessage('서버와 통신 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFresh = () => {
    if (!verifiedState) return;
    const fresh = createInitialStudentProgress(verifiedState.student);
    if (verifiedState.student.googleId) {
      fresh.googleId = verifiedState.student.googleId;
    }
    setShowResetConfirm(false);
    onAuthenticated(fresh, fresh);
  };

  const handleContinue = () => {
    if (!verifiedState) return;
    const progressToUse = { ...verifiedState.progress };
    if (verifiedState.student.googleId) {
      progressToUse.googleId = verifiedState.student.googleId;
    }
    onAuthenticated(progressToUse, progressToUse);
  };

  return (
    <div className="w-full max-w-lg mx-auto py-8">
      {/* Top Header Card */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#4B6344] text-white shadow-md shadow-[#4B6344]/20 mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C362B] tracking-tight">
          나의 롤모델 챗봇 만들기
        </h1>
        <p className="text-[#6B7280] mt-2 text-sm sm:text-base">
          나만의 AI 진로 멘토 프롬프트를 설계해 봅시다.
        </p>
      </div>

      {!verifiedState ? (
        /* Student Verification Form */
        <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#F3F4F1]">
            <BookOpen className="w-5 h-5 text-[#4B6344]" />
            <h2 className="text-base font-bold text-[#2C362B]">학생 정보 확인</h2>
            <span className="text-xs text-[#6B7280] ml-auto">중학교 3학년 진로 수업</span>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {!isLoading && !isFetchingOptions && options.grades.length === 0 && (
            <div className="mb-6 p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl flex items-start gap-3 text-[#2C362B] text-xs sm:text-sm">
              <BookOpen className="w-5 h-5 text-[#4B6344] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>등록된 학생 명단이 없습니다.</strong>
                <br />
                선생님께서는 Google Sheets의 <strong>Roster</strong> 시트에 학생 명단을 등록하시거나, 우측 상단 <strong>[선생님 모드]</strong>에서 명단을 등록해 주세요.
              </div>
            </div>
          )}

          {isFetchingOptions && (
            <div className="mb-6 p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl flex items-center justify-center gap-2 text-xs text-[#5D6B58] font-medium animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-[#4B6344] border-t-transparent rounded-full animate-spin"></div>
              <span>Google Sheets에서 학생 명단 정보를 불러오는 중입니다...</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {/* Grade */}
              <div>
                <label className="block text-xs font-bold text-[#4B6344] mb-1.5">
                  학년 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGrade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className={`w-full px-3 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all cursor-pointer ${
                    selectedGrade === '' ? 'text-[#6B7280]' : 'text-[#2C362B]'
                  }`}
                >
                  <option value="">학년 선택</option>
                  {options.grades.map((g) => (
                    <option key={g} value={g} className="text-[#2C362B]">
                      {g}학년
                    </option>
                  ))}
                </select>
              </div>

              {/* Class */}
              <div>
                <label className="block text-xs font-bold text-[#4B6344] mb-1.5">
                  반 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  disabled={selectedGrade === ''}
                  className={`w-full px-3 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    selectedClass === '' ? 'text-[#6B7280]' : 'text-[#2C362B]'
                  }`}
                >
                  <option value="">반 선택</option>
                  {selectedGrade !== '' &&
                    (options.classesByGrade[selectedGrade as number] || []).map((c) => (
                      <option key={c} value={c} className="text-[#2C362B]">
                        {c}반
                      </option>
                    ))}
                </select>
              </div>

              {/* Number */}
              <div>
                <label className="block text-xs font-bold text-[#4B6344] mb-1.5">
                  번호 <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedNumber}
                  onChange={(e) => handleNumberChange(e.target.value)}
                  disabled={selectedGrade === '' || selectedClass === ''}
                  className={`w-full px-3 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    selectedNumber === '' ? 'text-[#6B7280]' : 'text-[#2C362B]'
                  }`}
                >
                  <option value="">번호 선택</option>
                  {selectedGrade !== '' &&
                    selectedClass !== '' &&
                    (options.numbersByClass[`${selectedGrade}-${selectedClass}`] || []).map((n) => (
                      <option key={n} value={n} className="text-[#2C362B]">
                        {n}번
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-[#4B6344] mb-1.5">
                이름 <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="본인 이름을 정확히 입력하세요"
                  autoComplete="off"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                ※ 출석부에 등록된 이름과 일치해야 확인됩니다.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !name.trim() || selectedGrade === '' || selectedClass === '' || selectedNumber === ''}
              className="w-full mt-2 py-3 px-4 bg-[#4B6344] hover:bg-[#3D5237] active:bg-[#2C362B] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-[#4B6344]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isLoading ? (
                <span>정보 확인 중...</span>
              ) : (
                <>
                  <span>내 정보 확인하기</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {onOpenAdmin && (
            <div className="mt-6 pt-4 border-t border-[#F3F4F1] flex items-center justify-between text-xs text-[#6B7280]">
              <span>선생님이신가요?</span>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="font-bold text-[#4B6344] hover:text-[#3D5237] underline transition-colors cursor-pointer"
              >
                교사용 관리자 모드 바로가기
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Confirmation Screen after Student is verified */
        <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6 p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-[#2C362B]">
            <CheckCircle2 className="w-6 h-6 text-[#4B6344] shrink-0" />
            <div>
              <h3 className="font-bold text-base text-[#2C362B]">
                {verifiedState.student.name} 학생, 확인되었습니다!
              </h3>
              <p className="text-xs text-[#5D6B58] mt-0.5 font-medium">
                {verifiedState.student.grade}학년 {verifiedState.student.classNum}반 {verifiedState.student.number}번
              </p>
            </div>
          </div>

          {verifiedState.hasExisting ? (
            /* Existing Data Found */
            <div className="space-y-6">
              <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-4">
                <h4 className="text-xs font-bold text-[#4B6344] uppercase tracking-wider mb-2.5">
                  이전 작업 내역
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">설계 중인 롤모델:</span>
                    <span className="font-bold text-[#2C362B]">
                      {verifiedState.progress.step1?.roleModelName || '미지정'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">현재 진행 상태:</span>
                    <span className="font-bold text-[#4B6344]">
                      {verifiedState.progress.isFinalSubmitted || verifiedState.progress.currentStep >= 10 ? (
                        'STEP 10. 최종 제출 (완료)'
                      ) : (
                        `STEP ${verifiedState.progress.currentStep}. ${
                          STEP_NAMES[verifiedState.progress.currentStep - 1] || '롤모델 정보'
                        }`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">마지막 저장 시각:</span>
                    <span className="text-[#5D6B58]">
                      {verifiedState.progress.updatedAt
                        ? new Date(verifiedState.progress.updatedAt).toLocaleString('ko-KR')
                        : '기록 없음'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="w-full py-3.5 px-4 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl shadow-md shadow-[#4B6344]/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-base"
                >
                  <span>
                    {verifiedState.progress.isFinalSubmitted || verifiedState.progress.currentStep >= 10
                      ? '완료된 내용 확인 및 이어서 하기'
                      : '이어서 만들기'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2.5 px-4 bg-[#F3F4F1] hover:bg-rose-50 text-rose-600 border border-[#E1E4D8] hover:border-rose-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>처음부터 다시 만들기</span>
                </button>
              </div>
            </div>
          ) : (
            /* First time user */
            <div className="space-y-6">
              <p className="text-[#5D6B58] text-sm leading-relaxed text-center">
                롤모델 챗봇 만들기를 시작해 볼까요?
                <br />
                단계별 안내에 따라 나만의 진로 AI 멘토를 설계해 보세요.
              </p>

              <button
                type="button"
                onClick={handleContinue}
                className="w-full py-3.5 px-4 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl shadow-md shadow-[#4B6344]/20 flex items-center justify-center gap-2 transition-all cursor-pointer text-base"
              >
                <span>챗봇 만들기 시작</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E1E4D8] animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#2C362B] text-center mb-2">
              처음부터 다시 시작하시겠습니까?
            </h3>
            <p className="text-[#5D6B58] text-sm text-center mb-6 leading-relaxed">
              기존에 작성한 내용을 초기화하고 처음부터 다시 시작하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-md shadow-rose-100 transition-colors cursor-pointer"
              >
                처음부터 다시 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
