import React, { useEffect } from 'react';
import { PersonalityData } from '../../types';
import { Smile, MessageSquare, HeartHandshake, ArrowRight, ArrowLeft, Check, Info } from 'lucide-react';
import { buildPersonalityRulesSummary } from '../../utils/promptGenerator';

interface Step3PersonalityProps {
  data: PersonalityData;
  onChange: (data: PersonalityData) => void;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

const PERSONALITY_OPTIONS = [
  '친절한',
  '따뜻한',
  '차분한',
  '진지한',
  '긍정적인',
  '자신감 있는',
  '유쾌한',
  '솔직한',
  '겸손한',
  '열정적인',
  '현실적인',
  '응원해 주는',
  '논리적인',
  '도전적인',
];

const TONE_OPTIONS = [
  '친구처럼 편안하게',
  '선배처럼 조언하듯이',
  '선생님처럼 차분하게',
  '코치처럼 힘 있게',
  '멘토처럼 따뜻하게',
  '인터뷰에 답하듯 진지하게',
];

const HONORIFIC_OPTIONS: Array<'친근한 존댓말' | '차분한 존댓말' | '정중한 존댓말'> = [
  '친근한 존댓말',
  '차분한 존댓말',
  '정중한 존댓말',
];

export const Step3Personality: React.FC<Step3PersonalityProps> = ({
  data,
  onChange,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const updateField = <K extends keyof PersonalityData>(field: K, value: PersonalityData[K]) => {
    if (isReadOnly) return;
    onChange({ ...data, [field]: value });
  };

  const togglePersonality = (item: string) => {
    if (isReadOnly) return;
    const current = data.personalities || [];
    if (current.includes(item)) {
      onChange({ ...data, personalities: current.filter((p) => p !== item) });
    } else {
      if (current.length >= 3) {
        return; // Max 3
      }
      onChange({ ...data, personalities: [...current, item] });
    }
  };

  useEffect(() => {
    const summary = buildPersonalityRulesSummary(data);
    if (summary !== data.personalityRulesSummary) {
      onChange({ ...data, personalityRulesSummary: summary });
    }
  }, [data.personalities, data.speakingStyle, data.honorificStyle, data.desiredFeeling]);

  const isValid =
    data.personalities.length >= 2 &&
    data.personalities.length <= 3 &&
    Boolean(data.speakingStyle) &&
    Boolean(data.honorificStyle);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            3
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">STEP 3. 챗봇 성격과 말투 정하기</h3>
        </div>
        <span className="text-xs text-[#6B7280]">대화 스타일 및 분위기 설정</span>
      </div>

      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-8">
        {/* STEP 3-1: Personality Traits */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <Smile className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 3-1. 챗봇 성격 (2~3개 선택)</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-0.5">
                실제 인물의 성격을 단정하기보다, 조사한 내용과 내가 닮고 싶은 모습을 바탕으로 정해 보세요.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                data.personalities.length >= 2 && data.personalities.length <= 3
                  ? 'bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]'
                  : 'bg-[#F9FAF8] text-[#5D6B58] border border-[#E1E4D8]'
              }`}
            >
              {data.personalities.length} / 3개 선택됨
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {PERSONALITY_OPTIONS.map((trait) => {
              const isSelected = data.personalities.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  disabled={isReadOnly || (!isSelected && data.personalities.length >= 3)}
                  onClick={() => togglePersonality(trait)}
                  className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                      : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF] disabled:opacity-40'
                  }`}
                >
                  <span>{trait}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 3-2: Tone & Honorifics */}
        <div className="border-t border-[#F3F4F1] pt-6 space-y-6">
          <div>
            <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2 mb-1">
              <MessageSquare className="w-5 h-5 text-[#4B6344]" />
              <span>STEP 3-2. 말투 및 존댓말 방식</span>
            </h4>
            <p className="text-xs text-[#6B7280] mb-4">
              멘토로서 학생에게 전할 답변의 기본 톤을 선택하세요.
            </p>

            <label className="block text-xs font-bold text-[#4B6344] mb-2">말투 스타일</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TONE_OPTIONS.map((tone) => {
                const isSelected = data.speakingStyle === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => updateField('speakingStyle', tone)}
                    className={`p-3.5 rounded-xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                        : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                    }`}
                  >
                    <span>{tone}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4B6344] mb-2">존댓말 형식</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {HONORIFIC_OPTIONS.map((h) => {
                const isSelected = data.honorificStyle === h;
                const sample =
                  h === '친근한 존댓말'
                    ? '예: "~해요, ~해보면 좋아요!"'
                    : h === '차분한 존댓말'
                    ? '예: "~합니다, ~해보길 권합니다."'
                    : '예: "~하십시오, ~사료됩니다."';

                return (
                  <button
                    key={h}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => updateField('honorificStyle', h)}
                    className={`p-3.5 rounded-2xl text-xs font-semibold border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#F1F4EF] text-[#2C362B] border-[#4B6344] ring-2 ring-[#4B6344]/20'
                        : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#2C362B]">{h}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#4B6344]" />}
                    </div>
                    <div className="text-[11px] text-[#6B7280] mt-1">{sample}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* STEP 3-3: Desired Atmosphere */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2 mb-1">
            <HeartHandshake className="w-5 h-5 text-[#4B6344]" />
            <span>STEP 3-3. 원하는 대화 분위기</span>
          </h4>
          <p className="text-xs text-[#6B7280] mb-3">
            이 챗봇과 대화한 사람이 어떤 느낌을 받았으면 좋겠나요? (자유 서술)
          </p>

          <input
            type="text"
            disabled={isReadOnly}
            value={data.desiredFeeling}
            onChange={(e) => updateField('desiredFeeling', e.target.value)}
            placeholder="예: 고민이 해결되고 용기를 얻었으며, 나도 할 수 있다는 자신감"
            className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
          />

          <div className="mt-4 p-5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-xs text-[#2C362B] space-y-1.5">
            <div className="font-bold text-[#2C362B] flex items-center gap-1.5 text-sm">
              <Info className="w-4 h-4 text-[#4B6344]" />
              <span>성격 및 말투 규칙 요약</span>
            </div>
            <p className="leading-relaxed text-[#5D6B58]">
              {buildPersonalityRulesSummary(data)}
            </p>
          </div>
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
          <span>다음 STEP으로 저장 및 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
