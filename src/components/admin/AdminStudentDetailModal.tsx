import React, { useState } from 'react';
import { StudentProgress } from '../../types';
import {
  X,
  Sparkles,
  Printer,
  Eye,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  ShieldAlert,
  Compass,
  GraduationCap,
  Award,
} from 'lucide-react';
import { STEP_NAMES } from '../common/StepProgressBar';

interface AdminStudentDetailModalProps {
  student: StudentProgress;
  onClose: () => void;
  onPreviewStudentMode: (student: StudentProgress) => void;
  onPrintStudent: (student: StudentProgress) => void;
}

export const AdminStudentDetailModal: React.FC<AdminStudentDetailModalProps> = ({
  student,
  onClose,
  onPreviewStudentMode,
  onPrintStudent,
}) => {
  const [activeTab, setActiveTab] = useState<'submission' | 'prompt' | 'roleModel' | 'tests'>('submission');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = student.step6?.finalPrompt || student.step6?.revisedPrompt || student.step6?.initialPrompt || '';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentPrompt = student.step6?.finalPrompt || student.step6?.revisedPrompt || student.step6?.initialPrompt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C362B]/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#E1E4D8] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#E1E4D8] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F1F4EF] border border-[#DCE2D7] text-[#4B6344] flex items-center justify-center font-bold">
              {student.classNum}-{student.number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#2C362B]">
                  {student.grade}학년 {student.classNum}반 {student.number}번 {student.name}
                </h3>
                <span className="px-2.5 py-0.5 bg-[#F1F4EF] text-[#4B6344] text-xs font-bold rounded-md border border-[#DCE2D7]">
                  STEP {student.currentStep}. {STEP_NAMES[student.currentStep - 1] || '롤모델 정보'}
                </span>
                {student.isFinalSubmitted && (
                  <span className="px-2.5 py-0.5 bg-[#4B6344] text-white text-xs font-bold rounded-md">
                    최종 완료
                  </span>
                )}
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                롤모델: <strong className="text-[#2C362B]">{student.step1?.roleModelName || '미입력'}</strong> ({student.step1?.roleModelJob || '직업 미입력'}) | 챗봇명: <strong className="text-[#4B6344]">{student.step6?.chatbotName || '미정'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPreviewStudentMode(student)}
              className="px-3.5 py-2 bg-[#F1F4EF] hover:bg-[#EAECE6] text-[#4B6344] border border-[#DCE2D7] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#4B6344]" />
              <span>학생 화면으로 보기</span>
            </button>

            <button
              type="button"
              onClick={() => onPrintStudent(student)}
              className="px-3.5 py-2 bg-[#4B6344] hover:bg-[#3D5237] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#6B7280] hover:text-[#2C362B] hover:bg-[#F9FAF8] rounded-xl transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-[#E1E4D8] bg-[#F9FAF8] flex gap-2 shrink-0 overflow-x-auto">
          {[
            { id: 'submission', label: 'STEP10. 최종 제출 & 진로 상담' },
            { id: 'prompt', label: '최종 프롬프트 & 설정' },
            { id: 'roleModel', label: '롤모델 상세 정보' },
            { id: 'tests', label: '챗봇 테스트 & 수정' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#4B6344] text-[#4B6344] bg-white'
                  : 'border-transparent text-[#6B7280] hover:text-[#2C362B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: Submission & Career Counseling (STEP 10) */}
          {activeTab === 'submission' && (
            <div className="space-y-5">
              {/* Header Status */}
              <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-[#4B6344] block">
                    STEP 10. 롤모델 챗봇 최종 제출 및 지정 진로 상담 수행평가
                  </span>
                  <p className="text-xs text-[#5D6B58]">
                    롤모델: <strong className="text-[#2C362B]">{student.step1?.roleModelName || '미입력'}</strong> | 챗봇명: <strong className="text-[#4B6344]">{student.step6?.chatbotName || '미정'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {student.step10?.gemUrl && (
                    <a
                      href={student.step10.gemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white text-[#4B6344] hover:bg-[#F9FAF8] border border-[#DCE2D7] rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <span>Gem 열기</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                    student.isFinalSubmitted || (student.step10?.barrierAnswer && student.step10?.finalCareerReflection)
                      ? 'bg-[#4B6344] text-white border-[#4B6344]'
                      : 'bg-white text-amber-800 border-amber-200'
                  }`}>
                    {student.isFinalSubmitted || (student.step10?.barrierAnswer && student.step10?.finalCareerReflection)
                      ? '최종 완료'
                      : '진행 중 / 미완료'}
                  </span>
                </div>
              </div>

              {/* Gem URL Info */}
              <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2C362B] text-xs">Gemini Gem 공유 링크</span>
                  {student.step10?.submittedAt && (
                    <span className="text-[11px] text-[#6B7280]">
                      제출 시각: {new Date(student.step10.submittedAt).toLocaleString('ko-KR')}
                    </span>
                  )}
                </div>
                {student.step10?.gemUrl ? (
                  <a
                    href={student.step10.gemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#4B6344] font-medium hover:underline flex items-center gap-1 break-all"
                  >
                    <span>{student.step10.gemUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <p className="text-[#9CA3AF]">아직 Gem 공유 링크가 제출되지 않았습니다.</p>
                )}
              </div>

              {/* 3 Designated Counseling Questions & Reflections */}
              <div className="space-y-4">
                <h4 className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[#4B6344]" />
                  <span>지정 진로 상담 3문항 수행평가 결과</span>
                </h4>

                {/* 1. Career Barrier */}
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-2">
                    <span className="font-bold text-[#2C362B] text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-[#4B6344]" />
                      <span>상담 1. 진로 장벽 극복 사례</span>
                    </span>
                    <span className="text-[11px] text-[#6B7280] font-medium">
                      지정 질문: 어려움/장벽 및 극복 방법
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-[#4B6344] block">[챗봇 답변]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#2C362B] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.barrierAnswer || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-[#9E6B38] block">[알게 된 점 / 느낀 점]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.barrierReflection || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Career Decision */}
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-2">
                    <span className="font-bold text-[#2C362B] text-xs flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-[#4B6344]" />
                      <span>상담 2. 진로 의사 결정</span>
                    </span>
                    <span className="text-[11px] text-[#6B7280] font-medium">
                      지정 질문: 결정적 선택 이유 및 중요 기준
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-[#4B6344] block">[챗봇 답변]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#2C362B] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.decisionAnswer || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-[#9E6B38] block">[알게 된 점 / 느낀 점]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.decisionReflection || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Education Path */}
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E1E4D8] pb-2">
                    <span className="font-bold text-[#2C362B] text-xs flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#4B6344]" />
                      <span>상담 3. 진학 설계</span>
                    </span>
                    <span className="text-[11px] text-[#6B7280] font-medium">
                      지정 질문: 고등학교 진학 및 학업 경로 조언
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-[#4B6344] block">[챗봇 답변]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#2C362B] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.educationAnswer || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-[#9E6B38] block">[알게 된 점 / 느낀 점]</span>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                        {student.step10?.educationReflection || <span className="text-[#9CA3AF]">(미입력)</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Final Career Reflection */}
                <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl space-y-2">
                  <h4 className="font-bold text-[#2C362B] text-xs flex items-center justify-between">
                    <span>상담 후 나의 진로 생각 (최종 성찰)</span>
                    {student.step10?.finalCareerReflection && (
                      <span className="text-[11px] text-[#4B6344] font-semibold">
                        ({student.step10.finalCareerReflection.length}자)
                      </span>
                    )}
                  </h4>
                  <div className="p-3.5 bg-white rounded-xl border border-[#DCE2D7] text-[#2C362B] leading-relaxed whitespace-pre-wrap text-xs">
                    {student.step10?.finalCareerReflection || <span className="text-[#9CA3AF]">(작성 내용 없음)</span>}
                  </div>
                </div>

                {/* Revision summary */}
                {student.step10?.revisionSummary && (
                  <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1">
                    <span className="font-bold text-[#2C362B] text-xs">챗봇 제작/수정 요약</span>
                    <p className="text-[#5D6B58]">{student.step10.revisionSummary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Prompt & Chatbot Design */}
          {activeTab === 'prompt' && (
            <div className="space-y-5">
              {/* Chatbot Configurations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] block">챗봇 목적 & 대상</span>
                  <p className="text-[#5D6B58]"><strong className="text-[#2C362B]">대상:</strong> {student.step2?.targetUser || '중학생'}</p>
                  <p className="text-[#6B7280]"><strong className="text-[#2C362B]">역할/목적:</strong> {student.step2?.chatbotPurposes?.join(', ') || student.step2?.purposeSummarySentence || '(작성 없음)'}</p>
                  {student.step2?.expectedOutcome && (
                    <p className="text-[#6B7280] text-[11px]"><strong className="text-[#2C362B]">기대 효과:</strong> {student.step2?.expectedOutcome}</p>
                  )}
                </div>
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] block">성격 & 말투</span>
                  <p className="text-[#5D6B58]"><strong className="text-[#2C362B]">성격:</strong> {student.step3?.personalities?.join(', ') || '(미지정)'}</p>
                  <p className="text-[#6B7280]"><strong className="text-[#2C362B]">말투:</strong> {student.step3?.speakingStyle || '멘토처럼 따뜻하게'} ({student.step3?.honorificStyle || '친근한 존댓말'})</p>
                  {student.step3?.desiredFeeling && (
                    <p className="text-[#6B7280] text-[11px]"><strong className="text-[#2C362B]">느낌:</strong> {student.step3?.desiredFeeling}</p>
                  )}
                </div>
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] block">답변 방식 & 안전 규칙</span>
                  <p className="text-[#5D6B58]"><strong className="text-[#2C362B]">답변 길이:</strong> {student.step4?.answerLength === 'short' ? '짧고 명확하게 (2~3문장)' : student.step4?.answerLength === 'detailed' ? '충분히 자세하게' : '적절한 분량 (4~6문장)'}</p>
                  <p className="text-[#6B7280]"><strong className="text-[#2C362B]">구성 요소:</strong> {student.step4?.answerElements?.join(' / ') || '(기본 설정)'}</p>
                  <p className="text-emerald-700 text-[11px] font-semibold">✓ 진로 사실성 및 안전 가이드 준수</p>
                </div>
              </div>

              {/* Prompts Section */}
              <div className="space-y-4 pt-1">
                {/* 1. Final Prompt */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#2C362B] text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#4B6344]" />
                      <span>최종 프롬프트 (Final Prompt)</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1.5 bg-[#F1F4EF] hover:bg-[#EAECE6] text-[#4B6344] border border-[#DCE2D7] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? '복사 완료' : '프롬프트 복사'}</span>
                    </button>
                  </div>

                  {currentPrompt ? (
                    <pre className="p-5 bg-[#2C362B] text-[#F7F8F4] rounded-2xl font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap border border-[#3D5237] shadow-inner">
                      {currentPrompt}
                    </pre>
                  ) : (
                    <div className="p-6 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl text-center text-[#6B7280]">
                      아직 최종 프롬프트가 생성되지 않았습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Role Model Detailed Info (STEP 1) */}
          {activeTab === 'roleModel' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] text-xs">롤모델 이름 & 직업</span>
                  <p className="text-sm font-bold text-[#4B6344]">
                    {student.step1?.roleModelName || '(미입력)'} ({student.step1?.roleModelJob || '직업 미입력'})
                  </p>
                </div>
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] text-xs">선정 이유</span>
                  <p className="text-[#5D6B58]">{student.step1?.roleModelReason || '(미입력)'}</p>
                </div>
              </div>

              <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                <span className="font-bold text-[#2C362B] text-xs">직업 설명</span>
                <p className="text-[#5D6B58] leading-relaxed">{student.step1?.jobDescription || '(미입력)'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1">
                  <span className="font-bold text-[#2C362B] text-xs">핵심 역량</span>
                  <p className="text-[#5D6B58]">{student.step1?.competencies?.join(', ') || '(미선택)'}</p>
                </div>
                <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1">
                  <span className="font-bold text-[#2C362B] text-xs">강점 및 장점</span>
                  <p className="text-[#5D6B58]">{student.step1?.strengths?.join(', ') || '(미선택)'}</p>
                </div>
                <div className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1">
                  <span className="font-bold text-[#2C362B] text-xs">가치관</span>
                  <p className="text-[#5D6B58]">{student.step1?.values?.join(', ') || '(미선택)'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] text-xs">주요 경력 및 업적</span>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">{student.step1?.careerHistory || '(미입력)'}</p>
                </div>
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <span className="font-bold text-[#2C362B] text-xs">도전 및 극복 경험</span>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">{student.step1?.challengeExperience || '(미입력)'}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Tests & Prompt Revision (STEP 8 & 9) */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-[#2C362B] text-xs">챗봇 테스트 평가 결과 (STEP 8)</h4>
                  {student.step8?.testedAt && (
                    <span className="text-[11px] text-[#6B7280]">
                      테스트 일시: {new Date(student.step8.testedAt).toLocaleString('ko-KR')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {Object.entries(student.step8?.tests || {}).map(([key, testVal]) => {
                    const test = testVal as { result?: string; note?: string } | undefined;
                    const testLabels: Record<string, string> = {
                      test1: '1. 역할 일치도',
                      test2: '2. 말투/태도',
                      test3: '3. 진로 정보 유용성',
                      test4: '4. 답변 길이 적절성',
                      test5: '5. 사실성 준수',
                      test6: '6. 안전성 준수',
                    };
                    const isGood = test?.result === 'good';
                    const isNeedsFix = test?.result === 'needs_fix';

                    return (
                      <div
                        key={key}
                        className={`p-2.5 rounded-xl border flex items-center justify-between ${
                          isGood
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                            : isNeedsFix
                            ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                            : 'bg-white border-[#E1E4D8] text-[#6B7280]'
                        }`}
                      >
                        <span className="font-semibold">{testLabels[key] || key}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            isGood
                              ? 'bg-emerald-600 text-white'
                              : isNeedsFix
                              ? 'bg-amber-500 text-white'
                              : 'bg-[#F1F4EF] text-[#6B7280]'
                          }`}
                        >
                          {isGood ? '통과' : isNeedsFix ? '보완 필요' : '미평가'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {student.step8?.problemDescription && (
                <div className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-2xl space-y-1">
                  <span className="font-bold text-amber-900 text-xs">발견된 문제점</span>
                  <p className="text-amber-800 leading-relaxed">{student.step8.problemDescription}</p>
                </div>
              )}

              {student.step8?.revisionNote && (
                <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl space-y-1">
                  <span className="font-bold text-[#4B6344] text-xs">프롬프트 수정 방향 (STEP 9)</span>
                  <p className="text-[#2C362B] leading-relaxed">{student.step8.revisionNote}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
