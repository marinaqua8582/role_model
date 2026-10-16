# 합성 학생 25명 staging 시험 절차

이 문서는 준비 절차이며 실제 staging 시험 결과가 아닙니다. 운영 앱·운영 시트·실제 이름/Google ID를 입력하지 마세요. 계정과 staging 권한이 있는 관리자가 실행해야 합니다.

1. 비어 있는 별도 테스트 Google Sheets 3개와 각 시트에 연결할 별도 GAS 3개를 준비합니다. 운영 시트를 복사해 실제 자료가 남은 상태로 사용하지 마세요. 각 회차의 신규 행 시험을 위해 서로 다른 시트 ID가 필요합니다. 시험 도구는 데이터를 자동 삭제하지 않습니다.
2. 각 GAS에 이번 GoogleAppsScript.latest.gs를 넣고 기존 방식대로 시트 연결 설정/관리자 비밀값을 지정합니다. Script Properties에 PERF_TEST_MODE=synthetic-25, PERF_TEST_SPREADSHEET_ID=해당 테스트 시트 ID를 설정합니다. GAS 편집기에서 initializeEmptyPerformanceFixture를 명시적으로 실행합니다. 빈 시트 검사가 실패하면 중단하고 다른 빈 테스트 시트를 준비합니다. Roster는 Synthetic Student 1~25, 3학년 99반, syntheticN@example.invalid만 생성되어야 합니다. Progress/Tests/Submissions 데이터 행은 0이어야 합니다.
3. 테스트 GAS만 사용하는 별도 Vercel staging 배포 3개를 준비합니다. 주소는 https://staging-이름.vercel.app 형식이어야 합니다. 이번 코드를 배포할 권한이 필요하며 이 작업에서는 배포하지 않았습니다. 서버 환경변수를 각 배포에 지정합니다: STAGING_PERF_MODE=synthetic-25, STAGING_ORIGIN=정확한 origin(마지막 / 제외), TEST_GAS_URL=해당 테스트 GAS URL, TEST_SPREADSHEET_ID=해당 ID, STAGING_GAS_ADMIN_SECRET=해당 GAS 관리자 비밀값, STAGING_TEST_SECRET=시험 시작용 비밀값, STAGING_TOKEN_SECRET=32자 이상 독립 서명 키. 비밀값을 VITE_ 변수나 브라우저에 넣지 마세요. 일반 앱 GAS 설정도 테스트 GAS만 연결해야 합니다. LOGIN_BATCH_READS는 비활성 상태로 유지합니다.
4. 정상 개발 PC/CI에서 ZIP 압축을 풀고 npm ci, npm run lint, npm test, npm run build를 실행합니다. 기본 ci/build 실패는 배포 준비 통과가 아닙니다. 이번 환경의 EPERM 실패가 정상 환경에서 해소되는지 확인하세요.
5. PowerShell에서 아래 예시의 URL/ID/시작 비밀값을 본인의 테스트 값으로 대체하고 실행합니다. 비밀값을 결과 파일·화면 공유·Git에 남기지 마세요.

~~~powershell
$env:STAGING_CONFIRM='SYNTHETIC_25_ONLY'
$env:STAGING_URL='https://staging-test1.vercel.app'
$env:TEST_SPREADSHEET_ID='TEST_SHEET_ID_1'
$env:STAGING_TEST_SECRET='테스트 시작용 비밀값'
$env:STAGING_CASES_JSON='[{"url":"https://staging-test1.vercel.app","spreadsheetId":"TEST_SHEET_ID_1"},{"url":"https://staging-test2.vercel.app","spreadsheetId":"TEST_SHEET_ID_2"},{"url":"https://staging-test3.vercel.app","spreadsheetId":"TEST_SHEET_ID_3"}]'
npm run test:staging
~~~

3개 배포의 STAGING_TEST_SECRET은 이 실행 시 같은 시험 시작값을 사용합니다. 학생/루트 서명 토큰은 도구가 회차 시작에 한 번 발급받고 사용하며 결과 파일에 기록하지 않습니다. 초기 fixture 검사는 회차당 1회입니다. 전후 snapshot은 학생키 열만 검사하며 시간 측정 대상 학생 요청 밖에서 수행됩니다.

6. staging-results.json에서 actualRuns=3, 각 completed/ended/revocationVerified=true를 확인합니다. 각 login/new_saveProgress/existing_saveProgress/new_saveTests/existing_saveTests/new_submitFinal/existing_submitFinal의 count=25와 mean/p50/p95/max(밀리초), successRate=1, timeouts=0, lockFailures=0을 확인합니다. performance의 lockWaitMs/lockHeldMs/sheetWriteMs/flushMs/lockTimeoutCount/totalMs를 함께 비교합니다. null 측정값은 0으로 해석하지 말고 GAS 배포 버전을 확인하세요.
7. before/after에서 Progress/Tests/Submissions 중복 수는 모두 0, 최종 행 수는 각 25, foreignRows=0이어야 합니다. wrongStudentUpdates=0과 응답 유실 항목의 자동 재저장 0, 취소된 요청의 거부 결과를 확인합니다. 성공한 같은 ID의 빠른 10회 요청도 새 행을 만들면 안 됩니다. 도구는 실제 프런트 요청 모듈에서 응답을 한 번 버려 재저장이 발생하지 않는지 확인합니다.
8. 실제 브라우저에서 테스트 학생만 로그인하고 본인의 전체 synthetic Google ID만 표시되는지 확인합니다. 테스트 환경에서 네트워크를 끊어 저장 결과 불명 상태 → 결과 확인 안내 → 확인 후 다음 행동을 점검합니다. 같은 저장을 즉시 다시 누르지 마세요. 기존 인증 코드를 운영에서 바꾸거나 시험용 인증을 운영에 적용하지 마세요.
9. 실패/불명확 결과면 도구는 후속 저장과 다음 회차를 중단합니다. 자동 재실행하지 말고 테스트 시트와 receipt 결과를 먼저 확인하세요. 회차 토큰은 종료 시 폐기되며 최대 10분 후 만료합니다. 진행 중 직접 시트 편집을 하지 마세요. 재시험은 새 빈 합성 시트를 준비합니다.

성능 기준은 시험 전에 수업에서 허용할 대기시간을 정해 평가하세요. 실제 25명 시험과 cold start 검증 전에는 속도 개선을 확정할 수 없습니다. 시험 URL·권한이 없으면 위 절차만 제공한 상태로 남겨 두고 production 배포를 보류합니다.
