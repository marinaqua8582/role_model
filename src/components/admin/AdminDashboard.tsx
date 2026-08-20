import React from 'react';
import { DashboardStats } from '../../types';
import { Users, Play, Clock, Sparkles, Bot, Send } from 'lucide-react';

interface AdminDashboardProps {
  stats: DashboardStats;
  selectedGrade: number | 'all';
  selectedClass: number | 'all';
  onFilterClass: (grade: number | 'all', classNum: number | 'all') => void;
  onFilterStatus?: (status: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  stats,
  selectedGrade,
  selectedClass,
  onFilterClass,
}) => {
  const statCards = [
    {
      title: '전체 학생',
      count: stats.totalStudents,
      color: 'bg-[#2C362B]',
      textColor: 'text-[#2C362B]',
      bgColor: 'bg-white border-[#E1E4D8]',
      icon: Users,
    },
    {
      title: '활동 시작',
      count: stats.startedStudents,
      color: 'bg-[#4B6344]',
      textColor: 'text-[#4B6344]',
      bgColor: 'bg-white border-[#E1E4D8]',
      icon: Play,
    },
    {
      title: '프롬프트 작성 중',
      count: stats.inProgressStudents,
      color: 'bg-[#9E6B38]',
      textColor: 'text-[#9E6B38]',
      bgColor: 'bg-white border-[#E1E4D8]',
      icon: Clock,
    },
    {
      title: '프롬프트 완성',
      count: stats.promptCompletedStudents,
      color: 'bg-[#4B6344]',
      textColor: 'text-[#4B6344]',
      bgColor: 'bg-white border-[#E1E4D8]',
      icon: Sparkles,
    },
    {
      title: 'Gem 제작 / 테스트',
      count: stats.testCompletedStudents,
      color: 'bg-[#5D6B58]',
      textColor: 'text-[#5D6B58]',
      bgColor: 'bg-white border-[#E1E4D8]',
      icon: Bot,
    },
    {
      title: '최종 제출 완료',
      count: stats.finalSubmittedStudents,
      color: 'bg-[#4B6344]',
      textColor: 'text-[#4B6344]',
      bgColor: 'bg-[#F1F4EF] border-[#DCE2D7]',
      icon: Send,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top 6 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`p-4 rounded-2xl border ${card.bgColor} shadow-2xs space-y-2 transition-all`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280]">{card.title}</span>
                <div className={`w-6 h-6 rounded-lg ${card.color} text-white flex items-center justify-center shadow-xs`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-extrabold ${card.textColor}`}>{card.count}</span>
                <span className="text-xs text-[#6B7280] font-medium">명</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Class by Class Progress Overview */}
      <div className="bg-white rounded-3xl border border-[#E1E4D8] shadow-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#2C362B] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#4B6344]" />
              <span>반별 진행 현황 요약</span>
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              각 반을 클릭하면 해당 반의 학생 명단만 빠르게 필터링됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onFilterClass('all', 'all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              selectedGrade === 'all' && selectedClass === 'all'
                ? 'bg-[#4B6344] text-white border-[#4B6344]'
                : 'bg-white text-[#5D6B58] border-[#E1E4D8] hover:bg-[#F9FAF8]'
            }`}
          >
            전체 반 보기
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.byClass.map((c) => {
            const isSelected = selectedGrade === c.grade && selectedClass === c.classNum;
            const completionRate = c.total > 0 ? Math.round((c.submitted / c.total) * 100) : 0;

            return (
              <div
                key={`${c.grade}-${c.classNum}`}
                onClick={() => onFilterClass(c.grade, c.classNum)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F1F4EF] border-[#4B6344] ring-2 ring-[#4B6344]/20 shadow-sm'
                    : 'bg-[#F9FAF8] border-[#E1E4D8] hover:bg-[#F1F4EF]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#2C362B] text-sm">
                    <span>{c.grade}학년 {c.classNum}반</span>
                    <span className="text-xs font-normal text-[#6B7280]">(총 {c.total}명)</span>
                  </div>
                  <span className="text-xs font-extrabold text-[#4B6344] bg-white border border-[#DCE2D7] px-2.5 py-0.5 rounded-full">
                    제출률 {completionRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden mb-3.5">
                  <div
                    className="bg-[#4B6344] h-full rounded-full transition-all duration-300"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>

                {/* Stats list */}
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs">
                  <div className="flex justify-between text-[#5D6B58]">
                    <span>미시작:</span>
                    <strong className="text-[#2C362B]">{c.notStarted}명</strong>
                  </div>
                  <div className="flex justify-between text-[#5D6B58]">
                    <span>작성 중:</span>
                    <strong className="text-[#9E6B38]">{c.inProgress}명</strong>
                  </div>
                  <div className="flex justify-between text-[#5D6B58]">
                    <span>프롬프트 완성:</span>
                    <strong className="text-[#4B6344]">{c.promptCompleted}명</strong>
                  </div>
                  <div className="flex justify-between text-[#5D6B58]">
                    <span>Gem 테스트:</span>
                    <strong className="text-[#5D6B58]">{c.testing}명</strong>
                  </div>
                  <div className="flex justify-between text-[#5D6B58] col-span-2 pt-2 border-t border-[#E1E4D8]">
                    <span className="font-bold text-[#2C362B]">제출 완료:</span>
                    <strong className="text-[#4B6344] font-bold">{c.submitted}명</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
