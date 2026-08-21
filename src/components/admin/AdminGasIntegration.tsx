import React, { useState } from 'react';
import { getGoogleAppsScriptCode } from '../../utils/gasScriptTemplate';
import { getEffectiveGasUrl, getStoredGasUrl, setStoredGasUrl } from '../../api/client';
import { Copy, Check, X, Code2, FileSpreadsheet } from 'lucide-react';

interface AdminGasIntegrationProps {
  onClose: () => void;
}

export const AdminGasIntegration: React.FC<AdminGasIntegrationProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [gasUrl, setGasUrl] = useState(getStoredGasUrl() || getEffectiveGasUrl());
  const [isSaved, setIsSaved] = useState(false);

  const scriptCode = getGoogleAppsScriptCode();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredGasUrl(gasUrl);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
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
                Google Sheets / Google Apps Script 연동
              </h3>
              <p className="text-xs text-[#6B7280]">
                학생의 진행 상황과 최종 제출물을 선생님의 구글 스프레드시트에 영구 보관할 수 있습니다.
              </p>
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

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Guide Steps */}
          <div className="p-5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2.5">
            <div className="font-bold text-[#2C362B] text-sm">연동 가이드 및 보안 안내</div>
            <ol className="list-decimal list-inside space-y-1.5 text-[#5D6B58] leading-relaxed">
              <li>
                새 <strong>Google Spreadsheet</strong>를 생성하고 상단 메뉴에서 <strong>[확장 프로그램] → [Apps Script]</strong>를 클릭합니다.
              </li>
              <li>
                아래 <strong>Google Apps Script 코드</strong>를 복사하여 Apps Script 편집기에 붙여넣고 저장합니다.
              </li>
              <li>
                상단 우측 <strong>[배포] → [새 배포]</strong> 클릭 후, 유형을 <strong>[웹 앱]</strong>으로 선택하고 액세스 권한을 <strong>[모든 사용자(Anyone)]</strong>로 설정하여 배포합니다.
              </li>
              <li>
                <strong>관리자 보안 강화 (선택)</strong>: Apps Script의 [프로젝트 설정] → [스크립트 속성]에 <code>ADMIN_API_SECRET</code>을 등록하면 Vercel 서버 인증을 거친 관리자만 전체 학생 명단과 상세 데이터를 조회할 수 있습니다.
              </li>
            </ol>
          </div>

          {/* Script Code Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#2C362B] flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-[#4B6344]" />
                <span>Google Apps Script 자동 생성 코드</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-3.5 py-1.5 bg-[#4B6344] hover:bg-[#3D5237] text-white rounded-xl font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? '복사 완료!' : '스크립트 전체 복사'}</span>
              </button>
            </div>

            <pre className="p-5 bg-[#2C362B] text-[#F7F8F4] rounded-2xl font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto whitespace-pre border border-[#3D5237]">
              {scriptCode}
            </pre>
          </div>

          {/* Optional Web App URL Config */}
          <form onSubmit={handleSaveUrl} className="p-5 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#2C362B] mb-1.5">
                배포된 Google Apps Script 웹 앱 URL 등록 (선택)
              </label>
              <input
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 bg-white border border-[#DCE2D7] rounded-xl text-xs font-medium text-[#2C362B] focus:border-[#4B6344] outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#5D6B58]">
                등록 시 학생의 저장 및 제출 데이터가 구글 시트와 자동 실시간 동기화됩니다.
              </span>
              <button
                type="submit"
                className="px-4 py-2 bg-[#4B6344] hover:bg-[#3D5237] text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
              >
                {isSaved ? '저장 완료!' : 'URL 설정 저장'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E1E4D8] bg-[#F9FAF8] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-[#E1E4D8] hover:bg-[#F1F4EF] text-[#5D6B58] font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
