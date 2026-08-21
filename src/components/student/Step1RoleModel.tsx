import React, { useState, useMemo, useEffect } from 'react';
import { RoleModelData, StudentInfo } from '../../types';
import { saveStep1Progress } from '../../api/client';
import {
  User,
  Briefcase,
  Heart,
  ArrowRight,
  ArrowLeft,
  Info,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  COMPETENCY_OPTIONS,
  STRENGTH_OPTIONS,
  VALUE_OPTIONS,
  normalizeSingleCompetency,
  normalizeSingleStrength,
  normalizeSingleValue,
} from '../../utils/normalizer';

interface Step1RoleModelProps {
  data: RoleModelData;
  student?: StudentInfo;
  onChange: (data: RoleModelData) => void;
  onNext: () => void;
  onPrev?: () => void;
  isReadOnly?: boolean;
}

export const Step1RoleModel: React.FC<Step1RoleModelProps> = ({
  data,
  student,
  onChange,
  onNext,
  onPrev,
  isReadOnly = false,
}) => {
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Compute valid selected options strictly matching corresponding constants
  const validCompetencies = useMemo(() => {
    const rawList = Array.isArray(data.competencies) ? data.competencies : [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of rawList) {
      const normalized = normalizeSingleCompetency(item);
      if (normalized && (COMPETENCY_OPTIONS as readonly string[]).includes(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }, [data.competencies]);

  const validStrengths = useMemo(() => {
    const rawList = Array.isArray(data.strengths) ? data.strengths : [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of rawList) {
      const normalized = normalizeSingleStrength(item);
      if (normalized && (STRENGTH_OPTIONS as readonly string[]).includes(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }, [data.strengths]);

  const validValues = useMemo(() => {
    const rawList = Array.isArray(data.values) ? data.values : [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of rawList) {
      const normalized = normalizeSingleValue(item);
      if (normalized && (VALUE_OPTIONS as readonly string[]).includes(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
    return result;
  }, [data.values]);

  // Synchronize arrays if raw contained unnormalized items
  useEffect(() => {
    const rawC = Array.isArray(data.competencies) ? data.competencies : [];
    const rawS = Array.isArray(data.strengths) ? data.strengths : [];
    const rawV = Array.isArray(data.values) ? data.values : [];

    const cDiff = rawC.length !== validCompetencies.length || rawC.some((x, i) => x !== validCompetencies[i]);
    const sDiff = rawS.length !== validStrengths.length || rawS.some((x, i) => x !== validStrengths[i]);
    const vDiff = rawV.length !== validValues.length || rawV.some((x, i) => x !== validValues[i]);

    if (cDiff || sDiff || vDiff) {
      onChange({
        ...data,
        competencies: validCompetencies,
        strengths: validStrengths,
        values: validValues,
      });
    }
  }, [validCompetencies, validStrengths, validValues]);

  const updateField = <K extends keyof RoleModelData>(field: K, value: RoleModelData[K]) => {
    if (isReadOnly) return;
    onChange({ ...data, [field]: value });
  };

  const toggleArrayItem = (field: 'competencies' | 'strengths' | 'values', item: string) => {
    if (isReadOnly) return;
    if (field === 'competencies') {
      const updated = validCompetencies.includes(item)
        ? validCompetencies.filter((x) => x !== item)
        : [...validCompetencies, item];
      onChange({ ...data, competencies: updated });
    } else if (field === 'strengths') {
      const updated = validStrengths.includes(item)
        ? validStrengths.filter((x) => x !== item)
        : [...validStrengths, item];
      onChange({ ...data, strengths: updated });
    } else if (field === 'values') {
      const updated = validValues.includes(item)
        ? validValues.filter((x) => x !== item)
        : [...validValues, item];
      onChange({ ...data, values: updated });
    }
  };

  // Validation
  const isSubStep1Valid = Boolean(
    data.roleModelName.trim() && data.roleModelJob.trim() && data.roleModelReason.trim()
  );

  const isSubStep2Valid = Boolean(
    data.jobDescription.trim() && (validCompetencies.length > 0 || data.competencyCustom.trim())
  );

  const isSubStep3Valid = Boolean(
    (validStrengths.length > 0 || data.strengthCustom.trim()) &&
    (validValues.length > 0 || data.valueCustom.trim())
  );

  const handleSaveAndNext = async () => {
    if (!isSubStep3Valid || isSaving) return;

    if (isReadOnly || !student) {
      onNext();
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await saveStep1Progress(student, {
        ...data,
        competencies: validCompetencies,
        strengths: validStrengths,
        values: validValues,
      });
      if (res.success) {
        onNext();
      } else {
        setSaveError(res.message || '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err) {
      console.error(err);
      setSaveError('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextSubStep = () => {
    if (subStep === 1 && isSubStep1Valid) {
      setSubStep(2);
    } else if (subStep === 2 && isSubStep2Valid) {
      setSubStep(3);
    } else if (subStep === 3 && isSubStep3Valid) {
      handleSaveAndNext();
    }
  };

  const handlePrevSubStep = () => {
    if (isSaving) return;
    if (subStep > 1) {
      setSubStep((prev) => (prev - 1) as 1 | 2 | 3);
    } else if (onPrev) {
      onPrev();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sub-step Navigation Pill Header */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 sm:p-4 border border-[#E1E4D8] shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-[#4B6344] text-white text-xs font-bold flex items-center justify-center shadow-xs">
            1
          </span>
          <h3 className="font-bold text-[#2C362B] text-sm sm:text-base">STEP 1. 롤모델 정보 입력</h3>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {[
            { step: 1, label: '1-1. 롤모델 기본' },
            { step: 2, label: '1-2. 직업 및 역량' },
            { step: 3, label: '1-3. 가치와 극복' },
          ].map((item) => (
            <button
              key={item.step}
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (
                  item.step === 1 ||
                  (item.step === 2 && isSubStep1Valid) ||
                  (item.step === 3 && isSubStep1Valid && isSubStep2Valid) ||
                  isReadOnly
                ) {
                  setSubStep(item.step as 1 | 2 | 3);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                subStep === item.step
                  ? 'bg-[#F1F4EF] text-[#4B6344] border border-[#DCE2D7]'
                  : 'text-[#6B7280] hover:text-[#2C362B] hover:bg-[#F9FAF8]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8">
        {/* SUBSTEP 1-1 */}
        {subStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-[#F3F4F1] pb-4">
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <User className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 1-1. 나의 롤모델은 누구인가요?</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-1">
                자신이 닮고 싶거나 진로 탐색의 멘토로 삼고 싶은 인물의 기본 정보를 입력해 주세요.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B6344]">
                  롤모델 이름 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={data.roleModelName}
                  onChange={(e) => updateField('roleModelName', e.target.value)}
                  placeholder="예: 스티브 잡스, 유관순, 손흥민, 김연아 등"
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all disabled:opacity-75"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#4B6344]">
                  현재/과거 직업 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={data.roleModelJob}
                  onChange={(e) => updateField('roleModelJob', e.target.value)}
                  placeholder="예: IT 기업가/혁신가, 축구선수, 동물행동학자 등"
                  className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all disabled:opacity-75"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4B6344]">
                롤모델로 선택한 이유 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                disabled={isReadOnly}
                value={data.roleModelReason}
                onChange={(e) => updateField('roleModelReason', e.target.value)}
                placeholder="이 인물을 롤모델로 선정한 이유와 평소 인상 깊었던 점을 작성해 보세요."
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all resize-none disabled:opacity-75"
              />
              <div className="flex justify-end">
                <span className="text-[11px] text-[#6B7280]">{data.roleModelReason.length}자 입력됨</span>
              </div>
            </div>

            {/* Information Tip */}
            <div className="bg-[#F1F4EF] p-4 rounded-2xl flex gap-3 border border-[#DCE2D7]">
              <Info className="w-5 h-5 text-[#4B6344] mt-0.5 shrink-0" />
              <p className="text-xs sm:text-sm text-[#5D6B58] leading-relaxed">
                <strong>작성 팁:</strong> 조사한 자료에서 확인할 수 있는 사실을 중심으로 작성하세요. 추후 프롬프트 생성 단계에서 이 내용이 핵심 정보로 활용됩니다.
              </p>
            </div>
          </div>
        )}

        {/* SUBSTEP 1-2 */}
        {subStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-[#F3F4F1] pb-4">
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 1-2. 롤모델의 직업 탐구</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-1">
                롤모델의 직업에서 하는 일과 성공적인 수행에 필요한 핵심 역량을 조사하여 적어보세요.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4B6344]">
                이 직업에서 하는 일 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={data.jobDescription}
                onChange={(e) => updateField('jobDescription', e.target.value)}
                placeholder="해당 직업을 가진 사람이 주로 어떤 업무나 연구, 창작 활동을 하는지 구체적으로 작성해 보세요."
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all resize-none disabled:opacity-75"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#4B6344]">
                  필요한 핵심 역량 <span className="text-rose-500">*</span> (복수 선택)
                </label>
                <span className="text-xs text-[#4B6344] font-bold">
                  {validCompetencies.length}개 선택됨
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {COMPETENCY_OPTIONS.map((comp) => {
                  const isSelected = validCompetencies.includes(comp);
                  return (
                    <button
                      key={comp}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleArrayItem('competencies', comp)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                          : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                      }`}
                    >
                      <span>{comp}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={data.competencyCustom}
                  onChange={(e) => updateField('competencyCustom', e.target.value)}
                  placeholder="기타 직접 입력 (예: 데이터 분석력, 무대 장악력 등)"
                  className="w-full px-4 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4B6344]">
                주요 활동이나 대표적인 경력 (선택)
              </label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={data.careerHistory}
                onChange={(e) => updateField('careerHistory', e.target.value)}
                placeholder="롤모델의 대표적인 수상 내역, 프로젝트, 사회적 성과나 활동 경력을 적어보세요."
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all resize-none disabled:opacity-75"
              />
            </div>
          </div>
        )}

        {/* SUBSTEP 1-3 */}
        {subStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-[#F3F4F1] pb-4">
              <h4 className="text-xl font-bold text-[#2C362B] flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#4B6344]" />
                <span>STEP 1-3. 내가 닮고 싶은 점과 가치관</span>
              </h4>
              <p className="text-xs text-[#6B7280] mt-1">
                롤모델의 강점과 소중히 여기는 가치관, 그리고 실패 극복 경험을 정리합니다.
              </p>
            </div>

            {/* Factuality Guidelines Notice Banner */}
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl flex items-start gap-3 text-[#5D6B58] text-xs leading-relaxed">
              <Info className="w-5 h-5 text-[#4B6344] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#2C362B]">작성 안내:</strong> 조사한 자료에서 확인할 수 있는 객관적인 사실을 중심으로 작성하세요. 확인되지 않은 사실이나 사생활을 상상하여 작성하지 않습니다.
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#4B6344]">
                  내가 닮고 싶은 강점 <span className="text-rose-500">*</span> (복수 선택)
                </label>
                <span className="text-xs text-[#4B6344] font-bold">
                  {validStrengths.length}개 선택됨
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STRENGTH_OPTIONS.map((st) => {
                  const isSelected = validStrengths.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleArrayItem('strengths', st)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                          : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                      }`}
                    >
                      <span>{st}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={data.strengthCustom}
                  onChange={(e) => updateField('strengthCustom', e.target.value)}
                  placeholder="기타 강점 직접 입력"
                  className="w-full px-4 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#4B6344]">
                  중요하게 생각하는 가치 <span className="text-rose-500">*</span> (복수 선택)
                </label>
                <span className="text-xs text-[#4B6344] font-bold">
                  {validValues.length}개 선택됨
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {VALUE_OPTIONS.map((val) => {
                  const isSelected = validValues.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleArrayItem('values', val)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#4B6344] text-white border-[#4B6344] shadow-xs'
                          : 'bg-[#F9FAF8] text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                      }`}
                    >
                      <span>{val}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={data.valueCustom}
                  onChange={(e) => updateField('valueCustom', e.target.value)}
                  placeholder="기타 가치관 직접 입력"
                  className="w-full px-4 py-2.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:bg-white focus:border-[#4B6344] outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4B6344]">
                어려움이나 실패를 극복한 경험
              </label>
              <textarea
                rows={3}
                disabled={isReadOnly}
                value={data.challengeExperience}
                onChange={(e) => updateField('challengeExperience', e.target.value)}
                placeholder="롤모델이 겪었던 슬럼프, 실패, 어려움을 어떻게 이겨냈는지 조사한 내용을 바탕으로 적어보세요."
                className="w-full px-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all resize-none disabled:opacity-75"
              />
            </div>

            {/* Live Summary Card */}
            <div className="p-5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-[#2C362B] text-sm">
                <Sparkles className="w-4 h-4 text-[#4B6344]" />
                <span>STEP 1 요약 미리보기</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[#5D6B58]">
                <div>
                  <span className="text-[#6B7280]">롤모델:</span>{' '}
                  <strong className="text-[#2C362B]">{data.roleModelName || '(미입력)'}</strong> (
                  {data.roleModelJob || '직업 미입력'})
                </div>
                <div>
                  <span className="text-[#6B7280]">핵심 역량:</span>{' '}
                  {data.competencies.join(', ') || '(선택 없음)'}
                </div>
                <div>
                  <span className="text-[#6B7280]">닮고 싶은 점:</span>{' '}
                  {data.strengths.join(', ') || '(선택 없음)'}
                </div>
                <div>
                  <span className="text-[#6B7280]">핵심 가치:</span>{' '}
                  {data.values.join(', ') || '(선택 없음)'}
                </div>
              </div>
            </div>

            {/* Error Message & Retry Alert */}
            {saveError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start justify-between gap-3 text-rose-800 text-xs sm:text-sm animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-rose-900">저장에 실패했습니다. 잠시 후 다시 시도해 주세요.</strong>
                    <p className="text-xs text-rose-700 mt-0.5">{saveError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAndNext}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                  <span>다시 시도</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePrevSubStep}
          disabled={isSaving}
          className="px-6 py-3 bg-[#F3F4F1] hover:bg-[#EAECE6] disabled:opacity-50 text-[#5D6B58] border border-[#E1E4D8] font-bold rounded-xl text-sm flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{subStep === 1 ? '이전 단계' : '이전 항목'}</span>
        </button>

        <button
          type="button"
          onClick={handleNextSubStep}
          disabled={
            isSaving ||
            (subStep === 1 && !isSubStep1Valid) ||
            (subStep === 2 && !isSubStep2Valid) ||
            (subStep === 3 && !isSubStep3Valid)
          }
          className="px-8 py-3 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow-md shadow-[#4B6344]/20 flex items-center gap-2 transition-all cursor-pointer min-w-[140px] justify-center"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>저장 중...</span>
            </>
          ) : subStep === 3 ? (
            saveError ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>다시 시도</span>
              </>
            ) : (
              <>
                <span>다음 STEP으로 저장 및 이동</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )
          ) : (
            <>
              <span>다음 항목</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
