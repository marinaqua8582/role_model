import React, { useState } from 'react';
import { FinalSubmissionData, StudentProgress, StudentInfo } from '../../types';
import {
  Send,
  Sparkles,
  Award,
  ExternalLink,
  ArrowLeft,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Info,
  Copy,
  Check,
  Compass,
  GraduationCap,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitFinal } from '../../api/client';

interface Step10SubmissionProps {
  data: FinalSubmissionData;
  progress: StudentProgress;
  student?: StudentInfo;
  onChange: (data: FinalSubmissionData) => void;
  onSubmit?: () => Promise<void>;
  onPrev: () => void;
  isReadOnly?: boolean;
}

// Resilient Gemini URL validation
const validateGeminiUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.includes('gemini.google.com');
  } catch {
    return false;
  }
};

export const FIXED_COUNSELING_QUESTIONS = {
  barrier: {
    number: 1,
    title: '진로 상담 1 - 진로 장벽 극복',
    tag: '장벽 극복',
    icon: ShieldAlert,
    question:
      '이 진로를 선택하거나 준비하는 과정에서 가장 큰 어려움이나 장벽은 무엇이었나요? 그 어려움을 어떻게 극복했나요?',
    description: '롤모델이 겪었던 역경과 극복 과정을 질문하여 나의 진로 고민 해결 힌트를 얻습니다.',
  },
  decision: {
    number: 2,
    title: '진로 상담 2 - 진로 의사 결정',
    tag: '의사 결정',
    icon: Compass,
    question:
      '여러 진로 선택지 중에서 현재의 진로를 선택하게 된 결정적인 이유는 무엇이었나요? 선택할 때 어떤 기준을 중요하게 생각했나요?',
    description: '진로 갈림길에서 어떤 가치관과 기준을 우선순위로 두었는지 질문합니다.',
  },
  education: {
    number: 3,
    title: '진로 상담 3 - 진학 설계',
    tag: '진학 및 준비',
    icon: GraduationCap,
    question:
      '이 진로를 준비하려는 중학생이라면 고등학교 진학이나 이후 학업 경로를 어떻게 계획하는 것이 좋을까요? 지금부터 준비하면 좋은 것도 함께 알려주세요.',
    description: '중학교 시기에 실천할 수 있는 구체적인 학업 준비와 진학 경로 조언을 얻습니다.',
  },
};

