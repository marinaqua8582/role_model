> 이전 작업 기록입니다. 최신 배포 판단은 배포전_최종점검_보고서.md 및 staging-25명-시험절차.md를 확인하세요.

# 운영 배포 전 성능·저장 안정성 추가 점검

작업일: 2026-10-08. 대상: marinaqua8582/role_model. 운영 앱/운영 Google Sheets 요청, 실제 학생 데이터 변경, production 부하 테스트, 자동 배포, push/force push는 하지 않았습니다. **지금 production 배포 준비가 완료된 상태는 아닙니다.**

## 로그인 읽기 재검토

이전 단계와 동일한 25명 합성 fixture(Progress/Tests/Submissions 모두 존재)의 실제 로컬 메서드 호출 계수입니다. 지연 시간이나 원격 성능 측정이 아닙니다.

| 방식 | getValues | batchGet | 값 읽기 호출 합계 | 읽은 셀 |
|---|---:|---:|---:|---:|
| 이전의 좁은 범위 | 12 | 0 | 12 | 306 |
| 수정본 기본 경로 | 11 | 0 | 11 | 351 |
| 명시적으로 켠 batch 경로 | 4 | 2 | 6 | 306 |
| 표 전체를 읽는 비교 방식 | 4 | 0 | 4 | 2,028 |

기본 경로는 열이 정확히 Roster의 필수 5열로 구성된 경우 이름/Google ID까지 서버에서 한 번에 읽고 메모리에서 학생을 찾습니다. 헤더 확인과 본문 읽기 2회입니다. Roster에 추가 열이나 비정상 헤더가 있으면 기존 식별 열 + 대상 행 방식을 유지합니다. 다른 학생의 이름/ID는 브라우저로 반환하지 않습니다. Progress/Tests/Submissions는 식별 열을 정규화하여 찾은 뒤 본인 행만 자세히 읽습니다. 전체 학생의 긴 답변·프롬프트를 읽지 않습니다.

각 시트의 필요한 열을 한 연속 범위로 읽거나 약 120명 표 전체를 메모리에서 검색하면 호출은 줄지만, 현재 소유권 메타데이터가 답변 열 뒤에도 존재할 수 있어 다른 학생의 답변까지 읽게 됩니다. 이 방식은 채택하지 않았습니다. TextFinder로 키를 검색하는 방식도 검색 호출 비용과 헤더/상세 호출이 남으며, 전각·공백·0으로 채운 키와 기존 별칭/레거시 식별 열의 정규화를 놓칠 수 있어 기본 경로로 채택하지 않았습니다.

선택 batch 경로는 ① 4개 시트 헤더를 batchGet 1회, ② Roster 식별 열과 3개 시트 studentKey 열을 batchGet 1회, ③ 본인 상세 행을 getValues 4회로 읽습니다. 상세 행을 SpreadsheetApp으로 읽어 기존 Date 값과 복원 로직을 유지합니다. 원격 API 오류가 생기면 12회 fallback으로 추가 부하를 만들지 않고 실패를 반환합니다. 레거시 fallback 식별 열, 본인의 중복 행, Counseling 추가 시트가 있으면 호출 수가 더 늘어납니다. 6회는 일반적인 정규화된 단일 행/4개 시트 경로의 수치입니다.

Advanced Sheets 서비스 활성화와 GAS Script Property LOGIN_BATCH_READS=enabled가 모두 있어야 선택 경로를 사용합니다. 기본은 비활성입니다. Sheets API 기본 읽기 quota는 프로젝트당 분당 300, 사용자·프로젝트당 분당 60입니다. 같은 실행 소유자에게 25명 로그인 batchGet 50회가 몰리고 조회가 이어지면 quota 위험이 있습니다. **쓰기에는 batchGet을 적용하지 않습니다.** 기본 11회는 4~6회 목표에 미달합니다. quota와 실제 staging 지연을 확인하기 전 선택 경로가 실제로 더 빠르다고 확정하지 않습니다.

추가로 다른 합성 fixture에서 120명을 검증했습니다. 기본 경로 11회/1,107셀, 선택 경로 getValues 4회 + batchGet 2회/872셀을 측정했고, 학생 응답 동등성과 다른 학생 ID 미포함을 확인했습니다. 이 fixture의 25명 수치는 347셀/302셀로 위 표와 헤더 수가 다릅니다. 수치를 섞어 비교하지 않았습니다.

