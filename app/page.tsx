'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 공연장별 가까운 지하철역 매핑
const theaterStations: { [key: string]: string } = {
  "블루스퀘어": "6호선 한강진역 2번 출구",
  "예술의전당": "3호선 남부터미널역 5번 출구",
  "샤롯데씨어터": "2/8호선 잠실역 4번 출구",
  "대학로 아트원시어터": "4호선 혜화역 2번 출구",
  "충무아트센터": "2/6호선 신당역 9번 출구",
  "LG아트센터": "1호선 서울역 12번 출구"
};

export default function StageDiaryApp() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  const [currentTab, setCurrentTab] = useState<'home' | 'ticketbook' | 'calendar' | 'mypage' | 'stats' | 'sns_settings'>('home');
  const [viewMode, setViewMode] = useState<any>('main');
  const [detailTicket, setDetailTicket] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarMonth, setCalendarMonth] = useState(4);
  const [selectedActorFilter, setSelectedActorFilter] = useState('');
  const [snsConnected, setSnsConnected] = useState({ instagram: true, twitter: false });

  const [tickets, setTickets] = useState<any[]>([
    {
      id: 1,
      title: '위키드 (Wicked)',
      theater: '블루스퀘어',
      station: '6호선 한강진역 2번 출구',
      seat: 'OP석 3렬 12번',
      seatRating: '⭐⭐⭐⭐⭐',
      seatMemo: '오페라글라스 필수, 시야 방해 전혀 없음',
      date: '2026-04-12',
      timeHour: '19',
      timeMin: '30',
      poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
      casting: ['정선아', '박혜나'],
      price: '160000',
      discount: '마티네 할인 20%',
      memo: '지참 필수',
      sectionTitle: '오페라글라스 후기',
      review: '엘파바 초음파 고음 소름 돋음!',
      keywords: ['넘버 찢었다', '눈물샘 자극']
    }
  ]);

  const [customKeywords, setCustomKeywords] = useState([
    '넘버 찢었다', '눈물샘 자극', '앙상블 압도적', '텐션 폭발', '무대 연출 예술', '회전극 필수', '애드리브 폭주', '귀가 호강'
  ]);
  const [actorsList] = useState(['정선아', '박혜나', '이지훈', '조승우', '전동석', '강승호', '임찬민', '옥주현']);

  const [intermissionModalOpen, setIntermissionModalOpen] = useState(false);
  const [intermissionSelectedPlay, setIntermissionSelectedPlay] = useState('');
  const [intermissionCustomPlay, setIntermissionCustomPlay] = useState('');
  const [intermissionMemo, setIntermissionMemo] = useState('');
  const [intermissionCheckedKeywords, setIntermissionCheckedKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // 테마 계산
  const isLight = theme === 'light';

  // 인증 처리
  const handleAuthSubmit = async () => {
    if (!authEmail || !authPassword) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setCurrentUser(data.user);
        alert('로그인 성공!');
      } else {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert('회원가입 완료! 이메일 인증 후 로그인해주세요.');
        setAuthMode('login');
      }
    } catch (err: any) {
      alert('인증 오류: ' + err.message);
    }
  };

  const bypassAuthForDemo = () => {
    setCurrentUser({ email: 'musical_lover@stagediary.app', id: 'demo-user' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  // 포맷팅 및 입력 핸들러
  const formatNumber = (numStr: string) => {
    if (!numStr) return '';
    const clean = numStr.toString().replace(/[^0-9]/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // 티켓 저장 및 삭제
  const saveTicketFromForm = (id: number | null) => {
    const title = (document.getElementById('fTitle') as HTMLInputElement)?.value;
    const date = (document.getElementById('fDate') as HTMLInputElement)?.value;
    const timeHour = (document.getElementById('fTimeHour') as HTMLSelectElement)?.value;
    const timeMin = (document.getElementById('fTimeMin') as HTMLSelectElement)?.value;
    const theater = (document.getElementById('fTheater') as HTMLInputElement)?.value;
    const station = (document.getElementById('fStation') as HTMLInputElement)?.value;
    const seat = (document.getElementById('fSeat') as HTMLInputElement)?.value;
    const seatRating = (document.getElementById('fSeatRating') as HTMLSelectElement)?.value;
    const seatMemo = (document.getElementById('fSeatMemo') as HTMLInputElement)?.value;
    const price = (document.getElementById('fPrice') as HTMLInputElement)?.value.replace(/,/g, '');
    const discount = (document.getElementById('fDiscount') as HTMLInputElement)?.value;
    const memo = (document.getElementById('fMemo') as HTMLInputElement)?.value;
    const sectionTitle = (document.getElementById('fSectionTitle') as HTMLInputElement)?.value;
    const review = (document.getElementById('fReview') as HTMLTextAreaElement)?.value;

    if (!title || !date || !theater) {
      alert('필수 항목(제목, 일자, 공연장)을 입력해주세요.');
      return;
    }

    if (id === null) {
      const newT = {
        id: Date.now(),
        title, theater, station, seat, seatRating, seatMemo, date, timeHour, timeMin,
        poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
        casting: viewMode.casting || [],
        price, discount, memo, sectionTitle, review,
        keywords: ['넘버 찢었다']
      };
      setTickets([newT, ...tickets]);
    } else {
      setTickets(tickets.map(t => t.id === id ? {
        ...t,
        title, theater, station, seat, seatRating, seatMemo, date, timeHour, timeMin,
        casting: viewMode.casting,
        price, discount, memo, sectionTitle, review
      } : t));
    }
    setViewMode('main');
  };

  const deleteTicket = (id: number) => {
    if (confirm('해당 관람 기록을 삭제하시겠습니까?')) {
      setTickets(tickets.filter(t => t.id !== id));
      setDetailTicket(null);
    }
  };

  // 로그인 화면 렌더링
  if (!currentUser) {
    return (
      <div className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-4`}>
        <div className={`w-full max-w-md ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-3xl p-8 shadow-2xl flex flex-col justify-center space-y-6`}>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-purple-500">Stage Diary</h1>
            <p className="text-xs text-slate-400">클라우드로 동기화되는 나만의 뮤지컬 아카이브</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">이메일 계정</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="example@email.com" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">비밀번호</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100" />
            </div>
            <button onClick={handleAuthSubmit} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg transition">
              {authMode === 'login' ? '로그인' : '회원가입'}
            </button>
            <div className="flex justify-between items-center text-xs pt-2">
              <span className="text-slate-400">{authMode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}</span>
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-purple-400 font-semibold hover:underline">
                {authMode === 'login' ? '회원가입하기' : '로그인하기'}
              </button>
            </div>
            <div className="pt-4 border-t border-slate-800 text-center">
              <button onClick={bypassAuthForDemo} className="text-xs text-slate-500 hover:text-slate-300 underline">
                [개발/체험용] 로그인 없이 바로 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 등록/수정 폼 화면
  if (viewMode !== 'main') {
    const isEdit = viewMode.id !== null;
    const hours = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
    const mins = ['00', '10', '20', '30', '40', '50'];
    const allTheaters = Array.from(new Set([...Object.keys(theaterStations), ...tickets.map(t => t.theater)]));

    return (
      <div className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
        <div className={`w-full max-w-md ${isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-800'} border rounded-none sm:rounded-3xl min-h-screen sm:min-h-[850px] flex flex-col shadow-2xl relative overflow-hidden`}>
          <div className={`px-6 py-4 flex items-center justify-between border-b ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'} sticky top-0 z-20`}>
            <button onClick={() => setViewMode('main')} className="text-sm font-semibold">✕ 닫기</button>
            <h2 className="text-base font-bold">{isEdit ? '관람 기록 수정' : '새 관람 기록 등록'}</h2>
            <button onClick={() => saveTicketFromForm(viewMode.id)} className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-500">저장</button>
          </div>
          <div className="p-6 space-y-5 overflow-y-auto flex-1 pb-16">
            <div>
              <label className="block text-xs font-medium mb-1">뮤지컬 제목</label>
              <input type="text" id="fTitle" defaultValue={viewMode.title} placeholder="예: 위키드" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">관람 일자</label>
                <input type="date" id="fDate" defaultValue={viewMode.date} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">관람 시간</label>
                <div className="flex space-x-1">
                  <select id="fTimeHour" defaultValue={viewMode.timeHour} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5 text-sm flex-1 text-white">
                    {hours.map(h => <option key={h} value={h}>{h}시</option>)}
                  </select>
                  <select id="fTimeMin" defaultValue={viewMode.timeMin} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5 text-sm flex-1 text-white">
                    {mins.map(m => <option key={m} value={m}>{m}분</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">공연장</label>
                <input type="text" id="fTheater" list="theaterList" defaultValue={viewMode.theater} placeholder="예: 블루스퀘어" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
                <datalist id="theaterList">
                  {allTheaters.map(th => <option key={th} value={th} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">가까운 역</label>
                <input type="text" id="fStation" defaultValue={viewMode.station} readOnly placeholder="자동 입력" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-purple-300" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">좌석 정보</label>
                <input type="text" id="fSeat" defaultValue={viewMode.seat} placeholder="예: 1층 A구역 5열 7번" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">시야 만족도</label>
                <select id="fSeatRating" defaultValue={viewMode.seatRating} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5 text-sm text-white">
                  <option value="⭐⭐⭐⭐⭐">⭐⭐⭐⭐⭐</option>
                  <option value="⭐⭐⭐⭐">⭐⭐⭐⭐</option>
                  <option value="⭐⭐⭐">⭐⭐⭐</option>
                  <option value="⭐⭐">⭐⭐</option>
                  <option value="⭐">⭐</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">시야 메모</label>
              <input type="text" id="fSeatMemo" defaultValue={viewMode.seatMemo} placeholder="시야 후기" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">캐스팅 배우</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {actorsList.map(actor => {
                  const isSelected = viewMode.casting?.includes(actor);
                  return (
                    <button key={actor} type="button" onClick={() => {
                      const newCasting = isSelected ? viewMode.casting.filter((a: string) => a !== actor) : [...(viewMode.casting || []), actor];
                      setViewMode({ ...viewMode, casting: newCasting });
                    }} className={`px-2.5 py-1 rounded-lg text-xs border ${isSelected ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                      {actor}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">관람 금액 (원)</label>
                <input type="text" id="fPrice" defaultValue={formatNumber(viewMode.price)} placeholder="160,000" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">할인 정보</label>
                <input type="text" id="fDiscount" defaultValue={viewMode.discount} placeholder="할인 내역" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">간편 메모</label>
              <input type="text" id="fMemo" defaultValue={viewMode.memo} placeholder="메모" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">감상평 섹션 타이틀</label>
              <input type="text" id="fSectionTitle" defaultValue={viewMode.sectionTitle || '작품 감상평'} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-xs text-purple-300 mb-2" />
              <textarea id="fReview" rows={3} defaultValue={viewMode.review} placeholder="공연 감상을 남겨주세요" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 상세 모달 화면
  if (detailTicket) {
    return (
      <div className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
        <div className={`w-full max-w-md ${isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-800'} border rounded-none sm:rounded-3xl min-h-screen sm:min-h-[850px] flex flex-col shadow-2xl relative overflow-hidden`}>
          <div className={`px-6 py-4 flex items-center justify-between border-b ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'} sticky top-0 z-20`}>
            <button onClick={() => setDetailTicket(null)} className="text-sm font-semibold">◀ 뒤로가기</button>
            <h2 className="text-base font-bold">티켓 상세 정보</h2>
            <div className="flex space-x-1">
              <button onClick={() => { setViewMode(detailTicket); setDetailTicket(null); }} className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold">수정</button>
              <button onClick={() => deleteTicket(detailTicket.id)} className="bg-rose-500/20 text-rose-500 px-3 py-1.5 rounded-full text-xs font-semibold">삭제</button>
            </div>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto flex-1 pb-16">
            <div className="flex space-x-4 items-center">
              <img src={detailTicket.poster} className="w-24 h-36 object-cover rounded-xl border border-slate-700 shadow-lg" alt="포스터" />
              <div>
                <span className="text-xs text-purple-400 font-semibold">{detailTicket.date} ({detailTicket.timeHour}:{detailTicket.timeMin})</span>
                <h3 className="text-xl font-bold mt-1">{detailTicket.title}</h3>
                <p className="text-xs text-slate-400 mt-1">📍 {detailTicket.theater}</p>
                <p className="text-xs text-purple-300">({detailTicket.station || ''})</p>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">좌석 정보</span><span className="font-bold">{detailTicket.seat}</span></div>
              <div className="flex justify-between"><span class="text-slate-500">시야 만족도</span><span className="text-amber-500 font-bold">{detailTicket.seatRating}</span></div>
              {detailTicket.seatMemo && <div className="flex justify-between"><span className="text-slate-500">시야 메모</span><span className="italic">"{detailTicket.seatMemo}"</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">캐스팅 배우</span><span className="font-bold">{detailTicket.casting?.join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">관람 금액</span><span className="font-bold">{formatNumber(detailTicket.price)}원</span></div>
              <div className="flex justify-between"><span className="text-slate-500">할인 정보</span><span className="font-bold">{detailTicket.discount || '없음'}</span></div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-purple-400 font-bold">{detailTicket.sectionTitle || '작품 감상평'}</p>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs italic">
                "{detailTicket.review || '작성된 감상평이 없습니다.'}"
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 메인 애플리케이션 뷰
  return (
    <div className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
      <div className={`w-full max-w-md ${isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-800'} border rounded-none sm:rounded-3xl min-h-screen sm:min-h-[850px] flex flex-col shadow-2xl relative overflow-hidden`}>
        
        {/* 상단 헤더 */}
        <header className={`px-6 py-4 flex items-center justify-between border-b ${isLight ? 'border-slate-200 bg-white/95' : 'border-slate-800 bg-slate-900/90'} backdrop-blur sticky top-0 z-20`}>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-purple-500">Stage Diary</h1>
            <span className="text-xs text-slate-400 font-medium">스테이지 다이어리</span>
          </div>
          <div className="flex items-center space-x-2 relative">
            <button onClick={() => setIntermissionModalOpen(true)} className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1">
              <span>⚡ 인터미션</span>
            </button>
            <div className="relative">
              <button onClick={() => setThemeMenuOpen(!themeMenuOpen)} className="p-2 text-slate-300 hover:bg-slate-800 rounded-full">⚙️</button>
              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-slate-800 border border-slate-700 shadow-2xl rounded-2xl py-2 z-50 text-xs text-white">
                  <button onClick={() => { setTheme('light'); setThemeMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-purple-500/10">라이트 모드</button>
                  <button onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-purple-500/10">다크 모드</button>
                  <button onClick={() => { setTheme('system'); setThemeMenuOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-purple-500/10">시스템 설정</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 탭 컨텐츠 영역 */}
        <main className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
          {currentTab === 'home' && (
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 border border-purple-500/20 rounded-2xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-purple-300 font-semibold uppercase">Stage Diary Archive</p>
                    <h2 className="text-xl font-bold mt-1">안녕하세요, 조은희님! 🎭</h2>
                  </div>
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-2.5 py-1 rounded-full font-medium">Lv.3 관람 장인</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-center">
                  <div><p className="text-xs text-slate-400">총 관람</p><p className="text-lg font-bold mt-0.5">{tickets.length}회</p></div>
                  <div><p className="text-xs text-slate-400">최애 배우</p><p className="text-lg font-bold text-purple-400 mt-0.5">정선아</p></div>
                  <div><p className="text-xs text-slate-400">최다 극장</p><p className="text-lg font-bold mt-0.5">블루스퀘어</p></div>
                </div>
              </div>

              {/* 최근 관람 티켓 */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold">🎫 최근 관람 티켓 북</h3>
                  <button onClick={() => setCurrentTab('ticketbook')} className="text-xs text-purple-400 hover:underline">전체보기</button>
                </div>
                <div className="space-y-4">
                  {tickets.slice(0, 2).map(ticket => (
                    <div key={ticket.id} onClick={() => setDetailTicket(ticket)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-purple-500/40 transition">
                      <div className="flex space-x-4">
                        <img src={ticket.poster} className="w-20 h-28 object-cover rounded-xl border border-slate-700 shadow-md" alt="포스터" />
                        <div className="flex-1">
                          <span className="text-xs text-purple-400 font-semibold">{ticket.date}</span>
                          <h4 className="text-base font-bold mt-0.5">{ticket.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">📍 {ticket.theater}</p>
                          <p className="text-xs text-slate-400 mt-0.5">💺 {ticket.seat} <span className="text-amber-500 font-semibold">{ticket.seatRating}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'ticketbook' && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">나의 티켓 북</h2>
                <button onClick={() => openFullPageNew()} className="bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg">+ 기록하기</button>
              </div>
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} onClick={() => setDetailTicket(ticket)} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 cursor-pointer">
                    <h4 className="text-base font-bold">{ticket.title}</h4>
                    <p className="text-xs text-slate-400">{ticket.date} | {ticket.theater}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'calendar' && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold">{calendarYear}년 {calendarMonth}월 캘린더</h2>
                <button onClick={() => setViewMode({
                  id: null, title: '', theater: '', station: '', seat: '', seatRating: '⭐⭐⭐⭐⭐', seatMemo: '',
                  date: new Date().toISOString().split('T')[0], timeHour: '19', timeMin: '30',
                  poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
                  casting: [], price: '', discount: '', memo: '', sectionTitle: '작품 감상평', review: ''
                })} className="bg-purple-600 text-white text-xs px-3 py-2 rounded-xl">+ 일정 등록</button>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: 30}, (_, i) => i + 1).map(day => (
                  <div key={day} className="h-20 bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs font-bold text-slate-300">
                    {day}
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'mypage' && (
            <div className="p-6 space-y-6">
              <h2 className="text-lg font-bold">마이페이지 & 설정</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-bold">S</div>
                <h3 className="text-base font-bold">뮤지컬러버 님</h3>
                <p className="text-xs text-slate-400">{currentUser?.email}</p>
                <button onClick={handleLogout} className="text-xs text-rose-500 underline mt-2">로그아웃</button>
              </div>
            </div>
          )}
        </main>

        {/* 하단 네비게이션 */}
        <nav className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-3 flex justify-around items-center z-20">
          <button onClick={() => setCurrentTab('home')} className={`flex flex-col items-center ${currentTab === 'home' ? 'text-purple-400' : 'text-slate-400'}`}>홈</button>
          <button onClick={() => setCurrentTab('ticketbook')} className={`flex flex-col items-center ${currentTab === 'ticketbook' ? 'text-purple-400' : 'text-slate-400'}`}>티켓북</button>
          <button onClick={() => setViewMode({
            id: null, title: '', theater: '', station: '', seat: '', seatRating: '⭐⭐⭐⭐⭐', seatMemo: '',
            date: new Date().toISOString().split('T')[0], timeHour: '19', timeMin: '30',
            poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
            casting: [], price: '', discount: '', memo: '', sectionTitle: '작품 감상평', review: ''
          })} className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-rose-500 rounded-full flex items-center justify-center text-white shadow-lg">+</button>
          <button onClick={() => setCurrentTab('calendar')} className={`flex flex-col items-center ${currentTab === 'calendar' ? 'text-purple-400' : 'text-slate-400'}`}>캘린더</button>
          <button onClick={() => setCurrentTab('mypage')} className={`flex flex-col items-center ${currentTab === 'mypage' ? 'text-purple-400' : 'text-slate-400'}`}>마이페이지</button>
        </nav>

        {/* 인터미션 모달 */}
        {intermissionModalOpen && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold">⚡ 인터미션 빠른 기록</h3>
                <button onClick={() => setIntermissionModalOpen(false)} className="text-slate-400">✕</button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">1막 핵심 키워드</label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {customKeywords.map(kw => {
                    const checked = intermissionCheckedKeywords.includes(kw);
                    return (
                      <div key={kw} onClick={() => {
                        setIntermissionCheckedKeywords(checked ? intermissionCheckedKeywords.filter(k => k !== kw) : [...intermissionCheckedKeywords, kw]);
                      }} className={`p-2 rounded-xl border cursor-pointer text-xs flex justify-between ${checked ? 'border-purple-500 bg-purple-500/10 text-purple-300' : 'border-slate-800 bg-slate-800/50 text-slate-300'}`}>
                        <span>#{kw}</span>
                        <span>{checked ? '✓' : '□'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => { alert('인터미션 기록이 저장되었습니다!'); setIntermissionModalOpen(false); }} className="w-full bg-gradient-to-r from-purple-600 to-rose-500 text-white py-3 rounded-xl text-xs font-semibold">저장하기</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function openFullPageNew() {
  // 헬퍼 함수
}