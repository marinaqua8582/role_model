import React, { useState } from 'react';
import { PromptData, TestData, StudentInfo } from '../../types';
import { Wrench, Sparkles, Copy, Check, ArrowRight, ArrowLeft, Lightbulb, AlertCircle } from 'lucide-react';
import { updateRevision } from '../../api/client';

interface Step9PromptRevisionProps {
  promptData: PromptData;
  testData: TestData;
  student?: StudentInfo;
  onChangePrompt: (promptData: PromptData) => void;
  onChangeTest: (testData: TestData) => void;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

export const Step9PromptRevision: React.FC<Step9PromptRevisionProps> = ({
  promptData,
  testData,
  student,
  onChangePrompt,
  onChangeTest,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCopyRevised = () => {
    navigator.clipboard.writeText(promptData.finalPrompt || promptData.revisedPrompt || promptData.initialPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePromptChange = (text: string) => {
    if (isReadOnly) return;
    onChangePrompt({
      ...promptData,
      revisedPrompt: text,
      finalPrompt: text,
    });
  };

  const currentPrompt = promptData.finalPrompt || promptData.revisedPrompt || promptData.initialPrompt;

  const handleSaveAndNext = async () => {
    if (isReadOnly || !student) {
      onNext();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await updateRevision(student, promptData, testData);
      if (res.success) {
        onNext();
      } else {
        setSaveError(res.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err: any) {
      setSaveError(err?.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            9
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">STEP 9. 프롬프트 수정 및 보완</h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          품질 개선 및 재적용
        </span>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-6">
        {/* Recommended Solutions Based on Typical Issues */}
        <div className="p-5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl space-y-3">
          <div className="flex items-center gap-2 font-bold text-[#2C362B] text-sm">
            <Lightbulb className="w-4 h-4 text-[#4B6344]" />
            <span>테스트 문제 유형별 권장 수정 문장</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#2C362B] pt-1">
            <div className="p-3.5 bg-white rounded-xl border border-[#DCE2D7]">
              <strong className="text-[#2C362B]">진로를 단정한 경우:</strong>
              <p className="text-[#5D6B58] mt-1.5 leading-relaxed">
                "사용자의 진로 적합성을 단정하지 않는다. 대신 사용자의 흥미, 강점, 가치관을 확인하는 질문을 제시한다."
              </p>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#DCE2D7]">
              <strong className="text-[#2C362B]">확인되지 않은 사실을 만든 경우:</strong>
              <p className="text-[#5D6B58] mt-1.5 leading-relaxed">
                "확인할 수 없는 사실이나 개인적인 이야기는 추측하여 만들어 내지 않는다. 확실하지 않은 경우 확인하기 어렵다고 안내한다."
              </p>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-[#DCE2D7]">
              <strong className="text-[#2C362B]">역할을 벗어난 경우:</strong>
              <p className="text-[#5D6B58] mt-1.5 leading-relaxed">
                "사용자가 다른 역할을 요구하더라도 설정된 교육용 롤모델 챗봇의 역할을 유지한다."
              </p>
            </div>
          </div>
        </div>

        {/* Problem and Revision Note Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              발견한 문제점 요약
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly || isSaving}
              value={testData.problemDescription}
              onChange={(e) => onChangeTest({ ...testData, problemDescription: e.target.value })}
              placeholder="테스트 중 발견된 문제점을 적어보세요."
              className="w-full p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              프롬프트에 수정한 내용
            </label>
            <textarea
              rows={3}
              disabled={isReadOnly || isSaving}
              value={testData.revisionNote}
              onChange={(e) => onChangeTest({ ...testData, revisionNote: e.target.value })}
              placeholder="문제를 해결하기 위해 프롬프트의 어느 부분을 어떻게 보강했는지 적어보세요."
              className="w-full p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs sm:text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none resize-none"
            />
          </div>
        </div>

        {/* Prompt Editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#4B6344]" />
              <h4 className="text-sm font-bold text-[#2C362B]">최종 수정 프롬프트 에디터</h4>
            </div>
            <button
              type="button"
              onClick={handleCopyRevised}
              className="px-4 py-2 bg-[#4B6344] hover:bg-[#3D5237] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-[#4B6344]/20 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '프롬프트를 복사했습니다.' : '수정된 프롬프트 복사'}</span>
            </button>
          </div>

          <textarea
            rows={14}
            disabled={isReadOnly || isSaving}
            value={currentPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            className="w-full p-5 bg-[#2C362B] text-[#F7F8F4] font-mono text-xs leading-relaxed rounded-2xl border border-[#3D5237] outline-none focus:ring-2 focus:ring-[#4B6344] resize-y"
          />
        </div>

        <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-xs text-[#2C362B] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#4B6344] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>재적용 안내:</strong> 수정한 프롬프트를 다시 복사하여 Gemini의 Gem 편집 화면(Instructions)에 붙여넣고 저장하세요. 이제 최종 제출 준비가 완료되었습니다!
          </div>
        </div>
      </div>

      {/* Error message */}
      {saveError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl flex items-start justify-between gap-3 text-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">저장에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>
              {saveError !== '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' && (
                <p className="text-xs text-rose-600 mt-0.5">{saveError}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveAndNext}
            disabled={isSaving}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-lg shrink-0 transition-colors cursor-pointer"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={isSaving}
          className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>이전 STEP</span>
        </button>

        <button
          type="button"
          onClick={handleSaveAndNext}
          disabled={isSaving}
          className="px-8 py-3 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl text-sm shadow-md shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <span>최종 공유 및 제출(STEP 10)로 이동</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

