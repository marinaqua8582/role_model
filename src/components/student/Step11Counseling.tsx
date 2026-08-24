import React, { useState } from 'react';
import { Step11CounselingData, StudentProgress, StudentInfo } from '../../types';
import {
  MessageSquare,
  Sparkles,
  Award,
  ExternalLink,
  ArrowLeft,
  Copy,
  Check,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  Compass,
  GraduationCap,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitCounseling } from '../../api/client';

interface Step11CounselingProps {
  data: Step11CounselingData;
  progress: StudentProgress;
  student?: StudentInfo;
  onChange: (data: Step11CounselingData) => void;
  onSubmit?: () => Promise<void>;
  onPrev: () => void;
  isReadOnly?: boolean;
}

export const FIXED_QUESTIONS = {
  barrier: {
    title: '상담 1. 진로 장벽 극복 사례',
    tag: '장벽 극복',
    icon: ShieldAlert,
    question:
      '이 진로를 선택하거나 준비하는 과정에서 가장 큰 어려움이나 장벽은 무엇이었나요? 그 어려움을 어떻게 극복했나요?',
    description: '롤모델이 겪었던 역경과 극복 과정을 질문하여 나의 진로 고민 해결 힌트를 얻습니다.',
  },
  decision: {
    title: '상담 2. 진로 의사 결정',
    tag: '의사 결정',
    icon: Compass,
    question:
      '여러 진로 선택지 중에서 현재의 진로를 선택하게 된 결정적인 이유는 무엇이었나요? 선택할 때 어떤 기준을 중요하게 생각했나요?',
    description: '진로 갈림길에서 어떤 가치관과 기준을 우선순위로 두었는지 질문합니다.',
  },
  education: {
    title: '상담 3. 진학 설계',
    tag: '진학 및 준비',
    icon: GraduationCap,
    question:
      '이 진로를 준비하려는 중학생이라면 고등학교 진학이나 이후 학업 경로를 어떻게 계획하는 것이 좋을까요? 지금부터 준비하면 좋은 것도 함께 알려주세요.',
    description: '중학교 시기에 실천할 수 있는 구체적인 학업 준비와 진학 경로 조언을 얻습니다.',
  },
};

