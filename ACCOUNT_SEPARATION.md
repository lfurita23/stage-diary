# 앱별 인증 분리 및 계정 복구·탈퇴 준비 상태

확인일: 2026-11-05

## 운영 전환 결과 (2026-11-05)

- Story Seed GitHub Pages 전환 커밋 `2023b70`, Actions `42012007741` 성공. 실제 운영 JS에서 utvoealamrtiuutdtvlb URL 및 프로젝트별 세션 키를 확인했고, 기존 qtr URL은 없었다. Stage Diary 운영 JS는 qtr URL을 유지한다. 검증 결과: output/verification/live-auth-separation.json.
- 사용자가 Story Seed Gmail SMTP를 저장했으며 새 전용 계정 가입 → 인증 메일 수신 → 로그인 성공을 직접 확인했다. 기존 원고와 티켓, 기존 공용 계정은 삭제/이전하지 않았다.
- Stage Diary Gmail SMTP도 사용자가 저장했다. Site URL은 Stage Diary 운영 주소로 변경했다. 기존 리디렉션 허용 항목은 보존했다.
- Stage Diary 삭제 함수를 qtr 프로젝트에 활성화 배포했다 (version 1). 함수 내부에서 Auth getUser로 토큰을 검증하므로 게이트웨이 verify_jwt는 false다. 프로젝트 URL 제한, 최근 로그인, 확인 문구, 세션 취소 후 본인 계정만 삭제 조건을 유지한다.
- 운영 서버의 미로그인 GET/POST, 위조 토큰은 401, 다른 Origin은 403, PUT은 405, 허용 Origin OPTIONS는 204로 확인했다. 실제 계정 삭제는 수행하지 않았다.
- Stage Diary UI 배포를 진행한다. 로컬 build는 오래된 캐시를 보관한 뒤 정상 통과했다. 기존 테스트 27개 및 TypeScript 검사는 통과 상태다. 실제 비밀번호 재설정 메일 수신/새 비밀번호 변경은 사용자가 확인해야 한다.

아래는 준비 과정 당시 기록이다. 현재 상태는 위 운영 전환 결과를 우선한다.

## 2026-11-05 연결 권한 추가 후 진행

- 첫 번째 Codex Supabase 연결을 novel-team으로 재연결한 뒤 utvoealamrtiuutdtvlb 접근이 성공했다. 현재 도구는 소설 프로젝트만 보여 주므로 티켓 프로젝트 서버 배포 시 연결을 다시 전환해야 할 수 있다.
- 소설 프로젝트 SQL 확인: Auth 계정 0명, episodes/lore_books/novels 모두 RLS 활성화. 보안 advisor lints 없음. 기존 테이블/데이터는 변경하지 않았다.
- 소설 프로젝트 Site URL을 GitHub Pages 운영 주소로 저장하고 운영 루트/복구, localhost:3001 루트/복구 4개를 허용했다. 이메일 인증 ON 유지, 아직 custom SMTP 없음.
- Story Seed 로컬 코드에 전용 공개 연결 정보, 프로젝트별 세션 저장 키, 공용 계정 재가입 안내를 준비했다. 기존 원고 저장 키/백업은 유지했다. 테스트 14개와 Pages build가 통과했고 export JS에서 utvo URL만 존재함을 확인했다.
- 사용자는 도메인이 없어 Gmail SMTP를 먼저 사용하기로 했다. SMTP 화면의 발신 이름/호스트를 준비했으나 이메일/앱 비밀번호 입력과 저장은 사용자가 직접 해야 한다. 아직 운영 배포 전환/회원 탈퇴 활성화는 하지 않았다.
- Stage Diary 기존 복구/탈퇴 테스트 포함 27개 및 TypeScript 검사를 다시 통과했다.

## 확인된 현재 상태

| 용도 | 조직 | 프로젝트 이름 | 프로젝트 ID |
| --- | --- | --- | --- |
| Stage Diary 티켓 DB | story-seed | Stage Diary | qtrzbmmxjkgdbsxqsywr |
| 기존 소설 DB | novel-team | story-seed | utvoealamrtiuutdtvlb |

두 프로젝트의 이름만 용도에 맞게 정리했다. 조직 이동과 데이터 삭제는 하지 않았다.

