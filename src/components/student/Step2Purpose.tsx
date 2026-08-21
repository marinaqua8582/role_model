import React, { useState, useEffect, useMemo } from 'react';
import { ChatbotPurposeData, RoleModelData, StudentInfo } from '../../types';
import { Target, Users, Sparkles, ArrowRight, ArrowLeft, Check, Edit3, RotateCcw, AlertCircle } from 'lucide-react';
import { buildChatbotPurposeSentence } from '../../utils/promptGenerator';
import { saveStep2Progress } from '../../api/client';
import { PURPOSE_OPTIONS, normalizeSinglePurpose } from '../../utils/normalizer';

interface Step2PurposeProps {
  data: ChatbotPurposeData;
  roleModel: RoleModelData;
  student?: StudentInfo;
  onChange: (data: ChatbotPurposeData) => void;
  onNext: () => void;
  onPrev: () => void;
  isReadOnly?: boolean;
}

const TARGET_OPTIONS = [
  '이 직업에 관심 있는 중학생',
  '진로를 아직 정하지 못한 중학생',
  '롤모델의 삶과 경험이 궁금한 학생',
  '나와 비슷한 고민을 하는 학생',
  '기타',
];

export const Step2Purpose: React.FC<Step2PurposeProps> = ({
  data,
  roleModel,
  student,
  onChange,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const [isEditingSentence, setIsEditingSentence] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Compute valid selected purposes strictly matching PURPOSE_OPTIONS
  const validSelectedPurposes = useMemo(() => {
    const rawList = Array.isArray(data.chatbotPurposes) ? data.chatbotPurposes : [];
    const normalizedList: string[] = [];
    const seen = new Set<string>();

    for (const item of rawList) {
      const normalized = normalizeSinglePurpose(item);
      if (normalized && (PURPOSE_OPTIONS as readonly string[]).includes(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        normalizedList.push(normalized);
      }
    }
    return normalizedList;
  }, [data.chatbotPurposes]);

  // Synchronize state if raw purposes had old tags or unnormalized strings
  useEffect(() => {
    const rawList = Array.isArray(data.chatbotPurposes) ? data.chatbotPurposes : [];
    const isDifferent =
      rawList.length !== validSelectedPurposes.length ||
      rawList.some((item, idx) => item !== validSelectedPurposes[idx]);

    if (isDifferent) {
      onChange({ ...data, chatbotPurposes: validSelectedPurposes });
    }
  }, [validSelectedPurposes]);

  const updateField = <K extends keyof ChatbotPurposeData>(field: K, value: ChatbotPurposeData[K]) => {
    if (isReadOnly) return;
    onChange({ ...data, [field]: value });
  };

  const togglePurpose = (purpose: string) => {
    if (isReadOnly) return;
    if (validSelectedPurposes.includes(purpose)) {
      onChange({ ...data, chatbotPurposes: validSelectedPurposes.filter((p) => p !== purpose) });
    } else {
      if (validSelectedPurposes.length >= 4) {
        return; // Max 4
      }
      onChange({ ...data, chatbotPurposes: [...validSelectedPurposes, purpose] });
    }
  };

  // Sync auto sentence if not manually edited
  useEffect(() => {
    if (!data.purposeSummarySentence || !isEditingSentence) {
      const generated = buildChatbotPurposeSentence(
        { ...data, chatbotPurposes: validSelectedPurposes },
        roleModel.roleModelName,
        roleModel.roleModelJob
      );
      if (generated !== data.purposeSummarySentence && !isEditingSentence) {
        onChange({ ...data, purposeSummarySentence: generated });
      }
    }
  }, [validSelectedPurposes, data.targetUser, data.targetUserCustom, data.expectedOutcome]);

  const isValid =
    validSelectedPurposes.length >= 1 &&
    validSelectedPurposes.length <= 4 &&
    Boolean(data.targetUser) &&
    (data.targetUser !== '기타' || Boolean(data.targetUserCustom.trim()));

  const handleSaveAndNext = async () => {
    if (!isValid) return;
    if (isReadOnly || !student) {
      onNext();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await saveStep2Progress(student, { ...data, chatbotPurposes: validSelectedPurposes });
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
            2
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">STEP 2. 챗봇 목적 정하기</h3>
        </div>
        <span className="text-xs text-[#6B7280]">진로 AI 멘토 역할 설계</span>
      </div>

      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-8">
        {/* STEP 2-1: Chatbot Role */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <Target className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 2-1. 챗봇의 핵심 역할 선택</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-0.5">
                내 롤모델 챗봇이 친구들에게 어떤 도움을 주면 좋을까요? 가장 중요한 역할을 <strong>3~4개</strong> 선택하세요.
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                validSelectedPurposes.length >= 3 && validSelectedPurposes.length <= 4
                  ? 'bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]'
                  : 'bg-[#F9FAF8] text-[#5D6B58] border border-[#E1E4D8]'
              }`}
            >
              {validSelectedPurposes.length} / 4개 선택됨
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {PURPOSE_OPTIONS.map((item) => {
              const isSelected = validSelectedPurposes.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  disabled={isReadOnly || (!isSelected && validSelectedPurposes.length >= 4)}
                  onClick={() => togglePurpose(item)}
                  className={`p-3.5 rounded-2xl text-xs font-bold text-left border flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                      : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <span className="leading-snug">{item}</span>
                  {isSelected && <Check className="w-4 h-4 shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2-2: Target User */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-[#4B6344]" />
            <span>STEP 2-2. 대화 대상 및 기대 효과</span>
          </h4>
          <p className="text-xs text-[#6B7280] mb-4">
            이 챗봇과 주로 대화할 사용자는 누구이며, 어떤 가치를 전달하고 싶나요?
          </p>

          <div className="space-y-4">
            <label className="block text-xs font-bold text-[#4B6344]">대상 선택</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {TARGET_OPTIONS.map((target) => {
                const isSelected = data.targetUser === target;
                return (
                  <button
                    key={target}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => updateField('targetUser', target)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                        : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                    }`}
                  >
                    <span>{target}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>

            {data.targetUser === '기타' && (
              <input
                type="text"
                disabled={isReadOnly}
                value={data.targetUserCustom}
                onChange={(e) => updateField('targetUserCustom', e.target.value)}
                placeholder="대상 사용자를 직접 입력해 주세요 (예: 예술 분야 진학을 고민 중인 중학생)"
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none transition-all"
              />
            )}

            <div className="mt-4 space-y-1.5">
              <label className="block text-xs font-bold text-[#4B6344]">
                이 챗봇과 대화한 친구가 무엇을 얻어 갔으면 좋겠나요? (기대 효과)
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={data.expectedOutcome}
                onChange={(e) => updateField('expectedOutcome', e.target.value)}
                placeholder="예: 막연했던 진로에 대한 구체적인 준비 방법과 자신감"
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* STEP 2-3: Auto Purpose Sentence Generation */}
        <div className="border-t border-[#F3F4F1] pt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#4B6344]" />
              <span>STEP 2-3. 목적 문장 자동 생성</span>
            </h4>
            <div className="flex items-center gap-2">
              {!isEditingSentence ? (
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => setIsEditingSentence(true)}
                  className="px-3 py-1.5 text-xs font-bold text-[#4B6344] bg-[#F1F4EF] hover:bg-[#EAECE6] rounded-xl flex items-center gap-1.5 border border-[#DCE2D7] transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>직접 수정하기</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const regenerated = buildChatbotPurposeSentence(
                      data,
                      roleModel.roleModelName,
                      roleModel.roleModelJob
                    );
                    updateField('purposeSummarySentence', regenerated);
                    setIsEditingSentence(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-[#5D6B58] bg-[#F3F4F1] hover:bg-[#EAECE6] rounded-xl flex items-center gap-1.5 border border-[#E1E4D8] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>자동 생성 문장으로 복원</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl p-5">
            {isEditingSentence ? (
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={data.purposeSummarySentence}
                onChange={(e) => updateField('purposeSummarySentence', e.target.value)}
                className="w-full p-3 bg-white border border-[#E1E4D8] rounded-xl text-sm text-[#2C362B] outline-none focus:ring-2 focus:ring-[#4B6344]/20 resize-none"
              />
            ) : (
              <p className="text-sm text-[#2C362B] font-medium leading-relaxed">
                {data.purposeSummarySentence ||
                  buildChatbotPurposeSentence(data, roleModel.roleModelName, roleModel.roleModelJob)}
              </p>
            )}
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
          disabled={!isValid || isSaving}
          className="px-8 py-3 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow-md shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>저장 중...</span>
            </>
          ) : (
            <>
              <span>다음 STEP으로 저장 및 이동</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