export const Step11Counseling: React.FC<Step11CounselingProps> = ({
  data,
  progress,
  student,
  onChange,
  onSubmit,
  onPrev,
  isReadOnly = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompletedSuccess, setIsCompletedSuccess] = useState(
    Boolean(progress.isCounselingCompleted || (progress.isFinalSubmitted && data.finalCareerReflection))
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);

  const updateField = <K extends keyof Step11CounselingData>(field: K, value: Step11CounselingData[K]) => {
    if (isReadOnly) return;
    onChange({ ...data, [field]: value });
  };

  const studentInfo: StudentInfo = student || {
    grade: progress.grade,
    classNum: progress.classNum,
    number: progress.number,
    name: progress.name,
    studentKey: progress.studentKey,
  };

  const handleCopyQuestion = (key: 'barrier' | 'decision' | 'education', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestion(key);
    setTimeout(() => {
      setCopiedQuestion(null);
    }, 2000);
  };

  const gemUrl = (progress.step10?.gemUrl || '').trim();
  const hasGemUrl = Boolean(gemUrl && gemUrl.startsWith('https://'));

  // Validation
  const isBarrierDone = Boolean(data.barrierAnswer?.trim() && data.barrierReflection?.trim());
  const isDecisionDone = Boolean(data.decisionAnswer?.trim() && data.decisionReflection?.trim());
  const isEducationDone = Boolean(data.educationAnswer?.trim() && data.educationReflection?.trim());
  const finalReflectionLength = (data.finalCareerReflection || '').trim().length;
  const isFinalReflectionDone = finalReflectionLength >= 20;

  const isFormValid = isBarrierDone && isDecisionDone && isEducationDone && isFinalReflectionDone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!isBarrierDone) {
      setSubmitError('상담 1 (진로 장벽 극복)의 챗봇 답변과 느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isDecisionDone) {
      setSubmitError('상담 2 (진로 의사 결정)의 챗봇 답변과 느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isEducationDone) {
      setSubmitError('상담 3 (진학 설계)의 챗봇 답변과 느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isFinalReflectionDone) {
      setSubmitError('상담 후 나의 진로 생각을 최소 20자 이상 성실하게 작성해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onSubmit) {
        await onSubmit();
      }

      const res = await submitCounseling(studentInfo, data, progress);
      if (res.success) {
        setIsCompletedSuccess(true);
        try {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch (e) {}
      } else {
        setSubmitError(res.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            11
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">
            STEP 11. 롤모델 챗봇으로 진로 상담하기
          </h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          수행평가 실전 상담 활동
        </span>
      </div>

      {isCompletedSuccess ? (
        /* Completion Celebration Screen */
        <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-lg p-8 sm:p-12 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-[#4B6344] text-white flex items-center justify-center mx-auto shadow-xl shadow-[#4B6344]/20">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#2C362B]">
              진로 상담 활동이 최종 완료되었습니다!
            </h3>
            <p className="text-base text-[#5D6B58] font-medium max-w-lg mx-auto">
              내가 설계한 롤모델 챗봇과의 3가지 진로 상담 및 최종 성찰을 성공적으로 마쳤습니다.
            </p>
          </div>

          {/* Result Summary Card */}
          <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-left space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-3">
              <span className="text-xs text-[#6B7280] font-semibold">참여 학생</span>
              <span className="text-sm font-bold text-[#2C362B]">
                {progress.grade}학년 {progress.classNum}반 {progress.number}번 {progress.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B7280] block mb-0.5">상담 롤모델</span>
                <strong className="text-[#2C362B] text-sm">{progress.step1?.roleModelName || '미입력'}</strong> (
                {progress.step1?.roleModelJob || '미입력'})
              </div>
              <div>
                <span className="text-[#6B7280] block mb-0.5">챗봇 이름</span>
                <strong className="text-[#4B6344] text-sm">{progress.step6?.chatbotName || '미입력'}</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E1E4D8] space-y-2">
              <span className="text-xs font-bold text-[#4B6344] block">상담 후 나의 진로 생각</span>
              <p className="text-xs text-[#2C362B] bg-white p-3.5 rounded-xl border border-[#E1E4D8] leading-relaxed whitespace-pre-wrap">
                {data.finalCareerReflection}
              </p>
            </div>

            {gemUrl && (
              <div className="pt-1 text-xs flex items-center justify-between text-[#6B7280]">
                <span>Gem 링크:</span>
                <a
                  href={gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4B6344] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>내 롤모델 챗봇 열기</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <div className="text-xs text-[#6B7280]">
            선생님 관리자 대시보드에 최종 활동 완료 상태로 기록되었습니다.
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onPrev}
              className="px-5 py-2.5 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>STEP 10 (제출 화면) 보기</span>
            </button>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsCompletedSuccess(false)}
                className="px-5 py-2.5 bg-white hover:bg-[#F9FAF8] text-[#4B6344] border border-[#DCE2D7] text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                상담 내용 수정하기
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Counseling Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Instruction & Gem Button Box */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-lg sm:text-xl font-extrabold text-[#2C362B] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#4B6344]" />
                <span>내가 만든 롤모델 챗봇과 실제로 진로 상담하기</span>
              </h4>
              <p className="text-xs sm:text-sm text-[#5D6B58] leading-relaxed">
                내가 만든 롤모델 챗봇과 실제로 진로 상담을 해 봅시다.
                아래의 세 가지 질문을 롤모델 챗봇에게 직접 질문한 뒤, 챗봇의 답변을 그대로 입력하고 상담을 통해 알게 된 점이나 나의 생각을 정리하세요.
              </p>
              <p className="text-xs font-bold text-rose-600">
                ※ 수행평가이므로 제시된 질문을 임의로 변경하지 않습니다.
              </p>
            </div>

            {/* How to counsel guide box */}
            <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4B6344]">
                  <Lightbulb className="w-4 h-4 text-[#4B6344] shrink-0" />
                  <span>💡 상담 방법</span>
                </div>

                {/* Gemini Gem Open Button */}
                {hasGemUrl ? (
                  <a
                    href={gemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4B6344] hover:bg-[#3D5237] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    <span>내 롤모델 챗봇 열기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    먼저 STEP 10에서 롤모델 챗봇 공유 링크를 입력해 주세요.
                  </span>
                )}
              </div>

              <ol className="text-xs text-[#5D6B58] space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
                <li><strong className="text-[#2C362B]">STEP 10에서 제출한 나의 Gemini Gem</strong>을 엽니다. (위 버튼 클릭)</li>
                <li>아래에 제시된 <strong className="text-[#4B6344]">지정 질문 1, 2, 3</strong>을 하나씩 복사하여 롤모델 챗봇에게 질문합니다.</li>
                <li>챗봇이 답변한 내용을 복사하여 아래 각 상담의 <strong className="text-[#2C362B]">[챗봇 답변]</strong>란에 붙여넣습니다.</li>
                <li>답변을 읽고 내가 배운 점이나 느낀 점을 <strong className="text-[#2C362B]">[알게 된 점 / 느낀 점]</strong>에 정리합니다.</li>
                <li>세 번의 상담을 모두 마친 후 마지막 <strong className="text-[#2C362B]">[상담 후 나의 진로 생각]</strong>을 성찰합니다.</li>
              </ol>
            </div>
          </div>

          {/* QUESTION 1 CARD */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h5 className="font-bold text-[#2C362B] text-base">
                  {FIXED_QUESTIONS.barrier.title}
                </h5>
              </div>
              <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                {FIXED_QUESTIONS.barrier.description}
              </span>
            </div>

            {/* Fixed Question Display */}
            <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>지정 질문 (수정 불가)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyQuestion('barrier', FIXED_QUESTIONS.barrier.question)}
                  className="px-2.5 py-1 bg-white hover:bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedQuestion === 'barrier' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>질문 복사</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#2C362B] leading-relaxed bg-white p-3 rounded-xl border border-[#E1E4D8]">
                {FIXED_QUESTIONS.barrier.question}
              </p>
            </div>

            {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ① 챗봇 답변 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.barrierAnswer}
                  onChange={(e) => updateField('barrierAnswer', e.target.value)}
                  placeholder="롤모델 챗봇이 답변한 내용을 그대로 복사하여 붙여넣으세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ② 내가 알게 된 점 / 느낀 점 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.barrierReflection}
                  onChange={(e) => updateField('barrierReflection', e.target.value)}
                  placeholder="롤모델의 극복 과정을 보며 새롭게 알게 된 점이나 나에게 적용하고 싶은 점을 적어보세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* QUESTION 2 CARD */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h5 className="font-bold text-[#2C362B] text-base">
                  {FIXED_QUESTIONS.decision.title}
                </h5>
              </div>
              <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                {FIXED_QUESTIONS.decision.description}
              </span>
            </div>

            {/* Fixed Question Display */}
            <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>지정 질문 (수정 불가)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyQuestion('decision', FIXED_QUESTIONS.decision.question)}
                  className="px-2.5 py-1 bg-white hover:bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedQuestion === 'decision' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>질문 복사</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#2C362B] leading-relaxed bg-white p-3 rounded-xl border border-[#E1E4D8]">
                {FIXED_QUESTIONS.decision.question}
              </p>
            </div>

            {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ① 챗봇 답변 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.decisionAnswer}
                  onChange={(e) => updateField('decisionAnswer', e.target.value)}
                  placeholder="롤모델 챗봇이 답변한 내용을 그대로 복사하여 붙여넣으세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ② 내가 알게 된 점 / 느낀 점 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.decisionReflection}
                  onChange={(e) => updateField('decisionReflection', e.target.value)}
                  placeholder="롤모델의 의사 결정 기준과 가치관을 보며 나의 진로 선택 기준에 대해 느낀 점을 적어보세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* QUESTION 3 CARD */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h5 className="font-bold text-[#2C362B] text-base">
                  {FIXED_QUESTIONS.education.title}
                </h5>
              </div>
              <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                {FIXED_QUESTIONS.education.description}
              </span>
            </div>

            {/* Fixed Question Display */}
            <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>지정 질문 (수정 불가)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyQuestion('education', FIXED_QUESTIONS.education.question)}
                  className="px-2.5 py-1 bg-white hover:bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7] rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copiedQuestion === 'education' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>복사됨</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>질문 복사</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#2C362B] leading-relaxed bg-white p-3 rounded-xl border border-[#E1E4D8]">
                {FIXED_QUESTIONS.education.question}
              </p>
            </div>

            {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ① 챗봇 답변 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.educationAnswer}
                  onChange={(e) => updateField('educationAnswer', e.target.value)}
                  placeholder="롤모델 챗봇이 답변한 내용을 그대로 복사하여 붙여넣으세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#2C362B]">
                  ② 내가 알게 된 점 / 느낀 점 입력 <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  disabled={isReadOnly || isSubmitting}
                  value={data.educationReflection}
                  onChange={(e) => updateField('educationReflection', e.target.value)}
                  placeholder="고등학교 진학이나 지금 준비할 점에 대해 롤모델에게 조언받고 새롭게 계획하게 된 점을 적어보세요."
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* FINAL OVERALL REFLECTION CARD */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-3">
              <div>
                <h5 className="font-bold text-[#2C362B] text-base flex items-center gap-1.5">
                  <Compass className="w-5 h-5 text-[#4B6344]" />
                  <span>상담 후 나의 진로 생각 (최종 성찰)</span>
                  <span className="text-rose-500">*</span>
                </h5>
                <p className="text-xs text-[#5D6B58] mt-1">
                  세 번의 상담을 통해 나의 진로에 대해 새롭게 생각하게 된 점이나 앞으로 해보고 싶은 일을 정리해 보세요.
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                finalReflectionLength >= 30
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {finalReflectionLength}자 / 최소 30자 권장
              </span>
            </div>

            <div className="space-y-1.5">
              <textarea
                rows={4}
                disabled={isReadOnly || isSubmitting}
                value={data.finalCareerReflection}
                onChange={(e) => updateField('finalCareerReflection', e.target.value)}
                placeholder="롤모델 챗봇과의 3가지 상담을 마치며, 나의 진로 목표와 고등학교 진학, 그리고 지금부터 실천하고 싶은 나의 다짐을 종합적으로 적어보세요."
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
              />
            </div>
          </div>

          {/* Error Banner */}
          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start justify-between gap-3 text-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">작성 항목을 확인해 주세요.</p>
                  <p className="text-xs text-rose-600 mt-0.5">{submitError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E1E4D8]">
            <button
              type="button"
              onClick={onPrev}
              disabled={isSubmitting}
              className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>이전 STEP (STEP 10)</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isFormValid || isReadOnly}
              className="px-8 py-3.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-base shadow-lg shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>완료 처리 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>진로 상담 활동 완료하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
