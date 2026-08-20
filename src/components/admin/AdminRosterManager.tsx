import React, { useState, useRef } from 'react';
import { RosterItem, RosterValidationError, RosterDiff } from '../../types';
import {
  downloadRosterTemplateFile,
  parseAndValidateRosterFile,
  computeRosterDiff,
} from '../../utils/excel';
import { updateAdminRoster } from '../../api/client';
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  UserMinus,
  RefreshCw,
  FileSpreadsheet,
  X,
  Plus,
  Trash2,
  Edit3,
  Users,
} from 'lucide-react';

interface AdminRosterManagerProps {
  currentRoster: RosterItem[];
  onRosterUpdated: () => void;
  onClose: () => void;
}

export const AdminRosterManager: React.FC<AdminRosterManagerProps> = ({
  currentRoster,
  onRosterUpdated,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'excel' | 'direct'>('excel');

  // Excel state
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<RosterItem[]>([]);
  const [errors, setErrors] = useState<RosterValidationError[]>([]);
  const [diff, setDiff] = useState<RosterDiff | null>(null);
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [isApplying, setIsApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Direct single entry state
  const [inputGrade, setInputGrade] = useState<string>('3');
  const [inputClass, setInputClass] = useState<string>('1');
  const [inputNumber, setInputNumber] = useState<string>('');
  const [inputName, setInputName] = useState<string>('');
  const [singleAddError, setSingleAddError] = useState<string>('');

  // Direct batch text entry state
  const [batchText, setBatchText] = useState<string>('');
  const [batchMode, setBatchMode] = useState<'append' | 'replace'>('append');
  const [batchError, setBatchError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setSuccessMessage('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        const { validItems, errors: parseErrors } = parseAndValidateRosterFile(buffer);
        setParsedItems(validItems);
        setErrors(parseErrors);

        if (parseErrors.length === 0 && validItems.length > 0) {
          const diffResult = computeRosterDiff(currentRoster, validItems);
          setDiff(diffResult);
        } else {
          setDiff(null);
        }
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleApplyRoster = async () => {
    if (parsedItems.length === 0 || errors.length > 0) return;
    setIsApplying(true);

    try {
      await updateAdminRoster(parsedItems, applyMode);
      setSuccessMessage(`총 ${parsedItems.length}명의 학생 명단이 성공적으로 반영되었습니다!`);
      onRosterUpdated();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsApplying(false);
    }
  };

  // Direct single student add
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleAddError('');
    setSuccessMessage('');

    const g = Number(inputGrade);
    const c = Number(inputClass);
    const n = Number(inputNumber);
    const trimmedName = inputName.trim();

    if (!g || g < 1 || g > 6) {
      setSingleAddError('올바른 학년을 입력해 주세요 (1~6).');
      return;
    }
    if (!c || c < 1 || c > 30) {
      setSingleAddError('올바른 반을 입력해 주세요.');
      return;
    }
    if (!n || n < 1 || n > 99) {
      setSingleAddError('올바른 번호를 입력해 주세요.');
      return;
    }
    if (!trimmedName) {
      setSingleAddError('학생 이름을 입력해 주세요.');
      return;
    }

    const newItem: RosterItem = {
      grade: g,
      classNum: c,
      number: n,
      name: trimmedName,
    };

    setIsApplying(true);
    try {
      await updateAdminRoster([newItem], 'append');
      setSuccessMessage(`${g}학년 ${c}반 ${n}번 ${trimmedName} 학생이 등록되었습니다!`);
      setInputNumber(String(n + 1));
      setInputName('');
      onRosterUpdated();
    } catch (err) {
      console.error(err);
      setSingleAddError('학생 등록 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  // Direct batch text parsing and adding
  const handleAddBatchStudents = async () => {
    setBatchError('');
    setSuccessMessage('');

    if (!batchText.trim()) {
      setBatchError('학생 정보를 입력해 주세요.');
      return;
    }

    const lines = batchText.trim().split('\n');
    const newItems: RosterItem[] = [];
    const parseErrors: string[] = [];

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      // Split by tab, comma, slash, or space
      const parts = cleanLine.split(/[\t,/\s]+/).filter(Boolean);
      if (parts.length < 4) {
        parseErrors.push(`${idx + 1}번째 줄: 학년, 반, 번호, 이름 4개 항목이 필요합니다. ("${cleanLine}")`);
        return;
      }

      const g = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      const n = parseInt(parts[2], 10);
      const studentName = parts.slice(3).join(' ').trim();

      if (isNaN(g) || isNaN(c) || isNaN(n) || !studentName) {
        parseErrors.push(`${idx + 1}번째 줄: 숫자/이름 형식이 맞지 않습니다. ("${cleanLine}")`);
        return;
      }

      newItems.push({
        grade: g,
        classNum: c,
        number: n,
        name: studentName,
      });
    });

    if (parseErrors.length > 0) {
      setBatchError(parseErrors.slice(0, 5).join('\n') + (parseErrors.length > 5 ? `\n외 ${parseErrors.length - 5}건의 오류` : ''));
      return;
    }

    if (newItems.length === 0) {
      setBatchError('유효한 학생 정보가 없습니다.');
      return;
    }

    setIsApplying(true);
    try {
      await updateAdminRoster(newItems, batchMode);
      setSuccessMessage(`총 ${newItems.length}명의 학생 정보가 성공적으로 반영되었습니다!`);
      setBatchText('');
      onRosterUpdated();
    } catch (err) {
      console.error(err);
      setBatchError('명단 등록 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearAllRoster = async () => {
    if (currentRoster.length === 0) return;
    const confirmed = window.confirm(
      `현재 등록된 학생 ${currentRoster.length}명의 명단을 모두 삭제하시겠습니까?\n(새로운 학생 명단으로 교체하기 위해 비웁니다.)`
    );
    if (!confirmed) return;

    setIsApplying(true);
    try {
      await updateAdminRoster([], 'replace');
      setSuccessMessage('모든 학생 명단이 삭제되었습니다.');
      onRosterUpdated();
    } catch (err) {
      console.error(err);
      alert('명단 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C362B]/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E1E4D8] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E1E4D8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#4B6344] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#2C362B]">
                학생 명단 관리 (Roster)
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[#6B7280]">
                  현재 등록된 학생 수: <strong className="text-[#4B6344]">{currentRoster.length}명</strong>
                </p>
                {currentRoster.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllRoster}
                    disabled={isApplying}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    명단 전체 비우기
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#6B7280] hover:text-[#2C362B] hover:bg-[#F9FAF8] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E1E4D8] px-6 bg-[#F9FAF8] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'excel'
                ? 'border-[#4B6344] text-[#4B6344] bg-white rounded-t-xl'
                : 'border-transparent text-[#6B7280] hover:text-[#2C362B]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>엑셀 파일 업로드</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'direct'
                ? 'border-[#4B6344] text-[#4B6344] bg-white rounded-t-xl'
                : 'border-transparent text-[#6B7280] hover:text-[#2C362B]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>직접 입력하여 추가</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {successMessage && (
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-[#4B6344] font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-[#4B6344] shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: EXCEL UPLOAD */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Step 1: Download Template */}
              <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#4B6344]" />
                    <span>1. 학생 명단 엑셀 표준 양식 다운로드</span>
                  </div>
                  <p className="text-[#5D6B58]">
                    열 순서: [학년, 반, 번호, 이름] 형식으로 구성된 .xlsx 템플릿입니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadRosterTemplateFile}
                  className="px-4 py-2.5 bg-white hover:bg-[#F1F4EF] border border-[#E1E4D8] text-[#2C362B] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>양식 다운로드 (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: Upload Excel File */}
              <div className="space-y-3">
                <div className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-[#4B6344]" />
                  <span>2. 작성한 학생 명단 엑셀 파일 업로드</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#E1E4D8] hover:border-[#4B6344] bg-[#F9FAF8] hover:bg-[#F1F4EF] rounded-2xl p-6 text-center cursor-pointer transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileSpreadsheet className="w-8 h-8 text-[#4B6344] mx-auto mb-2" />
                  <p className="font-bold text-[#2C362B] text-xs sm:text-sm">
                    {file ? file.name : '클릭하여 엑셀(.xlsx) 파일을 선택하세요'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">
                    파일을 올리면 데이터 오류 검증 및 기존 명단과의 비교 결과가 자동으로 표시됩니다.
                  </p>
                </div>
              </div>

              {/* Validation Errors */}
              {errors.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-800 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-rose-900 text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>엑셀 파일에서 {errors.length}개의 오류가 발견되었습니다. (수정 후 다시 업로드해 주세요)</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] max-h-36 overflow-y-auto">
                    {errors.map((err, i) => (
                      <li key={i}>
                        {err.row > 0 ? `${err.row}번째 행: ` : ''}
                        {err.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diff Comparison & Preview */}
              {diff && errors.length === 0 && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl flex items-center gap-2 text-[#4B6344] font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-[#4B6344] shrink-0" />
                    <span>검증 성공! 총 {diff.totalNew}명의 유효한 학생 명단이 확인되었습니다.</span>
                  </div>

                  {/* Diff Stats Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl">
                      <span className="text-[#6B7280] block mb-0.5">기존 학생</span>
                      <strong className="text-[#2C362B] text-sm">{diff.totalExisting}명</strong>
                    </div>
                    <div className="p-3.5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
                      <span className="text-[#4B6344] block mb-0.5 flex items-center gap-1 font-bold">
                        <UserPlus className="w-3 h-3" /> 새로 추가
                      </span>
                      <strong className="text-[#4B6344] text-sm">{diff.toAdd.length}명</strong>
                    </div>
                    <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl">
                      <span className="text-[#6B7280] block mb-0.5">동일 학생</span>
                      <strong className="text-[#2C362B] text-sm">{diff.unchanged.length}명</strong>
                    </div>
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                      <span className="text-amber-700 block mb-0.5 flex items-center gap-1 font-bold">
                        <UserMinus className="w-3 h-3" /> 기존 제외
                      </span>
                      <strong className="text-amber-900 text-sm">{diff.toRemove.length}명</strong>
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                    <span className="font-bold text-[#2C362B] block text-xs">반영 방식 선택</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        onClick={() => setApplyMode('replace')}
                        className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                          applyMode === 'replace'
                            ? 'bg-[#F1F4EF] border-[#4B6344] text-[#2C362B] font-bold'
                            : 'bg-white border-[#E1E4D8] text-[#5D6B58]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="applyMode"
                          checked={applyMode === 'replace'}
                          onChange={() => setApplyMode('replace')}
                          className="accent-[#4B6344]"
                        />
                        <div>
                          <div>기존 명단 교체 (권장)</div>
                          <div className="text-[10px] text-[#6B7280] font-normal">
                            업로드한 엑셀 파일의 명단으로 전체를 새로 교체합니다.
                          </div>
                        </div>
                      </label>

                      <label
                        onClick={() => setApplyMode('append')}
                        className={`p-3.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                          applyMode === 'append'
                            ? 'bg-[#F1F4EF] border-[#4B6344] text-[#2C362B] font-bold'
                            : 'bg-white border-[#E1E4D8] text-[#5D6B58]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="applyMode"
                          checked={applyMode === 'append'}
                          onChange={() => setApplyMode('append')}
                          className="accent-[#4B6344]"
                        />
                        <div>
                          <div>새 학생만 추가</div>
                          <div className="text-[10px] text-[#6B7280] font-normal">
                            기존 명단을 유지하면서 신규 학생만 추가합니다.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DIRECT MANUAL ENTRY */}
          {activeTab === 'direct' && (
            <div className="space-y-6">
              {/* Method A: Single Student Quick Add */}
              <form
                onSubmit={handleAddSingleStudent}
                className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-4"
              >
                <div className="font-bold text-[#2C362B] text-sm flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-[#4B6344]" />
                    <span>개별 학생 1명 직접 등록</span>
                  </div>
                  <span className="text-[11px] text-[#6B7280] font-normal">
                    전입생이나 누락된 학생을 빠르게 추가할 수 있습니다.
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#4B6344] mb-1">
                      학년
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={inputGrade}
                      onChange={(e) => setInputGrade(e.target.value)}
                      placeholder="학년 (예: 3)"
                      className="w-full px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#4B6344] mb-1">
                      반
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={inputClass}
                      onChange={(e) => setInputClass(e.target.value)}
                      placeholder="반 (예: 1)"
                      className="w-full px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#4B6344] mb-1">
                      번호
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={inputNumber}
                      onChange={(e) => setInputNumber(e.target.value)}
                      placeholder="번호 (예: 15)"
                      className="w-full px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#4B6344] mb-1">
                      학생 이름
                    </label>
                    <input
                      type="text"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="이름 (예: 홍길동)"
                      className="w-full px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none"
                    />
                  </div>
                </div>

                {singleAddError && (
                  <p className="text-xs text-rose-600 font-medium">{singleAddError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isApplying || !inputGrade || !inputClass || !inputNumber || !inputName.trim()}
                    className="px-4 py-2 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>학생 1명 추가하기</span>
                  </button>
                </div>
              </form>

              {/* Method B: Bulk Text Paste Entry */}
              <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-4">
                <div className="space-y-1">
                  <div className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#4B6344]" />
                    <span>여러 학생 텍스트 일괄 붙여넣기 등록</span>
                  </div>
                  <p className="text-[#5D6B58] text-[11px]">
                    한 줄에 한 명씩 <strong>[학년 반 번호 이름]</strong> 순서로 공백, 쉼표 또는 탭으로 구분하여 붙여넣으세요.
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#E1E4D8] rounded-xl font-mono text-[11px] text-[#6B7280]">
                  <span className="font-bold text-[#4B6344] block mb-1">입력 예시 (한 줄에 1명):</span>
                  3 1 1 김민수<br />
                  3 1 2 이서연<br />
                  3 1 3 박지호
                </div>

                <textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="3 1 1 김민수&#10;3 1 2 이서연&#10;3 1 3 박지호"
                  className="w-full p-3.5 bg-white border border-[#E1E4D8] rounded-xl font-mono text-xs text-[#2C362B] focus:border-[#4B6344] outline-none resize-y"
                />

                {batchError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] whitespace-pre-line font-medium">
                    {batchError}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="batchMode"
                        checked={batchMode === 'append'}
                        onChange={() => setBatchMode('append')}
                        className="accent-[#4B6344]"
                      />
                      <span className="font-medium text-[#2C362B]">기존 명단에 추가</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="batchMode"
                        checked={batchMode === 'replace'}
                        onChange={() => setBatchMode('replace')}
                        className="accent-[#4B6344]"
                      />
                      <span className="font-medium text-[#2C362B]">전체 명단 교체</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={isApplying || !batchText.trim()}
                    onClick={handleAddBatchStudents}
                    className="px-5 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    {isApplying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>반영 중...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>입력한 명단 일괄 등록</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E1E4D8] bg-[#F9FAF8] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E1E4D8] hover:bg-[#F1F4EF] text-[#5D6B58] font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>

          {activeTab === 'excel' && (
            <button
              type="button"
              disabled={parsedItems.length === 0 || errors.length > 0 || isApplying}
              onClick={handleApplyRoster}
              className="px-6 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md shadow-[#4B6344]/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>반영 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>학생 명단 반영하기 ({parsedItems.length}명)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

