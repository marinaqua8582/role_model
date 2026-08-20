import React, { useState } from 'react';
import { FinalSubmissionData, StudentProgress } from '../../types';
import { Send, Sparkles, Award, ExternalLink, ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Step10SubmissionProps {
  data: FinalSubmissionData;
  progress: StudentProgress;
  onChange: (data: FinalSubmissionData) => void;
  onSubmit: () => Promise<void>;
  onPrev: () => void;
  isReadOnly?: boolean;
}

export const Step10Submission: React.FC<Step10SubmissionProps> = ({
  data,
  progress,
  onChange,
  onSubmit,
  onPrev,
  isReadOnly = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(progress.isFinalSubmitted);

  const updateField = <K extends keyof FinalSubmissionData>(field: K, value: FinalSubmissionData[K]) => {
    if (isReadOnly) return;
    onChange({ ...data, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setIsSubmitting(true);
    try {
      await onSubmit();
      setIsSubmittedSuccess(true);
      // Fire confetti effect
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {}
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid =
    Boolean(data.gemUrl && data.gemUrl.trim()) &&
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
                <strong className="text-[#2C362B] text-sm">{progress.step1?.roleModelName}</strong> (
                {progress.step1?.roleModelJob})
              </div>
              <div>
                <span className="text-[#6B7280] block mb-0.5">챗봇 이름</span>
                <strong className="text-[#4B6344] text-sm">{progress.step6?.chatbotName}</strong>
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

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setIsSubmittedSuccess(false)}
              className="px-5 py-2.5 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              제출 내용 수정하기
            </button>
          )}
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
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              Gemini Gem 공유 링크 <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              disabled={isReadOnly}
              value={data.gemUrl}
              onChange={(e) => updateField('gemUrl', e.target.value)}
              placeholder="https://gemini.google.com/gems/share/..."
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
            />
            <p className="text-[11px] text-[#6B7280]">
              ※ Gemini Gem 화면 우측 상단의 [공유] 아이콘을 눌러 링크를 복사해 붙여넣으세요.
            </p>
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
                disabled={isReadOnly}
                value={data.sampleQuestion1}
                onChange={(e) => updateField('sampleQuestion1', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 1"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                value={data.sampleQuestion2}
                onChange={(e) => updateField('sampleQuestion2', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 2"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                value={data.sampleQuestion3}
                onChange={(e) => updateField('sampleQuestion3', e.target.value)}
                placeholder="내가 챗봇에게 물어본 질문 3"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none mb-2"
              />
              <textarea
                rows={2}
                disabled={isReadOnly}
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
              테스트를 거치며 수정한 점 (선택)
            </label>
            <input
              type="text"
              disabled={isReadOnly}
              value={data.revisionSummary}
              onChange={(e) => updateField('revisionSummary', e.target.value)}
              placeholder="예: 진로를 단정하지 않도록 조언 규칙을 보강하고, 말투를 더욱 따뜻하게 바꿈"
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none"
            />
          </div>

          {/* Reflection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              진로 프로젝트 제작 소감 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              disabled={isReadOnly}
              value={data.reflection}
              onChange={(e) => updateField('reflection', e.target.value)}
              placeholder="롤모델을 조사하고 AI 챗봇을 직접 설계해보며 느낀 점, 앞으로의 진로 계획 등을 진솔하게 적어보세요."
              className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F1]">
            <button
              type="button"
              onClick={onPrev}
              className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer"
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
