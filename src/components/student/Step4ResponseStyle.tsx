import React from 'react';
import { ResponseStyleData } from '../../types';
import { AlignLeft, Layers, ArrowRight, ArrowLeft, Check, BookOpen } from 'lucide-react';

interface Step4ResponseStyleProps {
  data: ResponseStyleData;
  onChange: (data: ResponseStyleData) => void;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

const LENGTH_OPTIONS: Array<{
  id: 'short' | 'medium' | 'detailed';
  title: string;
  desc: string;
  badge?: string;
}> = [
  {
    id: 'short',
    title: '짧고 간단하게',
    desc: '2~3문장 내외로 핵심만 명확하게 전달합니다.',
  },
  {
    id: 'medium',
    title: '적당하게',
    desc: '4~6문장 내외로 충분한 설명과 예시를 균형 있게 전달합니다.',
    badge: '추천',
  },
  {
    id: 'detailed',
    title: '필요할 때 자세하게',
    desc: '배경과 세부적인 과정까지 상세하게 풀어서 설명합니다.',
  },
];

const COMPOSITION_OPTIONS = [
  '질문에 대한 핵심 답부터 말하기',
  '롤모델의 경험이나 사례 연결하기',
  '직업의 실제 모습 설명하기',
  '필요한 역량과 연결하기',
  '준비 방법 알려 주기',
  '장점뿐 아니라 어려운 점도 설명하기',
  '학생이 생각할 질문 던지기',
  '마지막에 격려 한마디 하기',
];

export const Step4ResponseStyle: React.FC<Step4ResponseStyleProps> = ({
  data,
  onChange,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const toggleElement = (elem: string) => {
    if (isReadOnly) return;
    const current = data.answerElements || [];
    if (current.includes(elem)) {
      onChange({ ...data, answerElements: current.filter((e) => e !== elem) });
    } else {
      if (current.length >= 4) return; // Max 4
      onChange({ ...data, answerElements: [...current, elem] });
    }
  };

  const isValid =
    Boolean(data.answerLength) &&
    data.answerElements.length >= 1 &&
    data.answerElements.length <= 4;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            4
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">STEP 4. 답변 방식 정하기</h3>
        </div>
        <span className="text-xs text-[#6B7280]">답변 길이 및 구성 규칙</span>
      </div>

      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-8">
        {/* STEP 4-1: Answer Length */}
        <div>
          <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2 mb-1">
            <AlignLeft className="w-5 h-5 text-[#4B6344]" />
            <span>STEP 4-1. 기본 답변 길이</span>
          </h4>
          <p className="text-xs text-[#6B7280] mb-4">
            챗봇이 사용자 질문에 답할 때 유지할 적절한 문장 길이를 선택하세요.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {LENGTH_OPTIONS.map((opt) => {
              const isSelected = data.answerLength === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => onChange({ ...data, answerLength: opt.id })}
                  className={`p-5 rounded-2xl text-left border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-[#F1F4EF] border-[#4B6344] ring-2 ring-[#4B6344]/20'
                      : 'bg-[#F9FAF8] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                  }`}
                >
                  {opt.badge && (
                    <span className="absolute top-4 right-4 px-2 py-0.5 bg-[#4B6344] text-white text-[10px] font-bold rounded-full">
                      {opt.badge}
                    </span>
                  )}
                  <div className="font-bold text-sm text-[#2C362B] mb-1.5">{opt.title}</div>
                  <div className="text-xs text-[#5D6B58] leading-relaxed">{opt.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 4-2: Answer Composition */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 4-2. 선호하는 답변 구성 요소 (최대 4개)</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-0.5">
                답변에 꼭 포함되면 좋은 핵심 요소들을 골라보세요.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                data.answerElements.length >= 2 && data.answerElements.length <= 4
                  ? 'bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]'
                  : 'bg-[#F9FAF8] text-[#5D6B58] border border-[#E1E4D8]'
              }`}
            >
              {data.answerElements.length} / 4개 선택됨
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {COMPOSITION_OPTIONS.map((elem) => {
              const isSelected = data.answerElements.includes(elem);
              return (
                <button
                  key={elem}
                  type="button"
                  disabled={isReadOnly || (!isSelected && data.answerElements.length >= 4)}
                  onClick={() => toggleElement(elem)}
                  className={`p-3.5 rounded-2xl text-xs font-bold text-left border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                      : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF] disabled:opacity-40'
                  }`}
                >
                  <span>{elem}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 4-3: Question-type specific rules summary */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-[#4B6344]" />
            <span>STEP 4-3. 질문 유형별 기본 원칙 (자동 적용)</span>
          </h4>
          <p className="text-xs text-[#6B7280] mb-4">
            질문의 성격에 맞게 자연스러운 대화가 이루어지도록 프롬프트에 기본 탑재되는 규칙입니다.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
              <span className="font-bold text-[#2C362B]">① 직업 정보 질문:</span>
              <p className="text-[#5D6B58] mt-1 leading-relaxed">
                정확하고 구체적으로 설명하며, 중학생 눈높이에 맞춘 쉬운 어휘 사용
              </p>
            </div>
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
              <span className="font-bold text-[#2C362B]">② 진로 고민 질문:</span>
              <p className="text-[#5D6B58] mt-1 leading-relaxed">
                학생의 진로를 대신 단정하지 않고, 스스로 고민해 볼 생각거리와 질문 제공
              </p>
            </div>
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
              <span className="font-bold text-[#2C362B]">③ 실패·어려움 질문:</span>
              <p className="text-[#5D6B58] mt-1 leading-relaxed">
                극복 과정과 배운 점을 솔직하게 나누어 용기와 동기부여 전달
              </p>
            </div>
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
              <span className="font-bold text-[#2C362B]">④ 준비 방법 질문:</span>
              <p className="text-[#5D6B58] mt-1 leading-relaxed">
                중학생이 현재 학교생활과 일상에서 실천할 수 있는 현실적 역량 개발 안내
              </p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-[#6B7280] text-center">
            ※ 모든 질문에 동일한 형식을 반복하지 않고 질문 내용에 맞게 유연하게 답변합니다.
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
