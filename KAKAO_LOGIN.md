# 카카오 로그인 요청 항목

2026-11-05: 사용자의 요청으로 프로필 사진 수집 동의를 제외했다.

- 로그인/회원가입 모두 기존 `kakao` provider와 Supabase callback을 유지한다. 계정 이전이나 별도 provider는 만들지 않는다.
- 요청 항목은 `account_email profile_nickname`이다. `options.queryParams.scope`(단수)를 사용한다. `options.scopes`(복수)는 Kakao 기본 항목에 추가하므로 사진 제외 용도로 사용하지 않는다.
- 실제 qtrzbmmxjkgdbsxqsywr Auth 서버에 SDK가 생성한 요청을 보내고 302 Location을 확인했다. Kakao scope에서 profile_image가 빠졌고 callback과 state는 유지됐다. 확인 시 사용자 인증/계정 생성은 실행하지 않았다.
- 로그인/회원가입 회귀 검사에서 두 요청 모두 사진 항목을 포함하지 않는지 확인한다.
- Supabase 서버가 추후 query scope 처리를 변경하면 운영 redirect scope를 다시 확인해야 한다. 기존 기본 동의 항목을 켜서 해결하거나 기본 목록으로 되돌리는 변경은 사용자의 사진 제외 의사와 충돌한다.

참고: https://github.com/supabase/auth/blob/master/internal/api/provider/kakao.go 및 https://github.com/supabase/auth/blob/master/internal/api/external.go
