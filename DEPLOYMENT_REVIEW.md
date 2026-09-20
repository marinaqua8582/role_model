# 배포 전 확인 사항

이 수정본은 Production 배포나 실제 시트 변경을 수행하지 않는다.

## 기존 자료의 신원 확인

학생 API는 Roster, 토큰 신원, 해당 학번의 모든 Progress / Tests / Submissions / Counseling 행을 확인한다. 이름 또는 저장된 Google ID가 다르면 조회, 저장, 초기화를 거부한다. 새로 저장하는 행에는 ownerName / ownerGoogleId를 기록한다.

과거 Tests처럼 studentKey만 있고 이름/Google ID/소유자 정보가 없는 행은 신뢰할 수 없는 legacy 자료로 격리한다. 물리적 이동이나 변경 없이 학생·관리자 조회, 저장 대상 선택, 초기화 대상에서 제외한다. 현재 Roster 학생의 로그인과 Progress 복원은 허용하며, 새 Tests는 인증된 ownerName / ownerGoogleId를 가진 별도 행에 기록한다. 다른 이름 또는 Google ID가 명시된 행은 계속 접근을 차단한다. Progress / Submissions / Counseling의 신원 검증은 유지한다.

`npm test` 29개와 TypeScript 검사가 통과했다. 기존 legacy 로그인 차단 테스트는 새 요구사항에 맞게 기대 결과를 수정했고, 학번 재사용 테스트는 명시적 이전 소유자 정보를 가진 Tests 행으로 검증한다. 실제 GAS/Sheets 통합 검증은 수행하지 않았다.

## 저장 호환성

- 물리적 열 위치는 헤더 이름으로 조회한다. 기존 추가 열은 쓰기 범위에서 제외한다.
- 신규 저장은 writtenFields로 명시적 빈 값을 기록한다. STEP별 생략 필드는 보존한다.
- 작성 이력이 없는 과거 중복 행에는 종전 누락 필드 보완 규칙을 유지한다. 과거 빈 값이 명시적 삭제였는지는 저장 이력이 없어 복원할 수 없다.
- 중복 행은 자동 삭제하지 않는다. 정상 학생의 명시적 초기화는 신원을 확인한 후 해당 학생 행을 삭제한다.
- 관리자와 학생은 동일한 studentKey 정규화 및 최신 행 선택 함수를 사용한다.

## 검증과 배포 조건

`npm test`는 실제 프론트 클라이언트와 생성된 GAS 코드를 메모리 시트/캐시로 검증한다. 실제 Google Sheets에 쓰지 않는다. `npm run lint`는 TypeScript 검사다. 로컬 `npm run build`는 esbuild 프로세스 생성 권한 제한(spawn EPERM)으로 중단됐다.

프론트와 수정된 GAS를 함께 검증해야 한다. ADMIN_API_SECRET은 Vercel 서버 환경과 GAS Script Properties에서 일치해야 하며 VITE_ 변수로 공개하지 않는다. GAS_URL(없으면 VITE_GAS_URL)이 서버 프록시 대상이다. 운영 GAS 배포 및 환경변수 변경은 별도 승인 작업이다.

로그아웃은 서버 캐시 토큰을 제거한다. 네트워크 실패 시 로컬 상태는 제거하지만 서버 토큰은 만료 전까지 남을 수 있다.
