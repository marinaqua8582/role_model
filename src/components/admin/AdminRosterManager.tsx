import React, { useState, useRef } from 'react';
import {
  RosterItem,
  RosterDiff,
  RosterValidationResult,
} from '../../types';
import {
  downloadRosterTemplateFile,
  parseAndValidateRosterFile,
  computeRosterDiff,
} from '../../utils/excel';
import { updateAdminRoster, deleteAdminRosterStudents } from '../../api/client';
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
  Edit3,
  Users,
  Search,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Trash2,
  CheckSquare,
  Square,
  Filter,
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
  const [validationResult, setValidationResult] = useState<RosterValidationResult | null>(null);
  const [diff, setDiff] = useState<RosterDiff | null>(null);
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace');
  const [isApplying, setIsApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'error'>('all');
  const [previewSearch, setPreviewSearch] = useState('');

  // Direct single entry state
  const [inputGrade, setInputGrade] = useState<string>('3');
  const [inputClass, setInputClass] = useState<string>('1');
  const [inputNumber, setInputNumber] = useState<string>('');
  const [inputName, setInputName] = useState<string>('');
  const [inputGoogleId, setInputGoogleId] = useState<string>('');
  const [singleAddError, setSingleAddError] = useState<string>('');

  // Direct batch text entry state
  const [batchText, setBatchText] = useState<string>('');
  const [batchMode, setBatchMode] = useState<'append' | 'replace'>('append');
  const [batchError, setBatchError] = useState<string>('');

  // Direct roster list & deletion state
  const [directGradeFilter, setDirectGradeFilter] = useState<number | 'all'>('all');
  const [directClassFilter, setDirectClassFilter] = useState<number | 'all'>('all');
  const [directSearchQuery, setDirectSearchQuery] = useState<string>('');
  const [selectedRosterKeys, setSelectedRosterKeys] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setSuccessMessage('');
    setErrorMessage('');
    setPreviewFilter('all');
    setPreviewSearch('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (buffer) {
        const result = parseAndValidateRosterFile(buffer);
        setValidationResult(result);

        if (result.errorCount === 0 && result.validItems.length > 0) {
          const diffResult = computeRosterDiff(currentRoster, result.validItems);
          setDiff(diffResult);
        } else {
          setDiff(null);
        }
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleApplyRoster = async () => {
    if (!validationResult || validationResult.errorCount > 0 || validationResult.validItems.length === 0) {
      return;
    }

    setIsApplying(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await updateAdminRoster(validationResult.validItems, applyMode);
      if (res && res.success) {
        setSuccessMessage('학생 명단이 Google Sheets에 정상적으로 반영되었습니다.');
        onRosterUpdated();
      } else {
        setErrorMessage('학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err: any) {
      console.error('Failed to update roster', err);
      setErrorMessage(err?.message || '학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsApplying(false);
    }
  };

  // Direct single student add
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleAddError('');
    setSuccessMessage('');
    setErrorMessage('');

    const g = Number(inputGrade);
    const c = Number(inputClass);
    const n = Number(inputNumber);
    const trimmedName = inputName.trim();
    const trimmedGoogleId = inputGoogleId.trim();

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
      googleId: trimmedGoogleId,
    };

    setIsApplying(true);
    try {
      const res = await updateAdminRoster([newItem], 'append');
      if (res && res.success) {
        setSuccessMessage(`${g}학년 ${c}반 ${n}번 ${trimmedName} 학생이 Google Sheets에 등록되었습니다.`);
        setInputNumber(String(n + 1));
        setInputName('');
        setInputGoogleId('');
        onRosterUpdated();
      } else {
        setSingleAddError('학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err: any) {
      console.error(err);
      setSingleAddError(err?.message || '학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsApplying(false);
    }
  };

  // Direct batch text parsing and adding
  const handleAddBatchStudents = async () => {
    setBatchError('');
    setSuccessMessage('');
    setErrorMessage('');

    if (!batchText.trim()) {
      setBatchError('학생 정보를 입력해 주세요.');
      return;
    }

    const lines = batchText.trim().split('\n');
    const newItems: RosterItem[] = [];
    const parseErrors: string[] = [];
    const seen = new Set<string>();

    lines.forEach((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      const parts = cleanLine.split(/[\t,/\s]+/).filter(Boolean);
      if (parts.length < 4) {
        parseErrors.push(`${idx + 1}행: [학년 반 번호 이름] 최소 4개 항목이 필요합니다. ("${cleanLine}")`);
        return;
      }

      const g = parseInt(parts[0], 10);
      const c = parseInt(parts[1], 10);
      const n = parseInt(parts[2], 10);
      
      let studentName = '';
      let studentGoogleId = '';

      if (parts.length === 4) {
        studentName = parts[3].trim();
      } else {
        // 5 or more tokens:
        // Format: 학년 반 번호 이름 Google ID (where name may have multiple words, and last token is Google ID)
        studentGoogleId = parts[parts.length - 1].trim();
        studentName = parts.slice(3, parts.length - 1).join(' ').trim();
      }

      if (isNaN(g) || isNaN(c) || isNaN(n) || g <= 0 || c <= 0 || n <= 0 || !studentName) {
        parseErrors.push(`${idx + 1}행: 숫자/이름 형식이 맞지 않습니다. ("${cleanLine}")`);
        return;
      }

      const key = `${g}-${c}-${n}`;
      if (seen.has(key)) {
        parseErrors.push(`${idx + 1}행: ${g}학년 ${c}반 ${n}번 - 중복된 학년/반/번호입니다.`);
        return;
      }
      seen.add(key);

      newItems.push({
        grade: g,
        classNum: c,
        number: n,
        name: studentName,
        googleId: studentGoogleId,
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
      const res = await updateAdminRoster(newItems, batchMode);
      if (res && res.success) {
        setSuccessMessage(`총 ${newItems.length}명의 학생 정보가 Google Sheets에 반영되었습니다.`);
        setBatchText('');
        onRosterUpdated();
      } else {
        setBatchError('학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } catch (err: any) {
      console.error(err);
      setBatchError(err?.message || '학생 명단 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearAllRoster = async () => {
    if (currentRoster.length === 0) return;
    const confirmed = window.confirm(
      `현재 등록된 학생 ${currentRoster.length}명의 명단을 Roster 시트에서 모두 삭제하시겠습니까?\n\n(※ 학생들의 Progress, Tests, Submissions 데이터는 안전하게 보존되며 Roster 시트만 초기화됩니다.)`
    );
    if (!confirmed) return;

    setIsApplying(true);
    try {
      await updateAdminRoster([], 'replace');
      setSuccessMessage('모든 학생 명단이 삭제되었습니다.');
      onRosterUpdated();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || '명단 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  // Filtered rows for the preview table
  const filteredRows = (validationResult?.rows || []).filter((r) => {
    if (previewFilter === 'valid' && !r.isValid) return false;
    if (previewFilter === 'error' && r.isValid) return false;
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      const match =
        String(r.gradeRaw).toLowerCase().includes(q) ||
        String(r.classRaw).toLowerCase().includes(q) ||
        String(r.numberRaw).toLowerCase().includes(q) ||
        String(r.nameRaw).toLowerCase().includes(q) ||
        String(r.googleIdRaw || '').toLowerCase().includes(q) ||
        (r.errorReason && r.errorReason.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  // Distinct grades and classes in current Roster
  const availableGrades = Array.from(
    new Set<number>(currentRoster.map((r) => Number(r.grade)).filter((g) => !isNaN(g) && g > 0))
  ).sort((a, b) => a - b);

  const availableClasses = Array.from(
    new Set<number>(
      currentRoster
        .filter((r) => directGradeFilter === 'all' || Number(r.grade) === directGradeFilter)
        .map((r) => Number(r.classNum !== undefined ? r.classNum : (r as any).class))
        .filter((c) => !isNaN(c) && c > 0)
    )
  ).sort((a, b) => a - b);

  // Sorted and filtered Roster for display
  const sortedRoster = [...currentRoster].sort((a, b) => {
    const ga = Number(a.grade);
    const gb = Number(b.grade);
    if (ga !== gb) return ga - gb;

    const ca = Number(a.classNum !== undefined ? a.classNum : (a as any).class);
    const cb = Number(b.classNum !== undefined ? b.classNum : (b as any).class);
    if (ca !== cb) return ca - cb;

    return Number(a.number) - Number(b.number);
  });

  const filteredRoster = sortedRoster.filter((item) => {
    const c = Number(item.classNum !== undefined ? item.classNum : (item as any).class);
    if (directGradeFilter !== 'all' && Number(item.grade) !== directGradeFilter) return false;
    if (directClassFilter !== 'all' && c !== directClassFilter) return false;
    if (directSearchQuery.trim()) {
      const q = directSearchQuery.trim().toLowerCase();
      const matchName = String(item.name || '').toLowerCase().includes(q);
      const matchNum = String(item.number).includes(q);
      const matchGrade = `${item.grade}학년`.includes(q) || String(item.grade) === q;
      const matchClass = `${c}반`.includes(q) || String(c) === q;
      const matchGoogleId = Boolean(item.googleId && item.googleId.toLowerCase().includes(q));
      if (!matchName && !matchNum && !matchGrade && !matchClass && !matchGoogleId) return false;
    }
    return true;
  });

  const allFilteredKeys = filteredRoster.map(
    (r) => `${r.grade}-${r.classNum !== undefined ? r.classNum : (r as any).class}-${r.number}`
  );
  const isAllFilteredSelected =
    allFilteredKeys.length > 0 && allFilteredKeys.every((k) => selectedRosterKeys.has(k));

  const handleToggleSelect = (key: string) => {
    setSelectedRosterKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedRosterKeys((prev) => {
        const next = new Set(prev);
        allFilteredKeys.forEach((k) => next.delete(k));
        return next;
      });
    } else {
      setSelectedRosterKeys((prev) => {
        const next = new Set(prev);
        allFilteredKeys.forEach((k) => next.add(k));
        return next;
      });
    }
  };

  const handleDeleteSingleStudent = async (student: RosterItem) => {
    const c = student.classNum !== undefined ? student.classNum : (student as any).class;
    const confirmed = window.confirm(
      `${student.grade}학년 ${c}반 ${student.number}번 ${student.name} 학생을 명단에서 삭제하시겠습니까?\n\n(※ 학생 명단에서 삭제해도 기존 진행 기록 및 제출 기록은 유지됩니다.)`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const res = await deleteAdminRosterStudents([student]);
      if (res && res.success) {
        setSuccessMessage(
          `${student.grade}학년 ${c}반 ${student.number}번 ${student.name} 학생이 Google Sheets 명단에서 삭제되었습니다.`
        );
        setSelectedRosterKeys((prev) => {
          const next = new Set(prev);
          next.delete(`${student.grade}-${c}-${student.number}`);
          return next;
        });
        onRosterUpdated();
      } else {
        setErrorMessage(res?.message || '학생 삭제에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Delete student error:', err);
      setErrorMessage(err?.message || '학생 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSelectedStudents = async () => {
    if (selectedRosterKeys.size === 0) return;
    const confirmed = window.confirm(
      `선택한 ${selectedRosterKeys.size}명의 학생을 명단에서 삭제하시겠습니까?\n\n(※ 학생 명단에서 삭제해도 기존 진행 기록 및 제출 기록은 유지됩니다.)`
    );
    if (!confirmed) return;

    const targetStudents = currentRoster.filter((item) => {
      const c = item.classNum !== undefined ? item.classNum : (item as any).class;
      return selectedRosterKeys.has(`${item.grade}-${c}-${item.number}`);
    });

    setIsDeleting(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const res = await deleteAdminRosterStudents(targetStudents);
      if (res && res.success) {
        setSuccessMessage(
          `선택한 ${targetStudents.length}명의 학생이 Google Sheets 명단에서 삭제되었습니다.`
        );
        setSelectedRosterKeys(new Set());
        onRosterUpdated();
      } else {
        setErrorMessage(res?.message || '선택 학생 일괄 삭제에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('Batch delete error:', err);
      setErrorMessage(err?.message || '학생 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C362B]/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E1E4D8] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E1E4D8] flex items-center justify-between shrink-0 bg-[#FAFBF9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4B6344] text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#2C362B]">
                학생 명단 관리 (Google Sheets Roster 연동)
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[#5D6B58]">
                  현재 시트 등록 학생: <strong className="text-[#4B6344]">{currentRoster.length}명</strong>
                </p>
                {currentRoster.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllRoster}
                    disabled={isApplying}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    명단 비우기
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#6B7280] hover:text-[#2C362B] hover:bg-white rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#E1E4D8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E1E4D8] px-6 bg-[#F1F4EF]/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'excel'
                ? 'border-[#4B6344] text-[#4B6344] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-[#6B7280] hover:text-[#2C362B]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>엑셀(.xlsx) 파일 업로드 & 검증</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'direct'
                ? 'border-[#4B6344] text-[#4B6344] bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-[#6B7280] hover:text-[#2C362B]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>수기 직접 등록</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-[#4B6344] font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#4B6344] shrink-0" />
                <span>{successMessage}</span>
              </div>
              <span className="text-[11px] font-normal text-[#5D6B58]">
                학생 로그인 및 대시보드에 즉시 반영됩니다.
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={handleApplyRoster}
                disabled={isApplying}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* TAB 1: EXCEL UPLOAD */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Section 1: Template Download */}
              <div className="p-4 sm:p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5">
                  <div className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-[#4B6344]" />
                    <span>1. 학생 명단 엑셀 양식 다운로드</span>
                  </div>
                  <p className="text-[#5D6B58] text-[11px]">
                    열 순서: [<strong>학년</strong>, <strong>반</strong>, <strong>번호</strong>, <strong>이름</strong>, <strong>구글 아이디</strong>] 빈 양식(.xlsx)을 다운로드하여 학생 정보를 입력하세요. (구글 아이디는 선택 사항)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={downloadRosterTemplateFile}
                  className="px-4 py-2.5 bg-white hover:bg-[#F1F4EF] border border-[#E1E4D8] text-[#2C362B] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#4B6344]" />
                  <span>양식 다운로드 (.xlsx)</span>
                </button>
              </div>

              {/* Section 2: Upload File Area */}
              <div className="space-y-2">
                <div className="font-bold text-[#2C362B] text-sm flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-[#4B6344]" />
                    <span>2. 작성한 학생 명단 엑셀 파일 업로드</span>
                  </div>
                  {file && (
                    <span className="text-[11px] text-[#4B6344] font-medium">
                      선택된 파일: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CCD4C5] hover:border-[#4B6344] bg-[#F9FAF8] hover:bg-[#F1F4EF] rounded-2xl p-6 text-center cursor-pointer transition-all shadow-2xs"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <FileSpreadsheet className="w-9 h-9 text-[#4B6344] mx-auto mb-2" />
                  <p className="font-bold text-[#2C362B] text-xs sm:text-sm">
                    {file ? '다른 엑셀 파일로 다시 올리려면 클릭하세요' : '클릭하여 엑셀(.xlsx) 파일을 선택하세요'}
                  </p>
                  <p className="text-[11px] text-[#6B7280] mt-1">
                    파일을 업로드하면 웹앱에서 데이터를 먼저 검증하고 미리보기를 표시합니다. (Google Sheets에 바로 저장되지 않습니다)
                  </p>
                </div>
              </div>

              {/* Section 3: Validation Summary Badges */}
              {validationResult && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl text-center">
                      <span className="text-[#6B7280] block text-[11px] mb-0.5">전체 학생 수</span>
                      <strong className="text-base font-bold text-[#2C362B]">
                        {validationResult.totalCount}명
                      </strong>
                    </div>

                    <div className="p-3.5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl text-center">
                      <span className="text-[#4B6344] font-bold block text-[11px] mb-0.5 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 정상 학생 수
                      </span>
                      <strong className="text-base font-bold text-[#4B6344]">
                        {validationResult.validCount}명
                      </strong>
                    </div>

                    <div className={`p-3.5 rounded-2xl text-center border ${
                      validationResult.errorCount > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-[#F9FAF8] border-[#E1E4D8] text-[#6B7280]'
                    }`}>
                      <span className="block text-[11px] mb-0.5 font-bold flex items-center justify-center gap-1">
                        {validationResult.errorCount > 0 ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-rose-700">오류 학생 수</span>
                          </>
                        ) : (
                          <span>오류 학생 수</span>
                        )}
                      </span>
                      <strong className={`text-base font-bold ${validationResult.errorCount > 0 ? 'text-rose-600' : 'text-[#2C362B]'}`}>
                        {validationResult.errorCount}명
                      </strong>
                    </div>
                  </div>

                  {/* Errors Notice Box */}
                  {validationResult.errorCount > 0 && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-900 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>엑셀 파일에서 {validationResult.errorCount}건의 데이터 오류가 발견되었습니다. 수정 후 다시 업로드해 주세요.</span>
                      </div>
                      <p className="text-[11px] text-rose-700">
                        ※ 오류가 있는 학생이 1건이라도 존재하면 학생 명단을 Google Sheets에 반영할 수 없습니다.
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] max-h-36 overflow-y-auto bg-white/70 p-2.5 rounded-xl border border-rose-200 font-medium">
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>
                            {err.row > 0 ? `[${err.row}행] ` : ''}
                            {err.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Diff Comparison & Mode Selection (Only when 0 errors) */}
                  {validationResult.errorCount === 0 && diff && (
                    <div className="space-y-4 animate-in fade-in">
                      {/* Comparison with Current Roster */}
                      <div className="p-4.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-2xl space-y-3">
                        <div className="font-bold text-[#2C362B] text-xs flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-[#4B6344]" />
                            <span>기존 Google Sheets Roster와 비교 현황</span>
                          </span>
                          <span className="text-[11px] text-[#5D6B58] font-normal">
                            (Progress, Tests, Submissions 시트는 안전하게 보호됩니다)
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          <div className="p-2.5 bg-white border border-[#E1E4D8] rounded-xl text-center">
                            <span className="text-[10px] text-[#6B7280] block">현재 등록</span>
                            <strong className="text-xs font-bold text-[#2C362B]">{diff.totalExisting}명</strong>
                          </div>
                          <div className="p-2.5 bg-white border border-[#E1E4D8] rounded-xl text-center">
                            <span className="text-[10px] text-[#6B7280] block">업로드</span>
                            <strong className="text-xs font-bold text-[#4B6344]">{diff.totalNew}명</strong>
                          </div>
                          <div className="p-2.5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-xl text-center">
                            <span className="text-[10px] text-[#4B6344] block font-bold">그대로 유지</span>
                            <strong className="text-xs font-bold text-[#4B6344]">{diff.unchanged.length}명</strong>
                          </div>
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                            <span className="text-[10px] text-emerald-700 block font-bold flex items-center justify-center gap-0.5">
                              <UserPlus className="w-3 h-3" /> 새로 추가
                            </span>
                            <strong className="text-xs font-bold text-emerald-800">{diff.toAdd.length}명</strong>
                          </div>
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
                            <span className="text-[10px] text-amber-700 block font-bold flex items-center justify-center gap-0.5">
                              <UserMinus className="w-3 h-3" /> 기존 제외
                            </span>
                            <strong className="text-xs font-bold text-amber-900">{diff.toRemove.length}명</strong>
                          </div>
                          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-center">
                            <span className="text-[10px] text-sky-700 block font-bold">이름 변경</span>
                            <strong className="text-xs font-bold text-sky-800">{diff.changed.length}명</strong>
                          </div>
                        </div>

                        {/* Name change warnings */}
                        {diff.changed.length > 0 && (
                          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-900 space-y-1">
                            <span className="font-bold block">
                              동일 학년/반/번호인데 이름이 다른 학생 ({diff.changed.length}명):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {diff.changed.map((c, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-sky-200">
                                  <span>{c.before.grade}학년 {c.before.classNum}반 {c.before.number}번:</span>
                                  <span className="text-[#6B7280] line-through">{c.before.name}</span>
                                  <ArrowRight className="w-3 h-3 text-sky-600" />
                                  <strong className="text-sky-900">{c.after.name}</strong>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mode Selection */}
                      <div className="p-4.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-2xl space-y-2.5">
                        <div className="font-bold text-[#2C362B] text-xs flex items-center gap-1.5">
                          <span>3. 반영 방식 선택</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <label
                            onClick={() => setApplyMode('replace')}
                            className={`p-3.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                              applyMode === 'replace'
                                ? 'bg-white border-[#4B6344] ring-2 ring-[#4B6344]/20 text-[#2C362B] shadow-2xs'
                                : 'bg-[#F9FAF8] border-[#E1E4D8] text-[#5D6B58] hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="applyMode"
                              checked={applyMode === 'replace'}
                              onChange={() => setApplyMode('replace')}
                              className="accent-[#4B6344] mt-0.5"
                            />
                            <div>
                              <div className="font-bold text-xs text-[#2C362B]">기존 명단 교체 (권장)</div>
                              <div className="text-[11px] text-[#6B7280] mt-0.5">
                                Google Sheets Roster 시트 2행 이하를 삭제하고 업로드한 전체 명단({validationResult.validItems.length}명)으로 새로 교체합니다.
                              </div>
                            </div>
                          </label>

                          <label
                            onClick={() => setApplyMode('append')}
                            className={`p-3.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                              applyMode === 'append'
                                ? 'bg-white border-[#4B6344] ring-2 ring-[#4B6344]/20 text-[#2C362B] shadow-2xs'
                                : 'bg-[#F9FAF8] border-[#E1E4D8] text-[#5D6B58] hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="applyMode"
                              checked={applyMode === 'append'}
                              onChange={() => setApplyMode('append')}
                              className="accent-[#4B6344] mt-0.5"
                            />
                            <div>
                              <div className="font-bold text-xs text-[#2C362B]">새 학생만 추가</div>
                              <div className="text-[11px] text-[#6B7280] mt-0.5">
                                기존 Roster를 유지하고 기존에 존재하지 않는 학년/반/번호 학생({diff.toAdd.length}명)만 추가합니다.
                              </div>
                            </div>
                          </label>
                        </div>

                        {applyMode === 'append' && diff.changed.length > 0 && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            ⚠️ 학년/반/번호가 같지만 이름이 다른 {diff.changed.length}명의 학생은 '새 학생만 추가' 모드에서 기존 이름이 유지됩니다.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section 4: Student Preview Table */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-bold text-[#2C362B] text-xs">
                        업로드 학생 목록 미리보기 ({filteredRows.length}명 표시)
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Status Filter */}
                        <div className="flex items-center bg-[#F1F4EF] p-0.5 rounded-xl border border-[#E1E4D8]">
                          <button
                            type="button"
                            onClick={() => setPreviewFilter('all')}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              previewFilter === 'all'
                                ? 'bg-white text-[#2C362B] shadow-2xs'
                                : 'text-[#6B7280] hover:text-[#2C362B]'
                            }`}
                          >
                            전체 ({validationResult.rows.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewFilter('valid')}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              previewFilter === 'valid'
                                ? 'bg-white text-[#4B6344] shadow-2xs'
                                : 'text-[#6B7280] hover:text-[#4B6344]'
                            }`}
                          >
                            정상 ({validationResult.validCount})
                          </button>
                          {validationResult.errorCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewFilter('error')}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                previewFilter === 'error'
                                  ? 'bg-white text-rose-600 shadow-2xs'
                                  : 'text-[#6B7280] hover:text-rose-600'
                              }`}
                            >
                              오류 ({validationResult.errorCount})
                            </button>
                          )}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                          <input
                            type="text"
                            placeholder="미리보기 검색..."
                            value={previewSearch}
                            onChange={(e) => setPreviewSearch(e.target.value)}
                            className="pl-8 pr-3 py-1 bg-white border border-[#E1E4D8] rounded-xl text-[11px] text-[#2C362B] placeholder-[#9CA3AF] focus:border-[#4B6344] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#E1E4D8] rounded-2xl overflow-hidden shadow-2xs">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead className="bg-[#F9FAF8] border-b border-[#E1E4D8] sticky top-0 z-10">
                            <tr>
                              <th className="py-2 px-3 font-bold text-[#5D6B58] w-12 text-center">행</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58] w-16 text-center">학년</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58] w-16 text-center">반</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58] w-16 text-center">번호</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58]">이름</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58]">Google ID</th>
                              <th className="py-2 px-3 font-bold text-[#5D6B58] text-right">상태</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E1E4D8]">
                            {filteredRows.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">
                                  조건에 맞는 학생 정보가 없습니다.
                                </td>
                              </tr>
                            ) : (
                              filteredRows.map((r, idx) => (
                                <tr
                                  key={idx}
                                  className={`hover:bg-[#F9FAF8] transition-colors ${
                                    !r.isValid ? 'bg-rose-50/50' : ''
                                  }`}
                                >
                                  <td className="py-2 px-3 text-center text-[#9CA3AF] font-mono">
                                    {r.rowNum}
                                  </td>
                                  <td className="py-2 px-3 text-center font-medium text-[#2C362B]">
                                    {r.gradeRaw || <span className="text-rose-500 font-bold">누락</span>}
                                  </td>
                                  <td className="py-2 px-3 text-center font-medium text-[#2C362B]">
                                    {r.classRaw || <span className="text-rose-500 font-bold">누락</span>}
                                  </td>
                                  <td className="py-2 px-3 text-center font-medium text-[#2C362B]">
                                    {r.numberRaw || <span className="text-rose-500 font-bold">누락</span>}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-[#2C362B]">
                                    {r.nameRaw || <span className="text-rose-500 font-bold">누락</span>}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-[#4B6344]">
                                    {r.googleIdRaw ? (
                                      r.googleIdRaw
                                    ) : (
                                      <span className="text-[#9CA3AF] font-normal italic font-sans">미등록</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    {r.isValid ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F1F4EF] text-[#4B6344] font-bold text-[10px]">
                                        <CheckCircle2 className="w-3 h-3" /> 정상
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-bold text-[10px]" title={r.errorReason}>
                                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                        <span>{r.errorReason}</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
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

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-[#4B6344] mb-1">
                      Google ID (선택)
                    </label>
                    <input
                      type="text"
                      value={inputGoogleId}
                      onChange={(e) => setInputGoogleId(e.target.value)}
                      placeholder="student01@school.kr"
                      className="w-full px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none placeholder-[#9CA3AF]"
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
                    <span>학생 1명 시트에 추가하기</span>
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
                    한 줄에 한 명씩 <strong>[학년 반 번호 이름 Google ID]</strong> 순서로 공백, 쉼표 또는 탭으로 구분하여 붙여넣으세요. (Google ID는 선택 사항이며 기존 4열 입력도 가능)
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#E1E4D8] rounded-xl font-mono text-[11px] text-[#6B7280]">
                  <span className="font-bold text-[#4B6344] block mb-1">입력 예시 (한 줄에 1명):</span>
                  3 1 1 김민지 student01@school.kr<br />
                  3 1 2 이서연 student02@school.kr<br />
                  3 1 3 박지호
                </div>

                <textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="3 1 1 김민지 student01@school.kr&#10;3 1 2 이서연 student02@school.kr&#10;3 1 3 박지호"
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
                        <span>Google Sheets 반영 중...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>입력한 명단 시트에 일괄 등록</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Method C: Current Registered Students List & Deletion */}
              <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="font-bold text-[#2C362B] text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#4B6344]" />
                      <span>현재 Roster 시트 등록 학생 명단</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#E1E7DC] text-[#4B6344] font-extrabold text-[11px]">
                        총 {currentRoster.length}명
                      </span>
                    </div>
                    <p className="text-[#5D6B58] text-[11px]">
                      학년 → 반 → 번호 순으로 정렬되어 있습니다. 개별 또는 여러 학생을 선택하여 명단에서 삭제할 수 있습니다.
                    </p>
                  </div>

                  {/* Batch Delete Action Button */}
                  {selectedRosterKeys.size > 0 && (
                    <button
                      type="button"
                      disabled={isDeleting || isApplying}
                      onClick={handleDeleteSelectedStudents}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 animate-in fade-in"
                    >
                      {isDeleting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>삭제 중...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>선택 학생 삭제 ({selectedRosterKeys.size}명)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Important Notice */}
                <div className="p-3 bg-[#F1F4EF] border border-[#DCE2D7] rounded-xl text-[11px] text-[#4B6344] font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#4B6344]" />
                  <span>
                    학생 명단(Roster)에서 삭제해도 학생의 기존 진행 기록(Progress) 및 최종 제출 기록(Submissions)은 안전하게 유지됩니다.
                  </span>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <div className="flex items-center gap-2">
                    {/* Grade Selector */}
                    <div className="relative">
                      <select
                        value={directGradeFilter}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDirectGradeFilter(v === 'all' ? 'all' : Number(v));
                        }}
                        className="px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none focus:border-[#4B6344] cursor-pointer pr-7"
                      >
                        <option value="all">전체 학년</option>
                        {availableGrades.map((g) => (
                          <option key={g} value={g}>
                            {g}학년
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Class Selector */}
                    <div className="relative">
                      <select
                        value={directClassFilter}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDirectClassFilter(v === 'all' ? 'all' : Number(v));
                        }}
                        className="px-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs font-semibold text-[#2C362B] outline-none focus:border-[#4B6344] cursor-pointer pr-7"
                      >
                        <option value="all">전체 반</option>
                        {availableClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}반
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={directSearchQuery}
                      onChange={(e) => setDirectSearchQuery(e.target.value)}
                      placeholder="학생 이름 또는 번호 검색..."
                      className="w-full pl-8 pr-3 py-2 bg-white border border-[#E1E4D8] rounded-xl text-xs text-[#2C362B] placeholder-[#9CA3AF] outline-none focus:border-[#4B6344]"
                    />
                    {directSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDirectSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#2C362B]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="bg-white border border-[#E1E4D8] rounded-xl overflow-hidden shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-[#F1F4EF] border-b border-[#E1E4D8] text-[#5D6B58] font-bold z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isAllFilteredSelected}
                              onChange={handleToggleSelectAll}
                              disabled={filteredRoster.length === 0}
                              className="accent-[#4B6344] cursor-pointer rounded"
                              title="필터링된 학생 전체 선택"
                            />
                          </th>
                          <th className="py-2.5 px-3 w-20">학년</th>
                          <th className="py-2.5 px-3 w-20">반</th>
                          <th className="py-2.5 px-3 w-20">번호</th>
                          <th className="py-2.5 px-3">이름</th>
                          <th className="py-2.5 px-3">Google ID</th>
                          <th className="py-2.5 px-3 text-right w-24">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E1E4D8]/60 font-medium text-[#2C362B]">
                        {currentRoster.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                              현재 Roster 시트에 등록된 학생이 없습니다. 위에서 학생을 추가해 주세요.
                            </td>
                          </tr>
                        ) : filteredRoster.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-[#9CA3AF]">
                              검색 및 필터 조건에 일치하는 학생이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          filteredRoster.map((item) => {
                            const c = Number(item.classNum !== undefined ? item.classNum : (item as any).class);
                            const key = `${item.grade}-${c}-${item.number}`;
                            const isSelected = selectedRosterKeys.has(key);

                            return (
                              <tr
                                key={key}
                                className={`transition-colors ${
                                  isSelected ? 'bg-[#F1F4EF]/80' : 'hover:bg-[#FAFBF9]'
                                }`}
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelect(key)}
                                    className="accent-[#4B6344] cursor-pointer rounded"
                                  />
                                </td>
                                <td className="py-2 px-3 text-[#5D6B58]">{item.grade}학년</td>
                                <td className="py-2 px-3 text-[#5D6B58]">{c}반</td>
                                <td className="py-2 px-3 text-[#5D6B58]">{item.number}번</td>
                                <td className="py-2 px-3 font-bold text-[#2C362B]">{item.name}</td>
                                <td className="py-2 px-3">
                                  {item.googleId ? (
                                    <span className="font-mono text-xs text-[#4B6344] font-medium">{item.googleId}</span>
                                  ) : (
                                    <span className="text-[#9CA3AF] italic text-xs">미등록</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    disabled={isDeleting || isApplying}
                                    onClick={() => handleDeleteSingleStudent(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                    title="명단에서 삭제"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>삭제</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer / Summary */}
                  {filteredRoster.length > 0 && (
                    <div className="p-2.5 bg-[#FAFBF9] border-t border-[#E1E4D8] flex items-center justify-between text-[11px] text-[#5D6B58] px-4">
                      <span>
                        표시 중: <strong>{filteredRoster.length}명</strong> / 전체: <strong>{currentRoster.length}명</strong>
                      </span>
                      {selectedRosterKeys.size > 0 && (
                        <span className="text-rose-600 font-bold">
                          선택됨: {selectedRosterKeys.size}명
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#E1E4D8] bg-[#FAFBF9] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E1E4D8] hover:bg-[#F1F4EF] text-[#5D6B58] font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>

          {activeTab === 'excel' && (
            <div className="flex items-center gap-2">
              {validationResult && validationResult.errorCount > 0 && (
                <span className="text-[11px] font-bold text-rose-600 hidden sm:inline">
                  오류 {validationResult.errorCount}건을 수정한 후 다시 업로드해 주세요.
                </span>
              )}
              <button
                type="button"
                disabled={
                  !validationResult ||
                  validationResult.errorCount > 0 ||
                  validationResult.validItems.length === 0 ||
                  isApplying
                }
                onClick={handleApplyRoster}
                className="px-6 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md shadow-[#4B6344]/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Google Sheets 반영 중...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      학생 명단 반영하기 (
                      {validationResult?.validItems.length || 0}명)
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
