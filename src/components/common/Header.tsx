import React from 'react';
import { StudentProgress } from '../../types';
import { Shield, Sparkles, LogOut, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

interface HeaderProps {
  currentStudent: StudentProgress | null;
  isAdminLoggedIn: boolean;
  isAdminView: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  isPreviewMode?: boolean;
  onOpenAdminLogin: () => void;
  onToggleAdminView: () => void;
  onStudentLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStudent,
  isAdminLoggedIn,
  isAdminView,
  saveStatus,
  isPreviewMode = false,
  onOpenAdminLogin,
  onToggleAdminView,
  onStudentLogout,
}) => {
  return (
    <header className="bg-white border-b border-[#E1E4D8] sticky top-0 z-40 shadow-xs print:hidden">
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="bg-[#4B6344] text-white px-4 py-2 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-inner">
          <Shield className="w-4 h-4 text-emerald-200" />
          <span>[관리자 미리보기 모드] 학생에게 보이는 화면을 확인하고 있습니다. (읽기 전용)</span>
          <button
            type="button"
            onClick={onToggleAdminView}
            className="ml-3 px-3 py-0.5 bg-[#3D5237] hover:bg-[#2C362B] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border border-[#DCE2D7]/30"
          >
            관리자 대시보드로 돌아가기
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* App Title & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#4B6344] flex items-center justify-center text-white shadow-md shadow-[#4B6344]/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-[#2C362B] text-base sm:text-lg tracking-tight">
                나의 롤모델 챗봇 만들기
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 bg-[#F1F4EF] text-[#4B6344] text-[11px] font-bold rounded-full border border-[#DCE2D7]">
                진로 탐색 AI 도우미
              </span>
            </div>
            <p className="text-xs text-[#6B7280] hidden sm:block">
              중학교 3학년 맞춤형 Gemini Gems 프롬프트 설계 도구
            </p>
          </div>
        </div>

        {/* Right Action Area */}
        <div className="flex items-center gap-3">
          {/* Auto Save Status (Student Mode Only) */}
          {currentStudent && !isPreviewMode && !isAdminView && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-[#5D6B58] bg-[#F9FAF8] px-3 py-1.5 rounded-xl border border-[#E1E4D8]">
              {saveStatus === 'saving' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-[#4B6344] animate-spin" />
                  <span className="text-[#4B6344] font-medium">저장 중...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4B6344]" />
                  <span className="text-[#4B6344] font-medium">
                    단계 이동 시 저장 완료
                    {currentStudent.updatedAt && (
                      <span className="text-[#6B7280] ml-1">
                        ({new Date(currentStudent.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })})
                      </span>
                    )}
                  </span>
                </>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-1 text-rose-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>저장 오류 발생</span>
                </div>
              )}
              {saveStatus === 'idle' && (
                <span className="text-[#6B7280]">
                  {currentStudent.updatedAt
                    ? `마지막 저장: ${new Date(currentStudent.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : '단계 이동 시 자동 저장'}
                </span>
              )}
            </div>
          )}

          {/* Student Info Tag */}
          {currentStudent && !isAdminView && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#F1F4EF] border border-[#DCE2D7] text-[#2C362B] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium">
                <span className="text-xs text-[#5D6B58] font-semibold">
                  {currentStudent.grade}학년 {currentStudent.classNum}반 {currentStudent.number}번
                </span>
                <strong className="text-[#2C362B]">{currentStudent.name}</strong>
              </div>

              {!isPreviewMode && (
                <button
                  type="button"
                  onClick={onStudentLogout}
                  title="학생 변경 / 로그아웃"
                  className="p-2 text-[#6B7280] hover:text-[#2C362B] hover:bg-[#F1F4EF] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#E1E4D8]"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Admin Switch Button */}
          {!isAdminLoggedIn && !isAdminView && !isPreviewMode && (
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#E1E4D8] text-[#5D6B58] bg-[#F9FAF8] hover:bg-[#F1F4EF] hover:border-[#DCE2D7] transition-all shadow-2xs cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-[#4B6344]" />
              <span>선생님 관리자</span>
            </button>
          )}

          {isAdminLoggedIn && (
            <button
              type="button"
              onClick={onToggleAdminView}
              className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-[#4B6344] text-white hover:bg-[#3D5237] transition-all shadow-sm shadow-[#4B6344]/20 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{isAdminView ? '학생 화면 미리보기' : '관리자 대시보드'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