위 계수는 값 읽기 메서드의 논리 호출 수입니다. getLastRow/getLastColumn/getRange 등의 메타데이터 접근, CacheService/PropertiesService, SDK 내부 batching과 실제 네트워크 왕복 수를 포함한 원격 계측이 아닙니다. 서비스 호출을 줄이라는 Google 권고는 후보 선택 근거이며, 실제 응답 시간이 빨라졌다는 증거는 아닙니다. [Google Apps Script best practices](https://developers.google.com/apps-script/guides/support/best-practices), [batchGet](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet), [Sheets API quota](https://developers.google.com/workspace/sheets/api/limits).

## 저장 잠금과 중복·부분 실패

**기존 행과 신규 행 모두 진짜 ScriptLock을 유지합니다.** 현재 저장은 소유권/중복 행 검증, stepData 및 writtenFields 병합, Progress/Tests 등 여러 시트의 변경을 수행합니다. 동일 학생의 상이한 요청이 겹치면 잠금을 없애거나 append만 잠그는 방식으로 안전한 lost-update 방지를 보장할 수 없습니다. UserLock은 학생키별 잠금이 아니며 CacheService도 원자적 mutex가 아닙니다. 다른 학생끼리 병렬 저장한다는 가짜 보장은 추가하지 않았습니다.

| 저장 경우 | 잠금 범위 | 대기 한도 | 보유 시간 |
|---|---|---:|---|
| 기존 학생 행 | 인증/신원·행 확인 → receipt → 변경 열 쓰기/관련 시트 갱신 → flush → 완료 receipt | 15초 | 실제 GAS 미측정, 이 임계 구역 전체 |
| 학생 행 없음 | 같은 범위 + 잠금 안의 최종 행 검색 및 append | 15초 | 실제 GAS 미측정, append 포함 |

이전 2.5초 대기를 15초로 바꿨습니다. 이것은 실패를 줄이기 위한 대기 정책 변경이며, 처리량이나 잠금 병목을 해결한 것은 아닙니다. 이상적으로 한 요청의 잠금 보유 시간이 T초라면 25개가 한꺼번에 도착했을 때 마지막 요청은 약 24T초를 기다립니다. T=0.2초면 4.8초, 0.5초면 12초, 1초면 24초입니다. 실제 대기는 약 15초에서 획득 실패로 끝날 수 있으며 공정한 FIFO 순서도 보장하지 않습니다. cold start/네트워크/관리자 저장은 별도입니다. 실측 T가 없어 최악 대기나 25명 성공률을 확정할 수 없습니다.

변경 열의 인접 구간만 쓰는 기존 writePatch 방식을 유지합니다. Progress/Tests 변경과 명시적 빈 값, 부분 stepData, 신원 충돌 방지, 중복 행 복원/보존을 유지했습니다. Roster 1회 읽기 감소는 쓰기 검증에도 적용됩니다. 새 영속 receipt의 Properties 호출 비용이 추가되어 임계 구역이 실제로 짧아졌는지는 미검증입니다. 표 전체 쓰기나 기존 학생/중복 행 자동 삭제는 추가하지 않았습니다. 운영 Roster 업로드의 자동 기본 행 생성은 시작 여부/대시보드/소유권 의미를 바꿀 수 있어 적용하지 않았습니다.

학생 쓰기는 요청 ID와 발행 시각이 필수입니다. ScriptProperties에 학생키·payload SHA-256·상태·완료 시각·만료 시각만 남깁니다. 이름, Google ID, 답변, 프롬프트, 토큰은 receipt나 성능 로그에 저장하지 않습니다. 같은 ID의 완료 요청은 Sheet 재쓰기 없이 완료 기록을 반환하고, 다른 payload/학생의 ID 재사용은 거절합니다. 모든 receipt 판정/생성은 전역 lock 안에서 수행합니다.

flush 이후에만 success와 완료 receipt를 기록합니다. flush 또는 중간 쓰기가 실패하면 성공 응답을 만들지 않습니다. Sheets 여러 시트 갱신은 원자적인 transaction이 아닙니다. 부분 실패는 pending/unknown으로 남겨 수동 확인이 필요합니다. 정상 처리에서 measurePerformance=true를 지정하면 lockWaitMs/lockHeldMs를 반환합니다. 실제 원격 측정은 하지 않았습니다.

receipt는 요청 발행 시각이 서버보다 2분 이상 미래이거나 10분 이상 과거면 쓰기를 거절하는 정책과 연결됩니다. purgeExpiredSaveReceipts는 재실행 가능 시간이 지난 receipt만 정리합니다. 테스트 후 5분 간격 trigger를 수동 설정하고 Properties 500KB 저장량/일일 사용량을 확인해야 합니다. live receipt를 임의 삭제하면 안 됩니다. 저장 quota가 부족하면 안전하게 실패하나 수업 가용성에 영향을 줄 수 있습니다. [Apps Script quota](https://developers.google.com/apps-script/guides/services/quotas).

## timeout 및 결과 확인

| 요청 | GAS upstream | 브라우저 |
|---|---:|---:|
| 로그인·일반 읽기 | 15초 | 요청당 최대 18초, 총 약 20초 |
| 학생 저장·제출·초기화 | 45초 | 약 50초 |
| 저장 결과 확인 | 45초 | 약 50초 |

운영 proxy maxDuration은 60초로 요청합니다. 실제 Vercel 프로젝트/플랜에서 해당 설정이 적용되는지 확인해야 합니다. cold start와 15초 lock 대기를 고려해 기존 8초/9초보다 여유를 주었지만, 느린 실행의 완료를 보장하지는 않습니다.

쓰기는 timeout뿐 아니라 네트워크 오류/HTTP 오류/JSON 오류 후에도 자동 재시도하지 않습니다. 요청 전 ID와 학생키/발행 시각만 브라우저에 저장하여 새로고침 중인 실행도 보호합니다. 같은 학생의 추가 쓰기는 결과 확인 전 차단합니다. 다른 학생 세션과 불명확한 기록은 학생키별로 분리했습니다. 동일 in-flight payload 병합도 유지했습니다.

UI에는 **저장 결과를 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.** 와 저장 결과 확인 버튼을 제공합니다. 확인 요청도 lock을 얻습니다. completed면 서버 데이터를 다시 불러오고, 아직 서버에 등록되지 않은 ID는 cancelled tombstone을 영속 기록하여 늦게 도착한 이전 쓰기를 차단한 다음 사용자가 새 저장을 할 수 있게 합니다. pending/unknown/확인 실패는 차단을 유지합니다. 단순히 not found를 실패로 해석하고 재전송하지 않습니다. 로그인/읽기의 제한된 재시도는 쓰기 재시도와 구분됩니다.

여러 탭/기기의 서로 다른 ID 요청은 전역 잠금으로 순서대로 처리되지만, 늦은 별도 요청의 명시적 필드 값까지 최신 버전으로 판정하는 서버 요청 버전 기능은 추가하지 않았습니다. 같은 학생 여러 기기의 동시 입력은 별도 검증과 운영 정책이 필요합니다.

구버전 프런트는 요청 ID가 없어 저장이 거절됩니다. GAS/프런트/proxy를 동일 버전으로 staging에서 확인하고 기존 학생 브라우저를 새로고침해야 합니다. 추가 PIN이나 로그인 방식 변경은 없습니다. 기존 Google ID 표시/복사도 유지합니다.

## 검증 결과와 실행 환경

| 항목 | 결과 |
|---|---|
| 정상 npm ci | 실패: 설치 스크립트 spawn EPERM |
| npm ci --ignore-scripts | 로컬 회귀검증용 설치 성공; 정상 ci를 대신하지 않음 |
| npm run lint | 성공 |
| npm test | 156개 모두 통과 (실패 0) |
| 기본 npm run build | 실패: Vite/esbuild spawn EPERM |
| 정상 CI | 검증 workflow 추가, 원격 실행 안 함 |
| 실제 staging 25명 테스트 | 실행 안 함; URL/자격증명/별도 Sheets 미제공 |
| production 부하 테스트/데이터 변경 | 수행 안 함 |

로컬 테스트는 신원 충돌/타인 읽기·쓰기 차단, 헤더 순서 변경, 중복 행 보존, 빈 값/부분 활동 복원, 단계 이동·더블 클릭 병합, 서버 저장 완료 시각, batch 응답 동등성, 실패 시 추가 batch fallback 금지, 요청 ID/payload 충돌, 취소 후 늦은 저장 방지, flush 실패, 네트워크 실패 1회 요청 및 결과 확인 후 새 요청을 검증합니다. 잠금 emulation은 실제 다중 GAS 실행이나 service latency를 재현하지 않습니다.

보호된 staging runner/API, 합성 25명 CSV, 빈 테스트 시트만 초기화하는 GAS 함수와 STAGING_PERFORMANCE.md를 제공했습니다. staging URL, 명시적 확인 값, 서버 secret, 테스트 spreadsheet ID가 모두 필요하고 서버/GAS가 합성 fixture를 검증합니다. 설정 없이 npm run test:staging을 실행하여 네트워크 요청 전에 거절되는 것을 확인했습니다. 평균/p50/p95/최대, timeout/실패/lock 실패, lock 대기/보유, 신규/기존 행 저장, 중복 ID, 중복 행, 잘못된 행 갱신을 측정하도록 준비했습니다. **실제 측정값은 없습니다. 미측정 항목은 0으로 보고하지 않습니다.** staging 응답 시간은 fixture 사전 확인 비용을 포함합니다.

## 배포 전에 직접 확인할 사항

1. 정상 개발/CI 환경에서 npm ci, npm run lint, npm test, 기본 npm run build를 모두 성공시킨다. build:sandbox만으로 승인하지 않는다.
2. 전용 테스트 GAS/Sheets/staging을 만들고 STAGING_PERFORMANCE.md의 보호 설정과 합성 학생 25명을 확인한다. 운영 ID/URL이 섞이지 않도록 직접 확인한다.
3. 25명 동시 로그인, 신규 행 저장, 기존 행 저장, 같은 학생 중복 ID를 cold/warm 환경에서 실행한다. p95/max·lock 대기·획득 실패·timeout·행 무결성 결과를 검토한다.
4. batch 옵션은 실제 quota/실행 소유자·신원 복원·표별 셀 수·latency를 검증한 후만 켠다. 로그인 뒤 추가 조회가 몰릴 때도 quota 오류가 없는지 확인한다.
5. 저장 timeout 후 결과 확인, cancelled 이후 늦은 실행 거절, 부분 쓰기 오류 복구, 기기 시각 오차를 확인한다. 학생 입력을 성공 없이 버리지 않는지도 수동 점검한다.
6. receipt 정리 trigger/Properties 저장량과 일일 quota, proxy의 60초 maxDuration을 확인한다. 테스트 route의 120초 설정은 staging 전용이고 플랜 지원을 확인한다.
7. 구버전 브라우저를 새로고침하고 GAS/프런트/proxy 버전을 맞춘다. production에서는 staging 환경변수를 비워 두고 테스트 route가 404인지 확인한다.
8. 수업 중 Sheets 직접 정렬/행 삭제/외부 스크립트 쓰기를 피한다. ScriptLock은 웹 앱 밖의 수동 편집을 잠그지 못한다. 운영 관리자 수정도 수업 시간과 겹치지 않게 한다.

**배포 판단: 보류.** 기본 build/정상 ci 성공, 실제 staging 25명 성능·무결성, quota/timeout/receipt 유지 관리를 검증하기 전 운영 준비 완료라고 판단하지 않습니다.

## 이번 단계 추가 변경 파일

- .env.example
- .github/workflows/validate.yml
- api/gas-proxy.ts
- api/staging-performance.ts
- DEPLOYMENT_REVIEW.md
- GoogleAppsScript.latest.gs
- package.json
- PERFORMANCE_FOLLOWUP.md
- PERFORMANCE_REVIEW.md
- src/api/client.ts
- src/App.tsx
- src/utils/gasScriptTemplate.ts
- STAGING_PERFORMANCE.md
- tests/fixtures/roster.synthetic.csv
- tests/gas.test.cjs
- tests/last-saved-time.test.cjs
- tests/measure-sheet-work.cjs
- tests/mock-runtime.cjs
- tests/performance-policy.test.cjs
- tests/run.cjs
- tests/second-pass.test.cjs
- tests/staging-load.cjs
- tests/step-navigation.test.cjs
- vercel.json
