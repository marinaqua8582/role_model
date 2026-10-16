# 최종배포결과

2026-10-09, 한국 시각. **staging 실패 / production 배포 보류**.
파일명 role_model_운영최종본.zip은 요청한 결과물 이름입니다. 운영 배포 또는 25명 성능 검증 완료를 뜻하지 않습니다.

## 502 진단: 확정된 사실과 미확정 사항

- 이전 시험 시작 502: 당시 진단 로그가 없으므로 정확한 upstream 상태·예외는 소급 확정할 수 없습니다. GAS 세션 생성 완료와 Vercel 502만 확인됐습니다.
- 이번 진단 Preview의 단독 시작 요청은 HTTP 200으로 정상 세션을 반환했습니다. correlation ID가 확인된 요청의 클라이언트 응답시간은 4.106초, upstream 응답 수신은 3.444초였습니다. Content-Type은 application/json, 응답은 266바이트, 최종 호스트는 Google Apps Script 계열입니다. 시작·종료 모두 정상 확인했습니다.
- 실제 25명 로그인에서 **4건은 Google 계열 최종 호스트의 HTTP 404 / text/html을 수신한 후 API가 502를 반환**했습니다. 수신까지 34.29~37.91초였습니다. JSON 파싱 이전의 upstream HTTP 실패라는 직접 원인은 확정됐습니다.
- **6건은 upstream fetch에서 약 45.005초에 TimeoutError**가 발생하여 504를 반환했습니다.
- Google 내부에서 왜 404가 발생하는지, 리디렉션의 어느 경로에서 지연되는지, 과거 시작 502와 동일 원인인지까지는 확정하지 못했습니다. 인증·할당량·GAS 동시 실행 제한 때문이라고 단정하지 않습니다. GAS 실행 목록에서는 동시 doPost 완료와 이후 doGet 실행도 관찰됐지만, 요청 단위로 연결할 자료가 없으므로 이를 원인으로 확정하지 않습니다.

## 최소 변경

변경 파일은 api/staging-performance.ts, tests/staging-diagnostics.test.cjs, tests/run.cjs 세 개입니다.
임의 correlation ID, 단계명, HTTP 상태, 허용 목록으로 정규화한 Content-Type, Google 계열 호스트 여부, JSON 응답 바이트 수, 단계 소요시간, 정규화한 예외 이름·오류 종류만 기록합니다. 응답 본문·전체 GAS URL·비밀번호·토큰·Authorization·요청 payload·학생 정보·시트 ID는 로그에 기록하지 않습니다. 상관관계 ID를 응답 헤더에도 제공합니다.
성공 HTTP 응답은 본문을 한 번 읽고 JSON으로 해석합니다. non-2xx 응답은 본문을 읽지 않으므로 해당 응답 크기는 미측정입니다.
로그 안전성 및 upstream 자동 재시도 미발생 테스트 2개를 추가했습니다. 기존 173개 테스트를 제거하지 않았습니다.
원인에 대한 근거가 부족하므로 timeout 증가, 리디렉션 재시도, startAttemptId/세션 복구 등 추가 수정은 하지 않았습니다. 진단 후 원인 수정은 0회입니다. 시험 실패 뒤 추가 수정·재시험을 하지 않았습니다.
두 GAS 소스, 학생 인증·로그인 정책, 본인 전체 Google ID 표시, receipt 정리 조건, 요청 ID, 전역 잠금, 중복 행 방지, staging 토큰, batch 기본 비활성 정책은 변경하지 않았습니다.

## 실제 실행한 검증

| 명령 | 로컬 | staging Preview 원격 환경 |
|---|---|---|
| npm run lint | 성공 | 성공 |
| npm test | 175개 통과, 실패 0 | 175개 통과, 실패 0 |
| npm run build | **실패: spawn EPERM** | **성공**, Vite 기본 build 5.67초 |

