import React, { useState, useEffect } from 'react';
import { PromptData, RoleModelData, ChatbotPurposeData, PersonalityData, ResponseStyleData } from '../../types';
import { Sparkles, FileText, CheckCircle2, Copy, Check, Edit2, Bot, ArrowRight, ArrowLeft } from 'lucide-react';
import { generateStructuredPrompt } from '../../utils/promptGenerator';

interface Step6FinalPromptProps {
  data: PromptData;
  roleModel: RoleModelData;
  purpose: ChatbotPurposeData;
  personality: PersonalityData;
  responseStyle: ResponseStyleData;
  onChange: (data: PromptData) => void;
  onNext: () => void;
  onPrev: () => void;
  onJumpToStep: (step: number) => void;
  isReadOnly?: boolean;
}

export const Step6FinalPrompt: React.FC<Step6FinalPromptProps> = ({
  data,
  roleModel,
  purpose,
  personality,
  responseStyle,
  onChange,
  onNext,
  onPrev,
  onJumpToStep,
  isReadOnly = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [checklist, setChecklist] = useState<{ [key: string]: boolean }>({
    roleModel: true,
    purpose: true,
    personality: true,
    response: true,
    factuality: true,
    careerAdvice: true,
  });

  // Auto-generate initial prompt if not set or when inputs change
  useEffect(() => {
    const generated = generateStructuredPrompt({
      roleModel,
      purpose,
      personality,
      responseStyle,
      chatbotName: data.chatbotName,
    });

    if (!data.initialPrompt || data.initialPrompt !== generated) {
      onChange({
        ...data,
        initialPrompt: generated,
        finalPrompt: data.revisedPrompt || generated,
      });
    }
  }, [roleModel, purpose, personality, responseStyle, data.chatbotName]);

  const handleCopyPrompt = () => {
    const promptText = data.finalPrompt || data.initialPrompt;
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCheck = (key: string) => {
    if (isReadOnly) return;
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllChecked = Object.values(checklist).every(Boolean);
  const hasName = Boolean(data.chatbotName && data.chatbotName.trim());
  const isValid = isAllChecked && hasName;

  const roleName = roleModel.roleModelName || '롤모델';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            6
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">
            STEP 6. 최종 프롬프트 생성 및 확정
          </h3>
        </div>
        <span className="text-xs font-bold text-[#4B6344] bg-[#F1F4EF] px-3 py-1 rounded-full border border-[#DCE2D7]">
          Gemini Gems 프롬프트 완성
        </span>
      </div>

      {/* 6-1. Summary Cards with Step Jump buttons */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-[#2C362B] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4B6344]" />
            <span>설정 내용 요약 및 수정</span>
          </h4>
          <span className="text-xs text-[#6B7280]">수정이 필요하면 해당 STEP 아이콘을 누르세요</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Role Model Card */}
          <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl relative group">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => onJumpToStep(1)}
              className="absolute top-3 right-3 text-[#6B7280] hover:text-[#4B6344] p-1 rounded-lg transition-colors cursor-pointer"
              title="STEP 1 수정"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <div className="font-bold text-[#2C362B] mb-1">롤모델 정보</div>
            <div className="text-[#5D6B58] truncate">
              <strong>{roleModel.roleModelName || '미입력'}</strong> ({roleModel.roleModelJob || '미입력'})
            </div>
            <div className="text-[#6B7280] truncate mt-0.5">
              역량: {roleModel.competencies.join(', ') || '없음'}
            </div>
          </div>

          {/* Purpose Card */}
          <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl relative group">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => onJumpToStep(2)}
              className="absolute top-3 right-3 text-[#6B7280] hover:text-[#4B6344] p-1 rounded-lg transition-colors cursor-pointer"
              title="STEP 2 수정"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <div className="font-bold text-[#2C362B] mb-1">챗봇 목적 & 대상</div>
            <div className="text-[#5D6B58] truncate">
              대상: {purpose.targetUser || '중학생'}
            </div>
            <div className="text-[#6B7280] truncate mt-0.5">
              역할 {purpose.chatbotPurposes.length}개 설정
            </div>
          </div>

          {/* Personality Card */}
          <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl relative group">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => onJumpToStep(3)}
              className="absolute top-3 right-3 text-[#6B7280] hover:text-[#4B6344] p-1 rounded-lg transition-colors cursor-pointer"
              title="STEP 3 수정"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <div className="font-bold text-[#2C362B] mb-1">성격 및 말투</div>
            <div className="text-[#5D6B58] truncate">
              {personality.personalities.join(', ') || '기본 성격'}
            </div>
            <div className="text-[#6B7280] truncate mt-0.5">
              {personality.speakingStyle} ({personality.honorificStyle})
            </div>
          </div>

          {/* Response Style Card */}
          <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl relative group">
            <button
              type="button"
              disabled={isReadOnly}
              onClick={() => onJumpToStep(4)}
              className="absolute top-3 right-3 text-[#6B7280] hover:text-[#4B6344] p-1 rounded-lg transition-colors cursor-pointer"
              title="STEP 4 수정"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <div className="font-bold text-[#2C362B] mb-1">답변 방식</div>
            <div className="text-[#5D6B58] truncate">
              길이: {responseStyle.answerLength === 'short' ? '2~3문장' : responseStyle.answerLength === 'medium' ? '4~6문장' : '자세하게'}
            </div>
            <div className="text-[#6B7280] truncate mt-0.5">
              구성 요소 {responseStyle.answerElements.length}개 선택
            </div>
          </div>
        </div>
      </div>

      {/* 6-4. Chatbot Name Input */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#4B6344]" />
          <h4 className="text-base font-bold text-[#2C362B]">챗봇 이름 정하기</h4>
          <span className="text-xs text-rose-500 font-bold">*필수</span>
        </div>

        <div>
          <input
            type="text"
            disabled={isReadOnly}
            value={data.chatbotName}
            onChange={(e) => onChange({ ...data, chatbotName: e.target.value })}
            placeholder="나만의 롤모델 챗봇 이름을 지어주세요"
            className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-base font-bold text-[#2C362B] placeholder:font-normal placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
          />

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-[#6B7280]">추천 예시:</span>
            {[
              `${roleName} 진로 멘토`,
              `${roleName}에게 묻다`,
              `꿈을 향한 ${roleName} 멘토`,
              `미래를 여는 ${roleName}`,
            ].map((example) => (
              <button
                key={example}
                type="button"
                disabled={isReadOnly}
                onClick={() => onChange({ ...data, chatbotName: example })}
                className="px-3 py-1 bg-[#F1F4EF] hover:bg-[#EAECE6] text-[#4B6344] text-xs font-bold rounded-lg border border-[#DCE2D7] transition-colors cursor-pointer"
              >
                + {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6-2. Generated Prompt Viewer */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#4B6344]" />
            <h4 className="text-lg font-bold text-[#2C362B]">생성된 Gemini Instructions 프롬프트</h4>
          </div>
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-4 py-2 bg-[#4B6344] hover:bg-[#3D5237] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-[#4B6344]/20 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '복사 완료!' : '프롬프트 전체 복사'}</span>
          </button>
        </div>

        <div className="relative">
          <textarea
            rows={14}
            disabled={isReadOnly}
            value={data.finalPrompt || data.initialPrompt}
            onChange={(e) => onChange({ ...data, finalPrompt: e.target.value, revisedPrompt: e.target.value })}
            className="w-full p-5 bg-[#2C362B] text-[#F7F8F4] font-mono text-xs leading-relaxed rounded-2xl border border-[#3D5237] outline-none focus:ring-2 focus:ring-[#4B6344] resize-y"
          />
          <div className="absolute bottom-4 right-4 text-[11px] text-[#AAB5A5] bg-[#3D5237]/80 px-2.5 py-1 rounded-lg">
            {(data.finalPrompt || data.initialPrompt).length} 자
          </div>
        </div>
      </div>

      {/* 6-3. Quality Checklist */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="w-5 h-5 text-[#4B6344]" />
          <h4 className="text-base font-bold text-[#2C362B]">프롬프트 최종 검토 체크리스트</h4>
        </div>
        <p className="text-xs text-[#6B7280]">
          다음 6가지 핵심 요소가 잘 포함되었는지 확인하고 체크해 주세요.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {[
            { id: 'roleModel', label: '롤모델 정보(인물, 직업, 역량, 가치)가 제대로 들어 있다.' },
            { id: 'purpose', label: '챗봇의 진로 멘토링 목적과 대상이 분명하다.' },
            { id: 'personality', label: '원하는 성격과 말투(존댓말)가 설정되어 있다.' },
            { id: 'response', label: '답변 길이와 구성 요소가 잘 설정되어 있다.' },
            { id: 'factuality', label: '거짓/환각을 방지하는 사실성 규칙이 들어 있다.' },
            { id: 'careerAdvice', label: '진로를 대신 결정하지 않는 안내 규칙이 있다.' },
          ].map((item) => {
            const isChecked = checklist[item.id];
            return (
              <button
                key={item.id}
                type="button"
                disabled={isReadOnly}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-2xl text-left text-xs font-semibold border flex items-center gap-3 transition-all cursor-pointer ${
                  isChecked
                    ? 'bg-[#F1F4EF] text-[#2C362B] border-[#DCE2D7]'
                    : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                    isChecked ? 'bg-[#4B6344] text-white' : 'border border-[#E1E4D8] bg-white'
                  }`}
                >
                  {isChecked && <Check className="w-3 h-3" />}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>이전 STEP</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className="px-8 py-3 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow-md shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>프롬프트 확정 & Gemini 제작 안내</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