현재 운영 중인 Stage Diary와 웹소설 사이트 모두 `qtrzbmmxjkgdbsxqsywr` 인증 서버를 사용한다. 웹소설 소스의 `src/app/page.js` 및 `src/lib/store.mjs`를 확인했으며 원고는 접속 주소의 브라우저 localStorage에 저장된다. 로그인 계정별 원고 분리·서버 동기화는 현재 없다. 인증 서버를 바꿔도 기존 localStorage 원본 및 백업을 삭제하지 않는다.

티켓 DB를 읽기 전용으로 확인했을 때 tickets 0건, Auth 계정 3개였다. 소설 DB 관리 화면에서는 episodes, lore_books, novels 테이블을 확인했으며 novels 예상 행 수는 1건이다. 소설 프로젝트의 Auth 목록은 비어 있다고 표시됐으나 하단 추정 숫자가 달라 정확한 계정 수는 재확인이 필요하다.

## 이번 코드 변경

- 이메일 찾기: 로그인 아이디가 가입 이메일임을 안내하고, 가입 메일·저장된 로그인 정보·카카오 로그인 확인 방법을 안내한다. 이메일 존재 여부를 공개 조회하지 않는다.
- 비밀번호 찾기: 현재 접속 앱의 루트로 돌아오는 재설정 이메일을 요청한다. 가입 여부와 무관한 안내를 사용한다.
- 비밀번호 재설정: PASSWORD_RECOVERY 이벤트로 인증된 계정만 변경 화면에 접근한다. 서버에서 계정을 재확인하고 비밀번호 일치 여부를 검증한 뒤 변경한다. 완료하면 세션을 로그아웃한다.
- 회원 탈퇴: 마이페이지에서 삭제 동의 및 ‘탈퇴’ 입력 후 확정한다. 서버는 본인 토큰을 검증하고 최근 15분 내 로그인한 계정만 처리한다. 모든 갱신 세션을 취소한 후 검증된 본인 계정을 삭제한다. tickets의 기존 FK ON DELETE CASCADE로 해당 계정의 기록과 첨부 데이터가 함께 삭제된다.
- 계정 삭제의 서버 enable 플래그는 false다. 웹소설 인증을 별도 프로젝트로 전환하고 실제 배포 코드에서 분리를 확인하기 전에는 켜지 않는다. 서버가 준비되지 않으면 탈퇴 버튼은 표시하지 않는다.
- 실제 계정 삭제, 인증 이메일 발송, 실제 비밀번호 변경은 자동 검사에서 실행하지 않는다. 테스트는 격리된 대역으로 검증한다.

## 배포 전 필요한 순서

1. Supabase 연결 도구에서 novel-team 프로젝트 접근 권한을 허용한다. 현재 연결은 qtrzb… 프로젝트만 보이며 utvo… 조회는 권한 오류를 반환한다.
2. 소설 프로젝트의 실제 Auth 사용자·테이블 소유 관계와 RLS를 확인한다. 기존 소설 데이터와 계정을 삭제하지 않는다.
3. 소설 프로젝트의 Auth URL/이메일 설정과 공개 연결 키를 준비한다. 웹소설 배포용 URL 및 `/reset-password/` 경로를 허용한다.
4. 웹소설 GitHub Pages의 인증 환경변수를 소설 프로젝트로 변경한다. 기존 계정은 공용 프로젝트에 남겨 두며 새 프로젝트 재가입 방식은 사용자와 합의했다. 브라우저 원고 원본은 보존한다.
5. 웹소설 실제 배포 코드가 utvo…를, Stage Diary가 qtrzb…를 사용하는지 비교하고 로그인·복구 흐름을 검증한다.
6. 서버 삭제 함수는 해당 앱의 전용 프로젝트에만 배포한다. Stage Diary용 함수는 코드에서 프로젝트 URL을 qtrzb…로 제한한다. 별도 소설용 함수를 만들 경우 utvo…로 제한한다. 서비스 관리자 키는 Edge Function 기본 서버 환경에서만 사용하며 프런트엔드와 Git에 넣지 않는다.
7. 회원 탈퇴 기능을 활성화한다. 테스트용 계정을 실제로 삭제하는 검증은 사용자 승인 또는 사용자의 직접 테스트로 진행한다.

주의: 카카오 연결은 기존 qtrzb… 프로젝트에서 유지하므로 Stage Diary의 현재 카카오 개발자 콜백을 변경할 필요가 없다. 소설 앱은 현재 이메일 로그인만 제공한다.

참고: 계정 보안 점검에서는 유출 비밀번호 차단이 비활성 상태로 나왔다. 이용 가능한 요금제 및 [공식 비밀번호 보안 안내](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 확인한 후 적용 여부를 결정한다.
