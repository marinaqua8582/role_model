> 후속 점검의 최신 판단은 PERFORMANCE_FOLLOWUP.md입니다. 기본 build/정상 ci와 실제 staging은 미검증이며 production 배포를 보류합니다.

# 동시 접속 성능 개선 결과

기준: marinaqua8582/role_model, main 커밋 a377fe6c5e7e9c9d0ea9835cad5337d7064c1fb0. 작업일: 2026-10-08, Asia/Seoul.

소스를 직접 수정하여 로컬에서 검증했습니다. 운영 앱과 운영 Google Sheets를 대상으로 테스트하지 않았고, 실제 학생 계정·데이터를 사용하거나 production에 배포하지 않았습니다. GitHub에 push/PR/merge를 실행하지 않았습니다. 전달 ZIP과 patch를 검토하여 적용할 수 있습니다.

## 1. 실제 확인된 병목과 변경

- GAS handleRequest는 옵션/관리자 설정 확인을 제외한 요청을 ScriptLock으로 감쌌습니다. 로그인·진행 조회·관리자 대시보드까지 학생 저장과 대기했습니다. 읽기는 잠금에서 제외했고 쓰기 잠금 대기는 20초에서 2.5초로 제한했습니다.
- 저장 인증은 Roster와 Progress/Tests/Submissions/(존재하면 Counseling)을 검색하고 저장 함수가 다시 같은 시트를 읽었습니다. 요청 안에서 읽은 자료/헤더를 재사용하며, 변경된 시트 자료만 무효화합니다.
- 기존 로그인은 이미 인증·본인 Google ID·진행/제출 상태를 한 요청으로 반환했습니다. 불필요하게 새 로그인 프로토콜을 추가하지 않았습니다.
- 옵션 요청은 proxy 실패 → 브라우저 GAS 직접 호출 → /api/roster/options → 로컬 명단 fallback 구조였습니다. 직접 호출과 이중 fallback을 제거했습니다. getRosterOptions는 동일 출처 /api/gas-proxy 한 경로를 사용합니다.
- 단계 버튼의 STEP1–7 다음은 기존에도 정상 상황 1회였습니다. 이전/상단/점프 이동은 답변 저장 후 단계 번호를 따로 저장하여 2회, STEP8·9 다음도 각 전용 저장 후 단계 번호 저장으로 2회였습니다. 각각 1회로 통합했습니다.
- 관리자 latestTable_는 학생마다 전체 시트를 다시 읽었습니다. 같은 테이블을 재사용하여 25명 fixture에서 대시보드 getValues가 237회에서 4회로 감소했습니다.
- 첫 화면 JS에 단계 화면, 관리자 화면, XLSX와 GAS 코드 템플릿이 모두 들어갔습니다. React.lazy/Suspense로 분리하여 첫 진입 JS를 약 1,111.40KB(압축 312.30KB)에서 313KB(압축 약 93KB)로 줄였습니다. 이는 분리 직전/직후 빌드 비교이며, upstream의 실제 배포 번들 실측은 아닙니다.

## 2. 수정 전후 요청 흐름

정상 성공 요청 기준이며, 재시도 시 최대 1회 추가됩니다. JS/CSS chunk 다운로드는 아래 API 수와 별도입니다.

