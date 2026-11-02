// Run with: node --test scripts/diary-checks.cjs
// Exercises page handlers with an isolated Supabase double; never contacts a DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('app/page.tsx', 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

async function setup({ authenticated = true, rows = [], failure = '', rejectLoad = false, storage = new Map() } = {}) {
  const state = [], deps = [], refs = [], pending = [], calls = [], fields = {};
  let cursor = 0, effectCursor = 0, refCursor = 0, tree, fail = failure;
  const user = { id: 'test-user', email: 'test@example.invalid' };
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = refCursor++; return refs[i] ||= { current: initial }; },
    useEffect(fn, next) { const i = effectCursor++; if (!deps[i] || next.some((v, j) => v !== deps[i][j])) { deps[i] = next; pending.push(fn); } },
  };
  const db = {
    auth: {
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async getSession() { return { data: { session: authenticated ? { user } : null }, error: null }; },
      async updateUser({ data }) {
        calls.push({ action: 'updateUser', data });
        if (fail) return { data: { user: null }, error: { message: fail } };
        user.user_metadata = { ...user.user_metadata, ...data };
        return { data: { user: { ...user } }, error: null };
      },
    },
    from(table) {
      const call = { table, action: 'select', filters: [] };
      calls.push(call);
      const q = {
        select() { return q; }, insert(row) { call.action = 'insert'; call.row = row; return q; },
        update(row) { call.action = 'update'; call.row = row; return q; },
        delete() { call.action = 'delete'; return q; },
        eq(key, value) { call.filters.push([key, value]); return q; }, order() { return q; },
        single() { call.single = true; return q; },
        then(resolve, reject) {
          if (rejectLoad && call.action === 'select') return Promise.reject(new Error('offline')).then(resolve, reject);
          if (fail) return Promise.resolve({ data: null, error: { message: fail } }).then(resolve, reject);
          const data = call.action === 'select' ? rows : { id: 101, ...call.row };
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const module = { exports: {} };
  const context = {
    exports: module.exports, module,
    require(name) { if (name === '@/lib/calendar') return require('./load-calendar.cjs'); if (name === 'react') return { ...require('react'), ...hooks }; if (name === '@/lib/supabase') return { supabase: db }; return require(name); },
    window: { innerHeight: 760, addEventListener() {}, removeEventListener() {}, location: { href: 'https://example.invalid/' }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
    localStorage: { getItem(key) { return storage.get(key) ?? null; }, setItem(key,value) { storage.set(key,value); } },
    URL: class extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} },
    Image: class { naturalWidth = 2400; naturalHeight = 3600; async decode() {} },
    document: { documentElement: { style: { setProperty() {}, removeProperty() {} } }, getElementById: id => fields[id] || { value: '' }, createElement() { return { width: 0, height: 0, getContext() { return {fillRect() {}, drawImage() {}}; }, toDataURL() { return 'data:image/jpeg;base64,compressed-test-image'; } }; } },
    confirm: () => true, alert() {}, console,
  };
  vm.runInNewContext(source, context);
  function render() { cursor = effectCursor = refCursor = 0; tree = module.exports.default(); return tree; }
  async function flush() { for (let i = 0; i < 4; i++) { render(); pending.splice(0).forEach(fn => fn()); await new Promise(setImmediate); } render(); }
  function nodes(...args) { const node = args.length ? args[0] : tree; if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(n => nodes(n))]; }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; if (typeof node !== 'object') return String(node); return [node.props?.children].flat(Infinity).map(text).join(''); }
  function button(label) { const found = nodes().find(n => n.type === 'button' && (n.props['aria-label'] === label || text(n) === label)); assert.ok(found, `button: ${label}`); return found; }
  await flush();
  return { render, flush, button, nodes, text: () => text(tree), calls, fields, storage, setFailure(value) { fail = value; } };
}

