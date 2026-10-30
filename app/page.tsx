'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const busy = useRef(false);
  const [authReady, setAuthReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [systemLight, setSystemLight] = useState(false);
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
  const [calendarMonth, setCalendarMonth] = useState(1);
  const [selectedActorFilter, setSelectedActorFilter] = useState('');
  const [snsConnected, setSnsConnected] = useState({ instagram: true, twitter: false });

  const [tickets, setTickets] = useState<any[]>([]);

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
  const isLight = theme === 'light' || (theme === 'system' && systemLight);

  useEffect(() => {
    const now = new Date(); setCalendarYear(now.getFullYear()); setCalendarMonth(now.getMonth() + 1);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => setSystemLight(media.matches);
    sync(); media.addEventListener('change', sync);
    const saved = localStorage.getItem('stage-diary-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') setTheme(saved);
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setCurrentUser(session?.user ?? null); setAuthReady(true); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setLoadError(error.message);
      setCurrentUser(data.session?.user ?? null); setAuthReady(true);
    }).catch(() => { if (active) setAuthReady(true); });
    return () => { active = false; subscription.unsubscribe(); media.removeEventListener('change', sync); };
  }, []);

  useEffect(() => { if (authReady) localStorage.setItem('stage-diary-theme', theme); }, [theme, authReady]);

  const fromRow = (row: any) => ({ ...row, seatRating: row.seat_rating ?? '', seatMemo: row.seat_memo ?? '', timeHour: row.time_hour ?? '19', timeMin: row.time_min ?? '30', sectionTitle: row.section_title ?? '', casting: row.casting ?? [], keywords: row.keywords ?? [] });
  useEffect(() => {
    let active = true;
    setTickets([]); setDetailTicket(null); setViewMode('main'); setLoadError('');
    if (!currentUser || currentUser.id === 'demo-user') { setWorking(false); return; }
    setWorking(true);
    supabase.from('tickets').select('*').eq('user_id', currentUser.id).order('date', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadError('기록을 불러오지 못했습니다: ' + error.message);
        else setTickets((data ?? []).map(fromRow));
        setWorking(false);
      });
    return () => { active = false; };
  }, [currentUser?.id]);

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const openFullPageNew = (date = today()) => setViewMode({ id: null, title: '', theater: '', station: '', seat: '', seatRating: '⭐⭐⭐⭐⭐', seatMemo: '', date, timeHour: '19', timeMin: '30', poster: '', casting: [], price: '', discount: '', memo: '', sectionTitle: '작품 감상평', review: '', keywords: [] });
  const changeMonth = (delta: number) => { const d = new Date(calendarYear, calendarMonth - 1 + delta, 1); setCalendarYear(d.getFullYear()); setCalendarMonth(d.getMonth()+1); };
  const mostFrequent = (values: string[]) => { const counts: Record<string, number> = {}; values.filter(Boolean).forEach(value => counts[value] = (counts[value] || 0) + 1); return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—'; };
  const favoriteActor = mostFrequent(tickets.flatMap(t => t.casting ?? []));
  const favoriteTheater = mostFrequent(tickets.map(t => t.theater));


  // 인증 처리
  const handleAuthSubmit = async () => {
    if (busy.current) return;
    if (!authEmail || !authPassword) {
      alert('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    busy.current = true; setWorking(true);
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setCurrentUser(data.user);
        alert('로그인 성공!');
      } else {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        alert('회원가입 완료! 이메일 인증 후 로그인해주세요.');
        setAuthMode('login');
      }
    } catch (err: any) {
      alert('인증 오류: ' + err.message);
    } finally { busy.current = false; setWorking(false); }
  };

  const bypassAuthForDemo = () => {
    setCurrentUser({ email: 'musical_lover@stagediary.app', id: 'demo-user' });
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { alert(error.message); return; }
    setTickets([]); setCurrentUser(null);
  };

  // 포맷팅 및 입력 핸들러
  const formatNumber = (numStr: string) => {
    if (!numStr) return '';
    const clean = numStr.toString().replace(/[^0-9]/g, '');
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // 티켓 저장 및 삭제
  const saveTicketFromForm = async (id: number | null) => {
    if (busy.current) return;
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

    const ticket = { title, theater, station, seat, seatRating, seatMemo, date, timeHour, timeMin,
      poster: (document.getElementById('fPoster') as HTMLInputElement)?.value || '',
      casting: viewMode.casting || [], price, discount, memo, sectionTitle, review, keywords: viewMode.keywords || [] };
    if (currentUser?.id === 'demo-user') {
      setTickets(prev => id === null ? [{ ...ticket, id: Date.now() }, ...prev] : prev.map(t => t.id === id ? { ...t, ...ticket } : t));
      setViewMode('main'); return;
    }
    if (!currentUser) return;
    const row = { user_id: currentUser.id, title, theater, station, seat, seat_rating: seatRating, seat_memo: seatMemo, date, time_hour: timeHour, time_min: timeMin, poster: ticket.poster, casting: ticket.casting, price, discount, memo, section_title: sectionTitle, review, keywords: ticket.keywords };
    busy.current = true; setWorking(true);
    try {
      const query = id === null ? supabase.from('tickets').insert(row) : supabase.from('tickets').update(row).eq('id', id).eq('user_id', currentUser.id);
      const { data, error } = await query.select().single();
      if (error) throw error;
      const saved = fromRow(data);
      setTickets(prev => (id === null ? [saved, ...prev] : prev.map(t => t.id === id ? saved : t)).sort((a,b) => b.date.localeCompare(a.date)));
      setViewMode('main');
    } catch (error: any) { alert('저장하지 못했습니다: ' + error.message); }
    finally { busy.current = false; setWorking(false); }
  };

  const deleteTicket = async (id: number) => {
    if (busy.current || !confirm('해당 관람 기록을 삭제하시겠습니까?')) return;
    busy.current = true; setWorking(true);
    try {
      if (currentUser.id !== 'demo-user') {
        const { data, error } = await supabase.from('tickets').delete().eq('id', id).eq('user_id', currentUser.id).select('id').single();
        if (error || !data) throw error || new Error('삭제할 기록을 찾지 못했습니다.');
      }
      setTickets(prev => prev.filter(t => t.id !== id)); setDetailTicket(null);
    } catch (error: any) { alert('삭제하지 못했습니다: ' + error.message); }
    finally { busy.current = false; setWorking(false); }
  };

  if (!authReady) return <div className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">로그인 상태 확인 중…</div>;

  // 로그인 화면 렌더링
  if (!currentUser) {
    return (
      <div data-theme={isLight ? 'light' : 'dark'} className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-4`}>
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
            <button disabled={working} onClick={handleAuthSubmit} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg transition">
              {working ? '처리 중…' : authMode === 'login' ? '로그인' : '회원가입'}
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
      <div data-theme={isLight ? 'light' : 'dark'} className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
        <div className={`w-full max-w-md ${isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-800'} border rounded-none sm:rounded-3xl min-h-screen sm:min-h-[850px] flex flex-col shadow-2xl relative overflow-hidden`}>
          <div className={`px-6 py-4 flex items-center justify-between border-b ${isLight ? 'border-slate-200 bg-white' : 'border-slate-800 bg-slate-900'} sticky top-0 z-20`}>
            <button onClick={() => setViewMode('main')} className="text-sm font-semibold">✕ 닫기</button>
            <h2 className="text-base font-bold">{isEdit ? '관람 기록 수정' : '새 관람 기록 등록'}</h2>
            <button disabled={working} onClick={() => saveTicketFromForm(viewMode.id)} className="bg-purple-600 text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-purple-500">{working ? '저장 중…' : '저장'}</button>
          </div>
          <div className="p-6 space-y-5 overflow-y-auto flex-1 pb-16">
            <div>
              <label className="block text-xs font-medium mb-1">뮤지컬 제목</label>
              <input type="text" id="fTitle" defaultValue={viewMode.title} placeholder="예: 위키드" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" />
            </div>
            <div><label htmlFor="fPoster" className="block text-xs font-medium mb-1">포스터 이미지 URL</label><input id="fPoster" type="url" defaultValue={viewMode.poster} placeholder="https://…" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white" /></div>
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
      <div data-theme={isLight ? 'light' : 'dark'} className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
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
              <div className="flex justify-between"><span className="text-slate-500">시야 만족도</span><span className="text-amber-500 font-bold">{detailTicket.seatRating}</span></div>
              {detailTicket.seatMemo && <div className="flex justify-between"><span className="text-slate-500">시야 메모</span><span className="italic">"{detailTicket.seatMemo}"</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">캐스팅 배우</span><span className="font-bold">{detailTicket.casting?.join(', ')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">관람 금액</span><span className="font-bold">{formatNumber(detailTicket.price)}원</span></div>
              <div className="flex justify-between"><span className="text-slate-500">할인 정보</span><span className="font-bold">{detailTicket.discount || '없음'}</span></div>
            </div>
            <div className="space-y-2">
              {detailTicket.memo && <p className="text-sm whitespace-pre-wrap">{detailTicket.memo}</p>}
              <div className="flex gap-1 flex-wrap">{detailTicket.keywords?.map((kw: string) => <span key={kw} className="text-xs text-purple-400">#{kw}</span>)}</div>
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
    <div data-theme={isLight ? 'light' : 'dark'} className={`min-h-screen ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col items-center justify-center p-0 sm:p-4`}>
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
          {working && <p role="status" className="px-6 pt-3 text-xs text-purple-300">처리 중…</p>}
          {loadError && <p role="alert" className="px-6 pt-3 text-xs text-rose-400">{loadError}</p>}
          {currentUser.id === 'demo-user' && <p className="px-6 pt-3 text-xs text-amber-400">체험 모드: 기록은 이 화면에서만 유지됩니다.</p>}
          {!working && !loadError && !tickets.length && <p className="px-6 pt-3 text-xs text-slate-400">등록된 관람 기록이 없습니다. + 버튼으로 추가해주세요.</p>}
          {currentTab === 'home' && (
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 border border-purple-500/20 rounded-2xl p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-purple-300 font-semibold uppercase">Stage Diary Archive</p>
                    <h2 className="text-xl font-bold mt-1">안녕하세요, {currentUser.email?.split('@')[0] || '관객'}님! 🎭</h2>
                  </div>
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs px-2.5 py-1 rounded-full font-medium">{tickets.length >= 10 ? '관람 장인' : '나의 관람 아카이브'}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-center">
                  <div><p className="text-xs text-slate-400">총 관람</p><p className="text-lg font-bold mt-0.5">{tickets.length}회</p></div>
                  <div><p className="text-xs text-slate-400">최애 배우</p><p className="text-lg font-bold text-purple-400 mt-0.5">{favoriteActor}</p></div>
                  <div><p className="text-xs text-slate-400">최다 극장</p><p className="text-lg font-bold mt-0.5">{favoriteTheater}</p></div>
                </div>
              </div>

              <button onClick={() => setIntermissionModalOpen(true)} className="w-full text-left bg-rose-900/20 border border-rose-500/30 rounded-2xl p-4"><strong className="text-sm">⚡ 인터미션 키워드 기록</strong><p className="text-xs text-slate-400 mt-1">1막 감상을 태그로 빠르게 남기세요! →</p></button>
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
                <div className="flex items-center gap-2 rounded-2xl bg-slate-800 px-3 py-2">
                  <button aria-label="이전 달" onClick={() => changeMonth(-1)}>◀</button>
                  <h2 className="text-sm font-bold">{calendarYear}년 {calendarMonth}월</h2>
                  <button aria-label="다음 달" onClick={() => changeMonth(1)}>▶</button>
                </div>
                <button onClick={() => openFullPageNew()} className="bg-purple-600 text-white text-xs px-3 py-2 rounded-xl">+ 일정 등록</button>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
                {['월','화','수','목','금','토','일'].map((label,i) => <span key={label} className={i === 5 ? 'text-blue-400' : i === 6 ? 'text-rose-400' : ''}>{label}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({length: (new Date(calendarYear, calendarMonth-1, 1).getDay()+6)%7}, (_,i) => <div key={'blank'+i} />)}
                {Array.from({length: new Date(calendarYear, calendarMonth, 0).getDate()}, (_,i) => i+1).map(day => {
                  const date = `${calendarYear}-${String(calendarMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const records = tickets.filter(t => t.date === date);
                  return <div key={day} className={`min-h-[90px] min-w-0 border rounded-xl p-1 flex flex-col ${records.length ? 'bg-purple-950/40 border-purple-500' : 'bg-slate-900 border-slate-800'}`}>
                    <button aria-label={`${date} 기록 등록`} onClick={() => openFullPageNew(date)} className={`text-left text-xs font-bold flex-1 ${date === today() ? 'text-purple-400' : ''}`}>{day}</button>
                    <div className="flex flex-wrap justify-center gap-1">{records.map(t => <button key={t.id} aria-label={`${t.title} 상세 보기`} onClick={() => setDetailTicket(t)}>{t.poster ? <img src={t.poster} alt={t.title} className="w-6 h-8 rounded object-cover" /> : <span className="text-[9px] text-purple-300 break-all">{t.title}</span>}</button>)}</div>
                  </div>;
                })}
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
              <button onClick={() => setCurrentTab('stats')} className="w-full rounded-2xl border border-purple-500/30 bg-purple-900/20 p-4 text-left"><strong className="text-sm">📊 나의 관람 통계 대시보드</strong><p className="text-xs text-slate-400 mt-1">관람 횟수·금액·배우·극장 분석 →</p></button>
              <section className="border border-slate-700 rounded-2xl p-4 space-y-3"><h3 className="text-sm font-bold">⚡ 인터미션 키워드 관리</h3><div className="flex flex-wrap gap-2">{customKeywords.map(kw => <button key={kw} onClick={() => setCustomKeywords(prev => prev.filter(k => k !== kw))} className="text-xs rounded-lg bg-slate-800 px-2 py-1">#{kw} ×</button>)}</div><div className="flex gap-2"><input aria-label="새 키워드" value={newKeywordInput} onChange={e => setNewKeywordInput(e.target.value)} className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm" placeholder="새 키워드" /><button onClick={() => { const kw = newKeywordInput.trim(); if (kw && !customKeywords.includes(kw)) setCustomKeywords(prev => [...prev,kw]); setNewKeywordInput(''); }} className="bg-purple-600 rounded-lg px-3 text-xs text-white">추가</button></div></section>
              <section className="border border-slate-700 rounded-2xl p-4 space-y-3"><h3 className="text-sm font-bold">테마 설정</h3><div className="flex gap-2">{(['light','dark','system'] as const).map((value,i) => <button key={value} onClick={() => setTheme(value)} className={`flex-1 rounded-xl p-2 text-xs ${theme === value ? 'bg-purple-600 text-white' : 'bg-slate-800'}`}>{['라이트','다크','시스템'][i]}</button>)}</div><button onClick={() => setCurrentTab('sns_settings')} className="text-sm">SNS 연동 관리 →</button></section>
            </div>
          )}
          {currentTab === 'stats' && <section className="p-6 space-y-4"><button onClick={() => setCurrentTab('mypage')} className="text-sm text-purple-400">← 마이페이지</button><h2 className="font-bold text-lg">나의 관람 통계</h2><div className="rounded-2xl border border-slate-700 p-5 space-y-3"><p>총 관람 {tickets.length}회</p><p>총 관람 금액 {formatNumber(String(tickets.reduce((sum,t) => sum + Number(t.price || 0),0)))}원</p><p>최애 배우 {favoriteActor}</p><p>최다 극장 {favoriteTheater}</p></div></section>}
          {currentTab === 'sns_settings' && <section className="p-6 space-y-4"><button onClick={() => setCurrentTab('mypage')} className="text-purple-400">← 마이페이지</button><h2 className="font-bold">SNS 연동 관리</h2><p className="text-sm text-slate-400">SNS 계정 연동은 준비 중입니다.</p></section>}
        </main>

        {/* 하단 네비게이션 */}
        <nav className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-3 flex justify-around items-center z-20">
          <button onClick={() => setCurrentTab('home')} className={`flex flex-col items-center ${currentTab === 'home' ? 'text-purple-400' : 'text-slate-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg><span className="text-[10px] mt-1 font-medium">홈</span></button>
          <button onClick={() => setCurrentTab('ticketbook')} className={`flex flex-col items-center ${currentTab === 'ticketbook' ? 'text-purple-400' : 'text-slate-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg><span className="text-[10px] mt-1 font-medium">티켓북</span></button>
          <button onClick={() => setViewMode({
            id: null, title: '', theater: '', station: '', seat: '', seatRating: '⭐⭐⭐⭐⭐', seatMemo: '',
            date: new Date().toISOString().split('T')[0], timeHour: '19', timeMin: '30',
            poster: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300',
            casting: [], price: '', discount: '', memo: '', sectionTitle: '작품 감상평', review: ''
          })} className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-rose-500 rounded-full flex items-center justify-center text-white shadow-lg" aria-label="새 관람 기록 등록"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg></button>
          <button onClick={() => setCurrentTab('calendar')} className={`flex flex-col items-center ${currentTab === 'calendar' ? 'text-purple-400' : 'text-slate-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span className="text-[10px] mt-1 font-medium">캘린더</span></button>
          <button onClick={() => setCurrentTab('mypage')} className={`flex flex-col items-center ${currentTab === 'mypage' ? 'text-purple-400' : 'text-slate-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg><span className="text-[10px] mt-1 font-medium">마이페이지</span></button>
        </nav>

        {/* 인터미션 모달 */}
        {intermissionModalOpen && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold">⚡ 인터미션 빠른 기록</h3>
                <button onClick={() => setIntermissionModalOpen(false)} className="text-slate-400">✕</button>
              </div>
              <div className="space-y-2"><label htmlFor="intermission-ticket" className="text-xs">관람 기록 선택</label><select id="intermission-ticket" value={intermissionSelectedPlay} onChange={e => setIntermissionSelectedPlay(e.target.value)} className="w-full bg-slate-800 rounded-xl p-2 text-sm"><option value="">기록을 선택해주세요</option>{tickets.map(t => <option key={t.id} value={String(t.id)}>{t.date} · {t.title}</option>)}</select><textarea aria-label="인터미션 메모" value={intermissionMemo} onChange={e => setIntermissionMemo(e.target.value)} className="w-full bg-slate-800 rounded-xl p-2 text-sm" placeholder="1막 감상을 남겨주세요" /></div>
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
              <button disabled={working} onClick={async () => {
                const ticket = tickets.find(t => String(t.id) === intermissionSelectedPlay);
                if (!ticket) { alert('먼저 관람 기록을 등록하고 선택해주세요.'); return; }
                if (busy.current) return;
                busy.current = true; setWorking(true);
                const memo = [ticket.memo, intermissionMemo.trim()].filter(Boolean).join('\n');
                const keywords = Array.from(new Set([...(ticket.keywords || []), ...intermissionCheckedKeywords]));
                try {
                  if (currentUser.id !== 'demo-user') {
                    const { error } = await supabase.from('tickets').update({ memo, keywords }).eq('id', ticket.id).eq('user_id', currentUser.id).select('id').single();
                    if (error) throw error;
                  }
                  setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, memo, keywords } : t));
                  setIntermissionModalOpen(false); setIntermissionMemo(''); setIntermissionCheckedKeywords([]);
                } catch (error: any) { alert('저장하지 못했습니다: ' + error.message); }
                finally { busy.current = false; setWorking(false); }
              }} className="w-full bg-gradient-to-r from-purple-600 to-rose-500 text-white py-3 rounded-xl text-xs font-semibold">저장하기</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