| 사용자 동작 | 프런트 함수 | Vercel API / GAS action | 수정 전 → 수정 후 |
|---|---|---|---|
| 첫 화면, 학생 세션 없음 | App checkAdminSession, StudentAuth getRosterOptions | GET /api/admin/session 및 POST /api/gas-proxy / getRosterOptions | 정상 2 → 2. StrictMode 등 중복 옵션 호출은 합치며, 같은 SPA 세션 30초 내 재사용 시 옵션 API는 0 |
| 학년·반·번호 선택 | handleGradeChange / handleClassChange / handleNumberChange | 없음 | 0 → 0, 이미 받은 숫자 옵션으로 처리 |
| 학생 로그인 | handleVerify → verifyStudentAuth | POST /api/gas-proxy / verifyStudent | 1 → 1. 이전 학생의 유효 토큰이 있으면 logoutStudent 1회가 별도로 필요 |
| 로그인 직후 진행 복원 | verifyStudentAuth / mapFullStudentDetail | verifyStudent 응답 사용 | 추가 0 → 0 |
| 브라우저 새로고침 후 이어하기 | App fetchStudentProgress → loadStudentProgress | /api/gas-proxy / loadProgress | 1 → 1, admin session 확인은 별도 |
| 단계 저장, STEP1–6 | saveStepNProgress → saveProgressPayload | /api/gas-proxy / saveProgress | 1 → 1. 동일 payload 처리 중 합침 |
| STEP1–7 다음 | 컴포넌트 저장 → navigateStep(saved=true) | saveProgress | 1 → 1, 저장 성공을 기다려 이동 |
| 이전·상단·이미 열린 단계 점프 | navigateStep → saveCurrentStudentStep | 현재 단계의 saveProgress/saveTests/updateRevision | 통상 2 → 1. STEP7/10 메타데이터 이동은 원래부터 1 |
| STEP8 다음 | saveTests → navigateStep(saved=true) | saveTests, 서버에서 Progress 단계도 함께 갱신 | 2 → 1 |
| STEP9 다음 | updateRevision → navigateStep(saved=true) | updateRevision, 서버에서 Progress/Tests 갱신 | 2 → 1 |
| 최종 제출 | Step10 handleSubmit → submitFinal | submitFinal | 1 → 1, 반복 제출은 같은 Submissions 행 갱신 |
| 관리자 대시보드 | 로그인 성공 후 loadAdminData → fetchAdminOverview | GET /api/admin/dashboard / getAdminDashboard | 1 → 1, 전체 시트 재검색 제거·요약 반환 |
| 관리자 학생 상세/인쇄 | fetchStudentDetail | GET /api/admin/student-detail / getStudentDetail | 선택한 학생별 1. 인쇄 상세 실패는 불완전한 요약 출력 대신 재시도 안내 |

학생 화면은 관리자 통계 API를 호출하지 않습니다. 첫 화면의 관리자 세션 확인은 통계 조회와 다릅니다. 별도의 /api/student/save-step 이중 저장이나 입력할 때마다 자동 서버 저장은 현재 코드에서 발견되지 않았습니다. 입력은 로컬 상태에만 반영하며 debounce 저장을 새로 추가하지 않았습니다.

## 3. Google Sheets 작업 횟수 전후

테스트 전용 메모리 시트에 가상 학생 25명과 Progress/Tests/Submissions 자료를 만들어 각 action 1회를 비교했습니다. 아래는 getValues/setValues/appendRow 논리 호출 수이며 SpreadsheetApp의 실제 네트워크 시간/내부 배치 횟수는 아닙니다. 헤더 생성 비용은 fixture 준비 단계에서 제외했습니다.

| action | getValues 호출 | 읽은 셀 | 전체 테이블 읽기 | 쓰기 호출 | ScriptLock 획득 |
|---|---:|---:|---:|---:|---:|
| options | 3 → 2 | 140 → 80 | 1 → 0 | 0 → 0 | 0 → 0 |
| optionsWarm | 3 → 0 | 140 → 0 | 1 → 0 | 0 → 0 | 0 → 0 |
| login | 4 → 12 | 2028 → 306 | 4 → 0 | 0 → 0 | 1 → 0 |
| load | 4 → 12 | 2028 → 306 | 4 → 0 | 0 → 0 | 1 → 0 |
| save | 20 → 13 | 3307 → 341 | 5 → 0 | 4 → 3 | 1 → 1 |
| tests | 32 → 14 | 4592 → 356 | 8 → 0 | 6 → 5 | 1 → 1 |
| revision | 46 → 19 | 7707 → 521 | 11 → 0 | 10 → 7 | 1 → 1 |
| submit | 33 → 14 | 5894 → 364 | 9 → 0 | 5 → 4 | 1 → 1 |
| dashboard | 237 → 4 | 53302 → 2028 | 79 → 4 | 0 → 0 | 1 → 0 |

로그인은 getValues 횟수가 **4 → 12로 증가**합니다. 대신 전체 학생의 답변을 읽지 않고 식별 열과 해당 학생 행만 읽어 셀 수는 **2,028 → 306**개로 줄었습니다. Apps Script에서는 호출 자체의 지연도 크므로 실제 로그인 지연 개선을 보장하지 않습니다. 로그인/조회가 더 이상 저장 전역 잠금을 기다리지 않는 효과는 따로 있습니다. 이를 숨기지 않고 실제 테스트 환경 검증 대상으로 남깁니다.

