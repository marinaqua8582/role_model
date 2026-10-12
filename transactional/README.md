# 합성 전용 영속 트랜잭션 후보

이 경로는 합성 학생 25명만 허용한다. 운영 사용·실제 자료 이관은 구현하지 않았다. 플래그가 없으면 기존 GAS 경로를 그대로 사용한다. `TRANSACTIONAL_SYNTHETIC`가 존재하지만 설정이 잘못되면 GAS로 우회하지 않고 실패한다. production 환경은 명시적으로 거절한다.

## 실제 구현

- 학생 로그인·저장·복원·최종 제출·관리자 조회가 같은 DB의 학생 문서를 사용한다. Progress/Tests/Submissions는 한 문서의 논리 영역이며 별도 Sheets 행을 생성하지 않는다.
- PostgreSQL은 `SELECT ... FOR UPDATE`로 해당 studentKey 행만 잠근다. 학생 행은 합성 초기화 시 미리 생성하며 요청 중 append가 없다. SQLite는 디스크/WAL/FULL synchronous 기반 로컬 참조 구현이다. SQLite의 단일 쓰기 잠금 결과를 PostgreSQL의 학생별 잠금 성능으로 해석하면 안 된다.
- 문서·버전·완료 receipt를 같은 트랜잭션에서 COMMIT하고 나서만 성공을 반환한다. commit 응답이 불명확하면 클라이언트는 미확인 상태로 남고 receipt를 조회한다.
- `(student_key,request_id)` 고유키, 내용 지문, expectedVersion CAS를 함께 확인한다. 중복 요청은 이전 결과를 반환하고 ID 재사용·오래된 버전·학생 불일치는 거절한다. 취소 tombstone도 같은 학생 잠금 아래 기록한다. 이미 완료된 저장은 취소되었다고 바꾸지 않는다.
- 완료·취소 receipt는 24시간 보존하며 저장 요청 유효기간은 15분이다. `cleanupExpired()`는 만료된 completed/cancelled만 학생 잠금 아래 재확인해 최대 50개 정리한다. pending/unknown/processing은 보호한다. DB 정리 예약 작업은 아직 설치하지 않았다. 기존 GAS 5분 트리거 코드는 바꾸지 않았다.
- 학생 세션은 HMAC 서명·만료·DB 세션을 확인하고 로그아웃 시 폐기한다. 등록 학년·반·번호·이름 일치 정책을 유지한다. 인증 코드나 비밀번호를 새로 추가하지 않는다. 전체 Google ID는 로그인한 학생 본인 응답에만 포함한다. 명단 선택 API에는 숫자 선택지만 반환한다.
- 새 로그인은 같은 출처 API→PostgreSQL JSON 응답이며 GAS/Google 콘텐츠 리디렉션을 전혀 호출하지 않는다. 기존 GAS 로그인 404의 원인을 고쳤다는 뜻은 아니다. 새 경로에서는 해당 장애 의존성을 제거했다.
- 관리자는 기존 관리자 인증을 거쳐 같은 DB를 조회한다. 합성 경로의 명단 수정·삭제·학생 초기화는 거절한다. 프런트에는 비밀값·DB URL을 전달하지 않는다.
- PostgreSQL 표는 비공개 `role_model_synthetic` 스키마에 둔다. 공개 REST 스키마에 추가하거나 anon/authenticated 역할에 권한을 주지 않는다. 최초 스키마 생성은 명시적인 setup 명령에서만 실행한다. 일반 cold start는 marker와 합성 신원 25개만 검증한다.

## 로컬 실행 (Node 24 권장)

```powershell
npm ci
npm run lint
npm test
npm run build
npm run test:transactional
```

테스트는 임시 디스크 DB와 localhost HTTP 서버를 생성하고 종료 후 지운다. 외부 계정·운영 GAS·운영 시트는 사용하지 않는다. 별도 API만 띄우려면 `node transactional/local-server.mjs` (127.0.0.1:3100). 실제 앱과 연결하려면 아래 환경변수를 현재 PowerShell에서 설정하고 초기화 후 `npm run dev`를 실행한다.

