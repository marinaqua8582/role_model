/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { StudentProgress, RosterItem, DashboardStats } from './types';
import {
  fetchRoster,
  fetchStudentProgress,
  saveStudentProgress,
  fetchAdminOverview,
} from './api/client';
import { Header } from './components/common/Header';
import { StepProgressBar } from './components/common/StepProgressBar';
import { StudentAuth } from './components/student/StudentAuth';
import { Step1RoleModel } from './components/student/Step1RoleModel';
import { Step2Purpose } from './components/student/Step2Purpose';
import { Step3Personality } from './components/student/Step3Personality';
import { Step4ResponseStyle } from './components/student/Step4ResponseStyle';
import { Step5SafetyRules } from './components/student/Step5SafetyRules';
import { Step6FinalPrompt } from './components/student/Step6FinalPrompt';
import { Step7GeminiGuide } from './components/student/Step7GeminiGuide';
import { Step8ChatbotTest } from './components/student/Step8ChatbotTest';
import { Step9PromptRevision } from './components/student/Step9PromptRevision';
import { Step10Submission } from './components/student/Step10Submission';

import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminStudentList } from './components/admin/AdminStudentList';
import { AdminStudentDetailModal } from './components/admin/AdminStudentDetailModal';
import { AdminRosterManager } from './components/admin/AdminRosterManager';
import { AdminPrintView } from './components/admin/AdminPrintView';
import { AdminGasIntegration } from './components/admin/AdminGasIntegration';