- Roster 옵션은 헤더와 식별 열만 읽습니다. 이름/Google ID는 옵션 응답·옵션 캐시에 들어가지 않습니다.
- 학생 요청은 식별 열을 인접한 범위로 묶어 읽고, 대상 행과 같은 학생의 기존 중복 행만 읽습니다. 열 이름/기존 별칭과 학생키 표준화를 유지합니다.
- 행 번호 영구 캐시는 도입하지 않았습니다. 매 요청에서 식별 열을 확인하므로 행 삽입·삭제로 오래된 행 번호가 다른 학생을 덮어쓰는 위험이 없습니다.
- 기존 동일 학생 중복 행의 최신 행 선택·복원 규칙과 신원 충돌 차단은 유지합니다. 기존 중복 행을 삭제하거나 정리하는 기능을 자동 실행하지 않습니다.
- 저장은 변경 셀, writtenFields, stepData, 소유자 정보를 합쳐 기록합니다. 떨어진 열과 교사 수식/알 수 없는 열은 덮어쓰지 않기 위해 여러 setValues 범위를 사용할 수 있습니다. 따라서 “API 1회”가 “항상 setValues 1회”라는 뜻은 아닙니다.
- initSheetsIfNeeded는 기본 시트가 없을 때만 호출합니다. 정상 시트의 열 순서를 바꾸거나 자료를 초기화하지 않습니다. 기존 시트 없는 신규 환경의 자동 생성 경로는 이번 운영 데이터에서 실행하지 않았습니다.

원자료: sheet-work-results.json. 재현 스크립트: tests/measure-sheet-work.cjs.

## 4. 캐시, 잠금과 재시도 정책

옵션 캐시는 브라우저 모듈 메모리 30초 및 GAS CacheService 45초입니다. GAS 캐시는 여러 Vercel 인스턴스가 공유하며 공개 CDN에 개인정보를 보관하지 않는 장점 때문에 선택했습니다. 이름/계정 없이 숫자 옵션만 저장합니다. 관리자 명단 수정/삭제 성공 후 GAS 캐시와 해당 브라우저 옵션 캐시를 무효화합니다. Sheets를 직접 편집하면 GAS 옵션은 최대 약 45초, 이미 열린 화면은 다음 옵션 요청 때 갱신됩니다. 브라우저 새로고침 뒤에는 Vercel 요청이 다시 발생할 수 있습니다.

관리자 요약은 개인정보 캐시를 추가하지 않았습니다. 테이블 재사용과 요약 반환으로 처리량을 줄이고 새로고침은 항상 다시 조회합니다. 학생·관리자 응답 모두 Cache-Control: no-store를 설정했습니다. CacheService의 기존 학생 세션 토큰 저장 방식은 인증 기능이므로 유지했습니다.

전역 잠금은 모든 쓰기 요청(명단 수정 포함)에 유지합니다. 잠금은 시트 초기화가 필요할 때의 확인, 신원 확인, 최신 중복행 선택, 여러 범위/시트 쓰기와 flush를 포함합니다. 기존 행도 stepData/writtenFields의 읽기-수정-쓰기와 Tests/Progress 동시 변경이 있어 잠금을 단순 제거하면 동일 학생의 다른 요청과 관리자 명단 변경 사이에 손실·신원 충돌이 생길 수 있습니다. GAS에는 학생별 키 잠금을 직접 제공하는 LockService API가 없어 이번 변경은 다른 학생의 기존 행 쓰기를 완전히 병렬화하지 않습니다. 외부 API 호출은 GAS 잠금 안에 없으며 긴 관리자 읽기는 잠금에서 제외했습니다.

잠금 대기는 2.5초로 제한하고 실패하면 명확한 재시도 메시지를 반환합니다. 데이터 검증 실패 응답은 자동 재시도하지 않습니다. 잠금 자체의 운영 대기 시간이 줄었다고 실측한 것은 아닙니다.

