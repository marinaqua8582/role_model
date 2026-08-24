import React from 'react';
import { Check } from 'lucide-react';

export const STEP_NAMES = [
  '롤모델 정보',
  '챗봇 목적',
  '성격과 말투',
  '답변 방식',
  '사실성·안전 규칙',
  '프롬프트 완성',
  'Gemini 제작 안내',
  '챗봇 테스트',
  '프롬프트 수정',
  '최종 제출',
];

interface StepProgressBarProps {
  currentStep: number;
  maxStepReached?: number;
  onStepClick?: (step: number) => void;
  onSelectStep?: (step: number) => void;
  isReadOnly?: boolean;
}

export const StepProgressBar: React.FC<StepProgressBarProps> = ({
  currentStep,
  maxStepReached = currentStep,
  onStepClick,
  onSelectStep,
  isReadOnly = false,
}) => {
  const handleSelect = onStepClick || onSelectStep || (() => {});
  const progressPercent = Math.round(((currentStep - 1) / (STEP_NAMES.length - 1)) * 100);

  return (
    <div className="bg-white border-b border-[#E1E4D8] py-4 px-4 sm:px-6 print:hidden">
      <div className="max-w-4xl mx-auto">
        {/* Top Label & Visual Text Bar */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]">
              STEP {currentStep} / {STEP_NAMES.length}
            </span>
            <h2 className="text-sm font-bold text-[#2C362B]">
              {STEP_NAMES[currentStep - 1]}
            </h2>
          </div>
          <div className="text-xs text-[#6B7280] font-medium hidden sm:block">
            진행률: <span className="font-bold text-[#4B6344]">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden mb-3.5">
          <div
            className="bg-[#4B6344] h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(6, progressPercent)}%` }}
          />
        </div>

        {/* 10 Step Buttons */}
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
          {STEP_NAMES.map((name, index) => {
            const stepNum = index + 1;
            const isCurrent = stepNum === currentStep;
            const isCompleted = stepNum < currentStep || stepNum < maxStepReached;
            const isAccessible = stepNum <= Math.max(currentStep, maxStepReached) || isReadOnly;

            return (
              <button
                key={stepNum}
                type="button"
                disabled={!isAccessible}
                onClick={() => isAccessible && handleSelect(stepNum)}
                title={`STEP ${stepNum}: ${name}`}
                className={`group relative flex flex-col items-center py-1.5 rounded-xl transition-all text-left ${
                  isCurrent
                    ? 'bg-[#F1F4EF] border border-[#DCE2D7] font-semibold'
                    : isCompleted
                    ? 'hover:bg-[#F9FAF8] cursor-pointer'
                    : isAccessible
                    ? 'hover:bg-[#F9FAF8] cursor-pointer'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-colors ${
                    isCurrent
                      ? 'bg-[#4B6344] text-white shadow-xs'
                      : isCompleted
                      ? 'bg-[#4B6344] text-white'
                      : 'bg-[#E1E4D8] text-[#5D6B58]'
                  }`}
                >
                  {isCompleted && !isCurrent ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className={`text-[10px] truncate max-w-full hidden md:block mt-1 scale-90 ${
                  isCurrent ? 'font-bold text-[#4B6344]' : 'text-[#6B7280]'
                }`}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
