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
    require(name) { if (name === 'react') return { ...require('react'), ...hooks }; if (name === '@/lib/supabase') return { supabase: db }; return require(name); },
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) },
    localStorage: { getItem(key) { return storage.get(key) ?? null; }, setItem(key,value) { storage.set(key,value); } },
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    Image: class { naturalWidth = 2400; naturalHeight = 3600; async decode() {} },
    document: { getElementById: id => fields[id] || { value: '' }, createElement() { return { width: 0, height: 0, getContext() { return {fillRect() {}, drawImage() {}}; }, toDataURL() { return 'data:image/jpeg;base64,compressed-test-image'; } }; } },
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

test('calendar: Monday alignment, leap year, year rollover and selected date', async () => {
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
  assert.equal(grid.props.children[0].length, 3); // Thursday, after Mon/Tue/Wed.
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