클라이언트는 동일 요청의 in-flight Promise를 공유하며, HTTP 429/500/502/503 및 fetch 네트워크 실패만 250–600ms jitter 후 최대 1회 재시도합니다. 400/401/403/404/422, 앱 검증 실패, abort/timeout, 504는 자동 재시도하지 않습니다. 제출도 동일 행 갱신과 쓰기 잠금으로 멱등성을 유지합니다. 프록시 GAS 응답 제한은 8초, 브라우저 단일 요청은 최대 9초, 재시도를 포함한 요청 예산은 약 9.5초입니다.

타임아웃은 GAS 작업 중단을 보장하지 않습니다. 늦은 쓰기가 끝날 수 있으므로 성공으로 표시하지 않고 자동 재시도도 하지 않습니다. 실제 운영에서 이 경우를 관찰하면 서버에 요청 버전/멱등키를 저장하는 추가 설계가 필요합니다. 여러 시트 쓰기는 트랜잭션이 아니므로 부분 쓰기 실패 후에는 동일 학생·동일 자료로 재시도해야 합니다.

8초 이상 처리 중에는 지연 안내를 표시합니다. 버튼 처리 중 비활성화, ref 중복 클릭 차단, 세션 세대 검증, 옵션 effect unmount 정리, 관리자 상세 요청 번호 검증을 적용했습니다. 마지막 서버 응답의 저장 시각을 유지합니다. 서버 성공 전에 이동하거나 저장 완료로 표시하지 않습니다.

## 5. 25명 동시 테스트 결과

환경: Windows 로컬 Node v24.19.0, loopback HTTP 서버, 실제 src/api/client.ts, 실제 GAS 스크립트를 vm에서 실행하는 Sheets/Cache/Lock 모형. 모든 이름/Google ID는 example.invalid의 합성 자료입니다. 지연은 정상 5ms, 오류 시나리오 120ms를 주입했습니다. 가상 스프레드시트 함수는 하나의 JS 실행 스레드에서 동기적으로 실행됩니다. **GAS 런타임의 진짜 동시 실행, 서비스 지연, lock 경합 또는 cold start를 측정한 부하 테스트가 아닙니다.**

| 시나리오 | 성공 | 평균 ms | p50 ms | p95 ms | 최대 ms | API 수 | timeout |
|---|---:|---:|---:|---:|---:|---:|---:|
| options-cold | 25/25 | 54.63 | 54.73 | 56.97 | 57.11 | 25 | 0 |
| options-warm | 25/25 | 0.1 | 0.1 | 0.17 | 0.2 | 0 | 0 |
| login | 25/25 | 117.76 | 117.76 | 121.36 | 121.59 | 25 | 0 |
| save-25 | 25/25 | 184.75 | 184.74 | 185.01 | 185.07 | 25 | 0 |
| rapid-identical-save | 25/25 | 151.52 | 151.59 | 154.36 | 154.72 | 25 | 0 |
| submit-25 | 25/25 | 197.81 | 197.75 | 198.43 | 198.48 | 25 | 0 |
| submit-repeat | 25/25 | 222.56 | 222.36 | 223.66 | 223.75 | 25 | 0 |
| delayed-503-retry | 25/25 | 642.6 | 588.79 | 865.78 | 866.45 | 30 | 0 |

전체 200개 사용자 동작 성공 200/200(100%), 최종 실패 0, timeout 0. 실제 HTTP 요청 180건 중 4xx 0, 5xx 5(의도한 503 주입). 5xx 5개는 5회의 추가 요청으로만 복구했습니다. 동일 학생 버튼 10번 호출은 학생당 API 1회, 25명 합계 25회입니다. 진행/제출 중복 행 0건, 다른 학생 자료 덮어쓰기 0건입니다.

서버 시간을 모형화한 수치이므로 p95 5초 목표가 운영에서 달성됐다고 결론 내리지 않습니다. 안전한 별도 GAS/Sheets 테스트 환경에서 cold/warm 25명 실측이 남습니다.

## 6. 실행 방법과 안전장치

압축을 풀거나 patch를 기준 커밋에 적용한 뒤:

```powershell
npm ci
npm run lint
npm test
npm run build

# 외부 프로세스 실행이 차단된 환경에서의 대체 빌드 검증
npm run build:sandbox

# loopback 모형 테스트만 허용. :0은 사용 가능한 로컬 포트를 선택합니다.
$env:PERF_TARGET_URL = 'http://127.0.0.1:0/'
$env:PERF_RESULT_FILE = 'performance-results.json'
npm run test:performance

# 현재 코드의 Sheets 논리 작업량 측정
$env:PERF_RESULT_FILE = 'sheet-work-results.json'
node tests/measure-sheet-work.cjs
```