```powershell
$env:TRANSACTIONAL_SYNTHETIC='synthetic-only-25'
$env:TRANSACTIONAL_SESSION_SECRET=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:TRANSACTIONAL_DB_FILE=Join-Path $env:TEMP 'role-model-synthetic.sqlite'
$env:TRANSACTIONAL_INITIALIZE='CREATE_SYNTHETIC_25_ONLY'
npm run setup:synthetic
Remove-Item Env:TRANSACTIONAL_INITIALIZE
npm run dev
```

합성 로그인은 3학년 1반 1~25번, 이름 `합성학생1`~`합성학생25`이다. ID는 example.invalid 도메인이다. 관리자 화면을 확인할 때는 운영과 다른 로컬 ADMIN_PASSWORD·ADMIN_API_SECRET을 환경에서 설정한다. 값은 화면·대화·Git에 출력하지 않는다.

## 외부 staging를 위한 결정 한 가지

추천: **Supabase PostgreSQL Free, 서울(ap-northeast-2), 합성 시험만 위한 새 프로젝트**. 실제 생성·결제·연결·배포는 이번 작업에서 하지 않았다. [가격](https://supabase.com/pricing): Free 월 $0, DB 500MB, 비활성 1주 후 일시 정지 가능, 활성 프로젝트 2개 제한. 유료 Pro는 월 $25부터지만 지금 결제하지 않는다. [지역](https://supabase.com/docs/guides/platform/regions): 특정 서울 지역을 선택하면 주 DB가 해당 지역에 저장된다. Vercel 처리·로그·서비스 메타데이터까지 모두 한국에 있다는 뜻은 아니다. 실제 학생 자료는 별도 정책 검토·승인 전 금지한다.

사용자가 한 번에 준비할 조작:

1. Supabase 계정으로 로그인하고 Free 조직에 새 합성 전용 프로젝트를 생성한다. 지역을 일반 APAC이 아닌 **Specific region: Seoul**로 선택한다. 결제 화면이면 진행하지 않는다.
2. Connect에서 [Transaction pooler](https://supabase.com/docs/guides/database/connecting-to-postgres) 연결 문자열을 확인한다. 실제 비밀번호를 넣은 URI를 비공개 설정에 직접 입력하고 채팅에 보내지 않는다. TLS 인증 검증을 끄지 않는다.
3. 기존 **합성 staging Vercel 프로젝트의 Preview 범위에만** `TRANSACTIONAL_SYNTHETIC=synthetic-only-25`, `TRANSACTIONAL_DATABASE_URL`(위 URI), `TRANSACTIONAL_SESSION_SECRET`(새 무작위 32바이트 이상)을 설정한다. production 범위에는 추가하지 않는다. 기존 테스트용 ADMIN_PASSWORD·ADMIN_API_SECRET을 유지한다. 이 Preview에서는 `STAGING_PERF_MODE`를 제거하고 기존 GAS staging 시험 API를 활성화하지 않는다. LOGIN_BATCH_READS는 비활성 유지한다.
4. 같은 비공개 DB URI/서명값을 로컬 환경에 직접 설정한다. `TRANSACTIONAL_INITIALIZE=CREATE_SYNTHETIC_25_ONLY`를 일시 설정해 `npm run setup:synthetic` 한 번 실행 후 제거한다. 새 전용 DB만 사용한다. 기존 표·행을 지우는 명령은 없다.
5. integration 브랜치의 자동 배포 차단을 유지하고, 이 소스를 별도 Preview로 수동 배포한다. production 재배포 메뉴를 사용하지 않는다.
6. Preview의 학생 UI로 1명 저장·재로그인·최종 제출을 확인한다. 이어 합성 25명 API 시험을 아래 조건으로 실행한다. 실패하면 확대/운영 전환 중단 후 로그를 분석한다. URL/비밀번호 변수는 비공개 환경에서 입력한다.

```powershell
$env:TRANSACTIONAL_STAGING_CONFIRM='SYNTHETIC_25_ONLY'
# TRANSACTIONAL_STAGING_URL: 전용 staging 프로젝트의 고유 Preview URL
# TRANSACTIONAL_TEST_ADMIN_PASSWORD: 비공개 테스트 관리자 비밀번호
node transactional/run-staging.mjs
```

도구는 지정된 합성 프로젝트의 Preview 호스트만 허용하고 새 backend marker를 확인한 뒤 실행한다. 10초 실패 한도이며 자동 재저장은 없다. 평균/p50/p95/최대, 학생별 잠금 대기·보유, DB 읽기·쓰기·COMMIT 시간을 집계한다. API 시험 완료만으로 실제 브라우저/다중 인스턴스/네트워크 단절 시험까지 통과했다고 판단하지 않는다. 초기/new 저장은 새 합성 DB에서 별도로 확인한다. 현재 이 원격 명령은 **미실행**이다.

## 운영 전환과 복구 계획 (미실행)

1. 별도 승인 후에만 쓰기를 잠시 막고 비공개 운영 Sheets 사본, GAS 소스/버전, Vercel 배포/설정, Git commit을 백업한다. 실제 답안·Google ID·원본 백업을 Git/보고서에 넣지 않는다. 기존 시트 연결과 studentKey를 바꾸지 않는다.
2. 기존 답안 호환은 현행 `mapFullStudentDetail`과 stepData/평면 필드를 기준으로 한다. 기존 204개 회귀와 새 실제 클라이언트 테스트에서 이 호환을 유지했다. 실제 Sheets→DB 이관기는 아직 구현/실행하지 않았다. 같은 키의 서로 다른 신원, 중복 행, 알 수 없는 열은 자동 삭제/덮어쓰기하지 않고 격리·수동 검토한다.
3. 운영 이관 전에는 비공개 내보내기→분리된 DB 적재→학생별 답안/완료 상태/버전 대조를 추가 구현·검증해야 한다. 관리자와 학생을 동시에 같은 원본으로 전환한다. Sheets와 DB에 이중으로 성공을 표시하지 않는다.
4. 롤백 때 옛 Sheets 사본을 덮어쓰지 않는다. 새 DB 쓰기를 먼저 중지하고 **전환 후 새 답안·버전·receipt까지** 내보내 보존한다. 이 델타를 기존 답안과 합친 복구 사본에서 검증한 뒤 이전 앱/GAS를 다시 연결한다. 델타를 읽을 수 없으면 구버전 쓰기를 열지 않고 읽기 전용으로 보존한다. 버전 충돌은 자동 덮어쓰지 않는다.
5. `recovery.mjs`는 합성 DB의 최신 문서·버전·receipt를 함께 내보내고 **미사용 합성 DB에만** 복구한다. 기존 새 답안이 있으면 거절하고 세션 토큰은 복구하지 않아 재로그인이 필요하다. 각 학생 단위 백업이므로 전체 일관된 전환 백업에는 쓰기 중지가 필요하다. 로컬 자동 검사에서 새 답안/receipt 보존과 덮어쓰기 거절을 검증한다. 운영용 이관·암호화 백업·델타 병합기는 별도 승인 후 구현 대상이다.

## 아직 통과하지 않은 항목

실제 PostgreSQL 실행, 외부 네트워크/서비스 cold start, Vercel 여러 인스턴스, 브라우저 실제 클릭 전체 경로, 실제 원격 응답 유실·DB 접속 단절·서버 강제 종료 중 COMMIT, 외부 staging 25명 목표 성능은 미검증이다. 로컬 SQLite의 빠른 결과를 운영 성능 개선 폭으로 환산하지 않는다. npm audit의 기존 xlsx high 1건(수정 버전 없음)은 별도 남은 문제다. 운영 배포는 보류한다.