원격 staging 전용 프로젝트의 buildCommand를 npm run lint && npm test && npm run build로 설정하여 실제 실행했습니다. Preview는 Ready입니다. 대체 build:sandbox를 production build 성공으로 간주하지 않았습니다. 이번 요청에서는 npm ci를 재실행하지 않았으며, 최신 ZIP의 정상 환경 ci 성공은 사용자 제공 이력입니다. 로컬 검증은 기존 workspace 의존성을 사용했습니다.
검증 Preview ID: dpl_5dRFvWJShEMEwZsrhnSJYVoCyTLY.
시험 URL: https://staging-role-model-synthetic25-20261009.vercel.app
이는 새 별도 staging 프로젝트의 Preview alias이며 기존 운영 Vercel과 연결되지 않았습니다.

## 실제 합성 학생 25명 시험 1회

별도로 만든 빈 테스트 Sheets, 테스트 GAS 버전 1, 별도 Vercel Preview만 사용했습니다. Roster에는 합성 학생 25명만 존재하며 batch는 기본 비활성 상태입니다. 실제 학생 자료를 fixture에 넣거나 운영 시트를 접근하지 않았습니다.
시험 시작·사전 스냅샷 후 25개 로그인 요청을 동시에 실행했습니다. **로그인 실패 즉시 후속 저장 시험을 진행하지 않았습니다.** 새로운 run ID로 실패 요청을 재시도하지 않았습니다.

| 항목 | 요청 / 성공 | 평균 | p50 | p95 | 최대 | timeout | 잠금 실패 |
|---|---|---|---|---|---|---|---|
| 로그인 | 25 / 15 (60%) | 22.743초 | 12.276초 | 46.005초 | 46.041초 | 6 | 응답받은 15건에서 0 |
| Progress 신규·기존 저장 | 미실행 | N/A | N/A | N/A | N/A | N/A | N/A |
| Tests 신규·기존 저장 | 미실행 | N/A | N/A | N/A | N/A | N/A | N/A |
| Submissions 신규·기존 저장 | 미실행 | N/A | N/A | N/A | N/A | N/A | N/A |
| 동일 요청 반복·응답 유실·취소 지연 저장 | 미실행 | N/A | N/A | N/A | N/A | N/A | N/A |

로그인 시간은 실패·timeout까지 포함한 25건의 클라이언트 실측입니다. 4건 502와 6건 504가 발생했습니다. 성공 응답 15건만의 GAS 측 계측은 다음과 같습니다.

| GAS 지표 (15건) | 평균 ms | p50 ms | p95 ms | 최대 ms |
|---|---:|---:|---:|---:|
| lockWaitMs | 0 | 0 | 0 | 0 |
| lockHeldMs | 0 | 0 | 0 | 0 |
| sheetWriteMs | 0 | 0 | 0 | 0 |
| flushMs | 0 | 0 | 0 | 0 |
| totalMs | 4459.87 | 4440 | 6209 | 6209 |

로그인은 읽기 요청이므로 잠금·쓰기 지표가 0입니다. **25명 저장의 잠금 성능을 검증한 결과가 아닙니다.** 실패 10건의 GAS 지표는 응답받지 못해 N/A입니다.

## 데이터 및 세션 안전 확인

- 시험 전: Progress/Tests/Submissions 각각 데이터 행 0, 중복 0, 외부 행 0.
- 시험 후 테스트 GAS의 fixture 검사: 세 저장 시트 각각 행 0, 중복 0, 외부 행 0, synthetic marker 및 전용 시트 일치 확인.
- 학생 저장 요청은 0건이므로 실제 잘못된 행 갱신은 발생하지 않았지만, 저장 후 정합성·중복 방지·취소 지연 차단·응답 유실 후 자동 재저장 시험은 **미검증**입니다. 이를 통과로 세지 않습니다.
- 수신한 응답 29개에서 타 학생 Google ID 노출은 0건으로 관찰됐습니다. 25명 모두의 정상 로그인 및 브라우저 표시 확인은 실패 때문에 미완료입니다.
- 시험 세션 종료 성공, 종료 토큰의 재사용 차단 확인. 자동 로그인 재시도·자동 저장·불명확한 시작 재요청을 실행하지 않았습니다.
- 운영 학생 이름·Google ID·답변을 읽거나 변경하지 않았습니다.