테스트 대상 URL이 없으면 실행을 거부합니다. 정확한 127.0.0.1 또는 ::1의 HTTP만 허용하고 localhost/DNS/HTTPS/production 주소/자격증명 포함 URL을 차단합니다. 전용 모형 서버를 직접 띄워 marker를 확인하므로 운영 Vercel/GAS로 데이터를 전송할 경로가 없습니다. 실제 GAS/Sheets staging 부하 테스트를 이 스크립트로 실행하도록 허용하지 않았습니다.

PERF_BASELINE_SOURCE에 로컬 원본 .gs 파일 경로를 지정하면 전후 논리 작업량을 다시 비교할 수 있습니다. 테스트 코드에 원래 운영 시트나 실제 학생 명단은 포함되지 않습니다.

## 7. 회귀 검증

- 최종 npm test: 기존 회귀와 추가 정책/UI 검증 총 147개 통과, 실패 0. 마지막 클립보드 모형 보강 후 해당 테스트 묶음 9개도 다시 통과했습니다.
- npm run lint: tsc --noEmit 통과.
- npm run build: 이 실행 환경에서 esbuild child process가 spawn EPERM으로 차단되었습니다. 이 명령이 통과했다고 표시하지 않습니다.
- npm run build:sandbox: 동일 버전 esbuild-wasm 0.25.12와 React/Tailwind/Vite 프로덕션 설정으로 빌드 통과. 개발 Express 플러그인은 제외하고, symlink 없는 workspace에서 preserveSymlinks를 사용해 Windows realpath 하위 프로세스를 피했습니다. 정상 배포 환경에서는 기본 build를 다시 실행하세요.
- 학생 정상/미등록 차단, 다른 학생 접근 차단, 한국어 공백 이름/학생키 표준화, 본인 전체 Google ID 표시/복사 모형, 진행 복원, 단계 저장, 재로그인 이어하기, 제출, 반복 제출 한 행 유지, 관리자 secret 검증, 대시보드/상세, 인쇄 컴포넌트 렌더링, 명단 추가/삭제, 교사 알 수 없는 열·수식 보존, 로그아웃·늦은 응답 차단, 저장 실패 성공 표시 금지는 로컬 회귀로 확인했습니다.
- 명단 업로드의 기존 XLSX 파서/관리자 UI를 변경하지 않았습니다. 실제 브라우저 파일 선택 업로드, OS 클립보드, 인쇄 대화상자, 모바일 실기기와 실제 Vercel 쿠키 인증은 이번 테스트에서 실행하지 않았습니다.
- 생성 bundle에 합성 학생 fixture 및 원래 배포 URL 식별자가 없고, DEFAULT_ROSTER는 빈 배열입니다. 실제 학생 명단 자체에 접근하지 않았으므로 모든 실제 개인정보와 대조한 스캔은 할 수 없습니다. index.html의 translate=no 및 google notranslate는 유지됐습니다.
- production 입력 환경변수 GAS_URL/ADMIN_PASSWORD/ADMIN_API_SECRET가 번들에 주입되는 코드는 없습니다. VITE_GAS_URL 사용을 제거하고 관리자 연동 화면의 브라우저 URL 저장 안내를 서버 환경변수 안내로 바꿨습니다.

## 8. 변경 파일