test('nickname saves to account, updates greeting, validates and retains failed draft', async () => {
  const h = await setup();
  h.button('마이페이지').props.onClick(); h.render(); h.button('닉네임 수정').props.onClick(); h.render();
  const input = () => h.nodes().find(n => n.props?.id === 'nickname');
  const save = () => h.nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  input().props.onChange({ target: { value: '  무대친구  ' } }); h.render();
  await save(); h.render();
  assert.equal(h.calls.find(c => c.action === 'updateUser').data.nickname, '무대친구');
  assert.ok(h.text().includes('무대친구 님'));
  h.button('홈').props.onClick(); h.render();
  assert.ok(h.text().includes('무대친구님!안녕하세요! 🎭'));
  await h.flush(); assert.ok(h.text().includes('무대친구님!안녕하세요! 🎭'));
  h.button('마이페이지').props.onClick(); h.render(); h.button('닉네임 수정').props.onClick(); h.render();
  input().props.onChange({ target: { value: '   ' } }); h.render(); await save(); h.render();
  assert.ok(h.text().includes('1~20자')); assert.equal(h.calls.filter(c => c.action === 'updateUser').length, 1);
  input().props.onChange({ target: { value: '다른닉네임' } }); h.render(); h.setFailure('offline'); await save(); h.render();
  assert.equal(input().props.value, '다른닉네임'); assert.ok(h.text().includes('저장하지 못했습니다'));
  h.button('취소').props.onClick(); h.render(); assert.ok(h.text().includes('무대친구 님'));
});

test('actor filters support multiple selections, individual toggle and full reset', async () => {
  const rows = [{ id: 1, title: 'First show', date: '2026-11-02', casting: ['새 배우 A'] }, { id: 2, title: 'Second show', date: '2026-11-01', casting: ['새 배우 B'] }, { id: 3, title: 'Other show', date: '2026-10-30', casting: ['다른 배우'] }, { id: 4, title: 'Shared show', date: '2026-11-03', casting: ['새 배우 A', '새 배우 B'] }];
  const h = await setup({ rows }); h.button('티켓북').props.onClick(); h.render();
  h.button('새 배우 A').props.onClick(); h.render();
  assert.ok(h.text().includes('First show')); assert.ok(!h.text().includes('Second show'));
  h.button('새 배우 B').props.onClick(); h.render();
  assert.ok(h.text().includes('Shared show')); assert.ok(!h.text().includes('First show')); assert.ok(!h.text().includes('Second show')); assert.ok(!h.text().includes('Other show'));
  assert.equal(h.button('새 배우 A').props['aria-pressed'], true);
  h.button('새 배우 A').props.onClick(); h.render();
  assert.ok(!h.text().includes('First show')); assert.ok(h.text().includes('Second show'));
  h.button('선택 취소').props.onClick(); h.render();
  assert.ok(h.text().includes('First show')); assert.ok(h.text().includes('Other show'));
  assert.equal(h.button('새 배우 B').props['aria-pressed'], false);
  h.button('새 배우 A').props.onClick(); h.render(); h.button('다른 배우').props.onClick(); h.render();
  assert.ok(h.text().includes('해당 조건의 관람 기록이 없습니다.')); assert.ok(!h.text().includes('Shared show'));
});

test('transfer fields start collapsed, and saved custom theatre reuses station', async () => {
  const h = await setup({ rows: [{ id: 1, title: 'Saved show', date: '2026-11-02', theater: '신규 공연장', station: '신규 역 2번 출구', casting: [] }] });
  h.button('새 관람 기록 등록').props.onClick(); h.render();
  const checkbox = () => h.nodes().find(n => n.type === 'input' && n.props?.type === 'checkbox');
  const fields = () => h.nodes().find(n => n.props?.id === 'transfer-ticket-fields');
  assert.equal(checkbox().props.checked, false); assert.equal(fields().props.hidden, true);
  checkbox().props.onChange({ target: { checked: true } }); h.render();
  assert.equal(checkbox().props.checked, true); assert.equal(fields().props.hidden, false);
  checkbox().props.onChange({ target: { checked: false } }); h.render();
  assert.equal(fields().props.hidden, true);
  h.fields.fStation = { value: '' };
  h.nodes().find(n => n.props?.id === 'fTheater').props.onChange({ target: { value: '신규 공연장' } });
  assert.equal(h.fields.fStation.value, '신규 역 2번 출구');
  h.nodes().find(n => n.props?.id === 'fTheater').props.onChange({ target: { value: '처음 가는 공연장' } });
  assert.equal(h.fields.fStation.value, '');
});

