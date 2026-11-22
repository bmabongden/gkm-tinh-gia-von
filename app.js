/* GKM Tính giá vốn — chạy offline hoàn toàn */
'use strict';

/* ---------------- tiện ích ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const strip = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const normCode = s => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
const looseCode = s => normCode(s).replace(/[^A-Z0-9]/g, '');
const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('vi-VN');
const fmtQ = n => (n == null || isNaN(n)) ? '—' : (+n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const fmtDate = t => new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const colName = i => XLSX.utils.encode_col(i);
/**
 * Tìm không cần đúng thứ tự: mỗi từ gõ vào chỉ cần có mặt trong tên (không dấu) hoặc trong mã.
 * Ví dụ "sh mode 2020", "2020 sh mode" hay "mode nam 2020 sh" đều ra "SH Mode năm 2020".
 * minCodeTok: từ ngắn hơn số ký tự này chỉ so với tên, không so với mã (tránh "2020" khớp nhầm mã phụ tùng).
 */
function makeMatcher(q, minCodeTok = 1) {
  const toks = strip(q).split(' ').filter(Boolean);
  if (!toks.length) return null;
  const tc = toks.map(t => looseCode(t)), qc = looseCode(q);
  return (text, codes = []) => {
    const h = strip(text), lcs = codes.map(looseCode);
    if (qc.length >= Math.max(3, minCodeTok) && lcs.some(c => c.includes(qc))) return true;
    return toks.every((t, i) => h.includes(t) || (tc[i].length >= minCodeTok && tc[i] && lcs.some(c => c.includes(tc[i]))));
  };
}
const APP_VERSION = '1.5';
const REPO = 'bmabongden/gkm-tinh-gia-von';
const verNum = v => String(v || '').replace(/^v/i, '').split('.').map(Number);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkUpdate() {
  if (!navigator.onLine) return toast('Máy đang không có mạng. Cần mạng để kiểm tra bản mới.', 'bad', 4000);
  busy('Đang kiểm tra bản mới…');
  let rel;
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 10000);
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: 'no-store', signal: ac.signal }).finally(() => clearTimeout(to));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    rel = await r.json();
  } catch (e) { busy(null); return toast('Không kiểm tra được bản mới' + (e.name === 'AbortError' ? ' (mạng chậm hoặc bị chặn)' : ': ' + e.message) + '. Thử lại sau.', 'bad', 4500); }
  busy(null);
  const tag = rel.tag_name || '';
  if (!newer(tag, APP_VERSION)) return toast(`Đang dùng bản mới nhất (v${APP_VERSION}).`, 'ok', 3500);
  const zip = `https://github.com/${REPO}/archive/refs/tags/${encodeURIComponent(tag)}.zip`;
  const canSelf = typeof window.showDirectoryPicker === 'function';
  const notes = rel.body ? `<div class="small" style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;max-height:30vh;overflow:auto">${esc(rel.body)}</div>` : '';
  const folder = appFolderName();
  const body = canSelf
    ? `<p style="margin-top:0">Có bản mới <b>${esc(tag)}</b> (đang dùng v${APP_VERSION}).</p>${notes}
      <p>Bấm <b>Cập nhật ngay</b>, rồi chọn thư mục app${folder ? ` <b>${esc(folder)}</b>` : ''} (thư mục đang chứa <code>index.html</code>) và bấm <b>Cho phép / Lưu thay đổi</b> khi trình duyệt hỏi. App tự tải bản mới, ghi đè vào đúng chỗ rồi mở lại.</p>
      <p class="small muted" style="margin-bottom:0">Bảng giá, bộ nhựa, ảnh xe vẫn giữ nguyên.</p>`
    : `<p style="margin-top:0">Có bản mới <b>${esc(tag)}</b> (đang dùng v${APP_VERSION}).</p>${notes}
      <p>Trình duyệt này không cho app tự cập nhật (hãy dùng Chrome hoặc Edge). Cách làm tay: tải file zip, giải nén rồi chép đè tất cả file vào đúng thư mục app đang dùng.</p>`;
  const go = await modal({ title: '🔄 Cập nhật app', body, buttons: [{ text: 'Để sau', value: false }, { text: canSelf ? '⚡ Cập nhật ngay' : '⬇️ Tải bản mới', value: true, cls: 'pri' }] });
  if (!go) return;
  if (canSelf) await selfUpdate(tag); else window.open(zip, '_blank');
}
/** Tên thư mục đang chứa index.html (lấy từ đường dẫn file:// đang mở) */
function appFolderName() {
  try { const parts = decodeURIComponent(location.pathname).split(/[\\/]/).filter(Boolean); return parts.length >= 2 ? parts[parts.length - 2] : ''; } catch { return ''; }
}
/** Tự cập nhật: tải các file của bản mới từ GitHub rồi ghi đè vào thư mục app người dùng chọn */
async function selfUpdate(tag) {
  let dir;
  try { dir = await window.showDirectoryPicker({ id: 'gkm-app', mode: 'readwrite' }); }
  catch (e) { if (e.name !== 'AbortError') toast('Không mở được thư mục: ' + e.message, 'bad', 4500); return; }
  // Kiểm tra đúng thư mục app
  try {
    const f = await (await dir.getFileHandle('app.js')).getFile(), txt = await f.text();
    await dir.getFileHandle('index.html');
    if (!txt.includes('GKM') || !txt.includes('APP_VERSION')) throw new Error('x');
  } catch { return toast('Thư mục này không phải thư mục app GKM (phải có index.html và app.js). Hãy chọn lại.', 'bad', 5000); }
  const folder = appFolderName();
  if (folder && dir.name !== folder && !await confirmBox(`Anh đang mở app từ thư mục <b>${esc(folder)}</b> nhưng lại chọn thư mục <b>${esc(dir.name)}</b>. Vẫn cập nhật thư mục <b>${esc(dir.name)}</b>?`, 'Vẫn cập nhật', false)) return;
  try {
    if ((await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') return toast('Chưa được cho phép ghi vào thư mục, chưa cập nhật.', 'bad', 4500);
  } catch { }
  busy('Đang tải bản mới…');
  try {
    let files = ['index.html', 'app.js', 'sw.js', 'manifest.json', 'icon.svg', 'HUONG-DAN.md', 'README.md', 'lib/xlsx.full.min.js', 'lib/jszip.min.js', 'tonkho/gkm-tonkho.ps1', 'tonkho/chay-an.vbs', 'tonkho/cai-dat.bat', 'tonkho/go-cai-dat.bat'];
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${encodeURIComponent(tag)}?recursive=1`, { cache: 'no-store' });
      if (r.ok) files = (await r.json()).tree.filter(x => x.type === 'blob' && !x.path.startsWith('.')).map(x => x.path);
    } catch { /* dùng danh sách mặc định */ }
    if (!files.includes('index.html') || !files.includes('app.js')) throw new Error('bản mới thiếu file');
    const got = [];
    for (const [n, path] of files.entries()) {
      busy(`Đang tải bản mới… ${n + 1}/${files.length}`);
      const fr = await fetch(`https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(tag)}/${path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' });
      if (!fr.ok) throw new Error(path + ' HTTP ' + fr.status);
      got.push([path, await fr.blob()]);
    }
    // Đã tải đủ mới bắt đầu ghi, để không bị nửa cũ nửa mới. app.js ghi sau cùng.
    got.sort((a, b) => (a[0] === 'app.js') - (b[0] === 'app.js'));
    for (const [n, [path, blob]] of got.entries()) {
      busy(`Đang ghi file… ${n + 1}/${got.length}`);
      const segs = path.split('/'); let d = dir;
      for (const sg of segs.slice(0, -1)) d = await d.getDirectoryHandle(sg, { create: true });
      const w = await (await d.getFileHandle(segs[segs.length - 1], { create: true })).createWritable();
      await w.write(blob); await w.close();
    }
    busy(null);
    toast(`Đã cập nhật lên ${tag}. App đang mở lại…`, 'ok', 3000);
    setTimeout(() => location.reload(), 1500);
  } catch (e) {
    busy(null);
    toast('Cập nhật chưa xong: ' + e.message + '. Dữ liệu không bị ảnh hưởng, thử lại sau.', 'bad', 6000);
  }
}
const LS = {
  get(k, d) { try { const v = localStorage.getItem('gkm.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gkm.' + k, JSON.stringify(v)); } catch { } }
};

/** Đọc số kiểu Việt Nam: 1.234.000 / 1,234,000 / 1234000.5 / "12.000 đ" */
function parseNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s|đ|₫|vnd|vnđ/gi, '');
  if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[^0-9.,]/g, '');
  if (!s) return null;
  const hasDot = s.includes('.'), hasCom = s.includes(',');
  if (hasDot && hasCom) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot || hasCom) {
    const sep = hasDot ? '.' : ',';
    const parts = s.split(sep);
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join('');
    else s = parts.join('.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : (neg ? -n : n);
}

function toast(msg, type = '', ms = 2800) {
  const d = document.createElement('div');
  d.className = type; d.textContent = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), ms);
}

function busy(msg) {
  let el = $('#busy');
  if (!msg) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'modal-bg'; el.style.alignItems = 'center'; el.innerHTML = '<div class="modal" style="max-width:360px;padding:22px;text-align:center"><div style="font-size:34px">⏳</div><div data-m style="font-weight:600;margin-top:6px"></div></div>'; document.body.appendChild(el); }
  $('[data-m]', el).textContent = msg;
}
const nextFrame = () => new Promise(r => setTimeout(r, 0));