| 파일 | 주요 변경 |
|---|---|
| GoogleAppsScript.latest.gs | 숫자 옵션 45초 캐시, 식별 열/본인 행 읽기, 요청 테이블 재사용, 변경 셀/metadata 묶음 쓰기, 대시보드 반복 검색 제거, 요약 응답, 쓰기 전용 bounded lock |
| src/utils/gasScriptTemplate.ts | 독립 GAS 파일과 정확히 동기화, 기존 관리자 코드 복사 유지 |
| src/api/client.ts | same-origin 단일 경로, 제한 재시도/timeout, 요청·로그인 dedup, 숫자 옵션 메모리 캐시, 캐시 무효화, 서버 저장 시각, 브라우저 GAS URL 제거, 로그 내용 제한 |
| src/App.tsx | 이전/점프/STEP8·9 이동 저장 통합, 8초 안내, 서버 저장 시각, 화면 lazy loading, 상세 늦은 응답 방지, 인쇄 상세 실패 안내 |
| src/components/student/StudentAuth.tsx | 옵션 오류 다시 시도, 로그인 ref 중복 클릭 및 unmount 보호 |
| src/components/student/Step8ChatbotTest.tsx | 저장과 다음 단계 번호 통합, ref 중복 클릭, onNext(saved) |
| src/components/student/Step9PromptRevision.tsx | 수정 저장과 다음 단계 번호 통합, ref 중복 클릭, onNext(saved) |
| src/components/student/Step10Submission.tsx | 제출 same-tick 중복 클릭 차단 |
| src/components/admin/AdminGasIntegration.tsx | 서버 GAS_URL 설정 안내, 실제로 동작하지 않던 브라우저 URL 등록 제거 |
| api/gas-proxy.ts | 허용 action 목록, no-store, 8초 timeout, upstream URL/error body 비노출 |
| api/_lib.ts | 서버 GAS_URL만 사용, 8초 timeout, non-JSON 응답 내용 비노출 |
| api/admin/dashboard.ts | no-store, 민감 오류 로그 제거 |
| api/admin/student-detail.ts | no-store, 민감 오류 로그 제거 |
| api/admin/update-roster.ts | no-store, 민감 오류 로그 제거 |
| api/admin/delete-roster.ts | no-store, 민감 오류 로그 제거 |
| api/admin/login.ts | no-store |
| api/admin/logout.ts | no-store |
| api/admin/session.ts | no-store |
| server.ts | 개발 서버의 학생 proxy를 Vercel과 동일 handler로 통일, /api no-store, 민감 오류 로그 제거 |
| .env.example | 실제 GAS URL/예시 비밀값 제거, 서버 전용 변수 안내 |
| package.json, package-lock.json | 실행 스크립트, sandbox build용 esbuild-wasm, 검증한 의존성 고정 |
| tests/mock-runtime.cjs | 합성 25명 Sheets/Cache/Lock 모형과 작업량 계측 |
| tests/mock-client.cjs | 실제 client.ts를 독립 세션 vm에서 실행 |
| tests/performance-target.cjs | production 실행 차단 |
| tests/performance-load.cjs | 25명 HTTP 테스트, 10회 빠른 저장, 제출 멱등성, 503/지연, 지표 |
| tests/performance-policy.test.cjs | 상태별 retry/no-retry, 옵션 개인정보, login dedup, lock 실패/조회, 행 변경 안전, proxy no-store 검증 |
| tests/measure-sheet-work.cjs | 작업량 전후 비교 |
| tests/build-sandbox.cjs | child process 제한 환경 빌드와 bundle 확인 |
| tests/ui-performance.test.cjs, tests/ui-harness.cjs | 본인 ID 화면/클립보드 모형 |
| tests/read-reuse.test.cjs, tests/request-read-reuse.test.cjs, tests/save-read-reuse.test.cjs | 기존 고정 작업량 가정을 새 좁은 읽기/쓰기 정책에 맞춰 수정, 신원/중복/실패 검증 유지 |
| tests/admin-config.test.cjs, tests/client.test.cjs | 실제 timeout/retry 코드에 필요한 모형 globals |
| tests/step-navigation.test.cjs, tests/last-saved-time.test.cjs | 통합 요청과 제한 네트워크 재시도 기대값 검증 |
| tests/run.cjs | 추가 검증 등록 |
| PERFORMANCE_REVIEW.md, DEPLOYMENT_REVIEW.md | 보고서 및 최신 배포 안내 참조 |

활동 문항/STEP 내용, 학생 로그인 조건, 전체 ID 복사, 관리자 인증 조건, 시트 이름/기존 열 순서를 변경하지 않았습니다. 기존 학생 자료 삭제·초기화·자동 정리 기능을 실행하지 않았습니다.

## 9. 직접 해야 할 배포 순서

GAS 새 버전 배포와 Vercel 재배포가 모두 필요합니다. 아직 실행하지 않았습니다.