test('casting board accepts camera or album, persists independently, and can be removed', async () => {
  const h = await setup();
  h.button('새 관람 기록 등록').props.onClick(); h.render();
  const camera = h.nodes().find(n => n.props?.['aria-label'] === '캐스팅 보드 사진 촬영');
  const album = h.nodes().find(n => n.props?.['aria-label'] === '캐스팅 보드 앨범에서 선택');
  assert.equal(camera.props.capture, 'environment'); assert.equal(album.props.capture, undefined);
  album.props.onChange({ target: { files: [{ type: 'image/png', size: 1024 }], value: 'board.png' } });
  await new Promise(setImmediate); h.render();
  Object.assign(h.fields, { fTitle: { value: 'Casting ticket' }, fDate: { value: '2026-11-20' }, fTheater: { value: 'Theater' }, fCasting: { value: '배우1, 배우2' } });
  await h.button('저장').props.onClick(); h.render();
  const row = h.calls.find(c => c.action === 'insert').row;
  assert.match(row.casting_image, /^data:image\/jpeg;base64,/); assert.equal(row.poster, ''); assert.equal(row.casting.length, 2);
  h.button('수정').props.onClick(); h.render(); h.button('캐스팅 보드 사진 삭제').props.onClick(); h.render();
  await h.button('저장').props.onClick(); h.render();
  assert.equal(h.calls.find(c => c.action === 'update').row.casting_image, '');
});

test('transfer capture and phone suffix persist, validate and can be cleared', async () => {
  const h = await setup();
  h.button('새 관람 기록 등록').props.onClick(); h.render();
  Object.assign(h.fields, { fTitle: { value: 'Transfer ticket' }, fDate: { value: '2026-11-20' }, fTheater: { value: 'Theater' }, fPhoneSuffix: { value: '0123' } });
  const input = h.nodes().find(n => n.props?.id === 'transferImage');
  input.props.onChange({ target: { files: [{ type: 'image/png', size: 1024 }], value: 'capture.png' } });
  await new Promise(setImmediate); h.render();
  await h.button('저장').props.onClick(); h.render();
  const row = h.calls.find(c => c.action === 'insert').row;
  assert.equal(row.phone_suffix, '0123');
  assert.match(row.transfer_image, /^data:image\/jpeg;base64,/);
  h.button('수정').props.onClick(); h.render();
  h.fields.fPhoneSuffix.value = '123';
  await h.button('저장').props.onClick(); h.render();
  assert.match(h.text(), /숫자 4자리/);
  assert.equal(h.calls.filter(c => c.action === 'update').length, 0);
  h.fields.fPhoneSuffix.value = '';
  h.button('캡처 삭제').props.onClick(); h.render();
  await h.button('저장').props.onClick(); h.render();
  const update = h.calls.find(c => c.action === 'update');
  assert.equal(update.row.phone_suffix, ''); assert.equal(update.row.transfer_image, '');
});

