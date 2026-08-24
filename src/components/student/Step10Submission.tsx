import React, { useState } from 'react';
import { FinalSubmissionData, StudentProgress, StudentInfo } from '../../types';
import { Send, Sparkles, Award, ExternalLink, ArrowLeft, MessageSquare, RefreshCw, AlertCircle, AlertTriangle, CheckCircle2, Lightbulb, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { submitFinal } from '../../api/client';

interface Step10SubmissionProps {
  data: FinalSubmissionData;
  progress: StudentProgress;
  student?: StudentInfo;
  onChange: (data: FinalSubmissionData) => void;
  onSubmit?: () => Promise<void>;
  onPrev: () => void;
  onNext?: () => void;
  isReadOnly?: boolean;
}

// Resilient Gemini URL validation (verifies https:// and gemini.google.com domain without enforcing specific path)
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

export const Step10Submission: React.FC<Step10SubmissionProps> = ({
  data,
  progress,
  student,
  onChange,
  onSubmit,
  onPrev,
  onNext,
  isReadOnly = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(progress.isFinalSubmitted);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!isGemUrlValid) {
      setSubmitError('https://gemini.google.com 으로 시작하는 올바른 Gemini Gem 공유 링크를 입력해 주세요.');
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
            particleCount: 120,
            spread: 70,
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

  const isValid =
    isGemUrlValid &&
    Boolean(data.sampleQuestion1 && data.sampleQuestion1.trim()) &&
    Boolean(data.sampleAnswer1 && data.sampleAnswer1.trim()) &&
    Boolean(data.reflection && data.reflection.trim());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            10
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">
            STEP 10. 최종 공유 및 제출
          </h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          프로젝트 최종 완성
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
              제출이 완료되었습니다!
            </h3>
            <p className="text-base text-[#5D6B58] font-medium">
              나의 롤모델 챗봇 만들기 프로젝트를 훌륭하게 완성했습니다.
            </p>
          </div>

          {/* Result Card */}
          <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-3xl p-6 sm:p-8 max-w-lg mx-auto text-left space-y-4">
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
              <div className="pt-2">
                <span className="text-xs text-[#6B7280] block mb-1">Gemini Gem 공유 링크</span>
                <a
                  href={data.gemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#4B6344] font-semibold hover:underline flex items-center gap-1 break-all"
                >
                  <span>{data.gemUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            )}
          </div>

          <div className="text-xs text-[#6B7280]">
            제출된 내용은 선생님 관리자 화면에서 확인 및 평가되며, 필요 시 다시 수정하여 제출할 수 있습니다.
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsSubmittedSuccess(false)}
                className="px-5 py-2.5 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                제출 내용 수정하기
              </button>
            )}

            {onNext && (
              <button
                type="button"
                onClick={onNext}
                className="px-6 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#4B6344]/20 flex items-center gap-1.5 cursor-pointer"
              >
                <span>STEP 11. 진로 상담하기로 이동</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Submission Form */
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
              <Send className="w-5 h-5 text-[#4B6344]" />
              <span>최종 결과물 및 대화 내용 제출</span>
            </h4>
            <p className="text-xs text-[#6B7280] mt-1">
              제작한 Gem의 공유 링크와 실제 대화해 본 대표 질문/답변, 제작 소감을 작성하여 제출해 주세요.
            </p>
          </div>

          {/* Gem URL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs sm:text-sm font-bold text-[#2C362B]">
                Gemini Gem 공유 링크 (대화 공유 링크 아님) <span className="text-rose-500">*</span>
              </label>
              {isGemUrlValid && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  올바른 Gemini 링크
                </span>
              )}
            </div>

            {/* How to get Gem Share Link - Step by step guide */}
            <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4B6344]">
                <Info className="w-4 h-4 text-[#4B6344] shrink-0" />
                <span>Gem 공유 링크 가져오는 방법</span>
              </div>
              <ol className="text-xs text-[#5D6B58] space-y-1.5 list-decimal list-inside pl-1 leading-relaxed">
                <li>Gemini 왼쪽 사이드바에서 <strong className="text-[#2C362B]">[Gems]</strong>를 엽니다.</li>
                <li>내가 만든 Gem 목록에서 제출할 Gem을 찾습니다.</li>
                <li>해당 Gem의 <strong className="text-[#2C362B]">공유 메뉴</strong>를 엽니다.</li>
                <li>Gem을 다른 사람이 사용할 수 있도록 공유 설정을 확인합니다.</li>
                <li><strong className="text-[#4B6344]">Gem 자체의 공유 링크를 복사</strong>하여 아래 입력란에 붙여넣습니다.</li>
              </ol>

              {/* Warning about conversation share */}
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold text-amber-950">주의: 대화 화면의 점 3개 메뉴에 있는 [대화 공유] 링크는 제출하지 마세요.</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    이 링크는 챗봇 자체가 아니라 특정 대화 내용을 공유하는 링크입니다.
                  </p>
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

            {/* Subtle visual callout tip */}
            <div className="bg-[#F1F4EF]/80 border border-[#DCE2D7] rounded-xl p-3 flex items-start gap-2.5 text-xs text-[#4B6344]">
              <Lightbulb className="w-4 h-4 text-[#4B6344] shrink-0 mt-0.5" />
              <p className="leading-snug">
                <span className="font-bold">Gem 공유 링크와 대화 공유 링크는 다릅니다.</span> 다른 친구가 나의 챗봇과 직접 대화하려면 Gem 자체의 공유 링크를 제출해야 합니다.
              </p>
            </div>
          </div>

          {/* Sample Q&A 1 */}
          <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
            <div className="font-bold text-xs text-[#4B6344] flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#4B6344]" />
              <span>대표 대화 1 (필수)</span>
            </div>
            <div>
              <input
                type="text"
                disabled={isReadOnly || isSubmitting}
                value={data.sampleQuestion1}
                onChange={(e) => updateField('sampleQuestion1', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 1"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly || isSubmitting}
                value={data.sampleAnswer1}
                onChange={(e) => updateField('sampleAnswer1', e.target.value)}
                placeholder="챗봇이 답변한 주요 내용 1"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none resize-none"
              />
            </div>
          </div>

          {/* Sample Q&A 2 */}
          <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
            <div className="font-bold text-xs text-[#4B6344] flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#4B6344]" />
              <span>대표 대화 2 (선택)</span>
            </div>
            <div>
              <input
                type="text"
                disabled={isReadOnly || isSubmitting}
                value={data.sampleQuestion2}
                onChange={(e) => updateField('sampleQuestion2', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 2"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly || isSubmitting}
                value={data.sampleAnswer2}
                onChange={(e) => updateField('sampleAnswer2', e.target.value)}
                placeholder="챗봇이 답변한 주요 내용 2"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none resize-none"
              />
            </div>
          </div>

          {/* Sample Q&A 3 */}
          <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
            <div className="font-bold text-xs text-[#4B6344] flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[#4B6344]" />
              <span>대표 대화 3 (선택)</span>
            </div>
            <div>
              <input
                type="text"
                disabled={isReadOnly || isSubmitting}
                value={data.sampleQuestion3}
                onChange={(e) => updateField('sampleQuestion3', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 3"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly || isSubmitting}
                value={data.sampleAnswer3}
                onChange={(e) => updateField('sampleAnswer3', e.target.value)}
                placeholder="챗봇이 답변한 주요 내용 3"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none resize-none"
              />
            </div>
          </div>

          {/* Revision Summary */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              수정한 점 (선택)
            </label>
            <input
              type="text"
              disabled={isReadOnly || isSubmitting}
              value={data.revisionSummary}
              onChange={(e) => updateField('revisionSummary', e.target.value)}
              placeholder="예: 진로를 단정하지 않도록 조언 규칙을 보강하고, 말투를 더욱 따뜻하게 바꿈"
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none"
            />
          </div>

          {/* Reflection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              제작 소감 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              disabled={isReadOnly || isSubmitting}
              value={data.reflection}
              onChange={(e) => updateField('reflection', e.target.value)}
              placeholder="롤모델을 조사하고 AI 챗봇을 직접 설계해보며 느낀 점, 앞으로의 진로 계획 등을 진솔하게 적어보세요."
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
            />
          </div>

          {/* Error message */}
          {submitError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start justify-between gap-3 text-sm animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">저장에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
                  {submitError !== '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' && (
                    <p className="text-xs text-rose-600 mt-0.5">{submitError}</p>
                  )}
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

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F1]">
            <button
              type="button"
              onClick={onPrev}
              disabled={isSubmitting}
              className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>이전 STEP</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isValid || isReadOnly}
              className="px-8 py-3.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-base shadow-lg shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>제출 처리 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>최종 제출하기</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

