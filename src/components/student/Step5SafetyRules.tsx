import React, { useState, useEffect } from 'react';
import { SafetyRuleData, RoleModelData } from '../../types';
import {
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Sparkles,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';

interface Step5SafetyRulesProps {
  data: SafetyRuleData;
  roleModel: RoleModelData;
  onChange: (data: SafetyRuleData) => void;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

const FACTUALITY_RULES = [
  '확인되지 않은 내용을 사실처럼 말하지 않는다.',
  '모르는 내용은 자의적으로 추측하지 않는다.',
  '공개되지 않은 사생활이나 개인정보를 만들어 내지 않는다.',
  '학생이 조사한 자료와 공개적으로 확인 가능한 정보를 우선한다.',
  '확실하지 않은 경우 "확인하기 어렵다"고 솔직하게 안내한다.',
];

const SAFETY_RULES = [
  '다른 사람의 개인정보를 절대 요구하지 않는다.',
  '위험하거나 부적절한 행동을 권하지 않는다.',
  '공격적이거나 모욕적인 표현을 사용하지 않는다.',
  '역할에서 벗어나는 요청에는 교육용 목적을 정중히 안내한다.',
];

export const Step5SafetyRules: React.FC<Step5SafetyRulesProps> = ({
  data,
  roleModel,
  onChange,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const [factualityChecks, setFactualityChecks] = useState<boolean[]>(() => {
    if (data.checkedFactualityRules && data.checkedFactualityRules.length === 5) {
      return data.checkedFactualityRules;
    }
    // If previously marked agreedToRules, default to true
    return data.agreedToRules ? [true, true, true, true, true] : [false, false, false, false, false];
  });

  const [disclaimerCheck, setDisclaimerCheck] = useState<boolean>(() => {
    return data.checkedDisclaimer !== undefined ? data.checkedDisclaimer : Boolean(data.agreedToRules);
  });

  const [safetyChecks, setSafetyChecks] = useState<boolean[]>(() => {
    if (data.checkedSafetyRules && data.checkedSafetyRules.length === 4) {
      return data.checkedSafetyRules;
    }
    return data.agreedToRules ? [true, true, true, true] : [false, false, false, false];
  });

  const [selectedQuiz, setSelectedQuiz] = useState<string>(data.quizAnswer || '');
  const [hasSubmittedQuiz, setHasSubmittedQuiz] = useState<boolean>(data.quizPassed);

  const roleModelName = roleModel.roleModelName || '롤모델';

  // Calculate completion status
  const factualityCount = factualityChecks.filter(Boolean).length;
  const disclaimerCount = disclaimerCheck ? 1 : 0;
  const quizCount = selectedQuiz === 'C' ? 1 : 0;
  const safetyCount = safetyChecks.filter(Boolean).length;

  const totalChecked = factualityCount + disclaimerCount + quizCount + safetyCount;
  const totalRequired = 11; // 5 factuality + 1 disclaimer + 1 quiz + 4 safety
  const isAllCompleted = totalChecked === totalRequired;

  const syncState = (
    newFact: boolean[],
    newDisc: boolean,
    newSafe: boolean[],
    newQuiz: string
  ) => {
    const isQuizPassed = newQuiz === 'C';
    const allChecked =
      newFact.filter(Boolean).length === 5 &&
      newDisc &&
      isQuizPassed &&
      newSafe.filter(Boolean).length === 4;

    onChange({
      ...data,
      quizAnswer: newQuiz,
      quizPassed: isQuizPassed,
      agreedToRules: allChecked,
      checkedFactualityRules: newFact,
      checkedDisclaimer: newDisc,
      checkedSafetyRules: newSafe,
      allRulesChecked: allChecked,
    });
  };

  const toggleFactuality = (idx: number) => {
    if (isReadOnly) return;
    const updated = [...factualityChecks];
    updated[idx] = !updated[idx];
    setFactualityChecks(updated);
    syncState(updated, disclaimerCheck, safetyChecks, selectedQuiz);
  };

  const toggleAllFactuality = (checkAll: boolean) => {
    if (isReadOnly) return;
    const updated = [checkAll, checkAll, checkAll, checkAll, checkAll];
    setFactualityChecks(updated);
    syncState(updated, disclaimerCheck, safetyChecks, selectedQuiz);
  };

  const toggleDisclaimer = () => {
    if (isReadOnly) return;
    const updated = !disclaimerCheck;
    setDisclaimerCheck(updated);
    syncState(factualityChecks, updated, safetyChecks, selectedQuiz);
  };

  const toggleSafety = (idx: number) => {
    if (isReadOnly) return;
    const updated = [...safetyChecks];
    updated[idx] = !updated[idx];
    setSafetyChecks(updated);
    syncState(factualityChecks, disclaimerCheck, updated, selectedQuiz);
  };

  const toggleAllSafety = (checkAll: boolean) => {
    if (isReadOnly) return;
    const updated = [checkAll, checkAll, checkAll, checkAll];
    setSafetyChecks(updated);
    syncState(factualityChecks, disclaimerCheck, updated, selectedQuiz);
  };

  const handleSelectAllRules = () => {
    if (isReadOnly) return;
    const allFact = [true, true, true, true, true];
    const allDisc = true;
    const allSafe = [true, true, true, true];
    const newQuiz = selectedQuiz || 'C'; // set to C if not selected
    setFactualityChecks(allFact);
    setDisclaimerCheck(allDisc);
    setSafetyChecks(allSafe);
    setSelectedQuiz(newQuiz);
    setHasSubmittedQuiz(true);
    syncState(allFact, allDisc, allSafe, newQuiz);
  };

  const handleSelectQuizOption = (opt: string) => {
    if (isReadOnly) return;
    setSelectedQuiz(opt);
    setHasSubmittedQuiz(true);
    syncState(factualityChecks, disclaimerCheck, safetyChecks, opt);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E1E4D8] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-[#4B6344] text-white text-sm font-bold flex items-center justify-center shadow-xs">
            5
          </span>
          <div>
            <h3 className="font-bold text-[#2C362B] text-base sm:text-lg">
              STEP 5. 사실성·안전 규칙 확인하기
            </h3>
            <p className="text-xs text-[#6B7280]">
              안전하고 신뢰할 수 있는 AI 챗봇을 만들기 위해 각 규칙을 읽고 확인 체크해 주세요.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSelectAllRules}
            disabled={isReadOnly || isAllCompleted}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isAllCompleted
                ? 'bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]'
                : 'bg-[#4B6344]/10 hover:bg-[#4B6344]/20 text-[#4B6344] border border-[#4B6344]/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isAllCompleted ? '모든 규칙 확인 완료' : '전체 항목 일괄 확인'}</span>
          </button>
        </div>
      </div>

      {/* Progress Box */}
      <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-4 sm:p-5 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[#2C362B] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#4B6344]" />
            <span>규칙 확인 진행 상황</span>
          </span>
          <span className={isAllCompleted ? 'text-[#4B6344]' : 'text-amber-600'}>
            {totalChecked} / {totalRequired}개 확인 완료 ({Math.round((totalChecked / totalRequired) * 100)}%)
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E1E4D8] h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isAllCompleted ? 'bg-[#4B6344]' : 'bg-[#4B6344]/70'
            }`}
            style={{ width: `${(totalChecked / totalRequired) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-8">
        {/* 1. Factuality Rules */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#4B6344]" />
              <h4 className="text-lg sm:text-xl font-bold text-[#2C362B]">
                1. 사실성 보장 규칙 (5개 항목 필수 확인)
              </h4>
            </div>

            <button
              type="button"
              onClick={() => toggleAllFactuality(factualityCount < 5)}
              disabled={isReadOnly}
              className="text-[11px] font-bold text-[#4B6344] hover:text-[#3D5237] underline self-start sm:self-auto cursor-pointer"
            >
              {factualityCount === 5 ? '선택 해제' : '5개 항목 모두 체크'}
            </button>
          </div>
          <p className="text-xs text-[#6B7280] mb-4">
            AI가 거짓 정보나 환각(Hallucination)을 생성하지 않도록 각 규칙을 클릭하여 확인 체크하세요.
          </p>

          <div className="space-y-2.5">
            {FACTUALITY_RULES.map((rule, idx) => {
              const isChecked = factualityChecks[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleFactuality(idx)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isChecked
                      ? 'bg-[#F1F4EF] border-[#4B6344] text-[#2C362B] shadow-2xs'
                      : 'bg-[#F9FAF8] hover:bg-[#F3F4F1] border-[#E1E4D8] text-[#5D6B58]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`shrink-0 w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-[#4B6344] text-white'
                          : 'border-2 border-[#BAC1B3] bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                    <span className="text-xs font-semibold leading-relaxed">{rule}</span>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      isChecked
                        ? 'bg-[#4B6344]/15 text-[#4B6344]'
                        : 'bg-[#E1E4D8] text-[#6B7280]'
                    }`}
                  >
                    {isChecked ? '확인됨' : '확인 필요'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Real Person Identity Disclaimer */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h4 className="text-lg sm:text-xl font-bold text-[#2C362B]">
              2. 실존 인물 고지 문장 (필수 확인)
            </h4>
          </div>

          <div className="bg-[#FFFDF7] border border-amber-200 rounded-2xl p-5 mb-3 text-xs text-[#2C362B] leading-relaxed font-medium">
            "너는 실제 <strong>{roleModelName}</strong> 본인이 아니라 공개적으로 확인할 수 있는 자료와 학생이 제공한 조사 내용을 바탕으로 만든 교육용 롤모델 챗봇이다. 실제 인물이 직접 말한 것처럼 확인되지 않은 생각이나 경험을 만들어 내지 않는다."
          </div>

          <div
            onClick={toggleDisclaimer}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              disclaimerCheck
                ? 'bg-[#F1F4EF] border-[#4B6344] text-[#2C362B] shadow-2xs'
                : 'bg-[#F9FAF8] hover:bg-[#F3F4F1] border-[#E1E4D8] text-[#5D6B58]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`shrink-0 w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center transition-colors ${
                  disclaimerCheck
                    ? 'bg-[#4B6344] text-white'
                    : 'border-2 border-[#BAC1B3] bg-white text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
              <span className="text-xs font-bold text-[#2C362B] leading-relaxed">
                위 실존 인물 고지 문장을 확인하였으며, AI 챗봇이 허구의 사생활이나 경험을 임의로 만들지 않도록 규정함을 동의합니다.
              </span>
            </div>

            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                disclaimerCheck
                  ? 'bg-[#4B6344]/15 text-[#4B6344]'
                  : 'bg-[#E1E4D8] text-[#6B7280]'
              }`}
            >
              {disclaimerCheck ? '확인됨' : '확인 필요'}
            </span>
          </div>
        </div>

        {/* 3. Career Advice Mini Quiz */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-5 h-5 text-[#4B6344]" />
            <h4 className="text-lg sm:text-xl font-bold text-[#2C362B]">
              3. 진로 조언 미니 퀴즈 (정답 선택 필수)
            </h4>
          </div>
          <p className="text-xs text-[#6B7280] mb-4">
            좋은 AI 진로 멘토가 되기 위해 올바른 답변 태도를 골라보세요.
          </p>

          <div className="bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl p-5 mb-4">
            <div className="text-sm font-bold text-[#2C362B] mb-3.5">
              Q. “제가 이 직업에 잘 어울리나요?”라는 질문을 받았을 때 챗봇의 가장 바람직한 답변은?
            </div>

            <div className="space-y-2.5">
              {[
                { id: 'A', text: 'A. “네, 질문자님은 이 직업에 아주 잘 어울립니다!”라고 확답해 준다.' },
                { id: 'B', text: 'B. “아닙니다. 다른 직업을 찾아보는 것이 좋겠습니다.”라고 단정 짓는다.' },
                {
                  id: 'C',
                  text: 'C. “제가 대신 결정하기보다, 질문자님의 흥미와 강점, 가치관을 함께 생각해보며 탐색할 수 있도록 도와드릴게요.”',
                  isCorrect: true,
                },
              ].map((opt) => {
                const isSelected = selectedQuiz === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleSelectQuizOption(opt.id)}
                    className={`w-full p-4 rounded-xl text-left text-xs font-semibold border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? opt.isCorrect
                          ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                          : 'bg-rose-50 text-rose-900 border-rose-300'
                        : 'bg-white text-[#2C362B] border-[#E1E4D8] hover:bg-[#F9FAF8]'
                    }`}
                  >
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        isSelected && opt.isCorrect
                          ? 'bg-white text-[#4B6344]'
                          : 'bg-[#F1F4EF] text-[#5D6B58]'
                      }`}
                    >
                      {opt.id}
                    </span>
                    <span className="leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            {hasSubmittedQuiz && (
              <div className="mt-4 pt-3.5 border-t border-[#DCE2D7]">
                {selectedQuiz === 'C' ? (
                  <div className="flex items-center gap-2 text-[#4B6344] font-bold text-xs animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-[#4B6344] shrink-0" />
                    <span>
                      정답입니다! 다음 필수 규칙이 프롬프트에 자동으로 삽입됩니다:
                      <br />
                      <span className="font-normal text-[#2C362B] mt-1 block">
                        "학생의 진로 적합성을 단정하지 않는다. 학생이 자신의 흥미, 강점, 가치관을 스스로 생각하도록 돕는다."
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-rose-700 font-medium">
                    다시 생각해 보세요! 챗봇은 학생의 진로를 대신 단정하지 않고 스스로 탐색하도록 도와야 합니다. (C번을 선택해 보세요.)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Common Safety Rules */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#4B6344]" />
              <h4 className="text-lg sm:text-xl font-bold text-[#2C362B]">
                4. 공통 안전 및 윤리 규칙 (4개 항목 필수 확인)
              </h4>
            </div>

            <button
              type="button"
              onClick={() => toggleAllSafety(safetyCount < 4)}
              disabled={isReadOnly}
              className="text-[11px] font-bold text-[#4B6344] hover:text-[#3D5237] underline self-start sm:self-auto cursor-pointer"
            >
              {safetyCount === 4 ? '선택 해제' : '4개 항목 모두 체크'}
            </button>
          </div>

          <p className="text-xs text-[#6B7280] mb-4">
            안전한 대화 환경을 위해 4가지 윤리 규칙을 각각 클릭하여 확인하세요.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SAFETY_RULES.map((rule, idx) => {
              const isChecked = safetyChecks[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleSafety(idx)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                    isChecked
                      ? 'bg-[#F1F4EF] border-[#4B6344] text-[#2C362B] shadow-2xs'
                      : 'bg-[#F9FAF8] hover:bg-[#F3F4F1] border-[#E1E4D8] text-[#5D6B58]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`shrink-0 w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-[#4B6344] text-white'
                          : 'border-2 border-[#BAC1B3] bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                    <span className="text-xs font-semibold leading-relaxed">{rule}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      isChecked
                        ? 'bg-[#4B6344]/15 text-[#4B6344]'
                        : 'bg-[#E1E4D8] text-[#6B7280]'
                    }`}
                  >
                    {isChecked ? '확인' : '미확인'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Helper guide when incomplete */}
      {!isAllCompleted && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            다음 단계로 진행하려면 모든 사실성 규칙(5개), 실존 인물 고지(1개), 퀴즈 정답(1개), 안전 규칙(4개)을 모두 확인해야 합니다. (남은 항목: {totalRequired - totalChecked}개)
          </span>
        </div>
      )}

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
          disabled={!isAllCompleted}
          className="px-8 py-3 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm shadow-md shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>다음 STEP (프롬프트 생성)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