test('calendar: Sunday alignment, leap year, year rollover and selected date', async () => {
  const h = await setup();
  h.button('캘린더').props.onClick(); h.render();
  let year = new Date().getFullYear(), month = new Date().getMonth() + 1;
  while (year !== 2024 || month !== 2) {
    const direction = year * 12 + month > 2024 * 12 + 2 ? -1 : 1;
    h.button(direction < 0 ? '이전 달' : '다음 달').props.onClick(); h.render();
    month += direction; if (month === 0) { month = 12; year--; } if (month === 13) { month = 1; year++; }
  }
  const days = h.nodes().filter(n => n.type === 'button' && /2024-02-\d+/.test(n.props['aria-label'] || ''));
  assert.equal(days.length, 29);
  const grid = h.nodes().find(n => n.props?.className === 'grid grid-cols-7 gap-2');
  assert.equal(grid.props.children[0].length, 4); // Thursday, after Sun/Mon/Tue/Wed.
  assert.match(h.button('2024-02-04 기록 등록').props.className, /text-rose-400/);
  assert.match(h.button('2024-02-03 기록 등록').props.className, /text-blue-400/);
  assert.ok(!/text-rose-400|text-blue-400/.test(h.button('2024-02-05 기록 등록').props.className));
  h.button('2024-02-29 기록 등록').props.onClick(); h.render();
  assert.equal(h.nodes().find(n => n.props?.id === 'fDate').props.defaultValue, '2024-02-29');
});

test('create/update/delete: user scope, returned DB data, empty numeric price', async () => {
  const h = await setup();
  h.button('새 관람 기록 등록').props.onClick(); h.render();
  Object.assign(h.fields, { fTitle: { value: 'Test musical' }, fDate: { value: '2026-10-30' }, fTheater: { value: 'Test theater' } });
  await h.button('저장').props.onClick(); h.render();
  const insert = h.calls.find(c => c.action === 'insert');
  assert.equal(insert.row.user_id, 'test-user'); assert.equal(insert.row.price, null);
  assert.ok(h.text().includes('Test musical'));
  h.button('수정').props.onClick(); h.render(); h.fields.fTitle.value = 'Edited musical';
  await h.button('저장').props.onClick(); h.render();
  const update = h.calls.find(c => c.action === 'update');
  assert.deepEqual(update.filters, [['id', 101], ['user_id', 'test-user']]);
  assert.ok(h.text().includes('Edited musical'));
  await h.button('삭제').props.onClick(); h.render();
  const deletion = h.calls.find(c => c.action === 'delete');
  assert.deepEqual(deletion.filters, [['id', 101], ['user_id', 'test-user']]);
  assert.ok(!h.text().includes('Edited musical'));
});

test('failed save keeps form and values, shows inline error, allows retry', async () => {
  const h = await setup();
  h.button('새 관람 기록 등록').props.onClick(); h.render();
  Object.assign(h.fields, { fTitle: { value: 'Draft' }, fDate: { value: '2026-10-30' }, fTheater: { value: 'Theater' } });
  h.setFailure('RLS denied'); await h.button('저장').props.onClick(); h.render();
  assert.ok(h.nodes().some(n => n.props?.role === 'alert'));
  assert.ok(h.text().includes('RLS denied')); assert.equal(h.fields.fTitle.value, 'Draft');
  assert.equal(h.button('저장').props.disabled, false);
  h.setFailure(''); await h.button('저장').props.onClick(); h.render(); assert.ok(h.text().includes('Draft'));
});

test('session restoration reloads user records; rejected fetch clears loading', async () => {
  const h = await setup({ rows: [{ id: 1, title: 'Persisted musical', date: '2026-10-30', casting: [] }] });
  assert.ok(h.text().includes('Persisted musical'));
  assert.deepEqual(h.calls[0].filters, [['user_id', 'test-user']]);
  const failed = await setup({ rejectLoad: true });
  assert.ok(failed.text().includes('offline')); assert.ok(!failed.text().includes('처리 중…'));
});