/* ---------------- modal ---------------- */
function modal({ title, body, buttons = [], wide = false, onOpen }) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" style="${wide ? '' : 'max-width:520px'}">
      <div class="mh"><span>${title}</span><button class="btn sm" data-x>✕</button></div>
      <div class="mb"></div><div class="mf"></div></div>`;
    const mb = $('.mb', bg);
    if (typeof body === 'string') mb.innerHTML = body; else mb.appendChild(body);
    const close = v => { bg.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    buttons.forEach(b => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.cls || '');
      el.textContent = b.text;
      el.onclick = async () => {
        if (b.validate) { const ok = await b.validate(mb); if (!ok) return; }
        close(b.value !== undefined ? (typeof b.value === 'function' ? b.value(mb) : b.value) : null);
      };
      $('.mf', bg).appendChild(el);
    });
    $('[data-x]', bg).onclick = () => close(null);
    const onKey = e => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const p = $('.mf .pri', bg); if (p) p.click(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    onOpen && onOpen(mb);
    const f = $('input[autofocus],textarea[autofocus]', mb); if (f) { f.focus(); f.select && f.select(); }
  });
}
const confirmBox = (msg, okText = 'Đồng ý', danger = true) => modal({
  title: 'Xác nhận', body: `<p style="margin:0">${msg}</p>`,
  buttons: [{ text: 'Hủy', value: false }, { text: okText, cls: danger ? 'pri' : 'pri', value: true }]
});
const promptBox = (title, label, def = '') => modal({
  title, body: `<label class="fld">${label}<input type="text" autofocus value="${esc(def)}"></label>`,
  buttons: [{ text: 'Hủy', value: null }, { text: 'Lưu', cls: 'pri', value: mb => $('input', mb).value.trim() || null }]
});

/* ---------------- IndexedDB ---------------- */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open('gkm-tinh-gia-von', 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('prices')) db.createObjectStore('prices', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kits')) db.createObjectStore('kits', { keyPath: 'id' });
      };
      rq.onsuccess = () => { this.db = rq.result; res(); };
      rq.onerror = () => rej(rq.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Giao dịch bị hủy (có thể hết dung lượng)'));
    });
  },
  all(store) { return this.tx(store, 'readonly', s => s.getAll()); },
  put(store, v) { return this.tx(store, 'readwrite', s => s.put(v)); },
  del(store, id) { return this.tx(store, 'readwrite', s => s.delete(id)); },
  clear(store) { return this.tx(store, 'readwrite', s => s.clear()); }
};

/* ---------------- trạng thái ---------------- */
const S = {
  prices: [],        // phiên bảng giá
  kits: [],          // phiên bộ nhựa
  idx: new Map(),    // cache chỉ mục tra cứu theo id phiên
  invoice: null,     // { fileName, lines:[{code,name,qty,manual}] }
  invFilter: 'all',
  kitView: null      // { sessId, kitId }
};

function priceIndex(sessId) {
  if (!sessId) return null;
  if (S.idx.has(sessId)) return S.idx.get(sessId);
  const sess = S.prices.find(p => p.id === sessId);
  if (!sess) return null;
  const exact = new Map(), loose = new Map();
  for (const it of sess.items) {
    const k = normCode(it.code);
    if (!exact.has(k)) exact.set(k, it);
    const l = looseCode(it.code);
    if (l && !loose.has(l)) loose.set(l, it);
  }
  const ix = { exact, loose, sess };
  S.idx.set(sessId, ix);
  return ix;
}
function lookup(ix, code) {
  if (!ix) return null;
  return ix.exact.get(normCode(code)) || ix.loose.get(looseCode(code)) || null;
}
function defaultPriceId(kind = 'inv') {
  const list = S.prices.filter(p => (p.kind || 'inv') === kind);
  const d = LS.get('defPrice.' + kind);
  if (d && list.some(p => p.id === d)) return d;
  return list.length ? list[list.length - 1].id : null;
}

/* ---------------- đọc file Excel/CSV ---------------- */
const FIELDS = {
  code: { label: 'Mã hàng', kw: ['ma hang', 'ma chi tiet', 'ma hang hoa', 'ma sp', 'ma san pham', 'ma phu tung', 'ma pt', 'ma vt', 'ma vat tu', 'part number', 'part no', 'sku', 'ma so', 'ma'] },
  name: { label: 'Tên hàng', kw: ['ten hang', 'ten tieng viet', 'ten hang hoa', 'ten san pham', 'ten sp', 'ten phu tung', 'ten vat tu', 'ten chi tiet', 'dien giai', 'mo ta', 'ten', 'san pham', 'chi tiet'] },
  cost: { label: 'Giá vốn', kw: ['gia von', 'don gia von', 'gia nhap', 'don gia nhap', 'gia goc', 'cost', 'von', 'don gia', 'gia'] },
  sell: { label: 'Giá bán', kw: ['gia ban', 'don gia ban', 'gia ban le', 'gia le', 'gia ban si', 'don gia', 'sale price', 'price'] },
  qty: { label: 'Số lượng', kw: ['so luong', 'sl', 'qty', 'quantity', 's.l', 'so luong ban', 'sl ban'] },
  kit: { label: 'Tên bộ / xe', kw: ['ma loai', 'bo nhua', 'ten bo nhua', 'ten bo', 'ten xe', 'dong xe', 'loai xe', 'mau xe', 'model', 'xe', 'bo'] }
};

function scoreHeader(cell, field) {
  const h = strip(cell);
  if (!h) return 0;
  const kws = FIELDS[field].kw;
  let best = 0;
  kws.forEach((k, i) => {
    let sc = 0;
    if (h === k) sc = 200 - i;
    else if (k.length > 3 && h.includes(k)) sc = 100 - i;
    else if (k.length <= 3 && new RegExp('(^|[^a-z])' + k.replace('.', '\\.') + '([^a-z]|$)').test(h) && h.length <= 12) sc = 60 - i;
    if (sc > best) best = sc;
  });
  // tránh nhầm "giá bán" thành giá vốn
  if (field === 'cost' && /ban|le|si|thanh tien|tong/.test(h) && !/von|nhap|goc/.test(h)) best = Math.min(best, 5);
  if (field === 'code' && /ten|gia/.test(h) && !/^ma/.test(h)) best = 0;
  if (field === 'sell' && /von|nhap|goc|giam/.test(h)) best = 0;
  return best;
}

function detectMapping(row, fields) {
  const cand = [];
  row.forEach((cell, c) => fields.forEach(f => { const s = scoreHeader(cell, f); if (s > 0) cand.push({ f, c, s }); }));
  cand.sort((a, b) => b.s - a.s);
  const map = {}, usedC = new Set();
  for (const x of cand) if (map[x.f] == null && !usedC.has(x.c)) { map[x.f] = x.c; usedC.add(x.c); }
  return map;
}
function detectHeaderRow(aoa, fields) {
  let best = -1, bestScore = 0;
  for (let r = 0; r < Math.min(aoa.length, 40); r++) {
    const m = detectMapping(aoa[r] || [], fields);
    const sc = Object.keys(m).length * 10 + (m.code != null ? 5 : 0);
    if (sc > bestScore) { bestScore = sc; best = r; }
  }
  return best; // -1 = không có tiêu đề
}

function sheetToAoa(ws) {
  if (!ws || !ws['!ref']) return { raw: [], txt: [] };
  const rg = XLSX.utils.decode_range(ws['!ref']);
  rg.s.r = 0; rg.s.c = 0;
  const opt = { header: 1, range: rg, blankrows: true, defval: '' };
  const raw = XLSX.utils.sheet_to_json(ws, { ...opt, raw: true });
  const txt = XLSX.utils.sheet_to_json(ws, { ...opt, raw: false });
  // điền ô gộp (merge) để tên bộ nhựa / tên xe không bị trống
  (ws['!merges'] || []).forEach(m => {
    const v = raw[m.s.r] && raw[m.s.r][m.s.c], t = txt[m.s.r] && txt[m.s.r][m.s.c];
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
      if (r === m.s.r && c === m.s.c) continue;
      if (raw[r]) { raw[r][c] = v; } if (txt[r]) { txt[r][c] = t; }
    }
  });
  return { raw, txt };
}

async function readWorkbook(file) {
  busy('Đang đọc file ' + file.name + '…'); await nextFrame();
  try { return await readWorkbook0(file); } finally { busy(null); }
}
async function readWorkbook0(file) {
  const buf = await file.arrayBuffer();
  let wb;
  if (/\.(csv|txt)$/i.test(file.name)) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1258').decode(buf);
    wb = XLSX.read(text, { type: 'string', raw: true }); // giữ nguyên chữ để đọc số kiểu VN (10.000) và mã có số 0 đầu
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: false });
  }
  const sheets = wb.SheetNames.map(n => ({ name: n, ...sheetToAoa(wb.Sheets[n]) })).filter(s => s.raw.length);
  return { buf, sheets, isZip: /\.(xlsx|xlsm)$/i.test(file.name) };
}
function textToSheets(text) {
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  const sep = rows.some(r => r.includes('\t')) ? '\t' : (rows.some(r => r.includes(';')) ? ';' : ',');
  const aoa = rows.map(r => r.split(sep).map(c => c.trim()));
  return [{ name: 'Dữ liệu dán', raw: aoa, txt: aoa }];
}
function cellCode(sh, r, c) {
  if (c == null) return '';
  const t = sh.txt[r] && sh.txt[r][c], v = sh.raw[r] && sh.raw[r][c];
  let s = String(t ?? '').trim();
  if (/^[\d.,]+E\+\d+$/i.test(s) && typeof v === 'number') s = String(v);
  return s;
}
const isTotalRow = v => /^(tong cong|tong tien|tong|cong|total|sum)\s*:?$/.test(strip(v));
const cellTxt = (sh, r, c) => c == null ? '' : String((sh.txt[r] || [])[c] ?? '').trim();
const cellNum = (sh, r, c) => c == null ? null : parseNum((sh.raw[r] || [])[c]);

/* ---------------- hộp thoại chọn cột ---------------- */
/**
 * kind: 'price' | 'invoice' | 'kit'
 * trả về { sheetIdx, headerRow, map, name, perSheet } hoặc null
 */
function mappingDialog({ kind, sheets, fileName, title }) {
  const fields = { price: ['code', 'name', 'cost', 'sell'], invoice: ['code', 'qty', 'name', 'sell'], kit: ['kit', 'code', 'name', 'qty', 'cost'] }[kind];
  const required = { price: ['code', 'cost'], invoice: ['code'], kit: ['code'] }[kind];
  const st = { sheetIdx: 0, headerRow: 0, map: {}, perSheet: false };
  // chọn sheet có nhiều dữ liệu nhất & tiêu đề tốt nhất
  let bestSc = -1;
  sheets.forEach((sh, i) => {
    const hr = detectHeaderRow(sh.raw, fields);
    const sc = (hr >= 0 ? Object.keys(detectMapping(sh.raw[hr], fields)).length * 1000 : 0) + Math.min(sh.raw.length, 999);
    if (sc > bestSc) { bestSc = sc; st.sheetIdx = i; }
  });
  const autoDetect = () => {
    const sh = sheets[st.sheetIdx];
    st.headerRow = detectHeaderRow(sh.raw, fields);
    st.map = st.headerRow >= 0 ? detectMapping(sh.raw[st.headerRow], fields) : {};
    if (st.headerRow < 0) { st.map = kind === 'invoice' ? { code: 0, qty: 1 } : kind === 'price' ? { code: 0, cost: 1 } : { code: 0 }; }
  };
  autoDetect();
  if (kind === 'kit' && sheets.length > 1 && st.map.kit == null) st.perSheet = true;
  // hóa đơn nhận đủ cột thì tính luôn, không hỏi lại
  if (kind === 'invoice' && st.headerRow >= 0 && st.map.code != null && st.map.qty != null) return Promise.resolve({ ...st, name: fileName });

  const defName = fileName.replace(/\.[^.]+$/, '');
  const body = document.createElement('div');
  body.innerHTML = `
    <div class="row">
      ${sheets.length > 1 ? `<label class="fld">Sheet<select data-sheet>${sheets.map((s, i) => `<option value="${i}">${esc(s.name)} (${s.raw.length} dòng)</option>`).join('')}</select></label>` : ''}
      <label class="fld">Dòng tiêu đề (0 = không có)<input type="number" min="0" data-hr style="width:110px"></label>
      ${kind !== 'invoice' ? `<label class="fld grow">Tên phiên lưu<input type="text" data-name value="${esc(defName)}"></label>` : ''}
    </div>
    ${kind === 'kit' && sheets.length > 1 ? `<label class="row small" style="margin-top:10px;gap:6px"><input type="checkbox" data-per> Mỗi sheet là một bộ nhựa (tên bộ = tên sheet), lấy tất cả ${sheets.length} sheet</label>` : ''}
    <div class="mapgrid" data-maps></div>
    <div class="small muted" data-info style="margin-bottom:6px"></div>
    <div class="tblwrap" style="max-height:42vh"><table data-prev></table></div>`;
  const shSel = $('[data-sheet]', body), hrIn = $('[data-hr]', body), per = $('[data-per]', body);

  const render = () => {
    const sh = sheets[st.sheetIdx];
    if (shSel) shSel.value = st.sheetIdx;
    hrIn.value = st.headerRow + 1;
    if (per) per.checked = st.perSheet;
    const hdr = st.headerRow >= 0 ? (sh.txt[st.headerRow] || []) : [];
    const ncol = Math.max(...sh.raw.slice(0, 60).map(r => r.length), hdr.length, 1);
    const opts = ['<option value="">— không có —</option>'];
    for (let c = 0; c < ncol; c++) opts.push(`<option value="${c}">${colName(c)}${hdr[c] ? ': ' + esc(String(hdr[c]).slice(0, 30)) : ''}</option>`);
    $('[data-maps]', body).innerHTML = fields.map(f => {
      if (f === 'kit' && st.perSheet) return '';
      const hint = f === 'cost' && kind === 'kit' ? ' <span class="muted">(bỏ trống = tra theo bảng giá)</span>' : '';
      return `<label class="fld">${FIELDS[f].label}${required.includes(f) ? ' <span class="req">*</span>' : ''}${hint}<select data-f="${f}">${opts.join('')}</select></label>`;
    }).join('');
    fields.forEach(f => { const s = $(`[data-f="${f}"]`, body); if (s) s.value = st.map[f] ?? ''; });
    $$('[data-f]', body).forEach(s => s.onchange = () => { st.map[s.dataset.f] = s.value === '' ? null : +s.value; render(); });
    // xem trước
    const show = fields.filter(f => st.map[f] != null && !(f === 'kit' && st.perSheet));
    const rows = [];
    for (let r = st.headerRow + 1; r < sh.raw.length && rows.length < 8; r++) {
      if (!cellCode(sh, r, st.map.code)) continue;
      rows.push(r);
    }
    let total = 0;
    for (let r = st.headerRow + 1; r < sh.raw.length; r++) if (cellCode(sh, r, st.map.code)) total++;
    $('[data-prev]', body).innerHTML = `<thead><tr><th>Dòng</th>${show.map(f => `<th class="${['cost', 'qty', 'sell'].includes(f) ? 'n' : ''}">${FIELDS[f].label}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><td class="muted">${r + 1}</td>${show.map(f => {
      if (f === 'cost' || f === 'qty' || f === 'sell') { const n = cellNum(sh, r, st.map[f]); return `<td class="n">${n == null ? (f === 'sell' ? '—' : '<span class="tag bad">trống</span>') : (f === 'qty' ? fmtQ(n) : fmt(n))}</td>`; }
      return `<td class="${f === 'code' ? 'code' : ''}">${esc(f === 'code' ? cellCode(sh, r, st.map[f]) : cellTxt(sh, r, st.map[f]))}</td>`;
    }).join('')}</tr>`).join('') || `<tr><td class="empty" colspan="9">Không thấy dòng dữ liệu nào: hãy chọn lại cột Mã hàng hoặc dòng tiêu đề.</td></tr>`}</tbody>`;
    $('[data-info]', body).textContent = `Tìm thấy ${total.toLocaleString('vi-VN')} dòng có mã hàng${st.perSheet ? ' (sheet đang xem)' : ''}. Xem trước 8 dòng đầu:`;
  };
  if (shSel) shSel.onchange = () => { st.sheetIdx = +shSel.value; autoDetect(); render(); };
  hrIn.onchange = () => {
    st.headerRow = Math.max(0, +hrIn.value || 0) - 1;
    const sh = sheets[st.sheetIdx];
    if (st.headerRow >= 0) { const m = detectMapping(sh.raw[st.headerRow] || [], fields); if (m.code != null) st.map = m; }
    render();
  };
  if (per) per.onchange = () => { st.perSheet = per.checked; render(); };
  render();

  return modal({
    title: title, body, wide: true,
    buttons: [
      { text: 'Hủy', value: null },
      {
        text: kind === 'invoice' ? 'Tính giá vốn' : 'Lưu phiên', cls: 'pri',
        validate: () => {
          const miss = required.filter(f => st.map[f] == null);
          if (miss.length) { toast('Chưa chọn cột: ' + miss.map(f => FIELDS[f].label).join(', '), 'bad'); return false; }
          return true;
        },
        value: () => ({ ...st, name: ($('[data-name]', body)?.value || defName).trim() || defName })
      }
    ]
  });
}

/* ---------------- ảnh trong Excel ---------------- */
const attr = (tag, n) => { const m = tag.match(new RegExp('\\b' + n.replace(':', '\\:') + '="([^"]*)"')); return m ? m[1] : null; };
function resolvePath(baseDir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (baseDir + target).split('/'), out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
const relsOf = p => dirOf(p) + '_rels/' + p.slice(p.lastIndexOf('/') + 1) + '.rels';
function parseRels(xml, baseDir) {
  const m = {};
  if (!xml) return m;
  for (const t of xml.match(/<Relationship\b[^>]*>/g) || []) m[attr(t, 'Id')] = resolvePath(baseDir, attr(t, 'Target'));
  return m;
}
/** Trả về { [tên sheet]: [{row, col, path}] } — gồm ảnh nổi (drawing) và ảnh trong ô (Place in cell) */
async function extractImages(buf) {
  if (typeof JSZip === 'undefined') return { zip: null, bySheet: {} };
  let zip;
  try { zip = await JSZip.loadAsync(buf); } catch { return { zip: null, bySheet: {} }; }
  const read = p => zip.file(p) ? zip.file(p).async('string') : Promise.resolve(null);
  const wbXml = await read('xl/workbook.xml');
  if (!wbXml) return { zip, bySheet: {} };
  const wbRels = parseRels(await read('xl/_rels/workbook.xml.rels'), 'xl/');

  // ảnh trong ô (Excel 365 "Place in cell")
  let richImgs = [];
  try {
    const rvRel = await read('xl/richData/richValueRel.xml');
    if (rvRel) {
      const relMap = parseRels(await read('xl/richData/_rels/richValueRel.xml.rels'), 'xl/richData/');
      const relList = (rvRel.match(/<rel\b[^>]*>/g) || []).map(t => relMap[attr(t, 'r:id')]);
      const structXml = await read('xl/richData/rdrichvaluestructure.xml') || '';
      const structs = (structXml.match(/<s\b[\s\S]*?<\/s>/g) || []).map(s => (s.match(/<k\b[^>]*>/g) || []).map(k => attr(k, 'n')));
      const rvXml = await read('xl/richData/rdrichvalue.xml') || '';
      const rvs = (rvXml.match(/<rv\b[\s\S]*?<\/rv>/g) || []).map(rv => {
        const s = +(attr(rv.match(/<rv\b[^>]*>/)[0], 's') || 0);
        const vals = [...rv.matchAll(/<v\b[^>]*>([^<]*)<\/v>/g)].map(m => m[1]);
        const keys = structs[s] || [];
        let ki = keys.indexOf('_rvRel:LocalImageIdentifier'); if (ki < 0) ki = 0;
        return relList[+vals[ki]] || null;
      });
      // vm -> rv qua metadata.xml
      const meta = await read('xl/metadata.xml');
      let vmToRv = null;
      if (meta) {
        const fm = (meta.match(/<futureMetadata\b[^>]*name="XLRICHVALUE"[\s\S]*?<\/futureMetadata>/) || [''])[0];
        const fmList = (fm.match(/<bk>[\s\S]*?<\/bk>/g) || []).map(b => { const m = b.match(/rvb\b[^>]*\bi="(\d+)"/); return m ? +m[1] : null; });
        const vmBlock = (meta.match(/<valueMetadata\b[\s\S]*?<\/valueMetadata>/) || [''])[0];
        vmToRv = (vmBlock.match(/<bk>[\s\S]*?<\/bk>/g) || []).map(b => { const m = b.match(/<rc\b[^>]*\bv="(\d+)"/); return m ? fmList[+m[1]] : null; });
      }
      richImgs = { rvs, vmToRv };
    }
  } catch (e) { console.warn('richData', e); }

  const bySheet = {};
  for (const t of wbXml.match(/<sheet\b[^>]*>/g) || []) {
    const name = attr(t, 'name').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const path = wbRels[attr(t, 'r:id')];
    if (!path) continue;
    const xml = await read(path);
    if (!xml) continue;
    const list = [];
    const sRels = parseRels(await read(relsOf(path)), dirOf(path));
    const dm = xml.match(/<drawing\b[^>]*r:id="([^"]+)"/);
    if (dm && sRels[dm[1]]) {
      const dPath = sRels[dm[1]];
      const dXml = await read(dPath);
      const dRels = parseRels(await read(relsOf(dPath)), dirOf(dPath));
      if (dXml) for (const a of dXml.match(/<(\w+:)?(twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/(\w+:)?(twoCellAnchor|oneCellAnchor)>/g) || []) {
        const from = a.match(/<(?:\w+:)?from>[\s\S]*?<(?:\w+:)?col>(\d+)<\/(?:\w+:)?col>[\s\S]*?<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/);
        const to = a.match(/<(?:\w+:)?to>[\s\S]*?<(?:\w+:)?row>(\d+)<\/(?:\w+:)?row>/);
        const emb = a.match(/r:embed="([^"]+)"/);
        if (from && emb && dRels[emb[1]]) list.push({ row: +from[2], rowEnd: to ? +to[1] : +from[2], col: +from[1], path: dRels[emb[1]] });
      }
    }
    if (richImgs.rvs) {
      for (const m of xml.matchAll(/<c\b[^>]*\bvm="(\d+)"[^>]*>/g)) {
        const ref = attr(m[0], 'r'); if (!ref) continue;
        const vm = +m[1];
        const rvi = richImgs.vmToRv && richImgs.vmToRv[vm - 1] != null ? richImgs.vmToRv[vm - 1] : vm - 1;
        const p = richImgs.rvs[rvi];
        if (p) { const rc = XLSX.utils.decode_cell(ref); list.push({ row: rc.r, rowEnd: rc.r, col: rc.c, path: p }); }
      }
    }
    if (list.length) bySheet[name] = list.sort((a, b) => a.row - b.row || a.col - b.col);
  }
  return { zip, bySheet };
}
async function compressImage(blob, max = 800) {
  try {
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * sc), h = Math.round(bmp.height * sc);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
    return await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.8));
  } catch { return null; }
}
const urlCache = new WeakMap();
function blobUrl(b) { if (!b) return ''; let u = urlCache.get(b); if (!u) { u = URL.createObjectURL(b); urlCache.set(b, u); } return u; }

/* ---------------- tính giá bán ---------------- */
const OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => b ? a / b : NaN, '%': (a, b) => a * (1 + b / 100) };
const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷', '%': '+%' };
function sellCfg(ctx) { return LS.get('sell.' + ctx, { op: '*', val: '', round: 0 }); }
function sellPrice(cost, cfg) {
  const v = parseNum(cfg.val);
  if (cost == null || v == null) return null;
  let r = OPS[cfg.op](cost, v);
  if (cfg.round && isFinite(r)) r = Math.round(r / cfg.round) * cfg.round;
  return r;
}
/** Vẽ ô tính giá bán; onChange gọi lại khi đổi cấu hình */
function renderSell(el, ctx, cost, onChange) {
  const cfg = sellCfg(ctx);
  const res = sellPrice(cost, cfg);
  const diff = res != null && cost != null ? res - cost : null;
  el.innerHTML = `
    <h2>💰 Tính giá bán</h2>
    <div class="formula">
      <span>Giá vốn <b>${fmt(cost)}</b></span>
      <div class="ops">${Object.keys(OPS).map(o => `<button data-op="${o}" class="${cfg.op === o ? 'on' : ''}" title="${o === '%' ? 'Cộng thêm phần trăm' : ''}">${OP_LABEL[o]}</button>`).join('')}</div>
      <input type="text" inputmode="decimal" data-val value="${esc(cfg.val)}" placeholder="${cfg.op === '%' ? 'vd 20' : cfg.op === '*' ? 'vd 1,3' : 'nhập số'}" style="width:140px;font-size:16px;font-weight:700">
      <span>=</span>
      <span class="res" data-res>${res == null ? '…' : fmt(res)}</span>
    </div>
    <div class="row small muted" style="margin-top:8px">
      <label class="row" style="gap:6px">Làm tròn
        <select data-round>${[[0, 'Không'], [100, '100'], [500, '500'], [1000, '1.000'], [5000, '5.000'], [10000, '10.000']].map(([v, t]) => `<option value="${v}" ${+cfg.round === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      </label>
      <span data-diff>${diff != null ? `Chênh lệch so với giá vốn: <b style="color:${diff >= 0 ? 'var(--ok)' : 'var(--bad)'}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b>${cost ? ` (${(diff / cost * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)` : ''}` : ''}</span>
    </div>`;
  const save = (patch, redraw) => { LS.set('sell.' + ctx, { ...sellCfg(ctx), ...patch }); onChange && onChange(); if (redraw) renderSell(el, ctx, cost, onChange); };
  $$('[data-op]', el).forEach(b => b.onclick = () => save({ op: b.dataset.op }, true));
  $('[data-round]', el).onchange = e => save({ round: +e.target.value }, true);
  const inp = $('[data-val]', el);
  inp.oninput = () => {
    LS.set('sell.' + ctx, { ...sellCfg(ctx), val: inp.value });
    const c = sellCfg(ctx), r = sellPrice(cost, c);
    $('[data-res]', el).textContent = r == null ? '…' : fmt(r);
    const d = r != null && cost != null ? r - cost : null;
    $('[data-diff]', el).innerHTML = d != null ? `Chênh lệch so với giá vốn: <b style="color:${d >= 0 ? 'var(--ok)' : 'var(--bad)'}">${d >= 0 ? '+' : ''}${fmt(d)}</b>${cost ? ` (${(d / cost * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)` : ''}` : '';
    onChange && onChange();
  };
}

/* ---------------- chọn file chung ---------------- */
function pickFile(accept) {
  return new Promise(res => {
    const inp = $('#filePick');
    inp.accept = accept || '.xlsx,.xls,.xlsm,.csv,.txt,.ods';
    inp.value = '';
    inp.onchange = () => res(inp.files[0] || null);
    inp.click();
  });
}
function setupDrop(el, onFile) {
  el.onclick = async () => { const f = await pickFile(); if (f) onFile(f); };
  el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
}

/* ================= BẢNG GIÁ VỐN ================= */
const KIND_LABEL = { inv: 'hóa đơn (hàng đang bán)', kit: 'bộ nhựa' };
const sessKind = p => p.kind || 'inv';
async function importPrices(file, replaceId, kind = 'inv') {
  let wb;
  try { wb = await readWorkbook(file); } catch (e) { console.error(e); return toast('Không đọc được file: ' + file.name, 'bad'); }
  if (!wb.sheets.length) return toast('File không có dữ liệu', 'bad');
  const old = replaceId ? S.prices.find(p => p.id === replaceId) : null;
  if (old) kind = sessKind(old);
  const r = await mappingDialog({ kind: 'price', sheets: wb.sheets, fileName: old ? old.name + '.x' : file.name, title: old ? `Cập nhật phiên “${esc(old.name)}”` : `Nhập bảng giá vốn ${KIND_LABEL[kind]}` });
  if (!r) return;
  const sh = wb.sheets[r.sheetIdx];
  const items = []; let noCost = 0;
  for (let i = r.headerRow + 1; i < sh.raw.length; i++) {
    const code = cellCode(sh, i, r.map.code);
    if (!code) continue;
    const cost = cellNum(sh, i, r.map.cost);
    if (cost == null) noCost++;
    items.push({ code, name: cellTxt(sh, i, r.map.name), cost, sell: cellNum(sh, i, r.map.sell) });
  }
  if (!items.length) return toast('Không có dòng nào có mã hàng', 'bad');
  const sess = old ? { ...old, name: r.name, fileName: file.name, items, updatedAt: Date.now() }
    : { id: uid(), kind, name: r.name, fileName: file.name, createdAt: Date.now(), items };
  try { await DB.put('prices', sess); } catch (e) { return toast('Lỗi lưu: ' + e.message, 'bad'); }
  S.idx.delete(sess.id);
  if (old) S.prices[S.prices.indexOf(old)] = sess; else S.prices.push(sess);
  if (!old && !S.prices.some(p => p.id === LS.get('defPrice.' + kind))) LS.set('defPrice.' + kind, sess.id);
  if (!old && kind === 'kit' && !S.prices.some(p => p.id === LS.get('kitPrice'))) LS.set('kitPrice', sess.id);
  toast(`Đã lưu ${items.length.toLocaleString('vi-VN')} sản phẩm vào phiên “${sess.name}”${noCost ? ` (${noCost} dòng không có giá)` : ''}`, 'ok', 4000);
  refreshAll();
}

function renderPriceList(kind, el) {
  const def = defaultPriceId(kind);
  const list = S.prices.filter(p => sessKind(p) === kind);
  if (!list.length) {
    el.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ic">📦</div>Chưa có bảng giá vốn ${KIND_LABEL[kind]}.</div>`;
    return;
  }
  el.innerHTML = [...list].reverse().map(p => `
    <div class="sesscard ${p.id === def ? 'def' : ''}" data-id="${p.id}">
      <div class="row"><span class="t grow">${esc(p.name)}</span>${p.id === def ? '<span class="tag info">Mặc định</span>' : ''}</div>
      <div class="small muted">${p.items.length.toLocaleString('vi-VN')} sản phẩm · ${esc(p.fileName || '')}</div>
      <div class="small muted">${p.updatedAt ? 'Cập nhật ' + fmtDate(p.updatedAt) : 'Nhập ' + fmtDate(p.createdAt)}</div>
      <div class="row" style="gap:6px;margin-top:4px">
        ${p.id !== def ? '<button class="btn sm" data-a="def">⭐ Đặt mặc định</button>' : ''}
        <button class="btn sm" data-a="upd" title="Thay dữ liệu bằng file mới, giữ tên phiên">🔄 Cập nhật</button>
        <button class="btn sm" data-a="ren" title="Đổi tên">✏️</button>
        <button class="btn sm" data-a="mv" title="Chuyển sang nhóm ${kind === 'inv' ? 'bộ nhựa' : 'hóa đơn'}">⇄</button>
        <button class="btn sm bad" data-a="del" title="Xóa">🗑️</button>
      </div>
    </div>`).join('');
  $$('[data-a]', el).forEach(b => b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id, p = S.prices.find(x => x.id === id);
    const a = b.dataset.a;
    if (a === 'def') { LS.set('defPrice.' + kind, id); if (kind === 'kit') LS.set('kitPrice', id); refreshAll(); }
    if (a === 'upd') { const f = await pickFile(); if (f) importPrices(f, id); }
    if (a === 'ren') { const n = await promptBox('Đổi tên phiên', 'Tên mới', p.name); if (n) { p.name = n; await DB.put('prices', p); refreshAll(); } }
    if (a === 'mv') {
      const to = kind === 'inv' ? 'kit' : 'inv';
      if (await confirmBox(`Chuyển phiên “<b>${esc(p.name)}</b>” sang nhóm bảng giá vốn <b>${KIND_LABEL[to]}</b>?`, 'Chuyển', false)) {
        p.kind = to; await DB.put('prices', p);
        if (!S.prices.some(x => x.id === LS.get('defPrice.' + to) && sessKind(x) === to)) LS.set('defPrice.' + to, id);
        refreshAll();
      }
    }
    if (a === 'del') {
      if (await confirmBox(`Xóa phiên bảng giá “<b>${esc(p.name)}</b>” (${p.items.length} sản phẩm)?`, 'Xóa')) {
        await DB.del('prices', id); S.prices = S.prices.filter(x => x.id !== id); S.idx.delete(id);
        toast('Đã xóa phiên'); refreshAll();
      }
    }
  });
}
function renderPrices() {
  renderPriceList('inv', $('#priceSessInv'));
  renderPriceList('kit', $('#priceSessKit'));
  const ls = $('#lookSess'), cur = ls.value || defaultPriceId('inv');
  const grp = k => S.prices.filter(p => sessKind(p) === k).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  ls.innerHTML = S.prices.length ? `<optgroup label="Hóa đơn (hàng đang bán)">${grp('inv')}</optgroup><optgroup label="Bộ nhựa">${grp('kit')}</optgroup>` : '<option value="">(chưa có bảng giá)</option>';
  if (S.prices.some(p => p.id === cur)) ls.value = cur;
  renderLookup();
}
function renderLookup() {
  const ix = priceIndex($('#lookSess').value);
  const q = strip($('#lookQ').value), m = makeMatcher($('#lookQ').value);
  const t = $('#lookTable');
  if (!ix) { t.innerHTML = ''; $('#lookInfo').textContent = ''; return; }
  const items = ix.sess.items;
  const res = [];
  for (const it of items) {
    if (!m || m(it.name, [it.code])) { res.push(it); if (res.length >= 200) break; }
  }
  $('#lookInfo').textContent = q ? `${res.length >= 200 ? '200+' : res.length} kết quả` : `${items.length.toLocaleString('vi-VN')} sản phẩm (hiện 200 đầu)`;
  t.innerHTML = `<thead><tr><th>Mã hàng</th><th>Tên hàng</th><th class="n">Giá vốn</th><th class="n">Giá bán</th></tr></thead><tbody>${res.map(it => `<tr><td class="code">${esc(it.code)}</td><td>${esc(it.name)}</td><td class="n">${it.cost == null ? '<span class="tag bad">trống</span>' : fmt(it.cost)}</td><td class="n">${it.sell == null ? '—' : fmt(it.sell)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Không tìm thấy</td></tr>'}</tbody>`;
}

/* ================= THÊM / BỚT SẢN PHẨM (dùng chung) ================= */
/** So sánh danh sách hiện tại với bản gốc: trả về thêm / bớt / đổi số lượng */
function diffLines(orig, cur) {
  const om = new Map((orig || []).map(o => [o.id, o]));
  const ids = new Set(cur.map(c => c.id));
  const added = [], removed = [], changed = [], recoded = [];
  cur.forEach(c => {
    const o = om.get(c.id);
    if (!o) { added.push(c); return; }
    if (normCode(o.code) !== normCode(c.code)) recoded.push({ c, o });
    if (+o.qty !== +c.qty) changed.push({ c, o });
  });
  (orig || []).forEach(o => { if (!ids.has(o.id)) removed.push(o); });
  return { added, removed, changed, recoded, any: added.length + removed.length + changed.length + recoded.length > 0 };
}
function noticeHtml(d, what) {
  if (!d.any) return '';
  const li = [];
  if (d.added.length) li.push(`<li><b>Thêm ${d.added.length} món:</b> ${d.added.map(x => `<span class="code">${esc(x.code)}</span> (SL ${fmtQ(x.qty)})`).join(', ')}</li>`);
  if (d.removed.length) li.push(`<li><b>Bớt ${d.removed.length} món:</b> ${d.removed.map(x => `<span class="code">${esc(x.code)}</span> (SL ${fmtQ(x.qty)})`).join(', ')}</li>`);
  if (d.recoded.length) li.push(`<li><b>Đổi mã thay thế ${d.recoded.length} món:</b> ${d.recoded.map(x => `<span class="code">${esc(x.o.code)}</span> → <span class="code">${esc(x.c.code)}</span>`).join(', ')}</li>`);
  if (d.changed.length) li.push(`<li><b>Đổi số lượng ${d.changed.length} món:</b> ${d.changed.map(x => `<span class="code">${esc(x.c.code)}</span> ${fmtQ(x.o.qty)} → ${fmtQ(x.c.qty)}`).join(', ')}</li>`);
  return `<div class="notice">⚠️ <b>${what} đã được chỉnh sửa (thêm / bớt / đổi) so với bản gốc.</b><ul>${li.join('')}</ul></div>`;
}
function noticeText(d, what) {
  if (!d.any) return [];
  const out = [`LƯU Ý: ${what} đã được thêm / bớt sản phẩm so với bản gốc`];
  if (d.added.length) out.push('Thêm: ' + d.added.map(x => `${x.code} (SL ${x.qty})`).join(', '));
  if (d.removed.length) out.push('Bớt: ' + d.removed.map(x => `${x.code} (SL ${x.qty})`).join(', '));
  if (d.recoded.length) out.push('Đổi mã: ' + d.recoded.map(x => `${x.o.code} → ${x.c.code}`).join(', '));
  if (d.changed.length) out.push('Đổi SL: ' + d.changed.map(x => `${x.c.code} ${x.o.qty} → ${x.c.qty}`).join(', '));
  return out;
}
/** Tìm trong các bảng giá theo mã hoặc tên (không dấu), trả về tối đa `max` món, mã trùng chỉ lấy 1 */
function searchItems(sessIds, q, max = 8) {
  const qc = looseCode(q), m = makeMatcher(q), out = [], seen = new Set();
  if (!m) return out;
  for (const id of sessIds) {
    const ix = priceIndex(id); if (!ix) continue;
    // ưu tiên mã bắt đầu bằng chữ gõ vào, sau đó mới tới mã/tên có chứa
    for (const pass of [0, 1]) {
      for (const it of ix.sess.items) {
        const lc = looseCode(it.code);
        const hit = pass === 0 ? (qc && lc.startsWith(qc)) : m(it.name, [it.code]);
        if (hit && !seen.has(lc)) { seen.add(lc); out.push(it); if (out.length >= max) return out; }
      }
    }
  }
  return out;
}
/** Danh sách gợi ý thả xuống dưới một ô nhập */
function attachSuggest(input, searchFn, onPick) {
  const box = document.createElement('div');
  box.className = 'suggest hide';
  input.parentNode.style.position = 'relative';
  input.after(box);
  let items = [], hi = -1, t;
  const close = () => { box.classList.add('hide'); hi = -1; };
  const draw = () => {
    box.innerHTML = items.map((it, i) => `<div data-i="${i}" class="${i === hi ? 'on' : ''}"><span class="code">${esc(it.code)}</span> <span>${esc(it.name || '')}</span>${it.cost != null ? `<span class="muted"> · vốn ${fmt(it.cost)}</span>` : ''}</div>`).join('');
    box.classList.toggle('hide', !items.length);
    box.style.left = input.offsetLeft + 'px'; box.style.top = (input.offsetTop + input.offsetHeight + 2) + 'px';
    $$('div[data-i]', box).forEach(d => d.onmousedown = e => { e.preventDefault(); onPick(items[+d.dataset.i]); close(); });
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { items = input.value.trim() ? searchFn(input.value.trim()) : []; hi = -1; draw(); }, 120); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    if (box.classList.contains('hide')) return;
    if (e.key === 'ArrowDown') { hi = Math.min(items.length - 1, hi + 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && hi >= 0) { onPick(items[hi]); close(); e.preventDefault(); e.stopImmediatePropagation(); }
    else if (e.key === 'Escape') { close(); e.stopPropagation(); }
  });
}
/** Ô thêm sản phẩm: gõ mã/tên → gợi ý → Thêm */
function renderAddRow(el, lookupFn, onAdd, searchFn) {
  el.innerHTML = `<div class="addrow">
    <b>➕ Thêm sản phẩm</b>
    <input type="text" data-code placeholder="Gõ mã hoặc tên hàng…" style="width:220px" autocomplete="off">
    <input type="text" inputmode="decimal" data-qty value="1" style="width:70px" title="Số lượng">
    <button class="btn sm pri" data-add>Thêm</button>
    <span class="small muted" data-hint></span></div>`;
  const code = $('[data-code]', el), qty = $('[data-qty]', el), hint = $('[data-hint]', el);
  code.oninput = () => {
    const v = code.value.trim();
    if (!v) { hint.textContent = ''; return; }
    const it = lookupFn(v);
    hint.innerHTML = it ? `✓ ${esc(it.name || '')}${it.cost != null ? ' · giá vốn ' + fmt(it.cost) : ''}` : '<span style="color:var(--bad)">Không có trong bảng giá (vẫn thêm được)</span>';
  };
  const go = () => {
    const c = code.value.trim(); if (!c) { code.focus(); return; }
    const q = parseNum(qty.value); if (!q) return toast('Số lượng không hợp lệ', 'bad');
    onAdd(c, q); code.value = ''; qty.value = '1'; hint.textContent = ''; code.focus();
  };
  $('[data-add]', el).onclick = go;
  if (searchFn) attachSuggest(code, searchFn, it => { code.value = it.code; code.oninput(); qty.focus(); qty.select(); });
  code.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  qty.onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ================= HÓA ĐƠN ================= */
function saveInvoice() { try { sessionStorage.setItem('gkm.invoice', JSON.stringify(S.invoice)); } catch { } }
async function loadInvoice(sheets, fileName) {
  const r = await mappingDialog({ kind: 'invoice', sheets, fileName, title: 'Chọn cột của hóa đơn' });
  if (!r) return;
  const sh = sheets[r.sheetIdx];
  const lines = [];
  for (let i = r.headerRow + 1; i < sh.raw.length; i++) {
    const code = cellCode(sh, i, r.map.code);
    if (!code) continue;
    if (isTotalRow(code)) continue;
    let qty = r.map.qty != null ? cellNum(sh, i, r.map.qty) : 1;
    if (qty == null) qty = 1;
    lines.push({ id: uid(), code, name: cellTxt(sh, i, r.map.name), qty, sell: cellNum(sh, i, r.map.sell), manual: null });
  }
  if (!lines.length) return toast('Không có dòng nào có mã hàng', 'bad');
  S.invoice = { fileName, lines, orig: lines.map(l => ({ id: l.id, code: l.code, qty: l.qty })), origFull: JSON.parse(JSON.stringify(lines)) };
  S.invFilter = 'all';
  $('#invSearch').value = '';
  saveInvoice();
  renderInvoice();
  toast(`Đã đọc ${lines.length} dòng hóa đơn`, 'ok');
}
function computeInvoice() {
  const ix = priceIndex($('#invPriceSel').value);
  let total = 0, qty = 0, miss = 0, sellTotal = 0, sellMiss = 0, profitSell = 0, profitSkip = 0;
  const profitAcc = { v: 0 };
  const rows = S.invoice.lines.map((l, i) => {
    const it = lookup(ix, l.code);
    let cost = it ? it.cost : null, status = it ? (it.cost == null ? 'nocost' : 'ok') : 'miss';
    if (cost == null && l.manual != null) { cost = l.manual; status = 'manual'; }
    if (status === 'miss' || status === 'nocost') miss++;
    const amount = cost != null ? cost * l.qty : null;
    if (amount != null) total += amount;
    const sell = l.sell != null ? l.sell : (it && it.sell != null ? it.sell : null);
    const sellFrom = l.sell != null ? 'file' : (sell != null ? 'table' : null);
    const sellAmt = sell != null ? sell * l.qty : null;
    if (sellAmt != null) sellTotal += sellAmt; else sellMiss++;
    const profit = sellAmt != null && amount != null ? sellAmt - amount : null;
    if (profit != null) { profitAcc.v += profit; profitSell += sellAmt; } else profitSkip++;
    qty += l.qty;
    return { i, l, it, cost, amount, status, sell, sellFrom, sellAmt, profit, name: l.name || (it && it.name) || '' };
  });
  return { rows, total, qty, miss, sellTotal, sellMiss, profit: profitAcc.v, profitSell, profitSkip };
}
const pct = (a, b) => b ? (a / b * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%' : '';
function renderInvoice() {
  const has = !!S.invoice;
  $('#invResult').classList.toggle('hide', !has);
  $('#invClear').classList.toggle('hide', !has);
  $('#invFileName').textContent = has ? '📄 ' + S.invoice.fileName : '';
  if (!has) return;
  if (!S.invoice.orig) { S.invoice.lines.forEach(l => l.id = l.id || uid()); S.invoice.orig = S.invoice.lines.map(l => ({ id: l.id, code: l.code, qty: l.qty })); }
  const c = computeInvoice();
  $('#sLines').textContent = c.rows.length;
  $('#sQty').textContent = 'Tổng SL: ' + fmtQ(c.qty);
  $('#sMiss').textContent = c.miss;
  $('#sMissBox').className = 'stat ' + (c.miss ? 'bad' : 'ok');
  $('#sTotal').textContent = fmt(c.total);
  $('#sSell').textContent = fmt(c.sellTotal);
  $('#sSellNote').textContent = c.sellMiss ? `${c.sellMiss} món chưa có giá bán` : '';
  $('#sProfit').textContent = (c.profit >= 0 ? '+' : '') + fmt(c.profit);
  $('#sProfit').style.color = c.profit >= 0 ? 'var(--ok)' : 'var(--bad)';
  const nLoss = c.rows.filter(r => r.profit != null && r.profit < 0).length;
  $('#sLoss').textContent = nLoss ? `⚠️ ${nLoss} món bán lỗ` : '';
  $('#sProfitPct').textContent = (c.profitSell ? 'Tỷ lệ lãi / giá bán: ' + pct(c.profit, c.profitSell) : '') + (c.profitSkip ? ` · chưa tính ${c.profitSkip} món thiếu giá` : '');
  $$('#invFilter button').forEach(b => b.classList.toggle('on', b.dataset.f === S.invFilter));
  renderSell($('#invSell'), 'inv', c.total);
  drawInvTable(c);
  const d = diffLines(S.invoice.orig, S.invoice.lines);
  $('#invNotice').innerHTML = noticeHtml(d, 'Hóa đơn');
  $('#invReset').classList.toggle('hide', !d.any);
}
function drawInvTable(c) {
  const m = makeMatcher($('#invSearch').value);
  const rows = c.rows.filter(r => (S.invFilter === 'all' || (S.invFilter === 'loss' ? r.profit != null && r.profit < 0 : (r.status === 'miss' || r.status === 'nocost' || r.status === 'manual')))
    && (!m || m(r.name, [r.l.code])));
  const added = new Set(diffLines(S.invoice.orig, S.invoice.lines).added.map(x => x.id));
  $('#invTable').innerHTML = `<thead><tr><th class="n">#</th><th>Mã hàng</th><th>Tên hàng</th><th class="n">SL</th><th class="n">Giá vốn</th><th class="n">Giá bán</th><th class="n">Tiền vốn</th><th class="n">Tiền bán</th><th class="n">Chênh lệch</th><th></th><th></th></tr></thead>
  <tbody>${rows.map(r => {
    const bad = r.status === 'miss' || r.status === 'nocost';
    const loss = r.profit != null && r.profit < 0;
    return `<tr class="${bad ? 'miss' : loss ? 'loss' : r.status === 'manual' ? 'manual' : ''}">
      <td class="n muted">${r.i + 1}</td>
      <td class="code">${esc(r.l.code)}${added.has(r.l.id) ? ' <span class="tag info">mới thêm</span>' : ''}${r.it && normCode(r.it.code) !== normCode(r.l.code) ? `<div class="small muted">≈ ${esc(r.it.code)}</div>` : ''}</td>
      <td>${esc(r.name)}</td>
      <td class="n"><input class="qty" data-q="${r.i}" value="${fmtQ(r.l.qty)}"></td>
      <td class="n">${bad || r.status === 'manual' ? `<input class="cost" data-i="${r.i}" placeholder="gõ giá…" value="${r.l.manual != null ? fmt(r.l.manual) : ''}">` : fmt(r.cost)}</td>
      <td class="n">${r.sellFrom !== 'file' || r.l.sellManual ? `<input class="cost" data-s="${r.i}" placeholder="giá bán…" value="${r.sell != null ? fmt(r.sell) : ''}">${r.sellFrom === 'table' && !r.l.sellManual ? '<div class="small muted">theo bảng giá</div>' : ''}` : fmt(r.sell)}</td>
      <td class="n">${fmt(r.amount)}</td>
      <td class="n">${fmt(r.sellAmt)}</td>
      <td class="n"><b style="color:${r.profit == null ? 'inherit' : r.profit >= 0 ? 'var(--ok)' : 'var(--bad)'}">${r.profit == null ? '—' : (r.profit >= 0 ? '+' : '') + fmt(r.profit)}</b>${r.profit != null && r.sellAmt ? `<div class="small muted">${pct(r.profit, r.sellAmt)}</div>` : ''}</td>
      <td style="white-space:nowrap">${loss ? '<span class="tag loss">Bán lỗ</span> ' : ''}${r.status === 'miss' ? '<span class="tag bad">Không có mã</span>' : r.status === 'nocost' ? '<span class="tag bad">Chưa có giá</span>' : r.status === 'manual' ? '<span class="tag warn">Giá tay</span>' : '<span class="tag ok">✓</span>'}</td>
      <td><button class="btn sm bad" data-del="${r.i}" title="Bớt món này">✕</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="11" class="empty">${S.invFilter === 'miss' ? '🎉 Không có mã nào bị thiếu' : S.invFilter === 'loss' ? '🎉 Không có món nào bán lỗ' : 'Không có dòng phù hợp'}</td></tr>`}</tbody>
  <tfoot><tr><td></td><td colspan="2">TỔNG CỘNG</td><td class="n">${fmtQ(c.qty)}</td><td></td><td></td><td class="n">${fmt(c.total)}</td><td class="n">${fmt(c.sellTotal)}</td><td class="n" style="color:${c.profit >= 0 ? 'var(--ok)' : 'var(--bad)'}">${(c.profit >= 0 ? '+' : '') + fmt(c.profit)}</td><td></td><td></td></tr></tfoot>`;
  $$('#invTable input.cost[data-i]').forEach(inp => inp.onchange = () => {
    S.invoice.lines[+inp.dataset.i].manual = parseNum(inp.value); saveInvoice(); renderInvoice();
  });
  $$('#invTable input[data-s]').forEach(inp => inp.onchange = () => {
    const l = S.invoice.lines[+inp.dataset.s]; l.sell = parseNum(inp.value); l.sellManual = true; saveInvoice(); renderInvoice();
  });
  $$('#invTable input.qty').forEach(inp => inp.onchange = () => {
    const v = parseNum(inp.value); if (!v) { toast('Số lượng không hợp lệ', 'bad'); renderInvoice(); return; }
    S.invoice.lines[+inp.dataset.q].qty = v; saveInvoice(); renderInvoice();
  });
  $$('#invTable [data-del]').forEach(b => b.onclick = () => {
    S.invoice.lines.splice(+b.dataset.del, 1); saveInvoice(); renderInvoice(); toast('Đã bớt 1 món');
  });
}
function exportInvoice() {
  const c = computeInvoice();
  const head = ['STT', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Giá vốn', 'Giá bán', 'Tiền vốn', 'Tiền bán', 'Chênh lệch', 'Ghi chú'];
  const added = new Set(diffLines(S.invoice.orig, S.invoice.lines).added.map(x => x.id));
  const data = [head, ...c.rows.map(r => [r.i + 1, r.l.code, r.name, r.l.qty, r.cost, r.sell, r.amount, r.sellAmt, r.profit,
  [r.status === 'miss' ? 'Không có mã trong bảng giá' : r.status === 'nocost' ? 'Chưa có giá vốn' : r.status === 'manual' ? 'Giá vốn nhập tay' : '', added.has(r.l.id) ? 'Mới thêm' : ''].filter(Boolean).join('; ')])];
  data.push([], ['', 'TỔNG CỘNG', '', c.qty, '', '', c.total, c.sellTotal, c.profit]);
  const cfg = sellCfg('inv'), sp = sellPrice(c.total, cfg);
  if (sp != null) data.push(['', `GIÁ BÁN THEO CÔNG THỨC (giá vốn ${OP_LABEL[cfg.op]} ${cfg.val})`, '', '', '', '', sp]);
  const notes = noticeText(diffLines(S.invoice.orig, S.invoice.lines), 'Hóa đơn');
  if (notes.length) { data.push([]); notes.forEach(n => data.push(['', n])); }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 40 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 26 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gia von');
  XLSX.writeFile(wb, 'GiaVon_' + S.invoice.fileName.replace(/\.[^.]+$/, '') + '.xlsx');
}

/* ================= BỘ NHỰA ================= */
async function importKits(file) {
  let wb;
  try { wb = await readWorkbook(file); } catch (e) { console.error(e); return toast('Không đọc được file: ' + file.name, 'bad'); }
  if (!wb.sheets.length) return toast('File không có dữ liệu', 'bad');
  const r = await mappingDialog({ kind: 'kit', sheets: wb.sheets, fileName: file.name, title: 'Nhập bảng bộ nhựa' });
  if (!r) return;
  busy('Đang xử lý dữ liệu…'); await nextFrame();
  try { await importKits2(file, wb, r); } finally { busy(null); }
}
async function importKits2(file, wb, r) {
  const base = wb.sheets[r.sheetIdx];
  const hdrText = f => r.headerRow >= 0 && r.map[f] != null ? strip((base.txt[r.headerRow] || [])[r.map[f]]) : null;
  const kits = [];
  const ranges = []; // {kit, sheet, from, to}
  const process = (sh, map, hr, kitNameFixed) => {
    let cur = null, ended = false;
    const startKit = (name, row) => {
      ended = false;
      cur = { id: uid(), name, parts: [], images: [] };
      kits.push(cur); ranges.push({ kit: cur, sheet: sh.name, from: row, to: row });
    };
    if (kitNameFixed) startKit(kitNameFixed, hr + 1);
    for (let i = hr + 1; i < sh.raw.length; i++) {
      const code = cellCode(sh, i, map.code);
      if (!kitNameFixed && map.kit != null) {
        const kn = cellTxt(sh, i, map.kit);
        if (kn && isTotalRow(kn)) { if (cur) ranges[ranges.length - 1].to = i; ended = true; continue; }
        if (kn && (!cur || ended || strip(kn) !== strip(cur.name))) startKit(kn, i);
      }
      if (ended) continue;
      if (!cur) startKit(r.name, i);
      ranges[ranges.length - 1].to = i;
      if (!code || isTotalRow(code)) continue;
      let qty = map.qty != null ? cellNum(sh, i, map.qty) : 1; if (qty == null) qty = 1;
      cur.parts.push({ id: uid(), code, name: cellTxt(sh, i, map.name), qty, cost: cellNum(sh, i, map.cost) });
    }
  };
  if (r.perSheet) {
    for (const sh of wb.sheets) {
      // tìm lại cột theo tên tiêu đề của sheet mẫu
      const fields = ['code', 'name', 'qty', 'cost'];
      let hr = detectHeaderRow(sh.raw, fields), map = {};
      if (hr >= 0) {
        const hdr = (sh.txt[hr] || []).map(strip);
        fields.forEach(f => { const t = hdrText(f); const c = t ? hdr.indexOf(t) : -1; if (c >= 0) map[f] = c; });
        const auto = detectMapping(sh.raw[hr], fields);
        fields.forEach(f => { if (map[f] == null && auto[f] != null) map[f] = auto[f]; });
      } else { map = { ...r.map }; hr = r.headerRow; }
      if (map.code == null) continue;
      process(sh, map, hr, sh.name);
    }
  } else process(base, r.map, r.headerRow, null);

  // ảnh
  let nImg = 0;
  if (wb.isZip) {
    try {
      const { zip, bySheet } = await extractImages(wb.buf);
      const cache = {};
      for (const sheetName in bySheet) {
        const kr = ranges.filter(x => x.sheet === sheetName);
        if (!kr.length) continue;
        for (const im of bySheet[sheetName]) {
          let target;
          if (r.perSheet) target = kr[0];
          else {
            target = kr.find(x => im.row >= x.from && im.row <= x.to)
              || kr.find(x => im.rowEnd >= x.from && im.row <= x.to)
              || kr.reduce((b, x) => Math.abs(x.from - im.row) < Math.abs(b.from - im.row) ? x : b, kr[0]);
          }
          if (!zip.file(im.path)) continue;
          if (!(im.path in cache) && Object.keys(cache).length % 20 === 0) { busy(`Đang lấy ảnh xe… ${Object.keys(cache).length} ảnh`); await nextFrame(); }
          if (!(im.path in cache)) cache[im.path] = await compressImage(await zip.file(im.path).async('blob'));
          const b = cache[im.path];
          if (b && !target.kit.images.includes(b)) { target.kit.images.push(b); nImg++; }
        }
      }
    } catch (e) { console.warn('Lỗi đọc ảnh', e); }
  }
  const good = kits.filter(k => k.parts.length);
  if (!good.length) return toast('Không đọc được bộ nhựa nào (thiếu mã hàng?)', 'bad');
  good.forEach(ensureKit);
  const nAlt = applyAltMap(good);
  const sess = { id: uid(), name: r.name, fileName: file.name, createdAt: Date.now(), kits: good };
  try { await DB.put('kits', sess); } catch (e) { return toast('Lỗi lưu: ' + e.message, 'bad'); }
  S.kits.push(sess);
  good.forEach(ensureKit);
  $('#kitSessSel').value = sess.id;
  toast(`Đã lưu ${good.length} bộ nhựa${nImg ? `, ${nImg} ảnh` : ''} vào phiên “${sess.name}”${nAlt ? `, tự thay ${nAlt} mã theo mã thay thế đã chọn trước` : ''}`, 'ok', 5000);
  renderKits();
}

function ensureKit(k) {
  if (k.orig) return;
  k.parts.forEach(p => { if (!p.id) p.id = uid(); });
  k.orig = k.parts.map(p => ({ id: p.id, code: p.code, qty: p.qty }));
  k.origFull = k.parts.map(p => ({ ...p }));
}
function kitPriceSource() { return $('#kitPriceSel').value; }
function kitSaleSource() { return $('#kitSaleSel').value; }
function computeKit(kit) {
  ensureKit(kit);
  const src = kitPriceSource();
  const ix = src && src !== 'file' ? priceIndex(src) : null;
  const sx = kitSaleSource() ? priceIndex(kitSaleSource()) : null;
  let total = 0, miss = 0, notSold = 0, short = 0;
  const rows = kit.parts.map((p, i) => {
    let cost = p.cost, from = 'file', it = null;
    if (ix) { it = lookup(ix, p.code); cost = it && it.cost != null ? it.cost : null; from = 'table'; }
    if (p.manual != null && cost == null) { cost = p.manual; from = 'manual'; }
    if (cost == null) miss++;
    const sold = sx ? !!lookup(sx, p.code) : true;
    if (!sold) notSold++;
    const stock = stockOf(p.code);
    if (stock != null && stock < p.qty) short++;
    const amount = cost != null ? cost * p.qty : null;
    if (amount != null) total += amount;
    return { stock,  i, p, cost, amount, from, sold, name: p.name || (it && it.name) || '' };
  });
  return { rows, total, miss, notSold, short };
}
/* Dòng xe: nhận từ tên bộ nhựa (chịu được lỗi gõ trong file như "Ari Blade", "Balde", "Visonn", "Wale Alpha") */
const LINES = [
  ['SH Mode', /\bsh ?mode/],
  ['SH 125 / 150 / 160', /\bsh ?\d|\bsh\d|\bsh\b/],
  ['Air Blade', /\ba[ir]{2} ?b[la]{2}de|\bab ?\d/],
  ['Blade (xe số)', /\bb[la]{2}de/],
  ['Lead', /\blead/],
  ['Vision', /\bvis+i?o?n+/],
  ['Future', /\bfuture/],
  ['Wave Alpha', /\bwa[vl]e ?(alpha|anpha|α|a\b)|\balpha\b/],
  ['Wave RSX', /\brsx/],
  ['Wave (110S, RS, ZX…)', /\bwa[vl]e/],
  ['Dream', /dream|\bsuper\b/],
  ['Winner (xe côn tay)', /\bwinner/],
  ['Vario', /\bvario/],
  ['Click', /\bclick/],
  ['PCX', /\bpcx/],
  ['Sonic', /\bsonic/],
  ['CBR / xe côn khác', /\bcbr|\bcb\d|\bmsx/],
];
const OTHER_LINE = 'Dòng khác';
function kitLine(name) {
  const n = String(name || '').normalize('NFC').toLowerCase().replace(/đ/g, 'd');
  for (const [label, re] of LINES) if (re.test(n)) return label;
  return OTHER_LINE;
}
const lineOrder = l => { const i = LINES.findIndex(x => x[0] === l); return i < 0 ? 999 : i; };
/** Bộ nhựa theo phiên đang chọn (chưa lọc dòng xe) */
function kitsInSession() {
  const f = $('#kitSessSel').value;
  const out = [];
  S.kits.forEach(s => { if (!f || f === s.id) s.kits.forEach(k => { if (!k.line) k.line = kitLine(k.name); out.push({ s, k }); }); });
  return out;
}
/** Bộ nhựa theo phiên + dòng xe đang chọn (dùng cho danh sách và nút Trước/Sau) */
function allKits() {
  const line = S.kitLine || '';
  const list = kitsInSession().filter(x => !line || x.k.line === line);
  return line ? list : list.sort((a, b) => lineOrder(a.k.line) - lineOrder(b.k.line));
}
function renderLineChips() {
  const all = kitsInSession(), cnt = {};
  all.forEach(({ k }) => cnt[k.line] = (cnt[k.line] || 0) + 1);
  const lines = Object.keys(cnt).sort((a, b) => lineOrder(a) - lineOrder(b));
  if (S.kitLine && !cnt[S.kitLine]) S.kitLine = '';
  $('#kitLines').innerHTML = all.length ? [['', `Tất cả (${all.length})`], ...lines.map(l => [l, `${l} (${cnt[l]})`])]
    .map(([v, t]) => `<button class="chip ${v === (S.kitLine || '') ? 'on' : ''}" data-line="${esc(v)}">${esc(t)}</button>`).join('') : '';
  $$('#kitLines [data-line]').forEach(b => b.onclick = () => { S.kitLine = b.dataset.line; LS.set('kitLine', S.kitLine); renderKits(); window.scrollTo(0, 0); });
}
function renderKitSelects() {
  const ss = $('#kitSessSel'), cur = ss.value;
  ss.innerHTML = `<option value="">Tất cả phiên (${S.kits.reduce((a, s) => a + s.kits.length, 0)} bộ)</option>` + S.kits.map(s => `<option value="${s.id}">${esc(s.name)} (${s.kits.length})</option>`).join('');
  if (S.kits.some(s => s.id === cur)) ss.value = cur;
  const kitTables = S.prices.filter(p => sessKind(p) === 'kit');
  const ps = $('#kitPriceSel'), pcur = LS.get('kitPrice');
  ps.innerHTML = kitTables.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') + `<option value="file">Giá có sẵn trong file bộ nhựa</option>`;
  ps.value = [...ps.options].some(o => o.value === pcur) ? pcur : (kitTables.length ? (defaultPriceId('kit') || kitTables[0].id) : 'file');
  $('#kitNoPrice').classList.toggle('hide', !!kitTables.length);
  const sale = $('#kitSaleSel'), scur = LS.get('kitSale') ?? defaultPriceId('inv') ?? '';
  sale.innerHTML = `<option value="">Không đối chiếu</option>` + S.prices.filter(p => sessKind(p) === 'inv').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  sale.value = [...sale.options].some(o => o.value === scur) ? scur : (defaultPriceId('inv') || '');
}
function renderKits() {
  renderKitSelects();
  const m = makeMatcher($('#kitSearch').value, 5);
  renderLineChips();
  const list = allKits().filter(({ k }) => !m || m(k.name + ' ' + (k.line || ''), k.parts.map(p => p.code)));
  let lastLine = null;
  const grid = $('#kitGrid');
  if (!S.kits.length) grid.innerHTML = `<div class="card empty" style="grid-column:1/-1"><div class="ic">🏍️</div>Chưa có bảng bộ nhựa nào.<br>Bấm <b>➕ Nhập bảng bộ nhựa</b> để thêm (có thể kèm ảnh xe trong Excel).</div>`;
  else if (!list.length) grid.innerHTML = `<div class="card empty" style="grid-column:1/-1">Không tìm thấy bộ nhựa phù hợp</div>`;
  else grid.innerHTML = list.map(({ s, k }) => {
    const c = computeKit(k), img = k.images[0], edited = diffLines(k.orig, k.parts).any;
    let hdr = '';
    if (!S.kitLine && k.line !== lastLine) { lastLine = k.line; hdr = `<h3 class="linehdr">${esc(k.line)} <span class="muted small">${list.filter(x => x.k.line === k.line).length} bộ</span></h3>`; }
    return hdr + `<div class="kit" data-s="${s.id}" data-k="${k.id}">
      <div class="img">${img ? `<img loading="lazy" decoding="async" src="${blobUrl(img)}" alt="">` : '🏍️'}</div>
      <div class="b"><div class="nm">${esc(k.name)}</div>
      <div class="small muted">${k.parts.length} món${edited ? ' · <span style="color:var(--warn)">đã chỉnh sửa</span>' : ''}<span class="costcol">${c.miss ? ` · <span style="color:var(--bad)">${c.miss} thiếu giá</span>` : ''}${c.notSold ? ` · <span style="color:#7c3aed">${c.notSold} chưa mở bán</span>` : ''}${loadStock() ? (c.short ? ` · <span style="color:#b91c1c;font-weight:600">${c.short} món thiếu hàng</span>` : ' · <span style="color:#15803d">đủ hàng</span>') : ''}</span></div>
      <div class="tt costcol">${fmt(c.total)}</div><div class="tt sellcol">${(() => { const v = sellPrice(c.total, sellCfg('kit')); return v == null ? '' : fmt(v); })()}</div></div></div>`;
  }).join('');
  $$('.kit', grid).forEach(el => el.onclick = () => openKit(el.dataset.s, el.dataset.k));

  const sl = $('#kitSessList');
  sl.innerHTML = S.kits.length ? [...S.kits].reverse().map(s => `<div class="sesscard" data-id="${s.id}">
    <div class="t">${esc(s.name)}</div>
    <div class="small muted">${s.kits.length} bộ · ${s.kits.reduce((a, k) => a + k.images.length, 0)} ảnh · ${esc(s.fileName || '')}</div>
    <div class="small muted">Nhập ${fmtDate(s.createdAt)}</div>
    <div class="row" style="gap:6px"><button class="btn sm" data-a="ren">✏️ Đổi tên</button><button class="btn sm bad" data-a="del">🗑️ Xóa</button></div></div>`).join('')
    : '<div class="muted small">Chưa có phiên nào.</div>';
  $$('[data-a]', sl).forEach(b => b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id, s = S.kits.find(x => x.id === id);
    if (b.dataset.a === 'ren') { const n = await promptBox('Đổi tên phiên', 'Tên mới', s.name); if (n) { s.name = n; await DB.put('kits', s); renderKits(); } }
    if (b.dataset.a === 'del' && await confirmBox(`Xóa phiên bộ nhựa “<b>${esc(s.name)}</b>” (${s.kits.length} bộ)?`, 'Xóa')) {
      await DB.del('kits', id); S.kits = S.kits.filter(x => x.id !== id); toast('Đã xóa phiên'); renderKits();
    }
  });
}
let kdImgIdx = 0;
function openKit(sId, kId) {
  S.kitView = { sId, kId }; kdImgIdx = 0;
  $('#kitList').classList.add('hide'); $('#kitDetail').classList.remove('hide');
  renderKitDetail(); window.scrollTo(0, 0);
}
function curKit() {
  if (!S.kitView) return null;
  const s = S.kits.find(x => x.id === S.kitView.sId); if (!s) return null;
  return { s, k: s.kits.find(x => x.id === S.kitView.kId) };
}
async function saveKit(s) { try { await DB.put('kits', s); } catch (e) { toast('Lỗi lưu: ' + e.message, 'bad'); } }
function renderKitDetail() {
  const ck = curKit(); if (!ck || !ck.k) { closeKit(); return; }
  const { s, k } = ck;
  const c = computeKit(k);
  const src = $('#kitPriceSel').selectedOptions[0], sale = $('#kitSaleSel').selectedOptions[0];
  $('#kdSess').textContent = `Phiên: ${s.name} · Giá vốn: ${src ? src.text : ''}${kitSaleSource() ? ' · Đối chiếu hàng đang bán: ' + sale.text : ''}${loadStock() ? ` · Tồn kho lúc ${fmtTime(loadStock().at)}${c.short ? ` (${c.short} món thiếu hàng)` : ' (đủ hàng)'}` : ''}`;
  $('#kdName').textContent = k.name;
  $('#kdLine').textContent = '🏍️ ' + (k.line || kitLine(k.name));
  $('#kdCount').textContent = k.parts.length;
  $('#kdMiss').textContent = c.miss; $('#kdMissBox').className = 'stat costcol ' + (c.miss ? 'bad' : 'ok');
  $('#kdNotSold').textContent = kitSaleSource() ? c.notSold : '—';
  $('#kdTotal').textContent = fmt(c.total);
  if (kdImgIdx >= k.images.length) kdImgIdx = 0;
  const img = k.images[kdImgIdx];
  const big = $('#kdImg');
  big.style.backgroundImage = img ? `url('${blobUrl(img)}')` : ''; big.textContent = img ? '' : '🏍️';
  $('#kdDelImg').classList.toggle('hide', !img);
  $('#kdThumbs').innerHTML = k.images.length > 1 ? k.images.map((b, i) => `<div data-i="${i}" class="${i === kdImgIdx ? 'on' : ''}" style="background-image:url('${blobUrl(b)}')"></div>`).join('') : '';
  $$('#kdThumbs div').forEach(d => d.onclick = () => { kdImgIdx = +d.dataset.i; renderKitDetail(); });

  const scfg = sellCfg('kit'), sellTotal = sellPrice(c.total, scfg);
  // giá bán từng món chỉ có nghĩa với phép × ÷ +% (phép + − áp cho cả bộ)
  const perPart = ['*', '/', '%'].includes(scfg.op) && sellTotal != null;
  const ps = r => perPart ? sellPrice(r.cost, scfg) : null;
  $('#kdSellTotal').textContent = sellTotal == null ? 'Chưa đặt' : fmt(sellTotal);
  const sc = perPart ? 'sellcol' : 'hide';
  const added = new Set(diffLines(k.orig, k.parts).added.map(x => x.id));
  $('#kdTable').innerHTML = `<thead><tr><th class="n">#</th><th>Mã hàng</th><th>Tên chi tiết</th><th class="n">SL</th>${loadStock() ? '<th class="n costcol" title="Tồn kho KiotViet">Tồn</th>' : ''}<th class="n costcol">Giá vốn</th><th class="n costcol">Thành tiền</th><th class="n ${sc}">Đơn giá</th><th class="n ${sc}">Thành tiền</th><th class="costcol"></th><th class="costcol"></th></tr></thead>
  <tbody>${c.rows.map(r => `<tr class="${r.cost == null ? 'miss' : r.from === 'manual' ? 'manual' : ''}">
    <td class="n muted">${r.i + 1}</td>
    <td class="code">${esc(r.p.code)}${added.has(r.p.id) ? ' <span class="tag info costcol">mới thêm</span>' : ''}</td>
    <td>${esc(r.name)}</td>
    <td class="n"><span class="sellcol">${fmtQ(r.p.qty)}</span><input class="qty costcol" data-q="${r.i}" value="${fmtQ(r.p.qty)}"></td>
    ${loadStock() ? `<td class="n costcol">${stockCell(r)}</td>` : ''}
    <td class="n costcol">${r.cost == null || r.from === 'manual' ? `<input class="cost" data-i="${r.i}" placeholder="gõ giá…" value="${r.p.manual != null ? fmt(r.p.manual) : ''}">` : fmt(r.cost)}</td>
    <td class="n costcol"><b>${fmt(r.amount)}</b></td>
    <td class="n ${sc}">${fmt(ps(r))}</td><td class="n ${sc}"><b>${ps(r) == null ? '—' : fmt(ps(r) * r.p.qty)}</b></td>
    <td class="costcol" style="white-space:nowrap">${r.sold ? '' : `<span class="tag sold" title="Mã này không có trong bảng hàng đang bán: cần tìm mã thay thế">Chưa mở bán</span> <button class="btn sm" data-alt="${r.i}" title="Tìm mã thay thế trong hàng đang bán">🔍 Mã thay thế</button>`}</td>
    <td class="costcol"><button class="btn sm bad" data-del="${r.i}" title="Bớt món này">✕</button></td></tr>`).join('')}</tbody>
  <tfoot><tr><td></td><td colspan="2"><span class="costcol">TỔNG GIÁ VỐN BỘ</span><span class="sellcol">TỔNG CẢ BỘ</span></td><td class="n">${fmtQ(k.parts.reduce((a, p) => a + p.qty, 0))}</td>${loadStock() ? '<td class="costcol"></td>' : ''}<td class="costcol"></td><td class="n costcol">${fmt(c.total)}</td><td class="${sc}"></td><td class="n sellcol">${sellTotal == null ? '' : fmt(sellTotal)}</td><td class="costcol"></td><td class="costcol"></td></tr></tfoot>`;
  $$('#kdTable input.cost').forEach(inp => inp.onchange = async () => {
    k.parts[+inp.dataset.i].manual = parseNum(inp.value); await saveKit(s); renderKitDetail();
  });
  $$('#kdTable input.qty').forEach(inp => inp.onchange = async () => {
    const v = parseNum(inp.value); if (!v) { toast('Số lượng không hợp lệ', 'bad'); renderKitDetail(); return; }
    k.parts[+inp.dataset.q].qty = v; await saveKit(s); renderKitDetail();
  });
  $$('#kdTable [data-alt]').forEach(b => b.onclick = () => pickAltCode(s, k, +b.dataset.alt));
  $$('#kdTable [data-del]').forEach(b => b.onclick = async () => {
    k.parts.splice(+b.dataset.del, 1); await saveKit(s); renderKitDetail(); toast('Đã bớt 1 món');
  });
  const d = diffLines(k.orig, k.parts);
  $('#kdNotice').innerHTML = noticeHtml(d, 'Bộ nhựa này');
  $('#kdReset').classList.toggle('hide', !d.any);
  renderSell($('#kitSell'), 'kit', c.total, () => { const v = sellPrice(c.total, sellCfg('kit')); $('#kdSellTotal').textContent = v == null ? 'Chưa đặt' : fmt(v); });
  const list = allKits(), pos = list.findIndex(x => x.k.id === k.id);
  $('#kitPrev').disabled = pos <= 0; $('#kitNext').disabled = pos < 0 || pos >= list.length - 1;
  $('#kitPrev').onclick = () => { const x = list[pos - 1]; if (x) openKit(x.s.id, x.k.id); };
  $('#kitNext').onclick = () => { const x = list[pos + 1]; if (x) openKit(x.s.id, x.k.id); };
}
/** Gợi ý mã thay thế: tìm trong hàng đang bán các mã có phần đầu giống nhất */
function altCandidates(code, max = 30) {
  const sx = priceIndex(kitSaleSource()); if (!sx) return { prefix: '', list: [] };
  const lc = looseCode(code);
  for (let n = lc.length - 1; n >= 5; n--) {
    const pre = lc.slice(0, n), list = [];
    for (const it of sx.sess.items) if (looseCode(it.code).startsWith(pre)) { list.push(it); if (list.length >= max) break; }
    if (list.length) return { prefix: pre, list };
  }
  return { prefix: '', list: [] };
}
async function pickAltCode(s, k, i) {
  const part = k.parts[i];
  const kx = kitPriceSource() !== 'file' ? priceIndex(kitPriceSource()) : null;
  const body = document.createElement('div');
  const first = altCandidates(part.code);
  body.innerHTML = `<p style="margin-top:0">Mã <b class="code">${esc(part.code)}</b> ${esc(part.name || '')} chưa có trong hàng đang bán.</p>
    <input type="search" data-q placeholder="Tìm mã hoặc tên khác…" style="width:100%" value="${esc(first.prefix)}">
    <p class="small muted" data-info></p>
    <div class="tblwrap" style="max-height:50vh"><table data-t></table></div>`;
  const draw = list => {
    $('[data-info]', body).textContent = list.length ? `${list.length} mã gợi ý, bấm “Chọn” để thay vào bộ nhựa:` : 'Không tìm thấy mã gần giống, thử gõ phần đầu mã ngắn hơn hoặc tên hàng.';
    $('[data-t]', body).innerHTML = `<thead><tr><th>Mã đang bán</th><th>Tên hàng</th><th class="n">Giá vốn</th><th></th></tr></thead><tbody>${list.map((it, j) => {
      const kc = kx ? lookup(kx, it.code) : null, cost = kc && kc.cost != null ? kc.cost : it.cost;
      return `<tr><td class="code">${esc(it.code)}</td><td>${esc(it.name || '')}</td><td class="n">${fmt(cost)}</td><td><button class="btn sm pri" data-j="${j}">Chọn</button></td></tr>`;
    }).join('')}</tbody>`;
    $$('[data-j]', body).forEach(b => b.onclick = async () => {
      const it = list[+b.dataset.j], old = part.code;
      $('.modal-bg [data-x]').click();
      await applyAltCode(old, it, s, k, i);
    });
  };
  draw(first.list);
  let t; $('[data-q]', body).oninput = e => { clearTimeout(t); t = setTimeout(() => draw(searchItems([kitSaleSource()], e.target.value, 30)), 150); };
  await modal({ title: '🔍 Tìm mã thay thế', body, wide: true, buttons: [{ text: 'Đóng', value: null }] });
}
/* Mã thay thế dùng chung: thay trong mọi bộ nhựa của mọi phiên, và nhớ lại để áp cho file bộ nhựa nhập sau */
function altMap() { return LS.get('altMap', {}); }
function replacePart(p, it) { p.code = it.code; p.name = it.name || p.name; p.cost = null; p.manual = null; }
async function applyAltCode(oldCode, it, s, k, i) {
  const lo = looseCode(oldCode), hits = [];
  S.kits.forEach(ss => ss.kits.forEach(kk => kk.parts.forEach((p, j) => { if (looseCode(p.code) === lo && !(ss === s && kk === k && j === i)) hits.push({ ss, kk, p }); })));
  const nKit = new Set(hits.map(h => h.kk).concat([k])).size - 1, nSess = new Set(hits.map(h => h.ss)).size;
  let all = true;
  if (hits.length) {
    all = await modal({ title: 'Thay mã ở đâu?', body: `<p style="margin-top:0">Mã <b class="code">${esc(oldCode)}</b> còn xuất hiện ${hits.length} lần trong ${nKit ? `<b>${nKit} bộ nhựa khác</b>` : 'chính bộ này'} (${nSess} phiên). Thay bằng <b class="code">${esc(it.code)}</b>:</p>`,
      buttons: [{ text: 'Chỉ món này', value: false }, { text: `Thay tất cả (khuyên dùng)`, value: true, cls: 'pri' }] });
    if (all == null) return;
  }
  ensureKit(k); replacePart(k.parts[i], it);
  const changed = new Set([s]);
  if (all) {
    hits.forEach(h => { ensureKit(h.kk); replacePart(h.p, it); changed.add(h.ss); });
    const m = altMap(); m[lo] = { code: it.code, name: it.name || '' }; LS.set('altMap', m);
  }
  for (const ss of changed) await saveKit(ss);
  renderKitDetail();
  toast(all ? `Đã thay ${oldCode} → ${it.code}${hits.length ? ` ở ${hits.length + 1} chỗ, trong ${nKit + 1} bộ nhựa` : ''}. Lần nhập bộ nhựa sau cũng tự thay.` : `Đã thay bằng mã ${it.code}`, 'ok', 5000);
}
/** Áp các mã thay thế đã nhớ cho bộ nhựa mới nhập. Trả về số món đã thay. */
function applyAltMap(kits) {
  const m = altMap(); let n = 0;
  if (!Object.keys(m).length) return 0;
  kits.forEach(k => k.parts.forEach(p => { const r = m[looseCode(p.code)]; if (r && looseCode(r.code) !== looseCode(p.code)) { replacePart(p, r); n++; } }));
  return n;
}
/* ===== Tồn kho: lấy từ file Danh sách hàng hóa xuất từ KiotViet (cột Mã hàng + Tồn kho) ===== */
let STOCK = null;
function loadStock() { if (STOCK === null) STOCK = LS.get('stock', null) || false; return STOCK || null; }
function stockOf(code) { const st = loadStock(); if (!st) return null; const v = st.map[looseCode(code)]; return v == null ? null : v; }
const metaDB = () => new Promise((res, rej) => { const r = indexedDB.open('gkm-meta', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function metaGet(k) { try { const db = await metaDB(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } }
async function metaSet(k, v) { try { const db = await metaDB(); await new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = res; }); } catch { } }
const fmtTime = t => new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
/** Tìm file DanhSachSanPham mới nhất trong thư mục Tải về đã chọn */
async function newestStockFile(dir) {
  let best = null;
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/^danh ?sach ?san ?pham.*\.(xlsx|xls|csv)$/i.test(strip(name).replace(/[^a-z0-9. _-]/g, ''))) continue;
    const f = await h.getFile();
    if (!best || f.lastModified > best.lastModified) best = f;
  }
  return best;
}
/* ===== Lấy tồn kho tự động qua chương trình GKM Tồn kho (thư mục tonkho, chạy nền trên máy) ===== */
const TK = 'http://127.0.0.1:47321';
async function tkPing() {
  try { const r = await fetch(TK + '/ping', { cache: 'no-store', signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function kvShop(ask) {
  let shop = LS.get('kvShop', '');
  if (!shop || ask) {
    const v = await promptBox('Địa chỉ KiotViet của cửa hàng', 'Phần đầu địa chỉ trang KiotViet, ví dụ trang <b>abc.kiotviet.vn</b> thì gõ <b>abc</b>', shop);
    if (v == null) return null;
    shop = String(v).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.kiotviet\.vn.*$/, '').replace(/[^a-z0-9-]/g, '');
    if (!shop) return null;
    LS.set('kvShop', shop);
  }
  return shop;
}
async function stockAuto() {
  const shop = await kvShop(false); if (!shop) return;
  busy('Đang vào KiotViet lấy tồn kho… (khoảng 20 – 60 giây)');
  let r;
  try { r = await fetch(`${TK}/export?shop=${encodeURIComponent(shop)}`, { cache: 'no-store', signal: AbortSignal.timeout(240000) }); }
  catch (e) { busy(null); return toast('Không lấy được tồn kho: ' + (e.name === 'TimeoutError' ? 'quá lâu không xong' : e.message), 'bad', 5000); }
  if (r.status === 409) {
    busy(null);
    const go = await modal({ title: '🔑 Cần đăng nhập KiotViet', body: `<p style="margin-top:0">Chương trình lấy tồn kho dùng một cửa sổ Edge <b>riêng</b> (không đụng tới Chrome anh đang dùng). Cửa sổ đó chưa đăng nhập KiotViet hoặc đã hết hạn đăng nhập.</p>
      <p>Bấm <b>Mở cửa sổ đăng nhập</b>, đăng nhập KiotViet <b>${esc(shop)}</b> trong cửa sổ hiện ra (nhớ tích <i>Duy trì đăng nhập</i> nếu có), rồi <b>đóng cửa sổ đó</b> và bấm lại nút Lấy tồn kho.</p>`,
      buttons: [{ text: 'Đổi địa chỉ cửa hàng', value: 'shop' }, { text: 'Mở cửa sổ đăng nhập', value: 'login', cls: 'pri' }] });
    if (go === 'shop') { await kvShop(true); return; }
    if (go === 'login') { try { await fetch(`${TK}/login?shop=${encodeURIComponent(shop)}`, { cache: 'no-store' }); } catch { } }
    return;
  }
  if (!r.ok) {
    busy(null);
    let m = 'HTTP ' + r.status; try { m = (await r.json()).message || m; } catch { }
    return toast('Không lấy được tồn kho: ' + m, 'bad', 6000);
  }
  const blob = await r.blob();
  let name = 'DanhSachSanPham.xlsx'; try { name = decodeURIComponent(r.headers.get('X-File-Name') || name); } catch { }
  busy(null);
  await loadStockFile(new File([blob], name, { lastModified: Date.now() }));
}
async function fetchStock() {
  if (await tkPing()) return stockAuto();
  const how = await modal({ title: '📦 Lấy tồn kho', body: `<p style="margin-top:0"><b>Chương trình GKM Tồn kho chưa chạy trên máy này.</b> Chương trình giúp app tự vào KiotViet lấy tồn kho mới nhất (dùng cửa sổ Edge riêng, không đụng Chrome của anh).</p>
    <p>Cài một lần: mở thư mục app, vào thư mục <b>tonkho</b>, bấm đúp file <b>cai-dat.bat</b>. Xong quay lại bấm nút Lấy tồn kho.</p>
    <p class="small muted" style="margin-bottom:0">Hoặc dùng cách cũ: xuất file Danh sách hàng hóa từ KiotViet rồi lấy từ thư mục Tải về.</p>`,
    buttons: [{ text: 'Dùng file trong Tải về', value: 'file' }, { text: 'Đã cài, thử lại', value: 'retry', cls: 'pri' }] });
  if (how === 'retry') { if (await tkPing()) return stockAuto(); return toast('Vẫn chưa thấy chương trình GKM Tồn kho chạy. Hãy bấm đúp tonkho\\cai-dat.bat trong thư mục app.', 'bad', 6000); }
  if (how === 'file') return fetchStockFromDownloads();
}
async function fetchStockFromDownloads() {
  let file = null;
  if (typeof window.showDirectoryPicker === 'function') {
    let dir = await metaGet('dlDir');
    if (dir) { try { if ((await dir.requestPermission({ mode: 'read' })) !== 'granted') dir = null; } catch { dir = null; } }
    if (!dir) {
      const ok = await modal({ title: '📦 Lấy tồn kho', body: `<p style="margin-top:0">Lần đầu, anh chọn thư mục <b>Tải về (Downloads)</b>, nơi máy lưu file xuất từ KiotViet. Lần sau app tự tìm file mới nhất ở đó.</p>`,
        buttons: [{ text: 'Hủy', value: false }, { text: 'Chọn thư mục', value: true, cls: 'pri' }] });
      if (!ok) return;
      try { dir = await window.showDirectoryPicker({ id: 'gkm-downloads', startIn: 'downloads', mode: 'read' }); await metaSet('dlDir', dir); }
      catch (e) { if (e.name !== 'AbortError') toast('Không mở được thư mục: ' + e.message, 'bad'); return; }
    }
    file = await newestStockFile(dir);
    if (!file) { toast('Chưa thấy file DanhSachSanPham trong thư mục ' + dir.name + '. Vào KiotViet → Hàng hóa → Xuất file trước.', 'bad', 6000); return; }
    const ageMin = (Date.now() - file.lastModified) / 60000;
    if (ageMin > 30 && !await confirmBox(`File mới nhất là <b>${esc(file.name)}</b>, xuất lúc <b>${fmtTime(file.lastModified)}</b> (${ageMin > 1440 ? Math.round(ageMin / 1440) + ' ngày' : ageMin > 90 ? Math.round(ageMin / 60) + ' giờ' : Math.round(ageMin) + ' phút'} trước), có thể đã cũ.<br><br>Muốn tồn kho mới nhất: vào KiotViet → <b>Hàng hóa</b> → <b>Xuất file</b>, rồi bấm lại nút này.`, 'Vẫn dùng file này', false)) return;
  } else {
    file = await pickFile(); if (!file) return;
  }
  await loadStockFile(file);
}
async function loadStockFile(file) {
  let r;
  try { r = await readWorkbook(file); } catch (e) { return toast('Không đọc được file: ' + e.message, 'bad'); }
  for (const sh of r.sheets) {
    for (let h = 0; h < Math.min(10, sh.raw.length); h++) {
      const row = sh.raw[h].map(x => strip(x));
      const ci = row.indexOf('ma hang'), ti = row.findIndex(x => x === 'ton kho' || x === 'ton');
      if (ci < 0 || ti < 0) continue;
      const map = {}; let n = 0;
      for (let i = h + 1; i < sh.raw.length; i++) {
        const code = looseCode(sh.raw[i][ci]); if (!code) continue;
        const v = parseNum(sh.raw[i][ti]); map[code] = v == null ? 0 : v; n++;
      }
      STOCK = { at: file.lastModified || Date.now(), fileName: file.name, n, map };
      try { LS.set('stock', STOCK); } catch (e) { toast('Không lưu được tồn kho: ' + e.message, 'bad'); }
      renderStockBtn();
      if (S.kitView) renderKitDetail(); else renderKits();
      return toast(`Đã lấy tồn kho ${n.toLocaleString('vi-VN')} mã (file xuất lúc ${fmtTime(STOCK.at)})`, 'ok', 4500);
    }
  }
  toast('File này không có cột “Mã hàng” và “Tồn kho”. Hãy dùng file Danh sách hàng hóa xuất từ KiotViet.', 'bad', 6000);
}
function renderStockBtn() {
  const st = loadStock(), b = $('#stockBtn'); if (!b) return;
  b.textContent = st ? `📦 Tồn kho (${fmtTime(st.at)})` : '📦 Lấy tồn kho';
  b.title = st ? `Tồn kho theo file ${st.fileName}. Bấm để lấy lại từ file mới nhất trong thư mục Tải về.` : 'Lấy tồn kho từ file Danh sách hàng hóa xuất từ KiotViet';
}
const stockCell = r => r.stock == null ? (loadStock() ? '<span class="muted">—</span>' : '') : r.stock <= 0 ? '<span class="tag out">Hết</span>' : r.stock < r.p.qty ? `<span class="tag out">${fmtQ(r.stock)}</span>` : fmtQ(r.stock);
function kitLookup(code) {
  const src = kitPriceSource();
  return (src && src !== 'file' ? lookup(priceIndex(src), code) : null) || (kitSaleSource() ? lookup(priceIndex(kitSaleSource()), code) : null);
}
async function printKitQuote() {
  const ck = curKit(); if (!ck) return;
  const { k } = ck, c = computeKit(k), cfg = sellCfg('kit'), total = sellPrice(c.total, cfg);
  if (total == null) { toast('Hãy đặt công thức giá bán (ô Tính giá bán phía dưới) trước khi in báo giá', 'bad', 4500); return; }
  if (c.miss && !await confirmBox(`Có <b>${c.miss} món chưa có giá vốn</b> nên giá trọn bộ đang thiếu các món đó. Vẫn in báo giá?`, 'Vẫn in', false)) return;
  const perPart = ['*', '/', '%'].includes(cfg.op);
  const img = k.images[kdImgIdx] || k.images[0];
  const notes = noticeText(diffLines(k.orig, k.parts), 'Bộ nhựa');
  $('#printArea').innerHTML = `
    <div class="pq">
      <div class="pq-h"><div><div class="pq-brand">GKM</div><div class="pq-sub">BÁO GIÁ BỘ NHỰA</div></div><div class="pq-date">Ngày ${new Date().toLocaleDateString('vi-VN')}</div></div>
      <h1>${esc(k.name)}</h1>
      ${img ? `<img class="pq-img" src="${blobUrl(img)}" alt="">` : ''}
      <table><thead><tr><th>#</th><th>Mã hàng</th><th>Tên chi tiết</th><th class="n">SL</th>${perPart ? '<th class="n">Đơn giá</th><th class="n">Thành tiền</th>' : ''}</tr></thead>
      <tbody>${c.rows.map(r => { const p = perPart ? sellPrice(r.cost, cfg) : null; return `<tr><td>${r.i + 1}</td><td>${esc(r.p.code)}</td><td>${esc(r.name)}</td><td class="n">${fmtQ(r.p.qty)}</td>${perPart ? `<td class="n">${fmt(p)}</td><td class="n">${p == null ? '—' : fmt(p * r.p.qty)}</td>` : ''}</tr>`; }).join('')}</tbody></table>
      <div class="pq-total">Giá trọn bộ: <b>${fmt(total)} đ</b></div>
      ${notes.length ? `<div class="pq-note">${notes.map(esc).join('<br>')}</div>` : ''}
    </div>`;
  const im = $('#printArea img');
  const go = () => { document.body.classList.add('printing'); window.print(); };
  if (im && !im.complete) { im.onload = im.onerror = go; } else go();
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
function applyCust() {
  const on = !!LS.get('cust', false);
  document.body.classList.toggle('cust', on);
  $$('[data-cust]').forEach(b => { b.classList.toggle('on', on); b.textContent = on ? '👁 Hiện giá vốn' : '🙈 Ẩn giá vốn'; b.title = on ? 'Đang ở chế độ cho khách xem: giá vốn bị ẩn' : 'Ẩn giá vốn để đưa màn hình cho khách xem (chỉ hiện giá bán)'; });
}
/** Làm mới: đưa mọi bộ nhựa về bản gốc (bỏ mã thay thế, thêm/bớt/SL), quên mã thay thế đã nhớ, xóa hóa đơn đang làm.
 *  Giữ nguyên bảng giá vốn, các phiên bộ nhựa gốc, ảnh xe và giá vốn tự điền tay. */
async function resetWork() {
  let nKit = 0;
  const dirty = [];
  S.kits.forEach(ss => { let ch = false; ss.kits.forEach(k => { if (k.origFull && diffLines(k.orig, k.parts).any) { nKit++; ch = true; } }); if (ch) dirty.push(ss); });
  const nAlt = Object.keys(altMap()).length, hasInv = !!S.invoice;
  if (!nKit && !nAlt && !hasInv) return toast('Không có gì cần làm mới: bộ nhựa đang là bản gốc và chưa có hóa đơn.', 'ok', 3500);
  const li = [];
  if (nKit) li.push(`<li>Đưa <b>${nKit} bộ nhựa</b> đã sửa (mã thay thế, thêm / bớt món, số lượng) về bản gốc trong file</li>`);
  if (nAlt) li.push(`<li>Quên <b>${nAlt} mã thay thế</b> đã nhớ (lần nhập sau không tự thay nữa)</li>`);
  if (hasInv) li.push(`<li>Xóa hóa đơn đang làm</li>`);
  const ok = await modal({ title: '🧹 Làm mới', body: `<p style="margin-top:0">App sẽ:</p><ul>${li.join('')}</ul>
    <p class="small muted" style="margin-bottom:0">Giữ nguyên: bảng giá vốn, các phiên bộ nhựa, ảnh xe, giá vốn anh tự điền tay.</p>`,
    buttons: [{ text: 'Hủy', value: false }, { text: 'Làm mới', value: true, cls: 'pri' }] });
  if (!ok) return;
  S.kits.forEach(ss => ss.kits.forEach(k => {
    if (!k.origFull || !diffLines(k.orig, k.parts).any) return;
    const manual = new Map(k.parts.map(p => [p.id, p.manual]));
    k.parts = k.origFull.map(p => ({ ...p, manual: manual.get(p.id) ?? p.manual }));
  }));
  for (const ss of dirty) await saveKit(ss);
  LS.set('altMap', {});
  S.invoice = null; try { sessionStorage.removeItem('gkm.invoice'); } catch { }
  renderInvoice();
  if (S.kitView) renderKitDetail(); else renderKits();
  toast('Đã làm mới. Bộ nhựa về bản gốc, hóa đơn đã xóa.', 'ok', 4000);
}
function closeKit() { S.kitView = null; $('#kitDetail').classList.add('hide'); $('#kitList').classList.remove('hide'); renderKits(); }
async function addKitImages(files) {
  const ck = curKit(); if (!ck) return;
  let n = 0;
  for (const f of files) { const b = await compressImage(f); if (b) { ck.k.images.unshift(b); n++; } }
  if (!n) return toast('Không đọc được ảnh', 'bad');
  kdImgIdx = 0;
  try { await DB.put('kits', ck.s); } catch (e) { return toast('Lỗi lưu ảnh: ' + e.message, 'bad'); }
  toast('Đã thêm ảnh', 'ok'); renderKitDetail();
}

/* ================= KHỞI ĐỘNG ================= */
function renderPriceSelects() {
  const sel = $('#invPriceSel'), cur = sel.value || defaultPriceId('inv');
  const list = S.prices.filter(p => sessKind(p) === 'inv');
  sel.innerHTML = list.map(p => `<option value="${p.id}">${esc(p.name)} (${p.items.length.toLocaleString('vi-VN')})</option>`).join('') || '<option value="">(chưa có)</option>';
  sel.value = list.some(p => p.id === cur) ? cur : (defaultPriceId('inv') || '');
  $('#invNoPrice').classList.toggle('hide', !!list.length);
}
function refreshAll() {
  renderPriceSelects(); renderPrices(); renderInvoice();
  if (S.kitView) { renderKitSelects(); renderKitDetail(); } else renderKits();
}
async function loadAll() {
  S.prices = (await DB.all('prices')).sort((a, b) => a.createdAt - b.createdAt);
  S.kits = (await DB.all('kits')).sort((a, b) => a.createdAt - b.createdAt);
  S.idx.clear();
  // chuyển dữ liệu phiên bản cũ
  if (LS.get('defPrice') && !LS.get('defPrice.inv')) { LS.set('defPrice.inv', LS.get('defPrice')); LS.set('defPrice', null); }
  refreshAll();
}
function showTab(t) {
  if (!$('#tab-' + t)) t = 'invoice';
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  LS.set('tab', t);
}

async function init() {
  if (typeof XLSX === 'undefined') { document.body.innerHTML = '<p style="padding:20px">Thiếu file lib/xlsx.full.min.js. Hãy giữ nguyên thư mục <b>lib</b> cạnh index.html.</p>'; return; }
  try { await DB.open(); } catch (e) { toast('Trình duyệt không cho lưu dữ liệu: ' + e.message, 'bad', 8000); }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { }
  try { const inv = sessionStorage.getItem('gkm.invoice'); if (inv) S.invoice = JSON.parse(inv); } catch { }

  $$('#nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  showTab(LS.get('tab', 'invoice'));

  // hóa đơn
  setupDrop($('#invDrop'), async f => {
    try { const wb = await readWorkbook(f); if (!wb.sheets.length) return toast('File không có dữ liệu', 'bad'); loadInvoice(wb.sheets, f.name); }
    catch (e) { console.error(e); toast('Không đọc được file: ' + f.name, 'bad'); }
  });
  $('#invPaste').onclick = async () => {
    const t = await modal({
      title: 'Dán hóa đơn từ Excel', body: `<p class="small muted" style="margin-top:0">Bôi đen các cột (gồm cả dòng tiêu đề nếu có) trong Excel, bấm <kbd>Ctrl</kbd>+<kbd>C</kbd>, rồi dán vào đây.</p><textarea autofocus rows="12" style="width:100%;font-family:monospace" placeholder="Mã hàng&#9;Số lượng&#10;64301-K1N-V00&#9;2"></textarea>`,
      buttons: [{ text: 'Hủy', value: null }, { text: 'Tiếp tục', cls: 'pri', value: mb => $('textarea', mb).value }]
    });
    if (t && t.trim()) loadInvoice(textToSheets(t), 'Dữ liệu dán');
  };
  $('#invClear').onclick = () => { S.invoice = null; try { sessionStorage.removeItem('gkm.invoice'); } catch { } renderInvoice(); };
  $('#invPriceSel').onchange = () => renderInvoice();
  $$('#invFilter button').forEach(b => b.onclick = () => { S.invFilter = b.dataset.f; renderInvoice(); });
  $('#invSearch').oninput = () => drawInvTable(computeInvoice());
  $('#invExport').onclick = exportInvoice;
  $('#invCopyMiss').onclick = async () => {
    const codes = computeInvoice().rows.filter(r => r.status === 'miss' || r.status === 'nocost').map(r => r.l.code);
    if (!codes.length) return toast('Không có mã thiếu 🎉', 'ok');
    const text = codes.join('\n');
    try { await navigator.clipboard.writeText(text); toast(`Đã chép ${codes.length} mã thiếu`, 'ok'); }
    catch { modal({ title: 'Mã thiếu', body: `<textarea rows="10" style="width:100%">${esc(text)}</textarea>`, buttons: [{ text: 'Đóng', cls: 'pri' }] }); }
  };
  renderAddRow($('#invAdd'), code => lookup(priceIndex($('#invPriceSel').value), code), (code, qty) => {
    const it = lookup(priceIndex($('#invPriceSel').value), code);
    S.invoice.lines.push({ id: uid(), code: it ? it.code : code, name: it ? it.name : '', qty, sell: null, manual: null });
    saveInvoice(); renderInvoice(); toast('Đã thêm ' + code, 'ok');
  }, q => searchItems([$('#invPriceSel').value], q));
  $('#invReset').onclick = async () => {
    if (!S.invoice || !S.invoice.origFull) return toast('Không còn bản gốc, hãy kéo thả lại file hóa đơn', 'bad');
    if (!await confirmBox('Bỏ hết các thay đổi (thêm / bớt / đổi số lượng) và quay về hóa đơn gốc?', 'Khôi phục', false)) return;
    S.invoice.lines = JSON.parse(JSON.stringify(S.invoice.origFull)); saveInvoice(); renderInvoice(); toast('Đã khôi phục hóa đơn gốc', 'ok');
  };

  // bảng giá
  $$('[data-import]').forEach(b => b.onclick = async () => { const f = await pickFile(); if (f) importPrices(f, null, b.dataset.import); });
  $('#lookSess').onchange = renderLookup;
  let lt; $('#lookQ').oninput = () => { clearTimeout(lt); lt = setTimeout(renderLookup, 120); };

  // bộ nhựa
  $('#updBtn').onclick = checkUpdate;
  $('#resetBtn').onclick = resetWork;
  $('#stockBtn').onclick = fetchStock; renderStockBtn();
  $('#updBtn').title = `Đang dùng v${APP_VERSION}. Bấm để kiểm tra bản mới.`;
  $('#kitImport').onclick = async () => { const f = await pickFile(); if (f) importKits(f); };
  S.kitLine = LS.get('kitLine', '');
  $('#kitSessSel').onchange = renderKits;
  $('#kitPriceSel').onchange = () => { LS.set('kitPrice', $('#kitPriceSel').value); S.kitView ? renderKitDetail() : renderKits(); };
  $('#kitSaleSel').onchange = () => { LS.set('kitSale', $('#kitSaleSel').value); S.kitView ? renderKitDetail() : renderKits(); };
  let kt; $('#kitSearch').oninput = () => { clearTimeout(kt); kt = setTimeout(renderKits, 120); };
  $('#kitBack').onclick = closeKit;
  $('#kdPrint').onclick = printKitQuote;
  $$('[data-cust]').forEach(b => b.onclick = () => { LS.set('cust', !LS.get('cust', false)); applyCust(); S.kitView ? renderKitDetail() : renderKits(); });
  applyCust();
  renderAddRow($('#kdAdd'), kitLookup, async (code, qty) => {
    const ck = curKit(); if (!ck) return;
    ensureKit(ck.k);
    const it = kitLookup(code);
    ck.k.parts.push({ id: uid(), code: it ? it.code : code, name: it ? it.name : '', qty, cost: null });
    await saveKit(ck.s); renderKitDetail(); toast('Đã thêm ' + code, 'ok');
  }, q => searchItems([kitPriceSource(), kitSaleSource()].filter(x => x && x !== 'file'), q));
  $('#kdReset').onclick = async () => {
    const ck = curKit(); if (!ck) return;
    if (!await confirmBox('Bỏ hết các thay đổi và quay về bộ nhựa gốc?', 'Khôi phục', false)) return;
    const { k } = ck;
    const manual = new Map(k.parts.map(p => [p.id, p.manual]));
    k.parts = k.origFull.map(p => ({ ...p, manual: manual.get(p.id) ?? p.manual }));
    await saveKit(ck.s); renderKitDetail(); toast('Đã khôi phục bộ gốc', 'ok');
  };
  $('#kdAddImg').onclick = () => { const p = $('#imgPick'); p.value = ''; p.onchange = () => addKitImages([...p.files]); p.click(); };
  $('#kdDelImg').onclick = async () => {
    const ck = curKit(); if (!ck || !ck.k.images[kdImgIdx]) return;
    if (!await confirmBox('Xóa ảnh này khỏi bộ nhựa?', 'Xóa')) return;
    ck.k.images.splice(kdImgIdx, 1); kdImgIdx = 0; await DB.put('kits', ck.s); renderKitDetail();
  };
  document.addEventListener('paste', e => {
    if (!S.kitView || !$('#tab-kits').classList.contains('on') || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
    if (files.length) { e.preventDefault(); addKitImages(files); }
  });
  document.addEventListener('keydown', e => {
    if (!S.kitView || $('.modal-bg') || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') $('#kitPrev').click();
    if (e.key === 'ArrowRight') $('#kitNext').click();
    if (e.key === 'Escape') closeKit();
  });

  if (DB.db) await loadAll(); else refreshAll();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
}
init();
