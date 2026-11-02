# 새 기능 설정 및 확인

## 계정과 데이터베이스

- 기존 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 필요하다. 비밀 키는 프런트엔드에 넣지 않는다.
- 양도 티켓을 저장하기 전에 `supabase/migrations/202611020001_transfer_ticket.sql`을 Supabase SQL Editor에서 한 번 실행한다. 기존 tickets RLS가 각 사용자의 `user_id = auth.uid()`에만 조회·추가·수정·삭제를 허용하는지 확인한다. 캡처는 기존 포스터와 같은 방식으로 압축한 JPEG 데이터를 계정 티켓에 저장한다.
- 구글과 카카오: 각 개발자 콘솔에 앱을 만들고, Supabase Authentication > Providers에서 해당 공급자를 활성화한 뒤 Client ID/Secret을 입력한다. 공급자 콘솔의 콜백은 Supabase에 표시되는 콜백 URL을 사용한다. Supabase URL Configuration에는 실제 서비스 주소와 로컬 개발 주소를 Redirect URLs로 허용한다. 로그인 및 신규 가입은 같은 소셜 로그인 버튼으로 진행된다.
- 네이버: 기본 Supabase 공급자 목록에 없으므로 구글·카카오와 같은 이름만 추가해서는 동작하지 않는다. Custom OAuth 또는 인증 중계 연동이 필요하다. 네이버 프로필은 `response` 내부에 회원 정보가 있으므로 Supabase의 사용자 정보 매핑 호환성을 실제 프로젝트에서 검증해야 한다. 아직 네이버 로그인 버튼과 서버 연결은 제공하지 않는다. 설정되지 않은 기능을 동작하는 것으로 표시하지 않는다.

공식 자료: [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Kakao](https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao), [Custom OAuth](https://supabase.com/docs/guides/auth/custom-oauth-providers), [네이버 API](https://developers.naver.com/docs/login/api/api.md).

## 일정 공유

캐스팅 보드 사진 저장에는 `supabase/migrations/202611020002_casting_board.sql`도 실행한다. 등록·수정 화면에서 촬영 또는 앨범 선택으로 사진을 첨부하고 저장한다. 배우 이름 입력과 사진은 함께 사용 가능하며, 사진은 상세 화면에서 확인·다운로드할 수 있다. 카메라 직접 실행 여부와 지원 사진 형식은 기기·브라우저에 따라 다를 수 있다.

티켓 상세에서 `내 캘린더에 등록`으로 ICS 파일을 열어 저장한다. `함께 보는 일정 공유`는 공연명·날짜·시간·공연장만 포함한 링크를 공유한다. 상대방은 로그인 없이 캘린더 파일을 받을 수 있고, 로그인하면 자신의 티켓북에 추가한 후 저장할 수 있다. 양쪽 사용자가 저장을 완료해야 한다. 자동 동기화와 다른 사람의 캘린더에 강제로 등록하는 기능은 포함하지 않는다. 시간은 한국 시간이며 하루 전 알림을 담는다. 실제 알림 허용과 파일 가져오기는 캘린더 앱 설정에 따른다.

## 배포 전 실제 기기 확인

iPhone 16 Pro Safari 및 사용 중인 iOS 브라우저, Android Chrome에서 빈 목록·많은 기록·가로/세로 화면·주소창 접힘/펼침·키보드 표시를 확인한다. 하단 메뉴가 화면 안에 유지되고 본문만 스크롤되는지 확인한다. 실제 구글/카카오 계정 로그인, 로그아웃, 재로그인, 캡처 저장 후 새로고침, 다른 계정에서 접근 차단, 공유 링크 수신과 캘린더 가져오기도 확인한다. 브라우저 에뮬레이션만으로 모든 기기의 동작을 보장할 수는 없다.