1. ZIP 또는 patch를 별도 작업 브랜치에서 검토합니다. patch는 기준 main 커밋용이며 변경이 더 있다면 먼저 충돌을 검토하세요. git apply --check role_model-performance.patch로 적용 전 확인할 수 있습니다.
2. 정상 개발/CI 환경에서 npm ci, npm run lint, npm test, npm run build를 실행합니다.
3. 기존 시트·열·자료를 그대로 두고, 별도의 가상 자료 테스트 스프레드시트와 GAS 배포를 만들어 실제 서비스 응답/동시 lock 경합/cold start를 확인합니다. 현재 제공된 부하 스크립트는 로컬 전용입니다.
4. 검토 후 기존 운영 GAS 프로젝트 코드를 GoogleAppsScript.latest.gs로 업데이트합니다. ADMIN_API_SECRET 등의 기존 스크립트 속성을 유지하고 새 버전을 기존 웹 앱 배포에 연결합니다. 불필요한 시트 초기화나 중복 정리를 실행하지 마세요.
5. Vercel에서 서버 전용 GAS_URL을 실제 배포 URL로 설정합니다. 기존 ADMIN_PASSWORD/ADMIN_API_SECRET와 GAS secret의 일치를 유지합니다. VITE_GAS_URL 및 VITE_ 접두어 비밀값을 제거합니다.
6. 프런트/Vercel API 변경을 수동 배포합니다. 기존 GAS 배포를 갱신해 URL을 유지한 경우 GAS_URL을 바꿀 필요가 없습니다.
7. 아래 수업 전 점검을 마친 뒤 사용합니다. 문제 시 이전 GAS 버전/Vercel 배포로 되돌리며 학생 시트 자료를 삭제하지 않습니다.

## 10. 수업 전 확인할 체크리스트와 남은 한계

- 운영 부하 테스트 대신 1개의 교사가 허용한 확인용 계정으로 이름·학년·반·번호 검증, 본인 전체 ID와 복사, 진행 저장→로그아웃→재로그인, 최종 제출을 확인합니다.
- 다른 학생 ID가 학생 화면/옵션 응답에 나오지 않는지, 학생/관리자 응답 no-store, 번들에 GAS_URL/secret 값이 없는지 확인합니다.
- 관리자 로그인·요약·상세·명단 업로드/추가/삭제·인쇄를 확인합니다. 원래 학생 명단 수정은 교사의 의도한 작업으로만 수행합니다.
- 모형 API에서 저장 실패/timeout 후 저장 완료 표시나 단계 이동이 없는지, 8초 지연 안내와 다시 시도 동작을 확인합니다.
- 별도 테스트 GAS에서 25명 cold/warm 평균/p50/p95/최대, lock 실패, 중복/잘못된 행을 계측합니다. 실제 warmed 로그인/저장 p95 5초 및 오류율 0%는 아직 미검증입니다.
- Sheets 직접 변경은 잠금에 참여하지 않습니다. 수업 중 외부 행 삽입/삭제나 수동 명단 교체를 동시에 실행하면 이번 구조만으로 충돌을 완전히 방지할 수 없습니다.
- 기존 중복 행을 복원하되 삭제하지 않으므로, 이미 존재하는 중복 행의 총수를 자동으로 0으로 만들지 않습니다. 테스트의 “중복 0”은 정상 fixture에서 새 중복이 생기지 않았다는 의미입니다.
- GAS ScriptLock으로 학생 쓰기는 여전히 직렬 처리됩니다. 실제 서비스 호출 지연과 2.5초 대기 제한 때문에 25명 실환경 오류 0%는 보장하지 않습니다. 더 큰 규모/지연이 확인되면 버전 기반 원자적 저장이나 큐/저장소 재설계를 별도 검토해야 합니다. 유료 서비스는 추가하지 않았습니다.
- 로그인 선택적 읽기는 셀 수를 줄이지만 호출 수를 늘립니다. 실측이 악화되면 읽기 전용 로그인에 한정해 요청 내 1회 전체 읽기 또는 Google Sheets batch read 접근과 비교해야 합니다. 이번 결과를 숨기지 않고 기록합니다.
- 로컬 메모리 시트는 실제 Google Sheets 트랜잭션이나 LockService의 프로세스 경쟁을 완전히 재현하지 않습니다. 실제 25명 학생 계정으로 검증했다고 주장하지 않습니다.
