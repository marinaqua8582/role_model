import React from 'react';
import { StudentProgress } from '../../types';
import { Printer, ArrowLeft } from 'lucide-react';

interface AdminPrintViewProps {
  studentsToPrint: StudentProgress[];
  title?: string;
  onBack: () => void;
}

export const AdminPrintView: React.FC<AdminPrintViewProps> = ({
  studentsToPrint,
  title = '롤모델 챗봇 만들기 결과 보고서',
  onBack,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F7F8F4] py-6 px-4">
      {/* Top Non-printing Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl border border-[#E1E4D8] shadow-sm flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-[#F9FAF8] rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-[#5D6B58]" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#2C362B]">{title}</h2>
            <p className="text-xs text-[#6B7280]">인쇄 대상: 총 {studentsToPrint.length}명</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-5 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#4B6344]/20 transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>지금 인쇄하기 (A4 출력)</span>
        </button>
      </div>

      {/* Printable Sheet Content */}
      <div className="max-w-4xl mx-auto space-y-8">
        {studentsToPrint.map((student, idx) => {
          const prompt = student.step6?.finalPrompt || student.step6?.initialPrompt || '(프롬프트 미작성)';

          return (
            <div
              key={student.studentKey || idx}
              className="bg-white p-8 sm:p-10 rounded-2xl border border-[#E1E4D8] shadow-sm print:shadow-none print:border-none print:p-0 print:m-0 break-after-page"
              style={{ pageBreakAfter: 'always' }}
            >
              {/* Document Header */}
              <div className="border-b-2 border-[#2C362B] pb-4 mb-6 flex justify-between items-end">
                <div>
                  <span className="text-xs font-bold text-[#4B6344] uppercase tracking-wider block mb-1">
                    중학교 3학년 진로 수업 AI 프로젝트
                  </span>
                  <h1 className="text-2xl font-black text-[#2C362B]">
                    롤모델 챗봇 만들기 – 최종 결과 보고서
                  </h1>
                </div>
                <div className="text-right text-xs text-[#6B7280]">
                  작성일:{' '}
                  {student.updatedAt
                    ? new Date(student.updatedAt).toLocaleDateString('ko-KR')
                    : new Date().toLocaleDateString('ko-KR')}
                </div>
              </div>

              {/* 1. Student & Role Model Summary Table */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl p-4 text-xs">
                <div className="space-y-1.5 border-r border-[#E1E4D8] pr-4">
                  <div className="text-[#6B7280] font-bold uppercase text-[10px]">학생 기본 정보</div>
                  <div className="text-sm font-black text-[#2C362B]">
                    {student.grade}학년 {student.classNum}반 {student.number}번 {student.name}
                  </div>
                  <div className="text-[#5D6B58]">
                    진행 단계: STEP {student.currentStep} |{' '}
                    {student.isFinalSubmitted ? '최종 제출 완료' : '작성 완료'}
                  </div>
                </div>

                <div className="space-y-1.5 pl-2">
                  <div className="text-[#6B7280] font-bold uppercase text-[10px]">롤모델 & 챗봇</div>
                  <div className="text-sm font-black text-[#4B6344]">
                    {student.step1?.roleModelName || '미지정'} ({student.step1?.roleModelJob || '직업 미지정'})
                  </div>
                  <div className="text-[#5D6B58] truncate">
                    챗봇 이름: <strong>{student.step6?.chatbotName || '나의 롤모델 멘토'}</strong>
                  </div>
                </div>
              </div>

              {/* 2. Chatbot Design Blueprint */}
              <div className="mb-6 space-y-2">
                <h3 className="text-sm font-bold text-[#2C362B] flex items-center gap-1.5 border-l-4 border-[#4B6344] pl-2">
                  1. 챗봇 설계 명세 (Design Blueprint)
                </h3>
                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg">
                    <span className="font-bold text-[#2C362B] block mb-0.5">목적 & 대상</span>
                    <p className="text-[#5D6B58]">{student.step2?.targetUser || '중학생'}</p>
                    <p className="text-[#6B7280] text-[11px] truncate">
                      {student.step2?.chatbotPurposes?.join(', ')}
                    </p>
                  </div>
                  <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg">
                    <span className="font-bold text-[#2C362B] block mb-0.5">성격 & 말투</span>
                    <p className="text-[#5D6B58]">{student.step3?.personalities?.join(', ')}</p>
                    <p className="text-[#6B7280] text-[11px]">
                      {student.step3?.speakingStyle} ({student.step3?.honorificStyle})
                    </p>
                  </div>
                  <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg">
                    <span className="font-bold text-[#2C362B] block mb-0.5">답변 방식</span>
                    <p className="text-[#5D6B58]">
                      길이: {student.step4?.answerLength === 'short' ? '2~3문장' : student.step4?.answerLength === 'medium' ? '4~6문장' : '자세히'}
                    </p>
                    <p className="text-[#6B7280] text-[11px] truncate">
                      {student.step4?.answerElements?.join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Final Prompt */}
              <div className="mb-6 space-y-2">
                <h3 className="text-sm font-bold text-[#2C362B] flex items-center gap-1.5 border-l-4 border-[#4B6344] pl-2">
                  2. Gemini Gems 최종 프롬프트 (Instructions)
                </h3>
                <pre className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-xl font-mono text-[11px] leading-relaxed text-[#2C362B] whitespace-pre-wrap">
                  {prompt}
                </pre>
              </div>

              {/* 4. Test & Revision History */}
              {(student.step8?.problemDescription || student.step8?.revisionNote || student.isTestCompleted) && (
                <div className="mb-6 space-y-2">
                  <h3 className="text-sm font-bold text-[#2C362B] flex items-center gap-1.5 border-l-4 border-[#4B6344] pl-2">
                    3. 테스트 및 프롬프트 수정 내역
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg">
                      <span className="font-bold text-[#2C362B] block mb-1">발견한 문제점</span>
                      <p className="text-[#5D6B58] leading-relaxed">
                        {student.step8?.problemDescription || '표준 테스트 통과 및 특이 문제 없음'}
                      </p>
                    </div>
                    <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg">
                      <span className="font-bold text-[#2C362B] block mb-1">수정 및 보완 내용</span>
                      <p className="text-[#5D6B58] leading-relaxed">
                        {student.step8?.revisionNote || '가이드라인에 따라 규칙 보강 완료'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Submissions & Reflection */}
              {student.step10?.gemUrl && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#2C362B] flex items-center gap-1.5 border-l-4 border-[#4B6344] pl-2">
                    4. 챗봇 대화 사례 및 프로젝트 소감
                  </h3>

                  <div className="p-3 bg-[#F9FAF8] border border-[#E1E4D8] rounded-lg text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-[#2C362B]">Gemini Gem 링크:</span>
                      <span className="text-[#4B6344] font-mono text-[11px]">{student.step10.gemUrl}</span>
                    </div>

                    {student.step10.sampleQuestion1 && (
                      <div className="pt-2 border-t border-[#E1E4D8]">
                        <div className="font-bold text-[#2C362B]">대표 문답 1:</div>
                        <div className="text-[#5D6B58] italic">Q. {student.step10.sampleQuestion1}</div>
                        <div className="text-[#2C362B] mt-0.5">A. {student.step10.sampleAnswer1}</div>
                      </div>
                    )}

                    {student.step10.reflection && (
                      <div className="pt-2 border-t border-[#E1E4D8]">
                        <div className="font-bold text-[#2C362B]">제작 소감:</div>
                        <p className="text-[#5D6B58] leading-relaxed mt-0.5">{student.step10.reflection}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
