import React, { useState } from 'react';
import { PromptData, StudentInfo } from '../../types';
import { Sparkles, Copy, ExternalLink, Check, ArrowRight, ArrowLeft, Layers, PlayCircle, AlertCircle } from 'lucide-react';
import { updateCurrentStep } from '../../api/client';

interface Step7GeminiGuideProps {
  promptData: PromptData;
  student?: StudentInfo;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

const GUIDE_STEPS = [
  {
    num: 1,
    title: 'Gemini 접속하기',
    desc: '아래 [Gemini 열기] 버튼을 눌러 새 탭에서 Google Gemini를 엽니다.',
  },
  {
    num: 2,
    title: 'Gems 메뉴로 이동',
    desc: '새 탭에서 Gemini가 열리면 왼쪽 사이드바에서 [Gems]를 클릭합니다. Gem을 처음 만드는 경우 [설정 및 도움말] → [Gems]에서 들어갈 수도 있습니다.',
  },
  {
    num: 3,
    title: '새 Gem 만들기',
    desc: '[Gems] → [새 Gem]을 클릭하여 새로운 챗봇 생성 화면으로 들어갑니다.',
  },
  {
    num: 4,
    title: '챗봇 이름 입력',
    desc: '웹앱에서 복사한 챗봇 이름(예: ○○○ 진로 멘토)을 Gem 이름 항목에 입력합니다.',
  },
  {
    num: 5,
    title: 'Instructions에 프롬프트 붙여넣기',
    desc: '복사한 최종 프롬프트를 [지침(Instructions)] 영역에 그대로 붙여넣습니다.',
  },
  {
    num: 6,
    title: 'Gem 저장하기',
    desc: '우측 상단의 [저장] 또는 [만들기] 버튼을 눌러 나만의 챗봇을 완성합니다.',
  },
  {
    num: 7,
    title: '대화 시작 및 링크 복사',
    desc: '만들어진 Gem과 대화를 시작하고, 우측 상단 공유 메뉴에서 링크를 복사해 둘 수 있습니다.',
  },
];

export const Step7GeminiGuide: React.FC<Step7GeminiGuideProps> = ({
  promptData,
  student,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCopy = () => {
    const text = promptData.finalPrompt || promptData.revisedPrompt || promptData.initialPrompt;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndNext = async () => {
    if (isReadOnly || !student) {
      onNext();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await updateCurrentStep(student, 7);
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
            7
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">
            STEP 7. Gemini Gems 제작 안내
          </h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          실제 Gem 만들기
        </span>
      </div>

      {/* Main Guide Card */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#4B6344] text-white flex items-center justify-center mx-auto shadow-md shadow-[#4B6344]/20">
            <Sparkles className="w-7 h-7" />
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-[#2C362B]">
            이제 실제 챗봇을 만들어 봅시다!
          </h3>
          <p className="text-[#6B7280] text-sm max-w-lg mx-auto">
            설계한 프롬프트를 복사하여 Google Gemini Gems에 붙여넣으면 나만의 진로 AI 멘토가 완성됩니다.
          </p>
        </div>

        {/* Action Buttons Box */}
        <div className="bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-xs text-[#6B7280]">등록할 챗봇 이름</div>
            <div className="text-base font-bold text-[#2C362B]">
              {promptData.chatbotName || '나의 롤모델 AI 멘토'}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-5 py-3 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-[#4B6344]/20 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '프롬프트를 복사했습니다.' : '최종 프롬프트 복사'}</span>
            </button>

            <a
              href="https://gemini.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none px-5 py-3 bg-white hover:bg-[#F9FAF8] text-[#2C362B] border border-[#E1E4D8] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer inline-flex"
            >
              <ExternalLink className="w-4 h-4 text-[#4B6344]" />
              <span>Gemini 열기</span>
            </a>
          </div>
        </div>

        {/* 7-Step Step-by-Step Interactive Cards */}
        <div className="space-y-4">
          <h4 className="text-base font-bold text-[#2C362B] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4B6344]" />
            <span>제작 순서 7단계</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {GUIDE_STEPS.map((step) => (
              <div
                key={step.num}
                className="p-4 bg-[#F9FAF8] hover:bg-[#F1F4EF] border border-[#E1E4D8] rounded-2xl transition-all flex items-start gap-3.5"
              >
                <div className="w-6 h-6 rounded-full bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {step.num}
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-xs sm:text-sm text-[#2C362B]">{step.title}</div>
                  <div className="text-xs text-[#5D6B58] leading-relaxed">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-xs text-[#2C362B] leading-relaxed flex items-center gap-3">
          <PlayCircle className="w-5 h-5 text-[#4B6344] shrink-0" />
          <span>
            Gem을 만든 후 다음 단계로 이동하여 <strong>6가지 테스트 질문</strong>으로 챗봇의 답변 태도를 직접 검증해 보세요!
          </span>
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
              <span>Gem 제작 완료 & STEP 8 테스트하기</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

