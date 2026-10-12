# GAS receipt 정리 트리거 설정 방법

## 설치 전
이번 GoogleAppsScript.latest.gs를 적용할 관리자가 GAS 편집기를 엽니다. 이 작업에서는 운영 GAS 수정이나 트리거 설치를 실행하지 않았습니다. 먼저 테스트 GAS에서 확인하세요. 자동 설치는 없으며 관리자가 아래 함수를 직접 실행해야 합니다. 설치 담당 계정 하나를 정하고 다른 관리자들의 기존 purgeExpiredSaveReceipts 트리거도 각 계정에서 확인하세요. getProjectTriggers는 현재 계정의 트리거만 볼 수 있습니다.

## 설치
1. 편집기 상단 함수 목록에서 installSaveReceiptCleanupTrigger를 선택하고 실행합니다. Google 권한 창이 나오면 해당 테스트 프로젝트 권한을 확인합니다.
2. 실행 로그에서 success=true, installed=true, intervalMinutes=5를 확인합니다. 처음은 created=true, 재실행은 created=false가 정상입니다. 이 관리 함수를 두 번 실행해도 등록된 트리거는 1개입니다. 기존 현재 계정의 미등록 동일 함수 트리거는 알려진 5분 트리거로 교체하고 다른 함수의 트리거는 건드리지 않습니다.
3. 왼쪽 시계 모양 '트리거' 메뉴에서 purgeExpiredSaveReceipts / 시간 기반 / 5분을 확인합니다. 주기 실행은 정확히 매 5분 시각이나 즉시 실행을 보장하지 않습니다.

## 확인
getSaveReceiptCleanupStatus를 선택해 실행합니다. installed=true와 intervalMinutes=5는 등록 UID가 현재 계정에서 보이는 경우입니다. installed=null 또는 '설치 관리자 계정에서 확인 필요'이면 원래 설치 계정으로 확인하세요. 다른 계정에서 새 트리거를 만들려 하지 마세요. unmanagedVisibleTriggers가 있으면 설치 함수로 현재 계정의 중복을 정리한 뒤 확인합니다.

receiptCount는 남은 receipt 개수입니다. last의 at, deleted, remaining, protectedPending, malformed, deferredExpired, statusRecorded를 확인합니다. 이름/Google ID/답변/요청 토큰은 결과에 포함하지 않습니다. 첫 주기 실행 전 last=null일 수 있습니다. purgeExpiredSaveReceipts를 직접 실행해 테스트 정리 결과를 확인할 수도 있습니다. 실행 메뉴에서 주기 성공/실패도 확인하세요.

만료된 완료·취소 기록만 삭제합니다. 유효 기록, pending/unknown 및 파싱 불가 기록은 보존합니다. 저장과 같은 ScriptLock을 사용하며 잠금 획득 실패는 다음 실행에서 다시 확인합니다. 최대 50개 또는 호출 사이 2초 경과 후 나머지를 남깁니다. Sheet/Properties 서비스 호출 지연 때문에 잠금이 반드시 2초 안에 끝난다는 뜻은 아닙니다. deferredExpired>0이면 다음 주기 결과를 확인하세요.

## 제거
설치한 계정에서 removeSaveReceiptCleanupTrigger를 선택해 실행합니다. 같은 정리 함수의 현재 계정 트리거와 등록 정보를 제거합니다. getSaveReceiptCleanupStatus로 installed=false 및 트리거 메뉴에서 제거를 확인합니다. receipt와 학생 행은 삭제하지 않습니다. 설치 계정이 다르면 그 계정으로 전환해야 합니다. 다른 계정에 남아 있는 미등록 수동 트리거는 해당 계정에서 별도로 확인/제거합니다.

## 저장 공간 오류
Script Properties 저장 한도는 프로젝트별로 제한됩니다. 용량 부족 안내가 나오면 자동으로 같은 저장을 재전송하지 마세요. pending/unknown 기록을 임의 삭제하면 늦은 저장·중복 방지에 문제가 생깁니다. 먼저 해당 저장 결과와 테스트/운영 시트 상태를 권한 있는 관리자가 확인하고, 만료된 완료/취소 기록은 정리 함수로 처리하세요. 잘못된/진행 중 기록은 자동 정리 대상이 아니므로 조사 없이 삭제하지 않습니다. 정리 결과 기록 자체가 실패하면 statusRecorded=false 및 로그 경고를 확인합니다. 최신 결과가 없다고 정리가 없었다고 단정하지 마세요. 설치 등록 실패 시 새 트리거는 롤백되고 용량 안내가 표시됩니다.

공식 문서: [설치형 트리거와 생성자 계정](https://developers.google.com/apps-script/guides/triggers/installable), [현재 계정 트리거 조회](https://developers.google.com/apps-script/reference/script/script-app), [Properties 용량과 서비스 할당량](https://developers.google.com/apps-script/guides/services/quotas).
