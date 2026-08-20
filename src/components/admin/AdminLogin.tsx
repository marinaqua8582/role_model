import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { verifyAdminPassword } from '../../api/client';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await verifyAdminPassword(password);
      if (res.success) {
        onLoginSuccess();
      } else {
        setErrorMessage(res.message || '관리자 비밀번호가 올바르지 않습니다.');
      }
    } catch (err) {
      setErrorMessage('인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C362B]/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E1E4D8] animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-[#4B6344] text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-[#4B6344]/20">
          <Shield className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-[#2C362B] text-center mb-1">
          교사용 관리자 로그인
        </h3>
        <p className="text-[#6B7280] text-xs text-center mb-6">
          학생 명단 관리 및 수업 진행 현황을 조회하기 위해 관리자 비밀번호를 입력해 주세요.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#4B6344]">
              관리자 비밀번호
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl text-sm font-medium text-[#2C362B] placeholder:text-[#6B7280]/60 focus:bg-white focus:border-[#4B6344] focus:ring-2 focus:ring-[#4B6344]/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 bg-[#F3F4F1] hover:bg-[#EAECE6] text-[#5D6B58] font-bold rounded-xl text-xs transition-colors cursor-pointer border border-[#E1E4D8]"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={isLoading || !password}
              className="flex-1 py-3 px-4 bg-[#4B6344] hover:bg-[#3D5237] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-[#4B6344]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{isLoading ? '확인 중...' : '로그인'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