export const Step10Submission: React.FC<Step10SubmissionProps> = ({
  data,
  progress,
  student,
  onChange,
  onSubmit,
  onPrev,
  isReadOnly = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(progress.isFinalSubmitted);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);

  const updateField = <K extends keyof FinalSubmissionData>(field: K, value: FinalSubmissionData[K]) => {
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

  const isGemUrlValid = validateGeminiUrl(data.gemUrl);
  const showUrlWarning = Boolean(data.gemUrl && data.gemUrl.trim() && !isGemUrlValid);

  // Validation
  const isBarrierDone = Boolean(data.barrierAnswer?.trim() && data.barrierReflection?.trim());
  const isDecisionDone = Boolean(data.decisionAnswer?.trim() && data.decisionReflection?.trim());
  const isEducationDone = Boolean(data.educationAnswer?.trim() && data.educationReflection?.trim());
  const finalReflectionLength = (data.finalCareerReflection || '').trim().length;
  const isFinalReflectionDone = finalReflectionLength >= 30;

  const isValid =
    isGemUrlValid &&
    isBarrierDone &&
    isDecisionDone &&
    isEducationDone &&
    isFinalReflectionDone;

  const handleCopyQuestion = (key: 'barrier' | 'decision' | 'education', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQuestion(key);
    setTimeout(() => {
      setCopiedQuestion(null);
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!isGemUrlValid) {
      setSubmitError('https://gemini.google.com 으로 시작하는 올바른 Gemini Gem 공유 링크를 입력해 주세요.');
      return;
    }
    if (!isBarrierDone) {
      setSubmitError('[진로 상담 1 - 진로 장벽 극복]의 챗봇 답변과 알게 된 점/느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isDecisionDone) {
      setSubmitError('[진로 상담 2 - 진로 의사 결정]의 챗봇 답변과 알게 된 점/느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isEducationDone) {
      setSubmitError('[진로 상담 3 - 진학 설계]의 챗봇 답변과 알게 된 점/느낀 점을 모두 작성해 주세요.');
      return;
    }
    if (!isFinalReflectionDone) {
      setSubmitError('‘상담 후 나의 진로 생각’을 최소 30자 이상 성실하게 작성해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (onSubmit) {
        await onSubmit();
      }

      const res = await submitFinal(studentInfo, data, progress);
      if (res.success) {
        setIsSubmittedSuccess(true);
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
            10
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">
            STEP 10. 롤모델 챗봇 최종 제출 및 진로 상담
          </h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          수행평가 최종 완료
        </span>
      </div>

      {isSubmittedSuccess ? (
        /* Submission Success Celebration Screen */
        <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-lg p-8 sm:p-12 text-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-20 h-20 rounded-3xl bg-[#4B6344] text-white flex items-center justify-center mx-auto shadow-xl shadow-[#4B6344]/20">
            <Award className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#2C362B]">
              진로 상담 및 최종 제출이 완료되었습니다!
            </h3>
            <p className="text-base text-[#5D6B58] font-medium max-w-lg mx-auto">
              나의 롤모델 챗봇 제작과 3가지 지정 진로 상담, 그리고 최종 성찰 활동을 모두 성공적으로 완수했습니다.
            </p>
          </div>

          {/* Result Card */}
          <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-3xl p-6 sm:p-8 max-w-2xl mx-auto text-left space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-3">
              <span className="text-xs text-[#6B7280] font-semibold">제출 학생</span>
              <span className="text-sm font-bold text-[#2C362B]">
                {progress.grade}학년 {progress.classNum}반 {progress.number}번 {progress.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[#6B7280] block mb-0.5">나의 롤모델</span>
                <strong className="text-[#2C362B] text-sm">{progress.step1?.roleModelName || '미입력'}</strong> (
                {progress.step1?.roleModelJob || '미입력'})
              </div>
              <div>
                <span className="text-[#6B7280] block mb-0.5">챗봇 이름</span>
                <strong className="text-[#4B6344] text-sm">{progress.step6?.chatbotName || '미입력'}</strong>
              </div>
            </div>

            {data.gemUrl && (
              <div className="pt-2 border-t border-[#E1E4D8]/80">
                <span className="text-xs text-[#6B7280] block mb-1">Gemini Gem 공유 링크</span>
                <a
                  href={data.gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#4B6344] font-semibold hover:underline inline-flex items-center gap-1.5 break-all"
                >
                  <span>{data.gemUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}

            {/* Career Counseling Summary */}
            <div className="pt-2 border-t border-[#E1E4D8]/80 space-y-2">
              <span className="text-xs font-bold text-[#4B6344] block">상담 후 나의 진로 생각</span>
              <p className="text-xs text-[#2C362B] bg-white p-3.5 rounded-xl border border-[#E1E4D8] leading-relaxed whitespace-pre-wrap">
                {data.finalCareerReflection}
              </p>
            </div>
          </div>

          <div className="text-xs text-[#6B7280]">
            제출된 내용은 선생님 관리자 화면에서 확인 및 평가되며, 필요 시 다시 수정하여 제출할 수 있습니다.
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsSubmittedSuccess(false)}
                className="px-6 py-2.5 bg-white hover:bg-[#F9FAF8] text-[#4B6344] border border-[#DCE2D7] text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                제출 내용 수정하기
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Instruction Banner */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-xl font-extrabold text-[#2C362B] flex items-center gap-2">
                <Send className="w-5 h-5 text-[#4B6344]" />
                <span>롤모델 챗봇 최종 제출 및 지정 진로 상담</span>
              </h4>
              <p className="text-xs sm:text-sm text-[#5D6B58] leading-relaxed">
                제작한 Gemini Gem의 공유 링크를 제출하고, 내가 만든 롤모델 챗봇과 실제로 3가지 지정 진로 상담을 진행합니다.
                각 질문에 대한 챗봇의 답변과 내가 알게 된 점/느낀 점, 그리고 최종 진로 생각을 성실하게 작성해 주세요.
              </p>
              <p className="text-xs font-bold text-rose-600">
                ※ 수행평가이므로 제시된 3가지 지정 질문을 임의로 변경하지 않습니다.
              </p>
            </div>
          </div>

          {/* PART 1: Gem URL Section */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-3">
              <label className="block text-sm font-bold text-[#2C362B]">
                1. Gemini Gem 공유 링크 입력 <span className="text-rose-500">*</span>
              </label>
              {isGemUrlValid && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  올바른 Gemini 링크
                </span>
              )}
            </div>

            {/* How to get Gem Share Link */}
            <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4B6344]">
                  <Info className="w-4 h-4 text-[#4B6344] shrink-0" />
                  <span>Gem 공유 링크 가져오는 방법</span>
                </div>
                {isGemUrlValid && (
                  <a
                    href={data.gemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#4B6344] hover:bg-[#3D5237] text-white text-xs font-bold rounded-lg shadow-xs transition-all"
                  >
                    <span>내 Gem 열기</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <ol className="text-xs text-[#5D6B58] space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
                <li>Gemini 왼쪽 사이드바에서 <strong className="text-[#2C362B]">[Gems]</strong>를 엽니다.</li>
                <li>내가 만든 Gem 목록에서 제출할 Gem을 찾아 <strong className="text-[#2C362B]">공유 메뉴</strong>를 엽니다.</li>
                <li><strong className="text-[#4B6344]">Gem 자체의 공유 링크</strong>를 복사하여 아래 입력란에 붙여넣습니다.</li>
              </ol>

              {/* Warning about conversation share */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold text-amber-950">주의: 대화 화면의 [대화 공유] 링크가 아니라 Gem 자체의 공유 링크를 제출해야 합니다.</span>
                </div>
              </div>
            </div>

            {/* Input Box */}
            <div className="space-y-1.5">
              <input
                type="url"
                disabled={isReadOnly || isSubmitting}
                value={data.gemUrl}
                onChange={(e) => updateField('gemUrl', e.target.value)}
                placeholder="Gem 자체의 공유 링크를 붙여넣으세요. (예: https://gemini.google.com/...)"
                className={`w-full px-4 py-3 bg-[#F9FAF8] border rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 outline-none transition-all ${
                  showUrlWarning
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : isGemUrlValid
                    ? 'border-emerald-400 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                    : 'border-[#E1E4D8] focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20'
                }`}
              />

              {showUrlWarning && (
                <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 pl-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  https://gemini.google.com 으로 시작하는 올바른 Gemini Gem 공유 링크를 입력해 주세요.
                </p>
              )}
            </div>
          </div>

          {/* PART 2: 3 Designated Career Counseling Questions */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="text-base font-extrabold text-[#2C362B]">
                지정 진로 상담 3문항 수행평가
              </h4>
            </div>

            {/* QUESTION 1 CARD: Barrier */}
            <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#4B6344]" />
                  <h5 className="font-bold text-[#2C362B] text-base">
                    {FIXED_COUNSELING_QUESTIONS.barrier.title}
                  </h5>
                </div>
                <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  {FIXED_COUNSELING_QUESTIONS.barrier.description}
                </span>
              </div>

              {/* Fixed Question Box */}
              <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>지정 질문 (수정 불가)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyQuestion('barrier', FIXED_COUNSELING_QUESTIONS.barrier.question)}
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
                  {FIXED_COUNSELING_QUESTIONS.barrier.question}
                </p>
              </div>

              {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2C362B]">
                    ① 챗봇의 답변 <span className="text-rose-500">*</span>
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
                    ② 상담을 통해 알게 된 점 / 느낀 점 <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    disabled={isReadOnly || isSubmitting}
                    value={data.barrierReflection}
                    onChange={(e) => updateField('barrierReflection', e.target.value)}
                    placeholder="롤모델의 역경과 극복 과정을 보며 새롭게 알게 된 점이나 나의 진로에 적용하고 싶은 점을 적어보세요."
                    className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* QUESTION 2 CARD: Decision */}
            <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#4B6344]" />
                  <h5 className="font-bold text-[#2C362B] text-base">
                    {FIXED_COUNSELING_QUESTIONS.decision.title}
                  </h5>
                </div>
                <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  {FIXED_COUNSELING_QUESTIONS.decision.description}
                </span>
              </div>

              {/* Fixed Question Box */}
              <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>지정 질문 (수정 불가)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyQuestion('decision', FIXED_COUNSELING_QUESTIONS.decision.question)}
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
                  {FIXED_COUNSELING_QUESTIONS.decision.question}
                </p>
              </div>

              {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2C362B]">
                    ① 챗봇의 답변 <span className="text-rose-500">*</span>
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
                    ② 상담을 통해 알게 된 점 / 느낀 점 <span className="text-rose-500">*</span>
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

            {/* QUESTION 3 CARD: Education */}
            <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-3.5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-[#4B6344]" />
                  <h5 className="font-bold text-[#2C362B] text-base">
                    {FIXED_COUNSELING_QUESTIONS.education.title}
                  </h5>
                </div>
                <span className="text-xs font-semibold text-[#5D6B58] bg-[#F1F4EF] px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  {FIXED_COUNSELING_QUESTIONS.education.description}
                </span>
              </div>

              {/* Fixed Question Box */}
              <div className="p-4 bg-[#F9FAF8] border border-[#DCE2D7] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4B6344] flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>지정 질문 (수정 불가)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyQuestion('education', FIXED_COUNSELING_QUESTIONS.education.question)}
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
                  {FIXED_COUNSELING_QUESTIONS.education.question}
                </p>
              </div>

              {/* Inputs: 1) Chatbot Answer, 2) Reflection */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#2C362B]">
                    ① 챗봇의 답변 <span className="text-rose-500">*</span>
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
                    ② 상담을 통해 알게 된 점 / 느낀 점 <span className="text-rose-500">*</span>
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
          </div>

          {/* PART 3: Final Career Reflection */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-3">
              <div>
                <h5 className="font-bold text-[#2C362B] text-base flex items-center gap-1.5">
                  <Compass className="w-5 h-5 text-[#4B6344]" />
                  <span>상담 후 나의 진로 생각</span>
                  <span className="text-rose-500">*</span>
                </h5>
                <p className="text-xs text-[#5D6B58] mt-1">
                  세 번의 상담을 통해 나의 진로에 대해 새롭게 생각하게 된 점이나 앞으로 해보고 싶은 일을 정리해 보세요.
                </p>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  finalReflectionLength >= 30
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {finalReflectionLength}자 / 최소 30자 이상
              </span>
            </div>

            <div className="space-y-1.5">
              <textarea
                rows={4}
                disabled={isReadOnly || isSubmitting}
                value={data.finalCareerReflection}
                onChange={(e) => updateField('finalCareerReflection', e.target.value)}
                placeholder="롤모델 챗봇과의 3가지 상담을 마치며, 나의 진로 목표와 고등학교 진학, 그리고 지금부터 실천하고 싶은 나의 다짐을 종합적으로 적어보세요. (최소 30자 이상)"
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
              />
            </div>
          </div>

          {/* Optional Revision Summary (if prompt was revised) */}
          <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-7 space-y-3">
            <label className="block text-xs font-bold text-[#4B6344]">
              챗봇 제작/수정 요약 (선택)
            </label>
            <input
              type="text"
              disabled={isReadOnly || isSubmitting}
              value={data.revisionSummary || ''}
              onChange={(e) => updateField('revisionSummary', e.target.value)}
              placeholder="예: 롤모델의 가치관을 더 잘 드러내도록 말투와 조언 규칙을 수정함"
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none"
            />
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start justify-between gap-3 text-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">작성 항목을 확인해 주세요.</p>
                  <p className="text-xs text-rose-600 mt-0.5">{submitError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shrink-0 transition-colors cursor-pointer"
              >
                다시 시도
              </button>
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
              <span>이전 STEP (STEP 9)</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isValid || isReadOnly}
              className="px-8 py-3.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-base shadow-lg shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>최종 완료 처리 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>진로 상담 및 최종 제출 완료하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
