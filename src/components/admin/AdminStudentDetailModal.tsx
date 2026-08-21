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
  const [activeTab, setActiveTab] = useState<'prompt' | 'roleModel' | 'tests' | 'submission'>('prompt');
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
                    최종 제출 완료
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
            { id: 'prompt', label: '최종 프롬프트 & 설정' },
            { id: 'roleModel', label: '롤모델 상세 정보' },
            { id: 'tests', label: '챗봇 테스트 & 수정' },
            { id: 'submission', label: '최종 제출물 & 소감' },
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
          {/* TAB 1: Prompt & Chatbot Design */}
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

                {/* 2. Initial / Revised Prompts if different */}
                {student.step6?.revisedPrompt && student.step6.revisedPrompt !== student.step6.finalPrompt && (
                  <div className="space-y-1.5 pt-2">
                    <span className="font-bold text-[#5D6B58] text-xs">수정 단계 프롬프트 (Revised Prompt)</span>
                    <pre className="p-4 bg-[#F9FAF8] text-[#2C362B] rounded-xl font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap border border-[#E1E4D8]">
                      {student.step6.revisedPrompt}
                    </pre>
                  </div>
                )}

                {student.step6?.initialPrompt && student.step6.initialPrompt !== (student.step6.finalPrompt || student.step6.revisedPrompt) && (
                  <div className="space-y-1.5 pt-1">
                    <span className="font-bold text-[#5D6B58] text-xs">초기 자동 생성 프롬프트 (Initial Prompt)</span>
                    <pre className="p-4 bg-[#F9FAF8] text-[#6B7280] rounded-xl font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap border border-[#E1E4D8]">
                      {student.step6.initialPrompt}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Role Model Details */}
          {activeTab === 'roleModel' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                  <div className="font-bold text-[#2C362B] text-sm">롤모델 선정 이유</div>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                    {student.step1?.roleModelReason || '(작성 내용 없음)'}
                  </p>
                </div>

                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                  <div className="font-bold text-[#2C362B] text-sm">직업에서 하는 일 및 직무 정보</div>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                    {student.step1?.jobDescription || '(작성 내용 없음)'}
                  </p>
                </div>
              </div>

              {/* Competencies, Strengths, Values */}
              <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-3">
                <div className="font-bold text-[#2C362B] text-sm">핵심 역량 / 주요 강점 / 가치관</div>
                <div className="space-y-2">
                  {student.step1?.competencies && student.step1.competencies.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-[#4B6344] block mb-1">핵심 역량:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {student.step1.competencies.map((c) => (
                          <span key={c} className="px-2.5 py-0.5 bg-[#F1F4EF] text-[#4B6344] rounded-lg font-semibold text-xs border border-[#DCE2D7]">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {student.step1?.strengths && student.step1.strengths.length > 0 && (
                    <div className="pt-1">
                      <span className="text-xs font-bold text-[#9E6B38] block mb-1">주요 강점:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {student.step1.strengths.map((s) => (
                          <span key={s} className="px-2.5 py-0.5 bg-amber-50 text-amber-900 rounded-lg font-semibold text-xs border border-amber-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {student.step1?.values && student.step1.values.length > 0 && (
                    <div className="pt-1">
                      <span className="text-xs font-bold text-[#5D6B58] block mb-1">직업 가치관:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {student.step1.values.map((v) => (
                          <span key={v} className="px-2.5 py-0.5 bg-white text-[#2C362B] rounded-lg font-semibold text-xs border border-[#E1E4D8]">
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {student.step1?.careerHistory && (
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                  <div className="font-bold text-[#2C362B] text-sm">주요 경력 및 성장 과정</div>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                    {student.step1.careerHistory}
                  </p>
                </div>
              )}

              <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                <div className="font-bold text-[#2C362B] text-sm">실패 및 어려움 극복 경험</div>
                <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                  {student.step1?.challengeExperience || '(작성 내용 없음)'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Tests & Revisions */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-bold text-[#2C362B] text-sm">6가지 질문 테스트 평가 결과</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'test1', title: '1. 자기소개 및 인사' },
                    { id: 'test2', title: '2. 직무 핵심 역량 질문' },
                    { id: 'test3', title: '3. 힘든 점 및 극복 경험' },
                    { id: 'test4', title: '4. 직접적 진로 결정 요구' },
                    { id: 'test5', title: '5. 사생활/추측성 정보 질문' },
                    { id: 'test6', title: '6. 역할 탈옥/악성 질문 시도' },
                  ].map((t) => {
                    const testItem = (student.step8?.tests as any)?.[t.id] || { result: '', note: '' };
                    return (
                      <div key={t.id} className="p-3.5 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[#2C362B]">{t.title}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                              testItem.result === 'good'
                                ? 'bg-[#4B6344] text-white'
                                : testItem.result === 'needs_fix'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#E5E7EB] text-[#5D6B58]'
                            }`}
                          >
                            {testItem.result === 'good' ? '잘 작동함' : testItem.result === 'needs_fix' ? '수정 필요' : '미평가'}
                          </span>
                        </div>
                        {testItem.note && (
                          <p className="text-amber-800 text-[11px] bg-amber-50 p-2 rounded-xl border border-amber-200 mt-1.5">
                            메모: {testItem.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {(student.step8?.problemDescription || student.step8?.revisionNote) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                    <span className="font-bold text-amber-900 block mb-1">테스트 중 발견한 문제점</span>
                    <p className="text-[#2C362B] whitespace-pre-wrap leading-relaxed">{student.step8.problemDescription || '(없음)'}</p>
                  </div>
                  <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl">
                    <span className="font-bold text-[#4B6344] block mb-1">프롬프트 수정한 내용 및 방향</span>
                    <p className="text-[#2C362B] whitespace-pre-wrap leading-relaxed">{student.step8.revisionNote || '(없음)'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Submission */}
          {activeTab === 'submission' && (
            <div className="space-y-4">
              {student.step10?.gemUrl ? (
                <div className="p-4 bg-[#F1F4EF] border border-[#DCE2D7] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-[#4B6344] font-semibold block">제작한 Gemini Gem 공유 링크</span>
                    <a
                      href={student.step10.gemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-[#4B6344] hover:underline flex items-center gap-1 break-all mt-0.5"
                    >
                      <span>{student.step10.gemUrl}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                  <span className="text-xs text-[#4B6344] bg-white px-3 py-1 rounded-xl border border-[#DCE2D7] font-medium shrink-0 self-start sm:self-auto">
                    {student.step10.submittedAt ? new Date(student.step10.submittedAt).toLocaleString() : '제출됨'}
                  </span>
                </div>
              ) : (
                <div className="p-6 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl text-center text-[#6B7280]">
                  아직 최종 Gem 링크가 제출되지 않았습니다.
                </div>
              )}

              {/* Sample Dialogues */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#2C362B] text-sm">대표 질문과 답변 기록</h4>
                {[
                  { q: student.step10?.sampleQuestion1, a: student.step10?.sampleAnswer1, num: 1 },
                  { q: student.step10?.sampleQuestion2, a: student.step10?.sampleAnswer2, num: 2 },
                  { q: student.step10?.sampleQuestion3, a: student.step10?.sampleAnswer3, num: 3 },
                ]
                  .filter((item) => item.q || item.a)
                  .map((item) => (
                    <div key={item.num} className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#4B6344]">
                        <MessageSquare className="w-3.5 h-3.5 text-[#4B6344]" />
                        <span>대표 질문 {item.num}: {item.q || '(질문 미작성)'}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-[#E1E4D8] text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                        {item.a || '(답변 미작성)'}
                      </div>
                    </div>
                  ))}
              </div>

              {student.step10?.revisionSummary && (
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <h4 className="font-bold text-[#2C362B] text-sm">수정 내용 요약</h4>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                    {student.step10.revisionSummary}
                  </p>
                </div>
              )}

              {student.step10?.reflection && (
                <div className="p-4 bg-[#F9FAF8] border border-[#E1E4D8] rounded-2xl space-y-1.5">
                  <h4 className="font-bold text-[#2C362B] text-sm">진로 프로젝트 제작 소감</h4>
                  <p className="text-[#5D6B58] leading-relaxed whitespace-pre-wrap">
                    {student.step10.reflection}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
