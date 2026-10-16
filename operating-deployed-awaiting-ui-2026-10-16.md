# 운영 전환 실행 상태 — 2026-10-16

> 이 문서는 배포 직후의 중간 기록이다. 10월 17일 관리자·교사 테스트 계정 검증을 완료했으며, 최종 상태는 `operating-cutover-complete-2026-10-17.md`를 따른다.

- 최종 동결 원본 암호화 백업, 복호화·인증·원본 대조 성공. 원본 전체 및 두 교사 테스트 기록은 암호화 원본에 보존.
- 실제 학생 125명 이관 완료. 문서·버전 대조 일치, 이관 receipt 125개. 테스트 키 두 개는 이관에서 제외.
- 원본 집계: Roster 126, Progress 99, Tests 67, Submissions 1, 별도 Counseling 0. 원본 자료 수정·삭제 없음.
- GAS v19 쓰기 차단과 기존 실행 종료 확인. GAS 쓰기 차단 유지.
- GitHub PR #8 병합 완료. main: `904b7c8ed3f034d7c0270c28eb9179b6c568237d`. 검증 브랜치 head: `d4ab281e7c3d98f6b4c51750cdebd16b43faf09f`.
- GitHub Actions checks 성공. 로컬 최신 전체 261개 테스트, lint, production build 성공.
- Vercel production: `dpl_2vhkgduASkjePzi3UashmZe8uPCS`, Ready. 실제 운영 alias `https://role-model-one.vercel.app/` 연결 확인.
- 실제 운영 URL의 getRosterOptions: HTTP 200, success true, storageBackend transactional-postgres. 개별 배포 URL은 Vercel 보호에 의해 401이므로 운영 alias로 확인.
- PostgreSQL 읽기 확인 후 저장 개방. maintenance closed false, epoch 2. 기존 GAS와 이중 쓰기 없음.
- 기존 ADMIN_PASSWORD, ADMIN_API_SECRET는 조회·복사·변경하지 않음. 운영 새 DB URL·세션 서명·schema 설정만 적용. 테스트 환경변수 없음, batch disabled.
- 복구 지점: 이전 Vercel `dpl_CMRkSJ6pQhoEqU4TvXsGeyoTnNVN`, 기존 Sheets/GAS, 암호화 원본·이관 계획·DB baseline 보존. 개방 이후 답안은 반드시 새 DB에서 보존한 후 복구하며 기존 Sheets로 단순 복귀 금지.

## 아직 완료하지 않은 최종 확인

교사의 운영 관리자 직접 로그인 대기. 관리자 조회 및 승인된 교사 테스트 계정으로 저장·로그아웃·재로그인 복원·제출 확인은 아직 실행하지 않음. 실제 학생 계정으로 답안을 변경하지 않음. 따라서 전체 운영 전환 최종 검증 완료라고 선언하지 않음.

자동 승인 검토가 CI 미완료 시 main 병합을 한 차례 차단했다. 이후 GitHub checks success를 확인한 뒤 동일 PR 병합이 승인되어 실행됐다. 기존 운영 비밀값 export 거부는 그대로 준수했으며 우회하지 않았다.