## receipt 트리거 실제 상태

02:04:40~02:04:42 테스트 GAS에서 getSaveReceiptCleanupStatus를 실행하여 확인했습니다.
visibleTriggers=1, registered=true, installed=true, intervalMinutes=5, unmanagedVisibleTriggers=0, receiptCount=0.
최근 자동 정리 실행: 02:04:25 한국 시각. success=true, statusRecorded=true, deleted=0, remaining=0, protectedPending=0, protectedUnknownState=0, invalidExpiresAt=0, malformed=0, deferredExpired=0.
정리 트리거 설치·주기 및 자동 실행은 확인됐습니다. 실제 저장 receipt가 생성되는 부하 상황의 정리는 저장 시험 미실행으로 검증하지 못했습니다.

## 운영 반영 및 롤백

**production 배포: 미실행 / 보류.** 성공률 100%, timeout 0 조건을 충족하지 못하여 운영 작업으로 넘어가지 않았습니다.
운영 Git commit·GAS 코드·배포 버전·Vercel 롤백 대상 백업, 운영 시트 구조·행 개수 조회는 미실행입니다. 운영 GAS·receipt 트리거·운영 환경변수·운영 Vercel·GitHub production branch는 변경하지 않았습니다. GitHub commit/push 및 production 배포 ID는 새로 생성하지 않았습니다.
김진로 로그인·STEP 1 복원·STEP 10 제출 상태·3-1-26 키·중복·관리자 대시보드 확인은 **미실행**입니다. 운영 접근 조건이 성립하지 않았기 때문입니다.
운영 변경이 없어 rollback 필요는 없습니다. 운영 상태가 정상이라고 새로 검증했다는 뜻은 아닙니다.
staging 환경변수는 이번 실패 후 추가 배포를 중단하여 아직 비활성 배포하지 않았습니다. 시험 세션은 종료됐고 토큰 재사용은 차단됐지만, 관리자 시작 비밀값을 가진 주체의 시험 API는 배포상 남아 있습니다. 추가 작업 전 폐쇄 또는 재승인한 시험 계획이 필요합니다.
이전 환경 구성에서 새 staging 전용 프로젝트 첫 배포가 Vercel에 의해 production target으로 자동 지정된 이력은 있습니다. 해당 별도 프로젝트 production 환경에는 GAS 연결 변수가 없고 시험에 사용하지 않았습니다. 기존 운영 프로젝트의 production 배포가 아닙니다. 이번 변경·시험은 명시적 Preview에서만 실행했습니다.

## 남은 문제와 배포 조건

남은 문제: Google upstream 404와 응답 지연/timeout의 내부 원인 미확정, 25명 로그인 실패, 모든 저장 부하·중복·취소·응답 유실·운영 읽기 확인 미실행. 추측에 따른 한 번 더의 코드 수정이나 부하 재시험은 하지 않았습니다.
production을 허용하려면 별도 승인한 후속 조치로 upstream 실패 원인을 확인하고 최소 수정의 근거를 확보한 뒤, 합성 25명 전체 항목이 성공률 100%, timeout·잠금 실패·중복·오학생 갱신·자동 재저장·취소 지연 반영·타인 ID·외부 실제 자료 모두 0이며 모든 저장 계측이 수집돼야 합니다. 그 전에는 운영 반영을 보류해야 합니다.
이번 ZIP에는 비밀값·로컬 환경 파일·Vercel 인증 파일·node_modules·빌드 출력·실측 응답 원문을 포함하지 않았습니다. 최신 사용자 ZIP의 소스를 기준으로 진단 코드와 추가 테스트만 반영했습니다.