export default function App() {
  // App views
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [isPreviewStudentMode, setIsPreviewStudentMode] = useState(false);

  // Print view state
  const [studentsToPrint, setStudentsToPrint] = useState<StudentProgress[] | null>(null);
  const [printTitle, setPrintTitle] = useState('롤모델 챗봇 만들기 결과 보고서');

  // Roster & Stats
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [allStudentsProgress, setAllStudentsProgress] = useState<StudentProgress[]>([]);
  const [adminStats, setAdminStats] = useState<DashboardStats | null>(null);

  // Admin filter states
  const [adminGradeFilter, setAdminGradeFilter] = useState<number | 'all'>('all');
  const [adminClassFilter, setAdminClassFilter] = useState<number | 'all'>('all');

  // Admin modals
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentProgress | null>(null);
  const [showRosterManager, setShowRosterManager] = useState(false);
  const [showGasIntegration, setShowGasIntegration] = useState(false);

  // Student active session state
  const [currentStudent, setCurrentStudent] = useState<StudentProgress | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save debounce timer
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load of roster and localStorage session
  useEffect(() => {
    loadRoster();

    // Check if student was logged in locally
    const savedKey = localStorage.getItem('rolemodel_current_student_key');
    if (savedKey) {
      fetchStudentProgress(savedKey).then((progress) => {
        if (progress) {
          setCurrentStudent(progress);
        }
      });
    }
  }, []);

  const loadRoster = async () => {
    try {
      const data = await fetchRoster();
      setRoster(data);
    } catch (e) {
      console.error('Failed to load roster', e);
    }
  };

  const loadAdminData = async () => {
    try {
      const overview = await fetchAdminOverview();
      setAllStudentsProgress(overview.students);
      setAdminStats(overview.stats);
    } catch (e) {
      console.error('Failed to load admin overview', e);
    }
  };

  useEffect(() => {
    if (isAdminLoggedIn && isAdminView) {
      loadAdminData();
    }
  }, [isAdminLoggedIn, isAdminView]);

  // Student Authentication handler
  const handleStudentAuthenticated = (progress: StudentProgress) => {
    setCurrentStudent(progress);
    localStorage.setItem('rolemodel_current_student_key', progress.studentKey);
    setIsPreviewStudentMode(false);
  };

  const handleStudentLogout = () => {
    if (isPreviewStudentMode) {
      setIsPreviewStudentMode(false);
      setIsAdminView(true);
      return;
    }
    localStorage.removeItem('rolemodel_current_student_key');
    setCurrentStudent(null);
  };

  // Student Progress Updater: only updates local state during typing/editing,
  // persistent save to server/localStorage happens when transitioning steps or on explicit submit
  const updateProgress = (updated: StudentProgress, saveToStorage = false) => {
    setCurrentStudent(updated);
    if (isPreviewStudentMode) return; // Read-only in preview mode

    if (saveToStorage) {
      setSaveStatus('saving');
      saveStudentProgress(updated)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2500);
        })
        .catch(() => {
          setSaveStatus('error');
        });
    }
  };

  const handleStepChange = (step: number) => {
    if (!currentStudent) return;
    const updated = {
      ...currentStudent,
      currentStep: step,
      isPromptCompleted: currentStudent.isPromptCompleted || step >= 7,
      isTestCompleted: currentStudent.isTestCompleted || step >= 9,
    };
    updateProgress(updated, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalSubmit = async () => {
    if (!currentStudent) return;
    const updated: StudentProgress = {
      ...currentStudent,
      isFinalSubmitted: true,
      currentStep: 10,
      step10: {
        ...currentStudent.step10,
        submittedAt: new Date().toISOString(),
      },
    };
    updateProgress(updated, true);
  };

  // Preview student from admin
  const handlePreviewStudent = (student: StudentProgress) => {
    setCurrentStudent(student);
    setIsPreviewStudentMode(true);
    setIsAdminView(false);
    setSelectedStudentDetail(null);
  };

  // Print single student
  const handlePrintStudent = (student: StudentProgress) => {
    setStudentsToPrint([student]);
    setPrintTitle(`${student.name} 학생 롤모델 챗봇 결과 보고서`);
  };

  // Print multiple students
  const handlePrintMultiple = (students: StudentProgress[], title: string) => {
    setStudentsToPrint(students);
    setPrintTitle(title);
  };

  // 1. PRINT VIEW MODE
  if (studentsToPrint) {
    return (
      <AdminPrintView
        studentsToPrint={studentsToPrint}
        title={printTitle}
        onBack={() => setStudentsToPrint(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#2C362B] font-sans flex flex-col antialiased">
      {/* Global Application Header */}
      <Header
        currentStudent={currentStudent}
        isAdminLoggedIn={isAdminLoggedIn}
        isAdminView={isAdminView}
        saveStatus={saveStatus}
        isPreviewMode={isPreviewStudentMode}
        onOpenAdminLogin={() => setShowAdminLogin(true)}
        onToggleAdminView={() => {
          if (isPreviewStudentMode) {
            setIsPreviewStudentMode(false);
          }
          setIsAdminView(!isAdminView);
        }}
        onStudentLogout={handleStudentLogout}
      />

      {/* Admin Login Dialog */}
      {showAdminLogin && (
        <AdminLogin
          onLoginSuccess={() => {
            setIsAdminLoggedIn(true);
            setShowAdminLogin(false);
            setIsAdminView(true);
          }}
          onCancel={() => setShowAdminLogin(false)}
        />
      )}

      {/* ADMIN VIEW MODE */}
      {isAdminLoggedIn && isAdminView ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4D8] pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#2C362B]">
                진로 수업 관리자 대시보드
              </h2>
              <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
                학생들의 롤모델 챗봇 프롬프트 제작 과정 및 제출 결과를 모니터링하고 인쇄합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAdminData}
                className="px-4 py-2 bg-white hover:bg-[#F1F4EF] border border-[#E1E4D8] rounded-xl text-xs font-bold text-[#2C362B] shadow-2xs transition-colors cursor-pointer"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* Metrics Overview */}
          {adminStats && (
            <AdminDashboard
              stats={adminStats}
              selectedGrade={adminGradeFilter}
              selectedClass={adminClassFilter}
              onFilterClass={(grade, classNum) => {
                setAdminGradeFilter(grade);
                setAdminClassFilter(classNum);
              }}
            />
          )}

          {/* Student List & Batch Actions */}
          <AdminStudentList
            students={allStudentsProgress}
            roster={roster}
            selectedGrade={adminGradeFilter}
            selectedClass={adminClassFilter}
            onFilterClass={(grade, classNum) => {
              setAdminGradeFilter(grade);
              setAdminClassFilter(classNum);
            }}
            onSelectStudentDetail={(student) => setSelectedStudentDetail(student)}
            onPreviewStudentMode={handlePreviewStudent}
            onPrintStudent={handlePrintStudent}
            onPrintMultiple={handlePrintMultiple}
            onOpenRosterManager={() => setShowRosterManager(true)}
            onOpenGasIntegration={() => setShowGasIntegration(true)}
          />

          {/* Modals */}
          {selectedStudentDetail && (
            <AdminStudentDetailModal
              student={selectedStudentDetail}
              onClose={() => setSelectedStudentDetail(null)}
              onPreviewStudentMode={handlePreviewStudent}
              onPrintStudent={handlePrintStudent}
            />
          )}

          {showRosterManager && (
            <AdminRosterManager
              currentRoster={roster}
              onRosterUpdated={() => {
                loadRoster();
                loadAdminData();
              }}
              onClose={() => setShowRosterManager(false)}
            />
          )}

          {showGasIntegration && (
            <AdminGasIntegration onClose={() => setShowGasIntegration(false)} />
          )}
        </main>
      ) : !currentStudent ? (
        /* STUDENT LOGIN / AUTHENTICATION SCREEN */
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <StudentAuth roster={roster} onAuthenticated={handleStudentAuthenticated} />
        </main>
      ) : (
        /* STUDENT 10-STEP WORKFLOW SCREEN */
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Step Progress Bar */}
          <StepProgressBar
            currentStep={currentStudent.currentStep}
            onStepClick={handleStepChange}
          />

          {/* STEP 1: Role Model Information */}
          {currentStudent.currentStep === 1 && (
            <Step1RoleModel
              data={currentStudent.step1}
              isReadOnly={isPreviewStudentMode}
              onChange={(step1) =>
                updateProgress({
                  ...currentStudent,
                  step1,
                })
              }
              onNext={() => handleStepChange(2)}
            />
          )}

          {/* STEP 2: Chatbot Purpose */}
          {currentStudent.currentStep === 2 && (
            <Step2Purpose
              data={currentStudent.step2}
              roleModel={currentStudent.step1}
              isReadOnly={isPreviewStudentMode}
              onChange={(step2) =>
                updateProgress({
                  ...currentStudent,
                  step2,
                })
              }
              onNext={() => handleStepChange(3)}
              onPrev={() => handleStepChange(1)}
            />
          )}

          {/* STEP 3: Personality & Tone */}
          {currentStudent.currentStep === 3 && (
            <Step3Personality
              data={currentStudent.step3}
              isReadOnly={isPreviewStudentMode}
              onChange={(step3) =>
                updateProgress({
                  ...currentStudent,
                  step3,
                })
              }
              onNext={() => handleStepChange(4)}
              onPrev={() => handleStepChange(2)}
            />
          )}

          {/* STEP 4: Response Style */}
          {currentStudent.currentStep === 4 && (
            <Step4ResponseStyle
              data={currentStudent.step4}
              isReadOnly={isPreviewStudentMode}
              onChange={(step4) =>
                updateProgress({
                  ...currentStudent,
                  step4,
                })
              }
              onNext={() => handleStepChange(5)}
              onPrev={() => handleStepChange(3)}
            />
          )}

          {/* STEP 5: Factuality & Safety */}
          {currentStudent.currentStep === 5 && (
            <Step5SafetyRules
              data={currentStudent.step5}
              roleModel={currentStudent.step1}
              isReadOnly={isPreviewStudentMode}
              onChange={(step5) =>
                updateProgress({
                  ...currentStudent,
                  step5,
                })
              }
              onNext={() => handleStepChange(6)}
              onPrev={() => handleStepChange(4)}
            />
          )}

          {/* STEP 6: Final Prompt Generation & Confirmation */}
          {currentStudent.currentStep === 6 && (
            <Step6FinalPrompt
              data={currentStudent.step6}
              roleModel={currentStudent.step1}
              purpose={currentStudent.step2}
              personality={currentStudent.step3}
              responseStyle={currentStudent.step4}
              isReadOnly={isPreviewStudentMode}
              onChange={(step6) =>
                updateProgress({
                  ...currentStudent,
                  step6,
                  isPromptCompleted: true,
                })
              }
              onNext={() => handleStepChange(7)}
              onPrev={() => handleStepChange(5)}
              onJumpToStep={(step) => handleStepChange(step)}
            />
          )}

          {/* STEP 7: Gemini Gems Guide */}
          {currentStudent.currentStep === 7 && (
            <Step7GeminiGuide
              promptData={currentStudent.step6}
              isReadOnly={isPreviewStudentMode}
              onNext={() => handleStepChange(8)}
              onPrev={() => handleStepChange(6)}
            />
          )}

          {/* STEP 8: Chatbot 6 Tests */}
          {currentStudent.currentStep === 8 && (
            <Step8ChatbotTest
              data={currentStudent.step8}
              isReadOnly={isPreviewStudentMode}
              onChange={(step8) =>
                updateProgress({
                  ...currentStudent,
                  step8,
                  isTestCompleted: true,
                })
              }
              onNext={() => handleStepChange(9)}
              onPrev={() => handleStepChange(7)}
            />
          )}

          {/* STEP 9: Prompt Revision */}
          {currentStudent.currentStep === 9 && (
            <Step9PromptRevision
              promptData={currentStudent.step6}
              testData={currentStudent.step8}
              isReadOnly={isPreviewStudentMode}
              onChangePrompt={(step6) =>
                updateProgress({
                  ...currentStudent,
                  step6,
                })
              }
              onChangeTest={(step8) =>
                updateProgress({
                  ...currentStudent,
                  step8,
                })
              }
              onNext={() => handleStepChange(10)}
              onPrev={() => handleStepChange(8)}
            />
          )}

          {/* STEP 10: Final Submission */}
          {currentStudent.currentStep === 10 && (
            <Step10Submission
              data={currentStudent.step10}
              progress={currentStudent}
              isReadOnly={isPreviewStudentMode}
              onChange={(step10) =>
                updateProgress({
                  ...currentStudent,
                  step10,
                })
              }
              onSubmit={handleFinalSubmit}
              onPrev={() => handleStepChange(9)}
            />
          )}
        </main>
      )}

      {/* Minimal Footer */}
      <footer className="py-4 border-t border-[#E1E4D8] text-center text-xs text-[#6B7280] print:hidden">
        중학교 3학년 진로 수업 AI 도우미 | 나의 롤모델 챗봇 만들기 (Gemini Gems 프롬프트 설계 도구)
      </footer>
    </div>
  );
}
