import React from 'react';
import { StudentProgress } from '../../types';
import { Printer, ArrowLeft, CheckCircle2, AlertCircle, Link as LinkIcon, Sparkles } from 'lucide-react';
import { getStudentPrompt } from '../../utils/excel';

interface AdminPrintViewProps {
  studentsToPrint: StudentProgress[];
  title?: string;
  onBack: () => void;
}

export const AdminPrintView: React.FC<AdminPrintViewProps> = ({
  studentsToPrint,
  title = '롤모델 챗봇 만들기 - 최종 결과',
  onBack,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F7F8F4] py-6 px-4 print:p-0 print:bg-white print:m-0">
      {/* Print-specific style block */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 15mm 12mm;
        }
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hidden-all {
            display: none !important;
          }
          .student-print-page {
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 0 20mm 0 !important;
          }
          .student-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
            margin-bottom: 0 !important;
          }
          .print-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .prompt-print-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            white-space: pre-wrap !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
          }
        }
      `}</style>

      {/* Top Non-printing Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-[#E1E4D8] shadow-sm flex items-center justify-between print-hidden-all">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-[#F9FAF8] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#E1E4D8]"
            title="돌아가기"
          >
            <ArrowLeft className="w-5 h-5 text-[#5D6B58]" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#2C362B]">{title}</h2>
            <p className="text-xs text-[#6B7280]">
              인쇄 대상: 총 <strong className="text-[#4B6344]">{studentsToPrint.length}명</strong> (각 학생별 1페이지씩 A4 세로 인쇄)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-white hover:bg-[#F1F4EF] border border-[#E1E4D8] text-[#5D6B58] font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-[#4B6344] hover:bg-[#3D5237] text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-[#4B6344]/20 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>지금 인쇄하기 (A4 세로)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Content */}
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-0 print:max-w-none">
        {studentsToPrint.map((student, idx) => {
          // Priority: 1. finalPrompt, 2. revisedPrompt, 3. initialPrompt
          const finalPrompt = getStudentPrompt(student);
          const hasPrompt = Boolean(finalPrompt);

          const answerLengthLabel =
            student.step4?.answerLength === 'short'
              ? '간결하게 (2~3문장)'
              : student.step4?.answerLength === 'detailed'
              ? '자세하고 풍부하게'
              : '적절한 분량 (4~6문장)';

          const answerElementsLabel =
            student.step4?.answerElements && student.step4.answerElements.length > 0
              ? student.step4.answerElements.join(', ')
              : '핵심 답변 및 따뜻한 조언';

          const purposeLabel =
            student.step2?.chatbotPurposes && student.step2.chatbotPurposes.length > 0
              ? student.step2.chatbotPurposes.join(', ')
              : student.step2?.purposeSummarySentence || student.step2?.expectedOutcome || '(미입력)';

          const personalitiesLabel =
            student.step3?.personalities && student.step3.personalities.length > 0
              ? student.step3.personalities.join(', ')
              : '(미지정)';

          const speakingStyleLabel = student.step3?.speakingStyle || '멘토처럼 따뜻하게';
          const honorificStyleLabel = student.step3?.honorificStyle || '친근한 존댓말';

          const printDate = student.step10?.submittedAt
            ? new Date(student.step10.submittedAt).toLocaleDateString('ko-KR')
            : student.updatedAt
            ? new Date(student.updatedAt).toLocaleDateString('ko-KR')
            : new Date().toLocaleDateString('ko-KR');

          return (
            <div
              key={student.studentKey || idx}
              className="student-print-page bg-white p-8 sm:p-10 rounded-2xl border border-[#E1E4D8] shadow-sm print:p-0 print:border-none print:shadow-none"
            >
              {/* Document Header */}
              <div className="border-b-2 border-[#2C362B] pb-3 mb-5 flex justify-between items-end print:pb-2 print:mb-4">
                <div>
                  <span className="text-xs font-bold text-[#4B6344] uppercase tracking-wider block mb-0.5">
                    진로 수업 AI 프로젝트
                  </span>
                  <h1 className="text-xl sm:text-2xl font-black text-[#2C362B] tracking-tight">
                    롤모델 챗봇 만들기 - 최종 결과
                  </h1>
                </div>
                <div className="text-right text-xs text-[#6B7280]">
                  <span>출력일: {new Date().toLocaleDateString('ko-KR')}</span>
                  {student.updatedAt && (
                    <div className="text-[10px] text-[#9CA3AF]">
                      (최종 수정: {new Date(student.updatedAt).toLocaleDateString('ko-KR')})
                    </div>
                  )}
                </div>
              </div>

              {/* 1. Student Info & Role Model (2-column layout) */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                {/* [학생 정보] */}
                <div className="p-3.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl space-y-1 print:bg-white print:border-[#CCD4C5]">
                  <div className="text-[10px] font-bold text-[#4B6344] uppercase tracking-wider">
                    [학생 정보]
                  </div>
                  <div className="text-sm font-black text-[#2C362B]">
                    {student.grade}학년 {student.classNum}반 {student.number}번 {student.name}
                  </div>
                  <div className="text-[#5D6B58] text-[11px]">
                    진행 상태: STEP {student.currentStep}{' '}
                    {student.isFinalSubmitted ? '(최종 제출 완료)' : '(진행 중)'}
                  </div>
                </div>

                {/* [롤모델] */}
                <div className="p-3.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl space-y-1 print:bg-white print:border-[#CCD4C5]">
                  <div className="text-[10px] font-bold text-[#4B6344] uppercase tracking-wider">
                    [롤모델]
                  </div>
                  <div className="text-sm font-black text-[#4B6344]">
                    {student.step1?.roleModelName || '미지정'}{' '}
                    <span className="text-xs font-bold text-[#5D6B58]">
                      ({student.step1?.roleModelJob || '직업 미지정'})
                    </span>
                  </div>
                  <div className="text-[#2C362B] text-[11px] leading-snug">
                    <strong className="text-[#5D6B58]">선정 이유: </strong>
                    {student.step1?.roleModelReason || '(선정 이유가 작성되지 않았습니다)'}
                  </div>
                </div>
              </div>

              {/* 2. Chatbot Design Specification */}
              <div className="mb-4 print-section">
                <div className="text-xs font-bold text-[#2C362B] flex items-center gap-1.5 border-l-3 border-[#4B6344] pl-2 mb-2">
                  <span>[챗봇 설계]</span>
                </div>

                <div className="p-3.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl text-xs space-y-2 print:bg-white print:border-[#CCD4C5]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] block">챗봇 이름</span>
                      <strong className="text-[#2C362B] text-xs">
                        {student.step6?.chatbotName || '나의 롤모델 멘토'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] block">대상 사용자</span>
                      <span className="text-[#2C362B]">{student.step2?.targetUser || '중학생'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] block">성격</span>
                      <span className="text-[#2C362B]">{personalitiesLabel}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#E1E4D8]/70">
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] block">챗봇 목적</span>
                      <p className="text-[#2C362B] text-[11px] leading-relaxed">{purposeLabel}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-[#6B7280] block">말투 & 답변 방식</span>
                      <p className="text-[#2C362B] text-[11px] leading-relaxed">
                        말투: {speakingStyleLabel} ({honorificStyleLabel})<br />
                        답변: {answerLengthLabel} / {answerElementsLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Final Prompt */}
              <div className="mb-4 print-section">
                <div className="text-xs font-bold text-[#2C362B] flex items-center justify-between border-l-3 border-[#4B6344] pl-2 mb-2">
                  <span>[최종 프롬프트]</span>
                  <span className="text-[10px] text-[#5D6B58] font-normal">
                    {student.step6?.finalPrompt
                      ? '(최종 확정본 finalPrompt)'
                      : student.step6?.revisedPrompt
                      ? '(수정본 revisedPrompt)'
                      : student.step6?.initialPrompt
                      ? '(초안 initialPrompt)'
                      : '(미작성)'}
                  </span>
                </div>

                <div className="prompt-print-box p-4 bg-[#FAFBF9] border border-[#CCD4C5] rounded-xl font-mono text-[10.5px] leading-relaxed text-[#1F271E] whitespace-pre-wrap break-words print:bg-white print:border-[#9CA3AF]">
                  {hasPrompt ? finalPrompt : '(학생이 작성한 프롬프트가 없습니다)'}
                </div>
              </div>

              {/* 4. Test & Revision History */}
              <div className="mb-4 print-section">
                <div className="text-xs font-bold text-[#2C362B] flex items-center gap-1.5 border-l-3 border-[#4B6344] pl-2 mb-2">
                  <span>[테스트 및 수정]</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-3 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl print:bg-white print:border-[#CCD4C5]">
                    <span className="text-[10px] font-bold text-[#6B7280] block mb-0.5">테스트 완료 여부</span>
                    <strong className={`text-xs ${student.isTestCompleted ? 'text-[#4B6344]' : 'text-amber-700'}`}>
                      {student.isTestCompleted ? '✓ 테스트 완료' : '진행 중 / 미완료'}
                    </strong>
                    {student.step8?.testedAt && (
                      <span className="text-[10px] text-[#9CA3AF] block mt-0.5">
                        ({new Date(student.step8.testedAt).toLocaleDateString('ko-KR')})
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl print:bg-white print:border-[#CCD4C5]">
                    <span className="text-[10px] font-bold text-[#6B7280] block mb-0.5">발견한 문제</span>
                    <p className="text-[11px] text-[#2C362B] leading-snug">
                      {student.step8?.problemDescription || '특이 문제 없음 (정상 동작 확인)'}
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl print:bg-white print:border-[#CCD4C5]">
                    <span className="text-[10px] font-bold text-[#6B7280] block mb-0.5">수정한 내용</span>
                    <p className="text-[11px] text-[#2C362B] leading-snug">
                      {student.step8?.revisionNote || student.step10?.revisionSummary || '프롬프트 규칙 및 말투 보완 완료'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Final Submissions & Gem Link */}
              <div className="print-section">
                <div className="text-xs font-bold text-[#2C362B] flex items-center gap-1.5 border-l-3 border-[#4B6344] pl-2 mb-2">
                  <span>[최종 결과물]</span>
                </div>

                <div className="p-3.5 bg-[#FAFBF9] border border-[#E1E4D8] rounded-xl text-xs space-y-2 print:bg-white print:border-[#CCD4C5]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2C362B]">Gemini Gem 공유 링크 등록 여부:</span>
                    {student.step10?.gemUrl ? (
                      <span className="font-bold text-[#4B6344] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>등록 완료</span>
                        <span className="font-mono text-[11px] font-normal text-[#5D6B58] ml-1">
                          ({student.step10.gemUrl})
                        </span>
                      </span>
                    ) : (
                      <span className="text-[#9CA3AF]">미등록</span>
                    )}
                  </div>

                  {/* Sample Dialogues & Reflection if present */}
                  {(student.step10?.sampleQuestion1 || student.step10?.reflection) && (
                    <div className="pt-2 border-t border-[#E1E4D8]/70 space-y-1.5 text-[11px]">
                      {student.step10?.sampleQuestion1 && (
                        <div>
                          <strong className="text-[#2C362B]">대표 문답 1: </strong>
                          <span className="text-[#5D6B58] italic">Q. {student.step10.sampleQuestion1} </span>
                          <span className="text-[#2C362B]"> → A. {student.step10.sampleAnswer1}</span>
                        </div>
                      )}

                      {student.step10?.reflection && (
                        <div>
                          <strong className="text-[#2C362B]">제작 소감: </strong>
                          <span className="text-[#5D6B58]">{student.step10.reflection}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