test('registration keeps bottom navigation; unknown station accepts direct input; cast tags and free text merge', async () => {
  const h = await setup(); h.button('새 관람 기록 등록').props.onClick(); h.render();
  assert.equal(h.nodes().filter(n => n.type === 'nav').length, 1);
  assert.equal(h.nodes().find(n => n.props?.id === 'fStation').props.readOnly, undefined);
  h.fields.fCasting = { value: '직접 입력 배우' };
  h.button('정선아').props.onClick(); h.render();
  assert.equal(h.fields.fCasting.value, '직접 입력 배우, 정선아');
  h.button('정선아').props.onClick(); h.render();
  assert.equal(h.fields.fCasting.value, '직접 입력 배우');
  Object.assign(h.fields, { fTitle: {value:'New show'}, fDate:{value:'2026-10-30'}, fTheater:{value:'New theatre'}, fStation:{value:'직접 입력 역'} });
  await h.button('저장').props.onClick(); h.render();
  const row = h.calls.find(c => c.action === 'insert').row;
  assert.equal(row.station, '직접 입력 역'); assert.deepEqual(Array.from(row.casting), ['직접 입력 배우']);
});

test('favorites have six editable slots; saved per account; settings are separate screens', async () => {
  const h = await setup(); h.button('마이페이지').props.onClick(); h.render();
  assert.ok(!h.nodes().some(n => n.props?.id === 'favorite-male-0'));
  h.button('최애 설정').props.onClick(); h.render();
  assert.equal(h.nodes().filter(n => n.type === 'input' && n.props?.id?.startsWith('favorite-')).length, 6);
  h.nodes().find(n => n.props?.id === 'favorite-male-0').props.onChange({target:{value:'남자 최애'}});
  await h.flush();
  h.nodes().find(n => n.props?.id === 'favorite-female-2').props.onChange({target:{value:'여자 차차애'}});
  await h.flush();
  const restored = await setup({storage:h.storage}); restored.button('마이페이지').props.onClick(); restored.render(); restored.button('최애 설정').props.onClick(); restored.render();
  assert.equal(restored.nodes().find(n => n.props?.id === 'favorite-male-0').props.value, '남자 최애');
  assert.equal(restored.nodes().find(n => n.props?.id === 'favorite-female-2').props.value, '여자 차차애');
  restored.button('남자 배우 최애 삭제').props.onClick(); await restored.flush();
  assert.equal(JSON.parse(restored.storage.get('stage-diary-preferences:test-user')).favorites['male-0'], undefined);
  restored.button('← 뒤로').props.onClick(); restored.render(); restored.button('앱 테마 설정').props.onClick(); restored.render();
  assert.ok(restored.text().includes('기본 테마는 다크 모드'));
});

test('image file selection stores compressed image in ticket instead of requiring a URL', async () => {
  const h = await setup(); h.button('새 관람 기록 등록').props.onClick(); h.render();
  assert.ok(!h.nodes().some(n => n.props?.id === 'fPoster'));
  const upload = h.nodes().find(n => n.props?.id === 'fPosterFile');
  upload.props.onChange({target:{files:[{type:'image/png',size:2048}],value:'poster.png'}});
  await h.flush();
  assert.ok(h.nodes().some(n => n.type === 'img' && n.props.src.startsWith('data:image/jpeg;base64,')));
  Object.assign(h.fields, {fTitle:{value:'Poster test'},fDate:{value:'2026-10-30'},fTheater:{value:'Theatre'}});
  await h.button('저장').props.onClick();
  assert.ok(h.calls.find(c => c.action === 'insert').row.poster.startsWith('data:image/jpeg;base64,'));
});

test('unsupported image keeps form usable and shows an error', async () => {
  const h = await setup(); h.button('새 관람 기록 등록').props.onClick(); h.render();
  h.nodes().find(n => n.props?.id === 'fPosterFile').props.onChange({target:{files:[{type:'image/svg+xml',size:100}],value:'x.svg'}});
  await h.flush();
  assert.ok(h.text().includes('사진 파일을 선택해주세요')); assert.equal(h.button('저장').props.disabled,false);
});
