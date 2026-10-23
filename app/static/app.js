/* Order Management System - front-end (vanilla JS single page app) */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const main = $('#main');
let META = { stages: [], buyers: [], contractors: [], settings: {} };
let USER = null;
let BRAND = { company_name: 'Order Management System', company_short: 'OMS' };
async function loadBrand() { try { BRAND = await api('/brand'); } catch (e) { /* keep default */ } $('#brand-side').textContent = BRAND.company_name; $('#brand-top').textContent = BRAND.company_short + ' · OMS'; document.title = BRAND.company_short + ' · Order Management'; }
const PRICES = () => !!(USER && USER.see_prices);
const NAV_ROLES = {
  dashboard: ['admin', 'office', 'dispatch'], order: ['admin', 'office'], orders: ['admin', 'office', 'dispatch'], assign: ['admin', 'office'], pos: ['admin', 'office', 'production'],
  production: ['admin', 'office', 'production'], shop: ['admin', 'office', 'production'], dispatch: ['admin', 'office', 'dispatch'], remaining: ['admin', 'office', 'dispatch'],
  reports: ['admin', 'office', 'dispatch'], documents: ['admin', 'office'], products: ['admin', 'office'], buyers: ['admin', 'office'], contractors: ['admin', 'office'],
  settings: ['admin'], users: ['admin'], account: ['admin', 'office', 'production', 'dispatch'],
};
const HOME = { admin: 'dashboard', office: 'dashboard', production: 'shop', dispatch: 'dispatch' };
const can = name => !!USER && (NAV_ROLES[name] || []).includes(USER.role);
let PRODUCTS = [];

// ------------------------------------------------------------------ helpers
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (v, d = 2) => { v = Number(v || 0); return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const q = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const c3 = v => n(v, 3);
const dmy = d => { if (!d) return ''; const [y, m, dd] = String(d).slice(0, 10).split('-'); return dd ? `${dd}-${m}-${y}` : d; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const qs = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined)));
const cur = () => META.settings.currency || 'USD';
const lcur = () => META.settings.labour_currency || 'INR';
const stageBadge = s => `<span class="badge s${s}">${esc(META.stages[s] ?? '')}</span>`;
const img = (f, cls = 'thumb') => f ? `<img class="${cls}" src="/images/${encodeURIComponent(f)}" loading="lazy">` : `<div class="${cls}"></div>`;
const pdfLink = (f, label) => f ? `<a href="/open/${encodeURIComponent(f)}" target="_blank">${esc(label || f)}</a>` : '';

function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = isErr ? 'err' : ''; t.style.display = 'block';
  clearTimeout(t._h); t._h = setTimeout(() => t.style.display = 'none', isErr ? 6000 : 3000);
}

async function api(path, opts = {}) {
  const o = { headers: {}, ...opts };
  if (o.body && !(o.body instanceof FormData)) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
  const r = await fetch('/api' + path, o);
  if (r.status === 401 && path !== '/me' && path !== '/login') { showLogin(); throw new Error('Please log in'); }
  if (!r.ok) {
    let msg = r.statusText;
    try { const j = await r.json(); msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

function openModal(html, narrow = false) {
  $('#modalbox').className = 'box' + (narrow ? ' narrow' : '');
  $('#modalbox').innerHTML = `<span class="close" onclick="closeModal()">&times;</span>` + html;
  $('#modal').style.display = 'flex';
}
function closeModal() { $('#modal').style.display = 'none'; $('#modalbox').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

async function loadMeta() {
  META = await api('/meta');
  PRODUCTS = await api('/products?limit=5000');
  $('#product-codes').innerHTML = PRODUCTS.map(p => `<option value="${esc(p.code)}">${esc(p.name)} ${p.buyer_name ? '(' + esc(p.buyer_name) + ')' : ''}</option>`).join('');
}

const buyerOpts = (sel, blank = '— select buyer —') => `<option value="">${blank}</option>` + META.buyers.map(b => `<option value="${b.id}" ${String(sel) === String(b.id) ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
const contractorOpts = (sel, types = null, blank = '— select contractor —') => `<option value="">${blank}</option>` + META.contractors.filter(c => !types || types.includes(c.type)).map(c => `<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${esc(c.name)} (${c.type})</option>`).join('');
const stageOpts = sel => META.stages.map((s, i) => `<option value="${i}" ${i === Number(sel) ? 'selected' : ''}>${i}. ${esc(s)}</option>`).join('');
const field = (label, inner, w = '') => `<div class="field" style="${w ? 'width:' + w : ''}"><label>${label}</label>${inner}</div>`;

// ------------------------------------------------------------------ router
const routes = {};
function route(name, fn) { routes[name] = fn; }
async function navigate() {
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, ...rest] = hash.split('/');
  $$('#side nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name || (name === 'reports' && rest[0] === 'remaining_by_buyer' && a.dataset.route === 'remaining')));
  if (name === 'reports' && rest[0] === 'remaining_by_buyer') $$('#side nav a').forEach(a => a.classList.toggle('active', a.dataset.route === 'remaining'));
  if (!can(name) && routes[name]) { location.hash = '#/' + HOME[USER.role]; return; }
  const fn = routes[name] || routes[HOME[USER.role]] || routes.dashboard;
  document.body.classList.remove('nav-open');
  main.innerHTML = '<p class="muted">Loading…</p>';
  try { await fn(...rest); } catch (e) { main.innerHTML = `<div class="panel">Error: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', navigate);

// ------------------------------------------------------------------ dashboard
route('dashboard', async () => {
  const d = await api('/dashboard');
  main.innerHTML = `
    <h1>Dashboard</h1>
    <div class="cards">
      <div class="card"><div class="v">${d.open_orders}</div><div class="l">Open buyer POs</div></div>
      <div class="card"><div class="v">${q(d.pending_qty)}</div><div class="l">Pcs remaining to dispatch (${d.pending_items} lines)</div></div>
      <div class="card"><div class="v">${c3(d.pending_cbm)}</div><div class="l">CBM remaining</div></div>
      <div class="card" data-p><div class="v">${cur()} ${n(d.pending_amount)}</div><div class="l">Amount remaining</div></div>
      <div class="card"><div class="v" style="color:${d.unassigned_qty ? 'var(--bad)' : 'var(--ok)'}">${q(d.unassigned_qty)}</div><div class="l">Pcs not yet assigned to contractor (${d.unassigned_lines} lines) ${d.unassigned_qty ? '<a href="#/assign">assign →</a>' : ''}</div></div>
    </div>
    <div class="two">
      <div class="panel"><h3>Remaining to dispatch — buyer wise</h3>
        <table class="grid"><tr><th>Buyer</th><th class="r">POs</th><th class="r">Qty</th><th class="r">CBM</th><th class="r" data-p>Amount ${cur()}</th></tr>
        ${d.by_buyer.map(b => `<tr><td><a href="#/reports/remaining_by_buyer?buyer=${encodeURIComponent(b.buyer)}">${esc(b.buyer)}</a></td><td class="r">${b.pos}</td><td class="r">${q(b.qty)}</td><td class="r">${c3(b.cbm)}</td><td class="r" data-p>${n(b.amount)}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="r">${d.by_buyer.reduce((a, b) => a + b.pos, 0)}</td><td class="r">${q(d.pending_qty)}</td><td class="r">${c3(d.pending_cbm)}</td><td class="r" data-p>${n(d.pending_amount)}</td></tr></table>
      </div>
      <div class="panel"><h3>Production stages (pending items)</h3>
        <table class="grid"><tr><th>Stage</th><th class="r">Lines</th><th class="r">Qty</th></tr>
        ${d.stages.map(s => `<tr><td><a href="#/production?stage=${s.stage}">${stageBadge(s.stage)}</a></td><td class="r">${s.lines}</td><td class="r">${q(s.qty)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nothing in production</td></tr>'}
        </table>
      </div>
    </div>
    <div class="two">
      <div class="panel"><h3>Contractor workload (pending)</h3>
        <table class="grid"><tr><th>Contractor</th><th>Type</th><th class="r">Lines</th><th class="r">Qty</th><th class="r">CBM</th><th class="r" data-p>Labour ${lcur()}</th></tr>
        ${d.contractor_load.map(c => `<tr><td><a href="#/production?contractor=${encodeURIComponent(c.name)}">${esc(c.name)}</a></td><td>${c.type}</td><td class="r">${c.lines}</td><td class="r">${q(c.qty)}</td><td class="r">${c3(c.cbm)}</td><td class="r" data-p>${n(c.labour)}</td></tr>`).join('')}
        </table>
      </div>
      <div class="panel"><h3>Recent documents</h3>
        <div class="doclinks">${d.recent_docs.map(x => pdfLink(x.filename)).join('') || '<span class="muted">None yet</span>'}</div>
      </div>
    </div>`;
});

// ------------------------------------------------------------------ new / edit order
function orderItemRow(it = {}) {
  return `<tr data-id="${it.id || ''}">
    <td class="c sno"></td>
    <td><input class="code" list="product-codes" value="${esc(it.code || '')}" placeholder="code"></td>
    <td class="imgcell">${img(it.image)}</td>
    <td><input class="txt name" value="${esc(it.name || '')}"></td>
    <td><input class="txt size" value="${esc(it.size || '')}" style="min-width:110px"></td>
    <td><input class="qty" type="number" min="0" step="1" value="${it.qty ?? ''}"></td>
    <td><input class="num cbm" type="number" step="0.001" value="${it.cbm ?? ''}"></td>
    <td class="r tcbm"></td>
    <td><input class="num rate" type="number" step="0.01" value="${it.rate ?? ''}"></td>
    <td class="r amount"></td>
    <td><input class="num labour" type="number" step="1" value="${it.labour_rate ?? ''}"></td>
    <td class="r lamount"></td>
    <td><input class="txt finish" value="${esc(it.finish || '')}" style="min-width:90px"></td>
    <td class="c"><input type="checkbox" class="iron" ${it.iron_required ? 'checked' : ''}></td>
    <td><button class="btn sm danger del" title="Remove">✕</button></td>
  </tr>`;
}

function recalcOrder() {
  let tq = 0, tc = 0, ta = 0, tl = 0, i = 0;
  $$('#items tbody tr').forEach(tr => {
    i++; tr.querySelector('.sno').textContent = i;
    const qty = +tr.querySelector('.qty').value || 0, cbm = +tr.querySelector('.cbm').value || 0, rate = +tr.querySelector('.rate').value || 0, lab = +tr.querySelector('.labour').value || 0;
    tr.querySelector('.tcbm').textContent = c3(qty * cbm);
    tr.querySelector('.amount').textContent = n(qty * rate);
    tr.querySelector('.lamount').textContent = n(qty * lab);
    tq += qty; tc += qty * cbm; ta += qty * rate; tl += qty * lab;
  });
  $('#tot').innerHTML = `<span>Lines <b>${i}</b></span><span>Total Qty <b>${q(tq)}</b></span><span>Total CBM <b>${c3(tc)}</b></span><span data-p>Total Amount <b>${cur()} ${n(ta)}</b></span><span data-p>Total Labour <b>${lcur()} ${n(tl)}</b></span>`;
}

function fillFromProduct(tr, code) {
  const p = PRODUCTS.find(x => x.code.toUpperCase() === code.trim().toUpperCase());
  if (!p) { tr.querySelector('.imgcell').innerHTML = img(''); return false; }
  tr.querySelector('.code').value = p.code;
  tr.querySelector('.name').value = p.name || '';
  tr.querySelector('.size').value = p.size || '';
  tr.querySelector('.cbm').value = p.cbm || '';
  tr.querySelector('.rate').value = p.rate || '';
  tr.querySelector('.labour').value = p.labour_rate || '';
  tr.querySelector('.finish').value = p.finish || '';
  tr.querySelector('.imgcell').innerHTML = img(p.image);
  return true;
}

function collectItems() {
  return $$('#items tbody tr').map(tr => ({
    id: tr.dataset.id || null, code: tr.querySelector('.code').value.trim(), name: tr.querySelector('.name').value, size: tr.querySelector('.size').value,
    qty: +tr.querySelector('.qty').value || 0, cbm: +tr.querySelector('.cbm').value || 0, rate: +tr.querySelector('.rate').value || 0,
    labour_rate: +tr.querySelector('.labour').value || 0, finish: tr.querySelector('.finish').value, iron_required: tr.querySelector('.iron').checked ? 1 : 0,
  })).filter(x => x.code && x.qty > 0);
}

async function renderOrderForm(o = null) {
  const edit = !!o;
  main.innerHTML = `
    <h1>${edit ? 'Edit Buyer PO ' + esc(o.po_number) : 'New Buyer PO'}</h1>
    <div class="panel">
      <div class="row">
        ${field('Buyer *', `<select id="buyer">${buyerOpts(o?.buyer_id)}</select>`, '220px')}
        ${field('Buyer PO number *', `<input id="po" type="text" value="${esc(o?.po_number || '')}" placeholder="e.g. PO-24015">`, '180px')}
        ${field('Order date', `<input id="odate" type="date" value="${o?.order_date || today()}">`, '150px')}
        ${field('PI number', `<input id="pi" type="text" value="${esc(o?.pi_number || '')}" placeholder="auto">`, '130px')}
        ${field('Destination / remark', `<input id="dest" type="text" value="${esc(o?.destination || '')}">`, '200px')}
        ${edit ? field('Status', `<select id="status"><option value="open" ${o.status === 'open' ? 'selected' : ''}>open</option><option value="closed" ${o.status === 'closed' ? 'selected' : ''}>closed</option></select>`, '110px') : ''}
      </div>
      <div class="row" style="margin-top:8px">${field('Notes (printed on PI)', `<input id="notes" type="text" value="${esc(o?.notes || '')}" style="width:100%">`, '100%')}</div>
    </div>
    <div class="panel">
      <div class="btns" style="margin-bottom:8px">
        <button class="btn" id="addrow">+ Add line</button>
        <button class="btn" id="paste">Quick paste (code &amp; qty)</button>
        <span class="hint">Type product code → description, size, CBM, rate &amp; labour rate fill automatically. Unknown codes are added to the product master.</span>
      </div>
      <div class="tblwrap" style="max-height:none">
      <table class="grid" id="items">
        <thead><tr><th>#</th><th>Product code</th><th>Image</th><th>Description</th><th>Size (cm)</th><th class="r">Qty</th><th class="r">CBM</th><th class="r">T.CBM</th><th class="r" data-p>Rate ${cur()}</th><th class="r" data-p>Amount</th><th class="r" data-p>Labour rate</th><th class="r" data-p>Labour amt</th><th>Finish</th><th>Iron?</th><th></th></tr></thead>
        <tbody>${(o?.items || [{}, {}, {}]).map(orderItemRow).join('')}</tbody>
      </table></div>
      <div class="totals" id="tot"></div>
      <div class="sticky-foot btns">
        <button class="btn primary" id="save">${edit ? 'Save changes' : 'Save order & generate PI + Carton + Sticker PDFs'}</button>
        ${edit ? '<button class="btn" id="saveregen">Save &amp; regenerate PDFs</button>' : ''}
        <a class="btn" href="#/orders">Cancel</a>
      </div>
    </div>`;
  const tbody = $('#items tbody');
  recalcOrder();
  const addRow = () => { tbody.insertAdjacentHTML('beforeend', orderItemRow()); recalcOrder(); tbody.lastElementChild.querySelector('.code').focus(); };
  $('#addrow').onclick = addRow;
  tbody.addEventListener('input', e => { if (e.target.classList.contains('code')) { fillFromProduct(e.target.closest('tr'), e.target.value); } recalcOrder(); });
  tbody.addEventListener('change', e => { if (e.target.classList.contains('code')) { fillFromProduct(e.target.closest('tr'), e.target.value); recalcOrder(); } });
  tbody.addEventListener('click', e => { if (e.target.classList.contains('del')) { e.target.closest('tr').remove(); recalcOrder(); } });
  tbody.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('qty') && e.target.closest('tr') === tbody.lastElementChild) { e.preventDefault(); addRow(); }
  });
  $('#paste').onclick = () => {
    openModal(`<h3>Quick paste</h3><p class="hint">One line per item: <span class="kbd">CODE  QTY</span> (space, tab or comma separated). Example:<br><span class="kbd">2376/16ZA 50</span></p>
      <textarea id="pastebox" style="width:100%;min-height:200px"></textarea><div class="btns" style="margin-top:8px"><button class="btn primary" id="pasteok">Add lines</button></div>`, true);
    $('#pasteok').onclick = () => {
      const lines = $('#pastebox').value.split(/\n/).map(l => l.trim()).filter(Boolean);
      let added = 0, unknown = [];
      for (const l of lines) {
        const m = l.match(/^(.+?)[\s,;\t]+(\d+(?:\.\d+)?)\s*$/);
        if (!m) continue;
        tbody.insertAdjacentHTML('beforeend', orderItemRow({ code: m[1].trim(), qty: +m[2] }));
        const tr = tbody.lastElementChild;
        if (!fillFromProduct(tr, m[1])) unknown.push(m[1]);
        added++;
      }
      $$('#items tbody tr').filter(tr => !tr.querySelector('.code').value && !tr.querySelector('.qty').value).forEach(tr => tr.remove());
      recalcOrder(); closeModal();
      toast(`${added} lines added` + (unknown.length ? `. Unknown codes (fill details manually): ${unknown.join(', ')}` : ''), unknown.length > 0);
    };
  };
  const save = async regen => {
    const body = { buyer_id: +$('#buyer').value || null, po_number: $('#po').value, order_date: $('#odate').value, pi_number: $('#pi').value, destination: $('#dest').value, notes: $('#notes').value, items: collectItems() };
    if (edit) { body.status = $('#status').value; body.generate_docs = regen; }
    if (!body.buyer_id) return toast('Select a buyer', true);
    if (!body.po_number.trim()) return toast('Enter the buyer PO number', true);
    if (!body.items.length) return toast('Add at least one item with quantity', true);
    $('#save').disabled = true;
    try {
      const r = edit ? await api('/orders/' + o.id, { method: 'PUT', body }) : await api('/orders', { method: 'POST', body });
      await loadMeta();
      toast('Order saved' + (r.generated?.length ? ' — PDFs generated' : ''));
      location.hash = '#/orders/' + r.id;
    } catch (e) { toast(e.message, true); $('#save').disabled = false; }
  };
  $('#save').onclick = () => save(!edit);
  if (edit) $('#saveregen').onclick = () => save(true);
}

route('order', async (sub, id) => {
  if (sub === 'new') return renderOrderForm();
  if (sub === 'edit') return renderOrderForm(await api('/orders/' + id));
  location.hash = '#/orders';
});

// ------------------------------------------------------------------ orders list & detail
route('orders', async (id) => {
  if (id) return renderOrderDetail(id);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const state = { buyer_id: params.get('buyer_id') || '', status: params.get('status') || 'open', q: '', date_from: '', date_to: '' };
  const render = async () => {
    const list = await api('/orders?' + qs(state));
    const tot = list.reduce((a, o) => ({ qty: a.qty + (o.total_qty || 0), rem: a.rem + (o.remaining_qty || 0), cbm: a.cbm + (o.total_cbm || 0), amt: a.amt + (o.total_amount || 0) }), { qty: 0, rem: 0, cbm: 0, amt: 0 });
    $('#list').innerHTML = `<table class="grid">
      <thead><tr><th>Buyer</th><th>PO number</th><th>Date</th><th>PI</th><th>Dest.</th><th class="r">Lines</th><th class="r">Qty</th><th class="r">Dispatched</th><th class="r">Remaining</th><th class="r">CBM</th><th class="r" data-p>Amount ${cur()}</th><th class="r" data-p>Labour ${lcur()}</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(o => `<tr>
        <td>${esc(o.buyer_name)}</td><td><a href="#/orders/${o.id}"><b>${esc(o.po_number)}</b></a></td><td class="nowrap">${dmy(o.order_date)}</td><td>${esc(o.pi_number)}</td><td>${esc(o.destination)}</td>
        <td class="r">${o.lines}</td><td class="r">${q(o.total_qty)}</td><td class="r">${q(o.dispatched_qty)}</td><td class="r"><b>${q(o.remaining_qty)}</b></td><td class="r">${c3(o.total_cbm)}</td><td class="r" data-p>${n(o.total_amount)}</td><td class="r" data-p>${n(o.total_labour)}</td>
        <td><span class="badge ${o.status}">${o.status}</span></td>
        <td class="nowrap"><a class="btn sm" href="#/orders/${o.id}">Open</a> <a class="btn sm" href="#/order/edit/${o.id}">Edit</a></td></tr>`).join('') || '<tr><td colspan="14" class="muted">No orders</td></tr>'}
      </tbody>
      <tfoot><tr class="total"><td colspan="6">Total (${list.length} POs)</td><td class="r">${q(tot.qty)}</td><td></td><td class="r">${q(tot.rem)}</td><td class="r">${c3(tot.cbm)}</td><td class="r" data-p>${n(tot.amt)}</td><td colspan="3"></td></tr></tfoot></table>`;
  };
  main.innerHTML = `<h1>Buyer Orders</h1>
    <div class="panel"><div class="row">
      ${field('Buyer', `<select id="f_buyer">${buyerOpts(state.buyer_id, 'All buyers')}</select>`, '200px')}
      ${field('Status', `<select id="f_status"><option value="">All</option><option value="open" ${state.status === 'open' ? 'selected' : ''}>Open</option><option value="closed">Closed</option></select>`, '110px')}
      ${field('From', `<input id="f_from" type="date">`, '150px')}${field('To', `<input id="f_to" type="date">`, '150px')}
      ${field('Search PO / code', `<input id="f_q" type="text" placeholder="PO number or product code">`, '220px')}
      <a class="btn primary" href="#/order/new">+ New Buyer PO</a>
    </div></div>
    <div class="tblwrap" id="list"></div>`;
  const upd = () => { state.buyer_id = $('#f_buyer').value; state.status = $('#f_status').value; state.date_from = $('#f_from').value; state.date_to = $('#f_to').value; state.q = $('#f_q').value; render(); };
  ['#f_buyer', '#f_status', '#f_from', '#f_to'].forEach(s => $(s).onchange = upd);
  $('#f_q').oninput = upd;
  render();
});

async function renderOrderDetail(id) {
  const o = await api('/orders/' + id);
  const docs = {}; o.documents.forEach(d => docs[d.kind] = d.filename);
  main.innerHTML = `
    <h1>${esc(o.buyer_name)} — PO ${esc(o.po_number)} <span class="badge ${o.status}">${o.status}</span></h1>
    <div class="panel"><div class="row" style="align-items:center">
      <div><b>Order date:</b> ${dmy(o.order_date)}</div><div><b>PI:</b> ${esc(o.pi_number) || '—'}</div><div><b>Destination:</b> ${esc(o.destination) || '—'}</div>
      <div style="flex:1"></div>
      <div class="btns">
        <a class="btn" href="#/order/edit/${o.id}">Edit</a>
        <button class="btn" id="regen">Regenerate PDFs</button>
        <a class="btn" href="#/assign?order_id=${o.id}">Assign to contractor</a>
        <a class="btn" href="#/dispatch?order_id=${o.id}">Dispatch</a>
        <button class="btn danger" id="del">Delete</button>
      </div></div>
      <div class="doclinks" style="margin-top:8px">
        ${pdfLink(docs.pi, 'Proforma Invoice')} ${pdfLink(docs.carton, 'Carton Order')} ${pdfLink(docs.sticker, 'Sticker Order')}
        ${!o.documents.length ? '<span class="muted">No PDFs yet — click Regenerate PDFs</span>' : ''}
      </div>
      ${o.notes ? `<p class="small muted">${esc(o.notes)}</p>` : ''}
    </div>
    <div class="tblwrap" style="max-height:none"><table class="grid">
      <thead><tr><th>#</th><th>Image</th><th>Code</th><th>Description</th><th>Size</th><th>Finish</th><th class="r">Qty</th><th class="r">Disp.</th><th class="r">Remaining</th><th class="r">CBM</th><th class="r">T.CBM</th><th class="r" data-p>Rate</th><th class="r" data-p>Amount</th><th class="r" data-p>Labour</th><th class="r" data-p>Labour amt</th><th>Contractors</th><th>Stage</th><th>Carton</th><th>Sticker</th><th>Iron</th></tr></thead>
      <tbody>${o.items.map(i => `<tr>
        <td>${i.sno}</td><td>${img(i.image)}</td><td><b>${esc(i.code)}</b></td><td>${esc(i.name)}</td><td>${esc(i.size)}</td><td>${esc(i.finish)}</td>
        <td class="r">${q(i.qty)}</td><td class="r">${q(i.dispatched_qty)}</td><td class="r"><b>${q(i.remaining_qty)}</b></td><td class="r">${c3(i.cbm)}</td><td class="r">${c3(i.t_cbm)}</td>
        <td class="r" data-p>${n(i.rate)}</td><td class="r" data-p>${n(i.amount)}</td><td class="r" data-p>${n(i.labour_rate)}</td><td class="r" data-p>${n(i.labour_amount)}</td>
        <td class="small">${esc(i.contractors || '')}${i.remaining_to_assign > 0 && i.remaining_qty > 0 ? ` <span class="badge bad">${q(i.remaining_to_assign)} unassigned</span>` : ''}</td>
        <td>${i.min_stage != null ? stageBadge(i.min_stage) : '<span class="muted">—</span>'}</td>
        <td class="small">${dmy(i.carton_ordered_at)}</td><td class="small">${dmy(i.sticker_ordered_at)}</td><td class="small">${i.iron_required ? (dmy(i.iron_ordered_at) || 'required') : ''}</td></tr>`).join('')}
      </tbody>
      <tfoot><tr class="total"><td colspan="6">Total</td><td class="r">${q(o.total_qty)}</td><td></td><td class="r">${q(o.remaining_qty)}</td><td></td><td class="r">${c3(o.total_cbm)}</td><td></td><td class="r" data-p>${n(o.total_amount)}</td><td data-p></td><td class="r" data-p>${n(o.total_labour)}</td><td colspan="5"></td></tr></tfoot>
    </table></div>
    <div class="panel"><h3>Dispatches</h3>
      <table class="grid"><tr><th>Date</th><th>Invoice</th><th>Container</th><th class="r">Qty</th><th>Notes</th></tr>
      ${o.dispatches.map(d => `<tr><td>${dmy(d.dispatch_date)}</td><td>${esc(d.invoice_no)}</td><td>${esc(d.container)}</td><td class="r">${q(d.qty)}</td><td class="small">${esc(d.notes)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No dispatches yet</td></tr>'}
      </table></div>`;
  $('#regen').onclick = async () => { try { await api(`/orders/${o.id}/documents`, { method: 'POST' }); toast('PDFs regenerated'); renderOrderDetail(id); } catch (e) { toast(e.message, true); } };
  $('#del').onclick = async () => { if (!confirm('Delete this buyer PO and all its lines?')) return; try { await api('/orders/' + o.id, { method: 'DELETE' }); toast('Deleted'); location.hash = '#/orders'; } catch (e) { toast(e.message, true); } };
}

// ------------------------------------------------------------------ assign to contractor
route('assign', async () => {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const state = { buyer_id: '', order_id: params.get('order_id') || '', q: '' };
  let items = [];
  const sel = {};   // order_item_id -> {qty, labour_rate}
  main.innerHTML = `<h1>Assign to Contractor (new PO)</h1>
    <div class="panel"><div class="row">
      ${field('Contractor *', `<select id="ctr">${contractorOpts('', ['wood', 'iron', 'other'])}</select>`, '240px')}
      ${field('PO number', `<input id="ponum" type="text" value="${esc(META.next_po)}" title="Auto-generated; you can override">`, '130px')}
      ${field('PO date', `<input id="podate" type="date" value="${today()}">`, '150px')}
      ${field('Delivery date', `<input id="deliv" type="date">`, '150px')}
      ${field('Notes / instructions', `<input id="ponotes" type="text">`, '300px')}
    </div></div>
    <div class="panel"><div class="row">
      ${field('Buyer', `<select id="f_buyer">${buyerOpts(state.buyer_id, 'All buyers')}</select>`, '200px')}
      ${field('Buyer PO', `<select id="f_order"><option value="">All POs</option></select>`, '200px')}
      ${field('Search code', `<input id="f_q" type="text" placeholder="product code">`, '180px')}
      <label class="small"><input type="checkbox" id="showall"> show fully-assigned items too</label>
    </div>
    <p class="hint">Enter quantity for each item to assign. "Available" = order qty − already assigned to wood contractors (for iron contractors: − already assigned iron work). Size, CBM and labour rate fill automatically.</p>
    <div class="tblwrap" id="list"></div>
    <div class="totals" id="tot"></div>
    <div class="sticky-foot btns"><button class="btn primary" id="save">Create PO & generate PDF</button></div></div>`;
  const ctrType = () => (META.contractors.find(c => String(c.id) === $('#ctr').value) || {}).type;
  const avail = i => ctrType() === 'iron' ? i.qty - i.iron_assigned_qty : i.remaining_to_assign;
  const recalc = () => {
    let tq = 0, tc = 0, ta = 0, lines = 0;
    $$('#list tbody tr').forEach(tr => {
      const id = tr.dataset.id, it = items.find(x => String(x.id) === id);
      const qty = +tr.querySelector('.aq').value || 0, lab = +tr.querySelector('.al').value || 0;
      if (qty > 0) { sel[id] = { qty, labour_rate: lab }; lines++; tq += qty; tc += qty * it.cbm; ta += qty * lab; } else delete sel[id];
      tr.querySelector('.tc').textContent = c3(qty * it.cbm); tr.querySelector('.ta').textContent = n(qty * lab);
      tr.querySelector('.aq').style.background = qty > avail(it) + 1e-9 ? '#fee2e2' : '';
    });
    $('#tot').innerHTML = `<span>Lines <b>${lines}</b></span><span>Total Qty <b>${q(tq)}</b></span><span>Total CBM <b>${c3(tc)}</b></span><span data-p>Total Labour <b>${lcur()} ${n(ta)}</b></span>`;
  };
  const render = async () => {
    const all = await api('/order-items?' + qs({ buyer_id: state.buyer_id, order_id: state.order_id, q: state.q, pending: 1 }));
    items = $('#showall').checked ? all : all.filter(i => avail(i) > 0);
    $('#list').innerHTML = `<table class="grid"><thead><tr><th>Buyer</th><th>Buyer PO</th><th>Image</th><th>Code</th><th>Description</th><th>Size</th><th>Finish</th><th class="r">Order qty</th><th class="r">Assigned</th><th class="r">Available</th><th>Already with</th><th class="r">CBM</th><th class="r">Assign qty</th><th class="r">T.CBM</th><th class="r" data-p>Labour rate</th><th class="r" data-p>Amount</th></tr></thead>
      <tbody>${items.map(i => `<tr data-id="${i.id}">
        <td>${esc(i.buyer_name)}</td><td>${esc(i.po_number)}</td><td>${img(i.image)}</td><td><b>${esc(i.code)}</b></td><td class="small">${esc(i.name)}</td><td class="small">${esc(i.size)}</td><td class="small">${esc(i.finish)}</td>
        <td class="r">${q(i.qty)}</td><td class="r">${q(ctrType() === 'iron' ? i.iron_assigned_qty : i.assigned_qty)}</td><td class="r"><b>${q(avail(i))}</b></td><td class="small">${esc(i.contractors || '')}</td><td class="r">${c3(i.cbm)}</td>
        <td><input class="qty aq" type="number" min="0" step="1" value="${sel[i.id]?.qty ?? ''}" placeholder="${q(avail(i))}"></td><td class="r tc"></td>
        <td data-p><input class="num al" type="number" step="1" value="${sel[i.id]?.labour_rate ?? (i.labour_rate || '')}"></td><td class="r ta" data-p></td></tr>`).join('') || '<tr><td colspan="16" class="muted">No items to assign for this filter</td></tr>'}
      </tbody></table>`;
    recalc();
  };
  const loadOrders = async () => {
    const os = await api('/orders?' + qs({ status: 'open', buyer_id: state.buyer_id }));
    $('#f_order').innerHTML = '<option value="">All POs</option>' + os.map(o => `<option value="${o.id}" ${String(o.id) === String(state.order_id) ? 'selected' : ''}>${esc(o.buyer_name)} — ${esc(o.po_number)}</option>`).join('');
  };
  $('#f_buyer').onchange = async () => { state.buyer_id = $('#f_buyer').value; state.order_id = ''; await loadOrders(); render(); };
  $('#f_order').onchange = () => { state.order_id = $('#f_order').value; render(); };
  $('#f_q').oninput = () => { state.q = $('#f_q').value; render(); };
  $('#showall').onchange = render;
  $('#ctr').onchange = render;
  $('#list').addEventListener('input', recalc);
  $('#list').addEventListener('dblclick', e => { const tr = e.target.closest('tr'); if (!tr || !e.target.classList.contains('aq')) return; const it = items.find(x => String(x.id) === tr.dataset.id); e.target.value = avail(it); recalc(); });
  $('#save').onclick = async () => {
    const cid = +$('#ctr').value;
    if (!cid) return toast('Select a contractor', true);
    const lines = Object.entries(sel).map(([order_item_id, v]) => ({ order_item_id: +order_item_id, qty: v.qty, labour_rate: v.labour_rate }));
    if (!lines.length) return toast('Enter assign quantity for at least one item', true);
    const over = lines.filter(l => l.qty > avail(items.find(i => i.id === l.order_item_id)) + 1e-9);
    if (over.length && !confirm(`${over.length} line(s) exceed the available quantity. Assign anyway?`)) return;
    $('#save').disabled = true;
    try {
      const r = await api('/pos', { method: 'POST', body: { contractor_id: cid, po_number: $('#ponum').value, po_date: $('#podate').value, delivery_date: $('#deliv').value, notes: $('#ponotes').value, items: lines, allow_over: over.length > 0 } });
      await loadMeta(); toast(`PO ${r.po_number} created`); location.hash = '#/pos/' + r.id;
    } catch (e) { toast(e.message, true); $('#save').disabled = false; }
  };
  await loadOrders(); render();
});

// ------------------------------------------------------------------ contractor POs
route('pos', async (id) => {
  if (id) return renderPoDetail(id);
  const state = { contractor_id: '', buyer_id: '', buyer_po: '', po: '', date_from: '', date_to: '' };
  const render = async () => {
    const list = await api('/pos?' + qs(state));
    const tot = list.reduce((a, p) => ({ qty: a.qty + (p.total_qty || 0), cbm: a.cbm + p.total_cbm, amt: a.amt + p.total_amount }), { qty: 0, cbm: 0, amt: 0 });
    $('#list').innerHTML = `<table class="grid"><thead><tr><th>Our PO</th><th>Date</th><th>Contractor</th><th>Type</th><th>Buyers</th><th>Buyer POs</th><th class="r">Lines</th><th class="r">Qty</th><th class="r">CBM</th><th class="r" data-p>Labour ${lcur()}</th><th>Delivery</th><th>Stage (min)</th><th>PDF</th></tr></thead>
      <tbody>${list.map(p => `<tr><td><a href="#/pos/${p.id}"><b>${esc(p.po_number)}</b></a></td><td class="nowrap">${dmy(p.po_date)}</td><td>${esc(p.contractor_name)}</td><td>${p.contractor_type}</td><td class="small">${esc(p.buyers || '')}</td><td class="small">${esc(p.buyer_pos || '')}</td>
        <td class="r">${p.lines}</td><td class="r">${q(p.total_qty)}</td><td class="r">${c3(p.total_cbm)}</td><td class="r" data-p>${n(p.total_amount)}</td><td>${dmy(p.delivery_date)}</td><td>${p.min_stage != null ? stageBadge(p.min_stage) : ''}</td><td>${pdfLink(p.pdf, 'PDF')}</td></tr>`).join('') || '<tr><td colspan="13" class="muted">No POs</td></tr>'}</tbody>
      <tfoot><tr class="total"><td colspan="6">Total (${list.length} POs)</td><td></td><td class="r">${q(tot.qty)}</td><td class="r">${c3(tot.cbm)}</td><td class="r" data-p>${n(tot.amt)}</td><td colspan="3"></td></tr></tfoot></table>`;
  };
  main.innerHTML = `<h1>Contractor POs</h1>
    <div class="panel"><div class="row">
      ${field('Contractor', `<select id="f_c">${contractorOpts('', null, 'All contractors')}</select>`, '220px')}
      ${field('Buyer', `<select id="f_b">${buyerOpts('', 'All buyers')}</select>`, '190px')}
      ${field('Buyer PO', `<input id="f_bpo" type="text">`, '140px')}${field('Our PO', `<input id="f_po" type="text">`, '120px')}
      ${field('From', `<input id="f_from" type="date">`, '150px')}${field('To', `<input id="f_to" type="date">`, '150px')}
      <a class="btn primary" href="#/assign">+ New PO</a>
    </div></div><div class="tblwrap" id="list"></div>`;
  const upd = () => { state.contractor_id = $('#f_c').value; state.buyer_id = $('#f_b').value; state.buyer_po = $('#f_bpo').value; state.po = $('#f_po').value; state.date_from = $('#f_from').value; state.date_to = $('#f_to').value; render(); };
  ['#f_c', '#f_b', '#f_from', '#f_to'].forEach(s => $(s).onchange = upd); ['#f_bpo', '#f_po'].forEach(s => $(s).oninput = upd);
  render();
});

async function renderPoDetail(id) {
  const p = await api('/pos/' + id);
  main.innerHTML = `<h1>PO ${esc(p.po_number)} — ${esc(p.contractor_name)} <span class="badge">${p.contractor_type}</span></h1>
    <div class="panel"><div class="row">
      ${field('PO date', `<input id="podate" type="date" value="${p.po_date || ''}">`, '150px')}${field('Delivery date', `<input id="deliv" type="date" value="${p.delivery_date || ''}">`, '150px')}
      ${field('Notes', `<input id="notes" type="text" value="${esc(p.notes)}">`, '320px')}
      <button class="btn primary" id="save">Save & regenerate PDF</button>
      <div class="doclinks">${p.documents.map(d => pdfLink(d.filename, 'PO PDF')).join('')}</div>
      <div style="flex:1"></div><button class="btn danger" id="del">Delete PO</button>
    </div></div>
    <div class="tblwrap" style="max-height:none"><table class="grid" id="lines"><thead><tr><th>#</th><th>Image</th><th>Code</th><th>Description</th><th>Size</th><th>Buyer</th><th>Buyer PO</th><th class="r">Qty</th><th class="r">CBM</th><th class="r">T.CBM</th><th class="r" data-p>Labour rate</th><th class="r" data-p>Amount</th><th>Stage</th><th>Stage date</th><th>Remarks</th><th></th></tr></thead>
      <tbody>${p.items.map((i, k) => `<tr data-id="${i.id}"><td>${k + 1}</td><td>${img(i.image)}</td><td><b>${esc(i.code)}</b></td><td class="small">${esc(i.name)}</td><td class="small">${esc(i.size)}</td><td>${esc(i.buyer_name)}</td><td>${esc(i.buyer_po)}</td>
        <td><input class="qty q" type="number" value="${i.qty}"></td><td class="r">${c3(i.cbm)}</td><td class="r">${c3(i.t_cbm)}</td><td data-p><input class="num l" type="number" value="${i.labour_rate}"></td><td class="r" data-p>${n(i.amount)}</td>
        <td><select class="st" data-id="${i.id}">${stageOpts(i.stage)}</select></td><td class="small">${dmy(i.stage_date)}</td><td><input class="txt rm" value="${esc(i.remarks)}"></td><td><button class="btn sm danger rmv">✕</button></td></tr>`).join('')}</tbody>
      <tfoot><tr class="total"><td colspan="7">Total</td><td class="r">${q(p.total_qty)}</td><td></td><td class="r">${c3(p.total_cbm)}</td><td data-p></td><td class="r" data-p>${n(p.total_amount)}</td><td colspan="4"></td></tr></tfoot></table></div>`;
  const removed = [];
  $('#lines').addEventListener('click', e => { if (e.target.classList.contains('rmv')) { const tr = e.target.closest('tr'); removed.push(+tr.dataset.id); tr.remove(); } });
  $('#lines').addEventListener('change', async e => {
    if (!e.target.classList.contains('st')) return;
    try { await api(`/production/${e.target.dataset.id}/stage`, { method: 'PUT', body: { stage: +e.target.value } }); toast('Stage updated'); } catch (err) { toast(err.message, true); }
  });
  $('#save').onclick = async () => {
    const items = $$('#lines tbody tr').map(tr => ({ id: +tr.dataset.id, qty: +tr.querySelector('.q').value, labour_rate: +tr.querySelector('.l').value, remarks: tr.querySelector('.rm').value }));
    try { await api('/pos/' + id, { method: 'PUT', body: { po_date: $('#podate').value, delivery_date: $('#deliv').value || null, notes: $('#notes').value, items, remove_items: removed } }); toast('Saved'); renderPoDetail(id); } catch (e) { toast(e.message, true); }
  };
  $('#del').onclick = async () => { if (!confirm('Delete this contractor PO? The quantities become available to assign again.')) return; try { await api('/pos/' + id, { method: 'DELETE' }); toast('Deleted'); location.hash = '#/pos'; } catch (e) { toast(e.message, true); } };
}

// ------------------------------------------------------------------ production tracking
route('production', async () => {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const cname = params.get('contractor');
  const state = { contractor_id: cname ? (META.contractors.find(c => c.name === cname) || {}).id || '' : '', buyer_id: '', stage: params.get('stage') ?? '', q: '', include_done: 0 };
  const render = async () => {
    const p = { ...state }; if (p.stage === '') delete p.stage;
    const list = await api('/production?' + qs(p));
    const counts = {}; list.forEach(l => counts[l.stage] = (counts[l.stage] || 0) + l.qty);
    $('#list').innerHTML = `<table class="grid"><thead><tr><th><input type="checkbox" id="selall"></th><th>Stage</th><th>Contractor</th><th>Our PO</th><th>Buyer</th><th>Buyer PO</th><th>Image</th><th>Code</th><th>Description</th><th class="r">Qty</th><th class="r">T.CBM</th><th>Stage date</th><th>Delivery</th><th>Remarks</th><th>Change stage</th></tr></thead>
      <tbody>${list.map(l => `<tr data-id="${l.id}"><td><input type="checkbox" class="pick"></td><td>${stageBadge(l.stage)}</td><td>${esc(l.contractor_name)}</td><td><a href="#/pos/${l.po_id}">${esc(l.contractor_po)}</a></td><td>${esc(l.buyer_name)}</td><td>${esc(l.buyer_po)}</td><td>${img(l.image)}</td><td><b>${esc(l.code)}</b></td><td class="small">${esc(l.name)}</td>
        <td class="r">${q(l.qty)}</td><td class="r">${c3(l.t_cbm)}</td><td class="small">${dmy(l.stage_date)}</td><td class="small">${dmy(l.delivery_date)}</td><td class="small">${esc(l.remarks)}</td>
        <td class="nowrap"><select class="st">${stageOpts(l.stage)}</select> <button class="btn sm next" title="Move to next stage">▶</button> <button class="btn sm hist" title="History">⌚</button></td></tr>`).join('') || '<tr><td colspan="15" class="muted">Nothing found</td></tr>'}</tbody></table>`;
    $('#selall').onchange = e => $$('.pick').forEach(c => c.checked = e.target.checked);
    $('#list').dataset.rows = JSON.stringify(list.map(l => ({ id: l.id, history: l.history, stage: l.stage })));
  };
  main.innerHTML = `<h1>Production Tracking</h1>
    <div class="panel"><div class="row">
      ${field('Contractor', `<select id="f_c">${contractorOpts(state.contractor_id, null, 'All contractors')}</select>`, '220px')}
      ${field('Buyer', `<select id="f_b">${buyerOpts('', 'All buyers')}</select>`, '190px')}
      ${field('Search', `<input id="f_q" type="text" placeholder="code / PO">`, '180px')}
      <label class="small"><input type="checkbox" id="f_done"> include Final Dispatch</label>
    </div>
    <div class="stagebar" id="stagebar">${['', ...META.stages.map((s, i) => i)].map(i => `<div class="st ${String(state.stage) === String(i) ? 'active' : ''}" data-stage="${i}">${i === '' ? 'All' : (i + '. ' + esc(META.stages[i]))}</div>`).join('')}</div>
    <div class="row" style="margin-top:6px">${field('Set stage for selected rows', `<select id="bulkstage">${stageOpts(0)}</select>`, '220px')}${field('Date', `<input id="bulkdate" type="date" value="${today()}">`, '150px')}<button class="btn" id="bulk">Apply to selected</button></div>
    </div><div class="tblwrap" id="list"></div>`;
  const upd = () => { state.contractor_id = $('#f_c').value; state.buyer_id = $('#f_b').value; state.q = $('#f_q').value; state.include_done = $('#f_done').checked ? 1 : 0; render(); };
  ['#f_c', '#f_b', '#f_done'].forEach(s => $(s).onchange = upd); $('#f_q').oninput = upd;
  $('#stagebar').onclick = e => { const el = e.target.closest('.st'); if (!el) return; state.stage = el.dataset.stage; $$('#stagebar .st').forEach(x => x.classList.toggle('active', x === el)); render(); };
  $('#list').addEventListener('change', async e => {
    if (!e.target.classList.contains('st')) return;
    try { await api(`/production/${e.target.closest('tr').dataset.id}/stage`, { method: 'PUT', body: { stage: +e.target.value } }); toast('Stage updated'); render(); } catch (err) { toast(err.message, true); }
  });
  $('#list').addEventListener('click', async e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.classList.contains('next')) {
      const cur = +tr.querySelector('.st').value; if (cur >= META.stages.length - 1) return;
      try { await api(`/production/${tr.dataset.id}/stage`, { method: 'PUT', body: { stage: cur + 1 } }); toast('Moved to ' + META.stages[cur + 1]); render(); } catch (err) { toast(err.message, true); }
    }
    if (e.target.classList.contains('hist')) {
      const rowsD = JSON.parse($('#list').dataset.rows), r = rowsD.find(x => String(x.id) === tr.dataset.id);
      const h = (r.history || '').split(';;').filter(Boolean).map(x => x.split('|'));
      openModal(`<h3>Stage history</h3><table class="grid"><tr><th>Stage</th><th>Date</th><th>Note</th></tr>${h.map(x => `<tr><td>${stageBadge(+x[0])}</td><td>${dmy(x[1])}</td><td>${esc(x[2])}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No history</td></tr>'}</table>`, true);
    }
  });
  $('#bulk').onclick = async () => {
    const ids = $$('#list tbody tr').filter(tr => tr.querySelector('.pick')?.checked).map(tr => +tr.dataset.id);
    if (!ids.length) return toast('Select rows first', true);
    try { await api('/production/bulk-stage', { method: 'PUT', body: { ids, stage: +$('#bulkstage').value, date: $('#bulkdate').value } }); toast(`${ids.length} lines updated`); render(); } catch (e) { toast(e.message, true); }
  };
  render();
});

// ------------------------------------------------------------------ dispatch
route('dispatch', async () => {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const state = { buyer_id: '', order_id: params.get('order_id') || '' };
  let items = [];
  main.innerHTML = `<h1>Dispatch</h1>
    <div class="panel"><div class="row">
      ${field('Buyer', `<select id="buyer">${buyerOpts('', 'All buyers')}</select>`, '200px')}
      ${field('Buyer PO *', `<select id="order"><option value="">— select PO —</option></select>`, '260px')}
      ${field('Dispatch date', `<input id="ddate" type="date" value="${today()}">`, '150px')}
      ${field('Invoice no.', `<input id="inv" type="text">`, '130px')}
      ${field('Container / vehicle', `<input id="cont" type="text">`, '160px')}
      ${field('Notes', `<input id="dnotes" type="text">`, '220px')}
    </div>
    <p class="hint">Enter the dispatched quantity per item (or click "Fill all remaining"). Items fully dispatched are marked and their production lines move to Final Dispatch automatically.</p>
    <div class="btns" style="margin-bottom:8px"><button class="btn" id="fillall">Fill all remaining</button><button class="btn" id="clearall">Clear</button></div>
    <div class="tblwrap" id="list" style="max-height:none"></div>
    <div class="totals" id="tot"></div>
    <div class="sticky-foot btns"><button class="btn primary" id="save">Save dispatch</button></div></div>
    <div class="panel"><h3>Dispatch history</h3><div id="hist"></div></div>`;
  const recalc = () => {
    let tq = 0, tc = 0, ta = 0;
    $$('#list tbody tr').forEach(tr => { const it = items.find(x => String(x.id) === tr.dataset.id); const v = +tr.querySelector('.dq').value || 0; tq += v; tc += v * it.cbm; ta += v * it.rate; tr.querySelector('.dq').style.background = v > it.remaining_qty ? '#fee2e2' : ''; });
    $('#tot').innerHTML = `<span>Dispatch Qty <b>${q(tq)}</b></span><span>CBM <b>${c3(tc)}</b></span><span data-p>Amount <b>${cur()} ${n(ta)}</b></span>`;
  };
  const loadOrders = async () => {
    const os = await api('/orders?' + qs({ status: 'open', buyer_id: state.buyer_id }));
    $('#order').innerHTML = '<option value="">— select PO —</option>' + os.map(o => `<option value="${o.id}" ${String(o.id) === String(state.order_id) ? 'selected' : ''}>${esc(o.buyer_name)} — ${esc(o.po_number)} (${q(o.remaining_qty)} remaining)</option>`).join('');
  };
  const render = async () => {
    if (!state.order_id) { $('#list').innerHTML = '<p class="muted">Select a buyer PO</p>'; $('#tot').innerHTML = ''; return; }
    items = (await api('/order-items?order_id=' + state.order_id)).filter(i => i.remaining_qty > 0);
    $('#list').innerHTML = `<table class="grid"><thead><tr><th>#</th><th>Image</th><th>Code</th><th>Description</th><th>Size</th><th class="r">Order qty</th><th class="r">Already disp.</th><th class="r">Remaining</th><th>Stage</th><th class="r">Dispatch now</th></tr></thead>
      <tbody>${items.map((i, k) => `<tr data-id="${i.id}"><td>${k + 1}</td><td>${img(i.image)}</td><td><b>${esc(i.code)}</b></td><td class="small">${esc(i.name)}</td><td class="small">${esc(i.size)}</td><td class="r">${q(i.qty)}</td><td class="r">${q(i.dispatched_qty)}</td><td class="r"><b>${q(i.remaining_qty)}</b></td><td>${i.min_stage != null ? stageBadge(i.min_stage) : ''}</td><td><input class="qty dq" type="number" min="0" placeholder="${q(i.remaining_qty)}"></td></tr>`).join('') || '<tr><td colspan="10" class="muted">Everything dispatched for this PO</td></tr>'}</tbody></table>`;
    recalc();
  };
  $('#buyer').onchange = async () => { state.buyer_id = $('#buyer').value; state.order_id = ''; await loadOrders(); render(); };
  $('#order').onchange = () => { state.order_id = $('#order').value; render(); };
  $('#list').addEventListener('input', recalc);
  $('#fillall').onclick = () => { $$('#list tbody tr').forEach(tr => { const it = items.find(x => String(x.id) === tr.dataset.id); tr.querySelector('.dq').value = it.remaining_qty; }); recalc(); };
  $('#clearall').onclick = () => { $$('.dq').forEach(i => i.value = ''); recalc(); };
  $('#save').onclick = async () => {
    const lines = $$('#list tbody tr').map(tr => ({ order_item_id: +tr.dataset.id, qty: +tr.querySelector('.dq').value || 0 })).filter(l => l.qty > 0);
    if (!lines.length) return toast('Enter dispatch quantity for at least one item', true);
    $('#save').disabled = true;
    try {
      const r = await api('/dispatches', { method: 'POST', body: { order_id: +state.order_id, dispatch_date: $('#ddate').value, invoice_no: $('#inv').value, container: $('#cont').value, notes: $('#dnotes').value, items: lines } });
      toast(`Dispatch saved. ${r.order.status === 'closed' ? 'PO fully dispatched and closed.' : 'Remaining: ' + q(r.order.remaining_qty) + ' pcs'}`);
      $('#inv').value = ''; $('#cont').value = ''; $('#dnotes').value = '';
      await loadOrders(); render(); loadHist();
    } catch (e) { toast(e.message, true); }
    $('#save').disabled = false;
  };
  const loadHist = async () => {
    const h = await api('/dispatches');
    $('#hist').innerHTML = `<table class="grid"><tr><th>Date</th><th>Buyer</th><th>PO</th><th>Invoice</th><th>Container</th><th class="r">Qty</th><th class="r">CBM</th><th class="r" data-p>Amount</th><th>Items</th><th></th></tr>
      ${h.map(d => `<tr><td class="nowrap">${dmy(d.dispatch_date)}</td><td>${esc(d.buyer_name)}</td><td><a href="#/orders/${d.order_id}">${esc(d.po_number)}</a></td><td>${esc(d.invoice_no)}</td><td>${esc(d.container)}</td><td class="r">${q(d.qty)}</td><td class="r">${c3(d.cbm)}</td><td class="r" data-p>${n(d.amount)}</td><td class="small">${esc(d.items)}</td><td><button class="btn sm danger" data-del="${d.id}">undo</button></td></tr>`).join('') || '<tr><td colspan="10" class="muted">No dispatches yet</td></tr>'}</table>`;
    $$('#hist [data-del]').forEach(b => b.onclick = async () => { if (!confirm('Undo this dispatch?')) return; try { await api('/dispatches/' + b.dataset.del, { method: 'DELETE' }); toast('Dispatch removed'); await loadOrders(); render(); loadHist(); } catch (e) { toast(e.message, true); } });
  };
  await loadOrders(); render(); loadHist();
});

// ------------------------------------------------------------------ reports
const REPORTS = [
  ['orders_by_code', 'Total orders — product code wise'],
  ['buyer_summary', 'Buyer summary (totals per buyer)'],
  ['orders_by_buyer', 'Orders — buyer & PO wise (full details)'],
  ['remaining_by_buyer', 'Remaining to dispatch — buyer & PO wise'],
  ['contractor', 'Contractor orders (code, CBM, labour, totals)'],
  ['production', 'Production status'],
];
route('reports', async (kind) => {
  kind = (kind || 'remaining_by_buyer').split('?')[0];
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const buyerName = params.get('buyer');
  const state = { buyer_id: buyerName ? (META.buyers.find(b => b.name === buyerName) || {}).id || '' : '', contractor_id: '', po: '', code: '', date_from: '', date_to: '', pending_only: kind === 'contractor' ? 1 : '' };
  const isC = kind === 'contractor' || kind === 'production';
  main.innerHTML = `<h1>Reports</h1>
    <div class="tabs">${REPORTS.map(([k, l]) => `<a href="#/reports/${k}" class="${k === kind ? 'active' : ''}">${l}</a>`).join('')}</div>
    <div class="panel"><div class="row">
      ${isC ? field('Contractor', `<select id="f_c">${contractorOpts('', null, 'All contractors')}</select>`, '210px') : ''}
      ${field('Buyer', `<select id="f_b">${buyerOpts(state.buyer_id, 'All buyers')}</select>`, '190px')}
      ${field('PO number', `<input id="f_po" type="text" placeholder="buyer PO${kind === 'contractor' ? ' or our PO' : ''}">`, '150px')}
      ${field('Product code', `<input id="f_code" type="text">`, '140px')}
      ${field(isC ? 'PO date from' : 'Order date from', `<input id="f_from" type="date">`, '150px')}${field('To', `<input id="f_to" type="date">`, '150px')}
      ${kind === 'contractor' ? `<label class="small"><input type="checkbox" id="f_pend" checked> pending only (exclude Final Dispatch)</label>` : ''}
      <button class="btn" id="run">Refresh</button>
      <button class="btn" id="xlsx">Export Excel</button>
      <button class="btn" id="pdf">Export PDF</button>
      <button class="btn" onclick="window.print()">Print</button>
    </div></div>
    <div id="out"></div>`;
  const collect = () => { state.buyer_id = $('#f_b').value; state.po = $('#f_po').value; state.code = $('#f_code').value; state.date_from = $('#f_from').value; state.date_to = $('#f_to').value; if (isC) state.contractor_id = $('#f_c').value; if (kind === 'contractor') state.pending_only = $('#f_pend').checked ? 1 : ''; };
  const rq = fmt => { collect(); return qs({ ...state, format: fmt }); };
  const render = async () => {
    const r = await api(`/reports/${kind}?` + rq('json'));
    const cols = r.columns;
    $('#out').innerHTML = `<h2>${esc(r.title)} <span class="small muted">${esc(r.subtitle)}</span></h2>
      <div class="tblwrap"><table class="grid"><thead><tr>${cols.map(c => `<th class="${c.align}">${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${r.rows.map(row => row._group ? `<tr class="group"><td colspan="${cols.length}">${esc(row[cols[0].key] || Object.values(row).find(v => typeof v === 'string' && v))}</td></tr>`
        : `<tr class="${row._bold ? 'sub' : ''}">${cols.map(c => `<td class="${c.align}">${esc(row[c.key] ?? '')}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="muted">No data</td></tr>`}</tbody>
      ${r.totals ? `<tfoot><tr class="total">${cols.map(c => `<td class="${c.align}">${esc(r.totals[c.key] ?? '')}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  };
  $('#run').onclick = render;
  ['#f_b', '#f_from', '#f_to', '#f_c', '#f_pend'].forEach(s => { const el = $(s); if (el) el.onchange = render; });
  ['#f_po', '#f_code'].forEach(s => $(s).oninput = () => { clearTimeout(window._rt); window._rt = setTimeout(render, 350); });
  $('#xlsx').onclick = () => window.open(`/api/reports/${kind}?` + rq('xlsx'));
  $('#pdf').onclick = async () => { try { const r = await api(`/reports/${kind}?` + rq('pdf')); window.open('/open/' + encodeURIComponent(r.filename)); } catch (e) { toast(e.message, true); } };
  render();
});

// ------------------------------------------------------------------ documents
route('documents', async () => {
  const docs = await api('/documents?limit=300');
  main.innerHTML = `<h1>Generated PDFs</h1><div class="panel"><p class="hint">Files are saved in the <span class="kbd">data\\pdf</span> folder. Click to open / print / attach to email.</p>
    <table class="grid"><tr><th>Date</th><th>Type</th><th>File</th></tr>${docs.map(d => `<tr><td class="nowrap">${esc(d.created_at)}</td><td>${esc(d.kind)}</td><td>${pdfLink(d.filename)}</td></tr>`).join('')}</table></div>`;
});

// ------------------------------------------------------------------ products
route('products', async () => {
  let qq = '', bid = '';
  const render = async () => {
    const list = await api('/products?' + qs({ q: qq, buyer_id: bid }));
    $('#list').innerHTML = `<table class="grid"><thead><tr><th>Image</th><th>Code</th><th>Internal</th><th>Description</th><th>Size</th><th class="r">CBM</th><th class="r" data-p>Rate ${cur()}</th><th class="r" data-p>Labour ${lcur()}</th><th>Finish</th><th>Buyer</th><th class="r">Ordered</th><th></th></tr></thead>
      <tbody>${list.map(p => `<tr class="${p.active ? '' : 'muted'}"><td>${img(p.image)}</td><td><b>${esc(p.code)}</b></td><td class="small">${esc(p.internal_code)}</td><td class="small">${esc(p.name)}</td><td class="small">${esc(p.size)}</td><td class="r">${c3(p.cbm)}</td><td class="r" data-p>${n(p.rate)}</td><td class="r" data-p>${n(p.labour_rate, 0)}</td><td class="small">${esc(p.finish)}</td><td class="small">${esc(p.buyer_name || '')}</td><td class="r">${p.times_ordered}</td>
        <td class="nowrap"><button class="btn sm" data-edit="${p.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
    $$('#list [data-edit]').forEach(b => b.onclick = () => editProduct(list.find(p => String(p.id) === b.dataset.edit)));
  };
  main.innerHTML = `<h1>Products (${PRODUCTS.length})</h1><div class="panel"><div class="row">
    ${field('Search', `<input id="f_q" type="text" placeholder="code / description">`, '260px')}${field('Buyer', `<select id="f_b">${buyerOpts('', 'All buyers')}</select>`, '200px')}
    <button class="btn primary" id="add">+ New product</button></div></div><div class="tblwrap" id="list"></div>`;
  $('#f_q').oninput = () => { qq = $('#f_q').value; render(); }; $('#f_b').onchange = () => { bid = $('#f_b').value; render(); };
  $('#add').onclick = () => editProduct(null);
  const editProduct = p => {
    openModal(`<h3>${p ? 'Edit product ' + esc(p.code) : 'New product'}</h3>
      <div class="row">${field('Code *', `<input id="p_code" type="text" value="${esc(p?.code || '')}">`, '180px')}${field('Internal code (WW)', `<input id="p_int" type="text" value="${esc(p?.internal_code || '')}">`, '140px')}${field('Buyer', `<select id="p_buyer">${buyerOpts(p?.buyer_id, '—')}</select>`, '180px')}</div>
      <div class="row" style="margin-top:8px">${field('Description', `<input id="p_name" type="text" value="${esc(p?.name || '')}">`, '100%')}</div>
      <div class="row" style="margin-top:8px">${field('Size (cm)', `<input id="p_size" type="text" value="${esc(p?.size || '')}">`, '200px')}${field('CBM', `<input id="p_cbm" type="number" step="0.001" value="${p?.cbm ?? ''}">`, '100px')}${field('Rate ' + cur(), `<input id="p_rate" type="number" step="0.01" value="${p?.rate ?? ''}">`, '110px')}${field('Labour rate ' + lcur(), `<input id="p_lab" type="number" step="1" value="${p?.labour_rate ?? ''}">`, '120px')}${field('Finish', `<input id="p_fin" type="text" value="${esc(p?.finish || '')}">`, '150px')}</div>
      <div class="row" style="margin-top:8px">${field('Notes', `<input id="p_notes" type="text" value="${esc(p?.notes || '')}">`, '100%')}</div>
      <div class="row" style="margin-top:8px;align-items:center">${p ? img(p.image, 'thumb lg') : ''}${field('Image', `<input id="p_img" type="file" accept="image/*">`, '260px')}${p ? `<label class="small"><input type="checkbox" id="p_active" ${p.active ? 'checked' : ''}> active</label>` : ''}</div>
      <div class="btns" style="margin-top:12px"><button class="btn primary" id="p_save">Save</button>${p ? '<button class="btn danger" id="p_del">Delete</button>' : ''}</div>`);
    $('#p_save').onclick = async () => {
      const body = { code: $('#p_code').value, internal_code: $('#p_int').value, buyer_id: +$('#p_buyer').value || null, name: $('#p_name').value, size: $('#p_size').value, cbm: $('#p_cbm').value, rate: $('#p_rate').value, labour_rate: $('#p_lab').value, finish: $('#p_fin').value, notes: $('#p_notes').value };
      if (p) body.active = $('#p_active').checked ? 1 : 0;
      try {
        const r = p ? await api('/products/' + p.id, { method: 'PUT', body }) : await api('/products', { method: 'POST', body });
        const f = $('#p_img').files[0];
        if (f) { const fd = new FormData(); fd.append('file', f); await api(`/products/${r.id}/image`, { method: 'POST', body: fd }); }
        await loadMeta(); closeModal(); toast('Product saved'); render();
      } catch (e) { toast(e.message, true); }
    };
    if (p) $('#p_del').onclick = async () => { if (!confirm('Delete product?')) return; try { const r = await api('/products/' + p.id, { method: 'DELETE' }); toast(r.note || 'Deleted'); await loadMeta(); closeModal(); render(); } catch (e) { toast(e.message, true); } };
  };
  render();
});

// ------------------------------------------------------------------ buyers / contractors
function masterPage(kind, title, fields) {
  return async () => {
    const render = async () => {
      const list = await api('/' + kind);
      $('#list').innerHTML = `<table class="grid"><thead><tr>${fields.map(f => `<th>${f[1]}</th>`).join('')}<th>Active</th><th></th></tr></thead>
        <tbody>${list.map(x => `<tr>${fields.map(f => `<td>${esc(x[f[0]])}</td>`).join('')}<td>${x.active ? 'yes' : 'no'}</td><td><button class="btn sm" data-edit="${x.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
      $$('#list [data-edit]').forEach(b => b.onclick = () => edit(list.find(x => String(x.id) === b.dataset.edit)));
    };
    const edit = x => {
      openModal(`<h3>${x ? 'Edit' : 'New'} ${title.slice(0, -1).toLowerCase()}</h3>
        ${fields.map(f => `<div class="row" style="margin-top:8px">${field(f[1], f[2] === 'select' ? `<select id="m_${f[0]}">${f[3].map(o => `<option ${x?.[f[0]] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input id="m_${f[0]}" type="text" value="${esc(x?.[f[0]] || '')}">`, '100%')}</div>`).join('')}
        ${x ? `<label class="small" style="display:block;margin-top:8px"><input type="checkbox" id="m_active" ${x.active ? 'checked' : ''}> active</label>` : ''}
        <div class="btns" style="margin-top:12px"><button class="btn primary" id="m_save">Save</button>${x ? '<button class="btn danger" id="m_del">Delete</button>' : ''}</div>`, true);
      $('#m_save').onclick = async () => {
        const body = {}; fields.forEach(f => body[f[0]] = $('#m_' + f[0]).value); if (x) body.active = $('#m_active').checked ? 1 : 0;
        try { x ? await api(`/${kind}/${x.id}`, { method: 'PUT', body }) : await api('/' + kind, { method: 'POST', body }); await loadMeta(); closeModal(); toast('Saved'); render(); } catch (e) { toast(e.message, true); }
      };
      if (x) $('#m_del').onclick = async () => { if (!confirm('Delete?')) return; try { const r = await api(`/${kind}/${x.id}`, { method: 'DELETE' }); toast(r.note || 'Deleted'); await loadMeta(); closeModal(); render(); } catch (e) { toast(e.message, true); } };
    };
    main.innerHTML = `<h1>${title}</h1><div class="panel"><button class="btn primary" id="add">+ New</button></div><div class="tblwrap" id="list"></div>`;
    $('#add').onclick = () => edit(null);
    render();
  };
}
route('buyers', masterPage('buyers', 'Buyers', [['name', 'Name'], ['address', 'Address'], ['country', 'Country'], ['email', 'Email'], ['phone', 'Phone'], ['notes', 'Notes']]));
route('contractors', masterPage('contractors', 'Contractors', [['name', 'Name'], ['type', 'Type', 'select', ['wood', 'iron', 'carton', 'sticker', 'other']], ['address', 'Address'], ['phone', 'Phone'], ['notes', 'Notes']]));

// ------------------------------------------------------------------ shop floor (mobile stage update)
route('shop', async () => {
  const state = { contractor_id: '', q: '', stage: '' };
  const render = async () => {
    const p = { ...state }; if (p.stage === '') delete p.stage;
    const list = await api('/production?' + qs(p));
    $('#cards').innerHTML = list.map(l => `<div class="wcard" data-id="${l.id}">
      <div class="wimg">${img(l.image, 'thumb lg')}</div>
      <div class="wbody">
        <div class="wtitle">${esc(l.code)} <span class="muted small">× ${q(l.qty)} pcs</span></div>
        <div class="small">${esc(l.name)}</div>
        <div class="small muted">${esc(l.contractor_name)} · ${esc(l.contractor_po)} · ${esc(l.buyer_name)} ${esc(l.buyer_po)}${l.finish ? ' · ' + esc(l.finish) : ''}</div>
        <div style="margin-top:6px">${stageBadge(l.stage)} <span class="small muted">${dmy(l.stage_date)}</span></div>
        <div class="wbtns"><button class="btn sm prev" ${l.stage <= 0 ? 'disabled' : ''}>◀ ${esc(META.stages[l.stage - 1] || '')}</button>
          <select class="st">${stageOpts(l.stage)}</select>
          <button class="btn sm primary next" ${l.stage >= 11 ? 'disabled' : ''}>${esc(META.stages[l.stage + 1] || 'Done')} ▶</button></div>
      </div></div>`).join('') || '<p class="muted">Nothing found</p>';
  };
  main.innerHTML = `<h1>Shop Floor</h1>
    <div class="panel"><div class="row">
      ${field('Contractor', `<select id="f_c">${contractorOpts('', ['wood', 'iron', 'other'], 'All contractors')}</select>`, '200px')}
      ${field('Stage', `<select id="f_s"><option value="">All stages</option>${META.stages.map((x, i) => `<option value="${i}">${i}. ${esc(x)}</option>`).join('')}</select>`, '180px')}
      ${field('Search code / PO', `<input id="f_q" type="text" placeholder="code or PO">`, '200px')}
    </div></div>
    <div id="cards" class="wcards"></div>`;
  $('#f_c').onchange = () => { state.contractor_id = $('#f_c').value; render(); };
  $('#f_s').onchange = () => { state.stage = $('#f_s').value; render(); };
  $('#f_q').oninput = () => { clearTimeout(window._st); window._st = setTimeout(() => { state.q = $('#f_q').value; render(); }, 300); };
  const setStage = async (card, stage) => {
    try { await api(`/production/${card.dataset.id}/stage`, { method: 'PUT', body: { stage } }); toast('→ ' + META.stages[stage]); render(); } catch (e) { toast(e.message, true); }
  };
  $('#cards').addEventListener('click', e => {
    const card = e.target.closest('.wcard'); if (!card) return;
    const cur = +card.querySelector('.st').value;
    if (e.target.classList.contains('next')) setStage(card, Math.min(11, cur + 1));
    if (e.target.classList.contains('prev')) setStage(card, Math.max(0, cur - 1));
  });
  $('#cards').addEventListener('change', e => { if (e.target.classList.contains('st')) setStage(e.target.closest('.wcard'), +e.target.value); });
  render();
});

// ------------------------------------------------------------------ users (admin)
route('users', async () => {
  const render = async () => {
    const d = await api('/users');
    $('#list').innerHTML = `<table class="grid"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Active</th><th>Created</th><th></th></tr></thead>
      <tbody>${d.users.map(u => `<tr><td><b>${esc(u.username)}</b></td><td>${esc(u.name)}</td><td>${esc(u.role_label)}</td><td>${u.active ? 'yes' : '<span class="badge bad">no</span>'}</td><td class="small">${esc(u.created_at)}</td><td><button class="btn sm" data-edit="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
    $$('#list [data-edit]').forEach(b => b.onclick = () => edit(d, d.users.find(u => String(u.id) === b.dataset.edit)));
  };
  const edit = (d, u) => {
    openModal(`<h3>${u ? 'Edit user ' + esc(u.username) : 'New user'}</h3>
      ${u ? '' : `<div class="row"><div class="field" style="width:100%"><label>Username (login)</label><input id="u_user" type="text"></div></div>`}
      <div class="row" style="margin-top:8px"><div class="field" style="width:100%"><label>Full name</label><input id="u_name" type="text" value="${esc(u?.name || '')}"></div></div>
      <div class="row" style="margin-top:8px"><div class="field" style="width:100%"><label>Role</label><select id="u_role">${d.roles.map(r => `<option value="${r.id}" ${u?.role === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div></div>
      <div class="row" style="margin-top:8px"><div class="field" style="width:100%"><label>${u ? 'New password (leave blank to keep)' : 'Password'}</label><input id="u_pass" type="text" autocomplete="off"></div></div>
      ${u ? `<label class="small" style="display:block;margin-top:8px"><input type="checkbox" id="u_active" ${u.active ? 'checked' : ''}> active (unticked = cannot log in)</label>` : ''}
      <p class="hint">Admin: everything · Office assistant: orders, POs, dispatch, reports (no settings/users/delete) · Production supervisor: Shop Floor & stage updates only, no prices · Dispatch: dispatch entry & remaining lists, no prices.</p>
      <div class="btns" style="margin-top:12px"><button class="btn primary" id="u_save">Save</button></div>`, true);
    $('#u_save').onclick = async () => {
      const body = { name: $('#u_name').value, role: $('#u_role').value, password: $('#u_pass').value };
      if (u) body.active = $('#u_active').checked ? 1 : 0; else body.username = $('#u_user').value;
      try { u ? await api('/users/' + u.id, { method: 'PUT', body }) : await api('/users', { method: 'POST', body }); closeModal(); toast('Saved'); render(); } catch (e) { toast(e.message, true); }
    };
  };
  main.innerHTML = `<h1>Users</h1><div class="panel"><button class="btn primary" id="add">+ New user</button> <span class="hint">Each team member gets their own login. Share the website address and their username/password.</span></div><div class="tblwrap" id="list"></div>`;
  $('#add').onclick = async () => edit(await api('/users'), null);
  render();
});

// ------------------------------------------------------------------ my account
route('account', async () => {
  main.innerHTML = `<h1>My account</h1><div class="panel">
    <p>Logged in as <b>${esc(USER.name || USER.username)}</b> (${esc(USER.role_label)})</p>
    <h3>Change password</h3>
    <div class="row">${field('Current password', `<input id="a_old" type="password">`, '220px')}${field('New password', `<input id="a_new" type="password">`, '220px')}${field('Repeat new password', `<input id="a_new2" type="password">`, '220px')}<button class="btn primary" id="a_save">Change password</button></div></div>`;
  $('#a_save').onclick = async () => {
    if ($('#a_new').value !== $('#a_new2').value) return toast('New passwords do not match', true);
    try { await api('/me/password', { method: 'PUT', body: { old: $('#a_old').value, new: $('#a_new').value } }); toast('Password changed'); $$('#main input').forEach(i => i.value = ''); } catch (e) { toast(e.message, true); }
  };
});

// ------------------------------------------------------------------ settings
route('settings', async () => {
  const s = META.settings;
  const keys = [['company_name', 'Company name'], ['company_short', 'Short name (menu bar)'], ['company_city', 'City (for PO jurisdiction line)'], ['company_address1', 'Address line 1'], ['company_address2', 'Address line 2'], ['company_phone', 'Phone'], ['company_email', 'Email'], ['company_gst', 'GST IN'],
    ['ship_to_name', 'Ship-to name (on contractor PO)'], ['ship_to_address1', 'Ship-to address 1'], ['ship_to_address2', 'Ship-to address 2'], ['ship_to_phone', 'Ship-to phone'],
    ['po_prefix', 'Contractor PO prefix'], ['po_next_number', 'Next contractor PO number'], ['po_number_width', 'PO number digits'], ['po_suffix', 'PO suffix (e.g. /26)'],
    ['pi_prefix', 'PI prefix'], ['pi_next_number', 'Next PI number'], ['moisture_content', 'Moisture content (contractor PO)'], ['currency', 'Sales currency'], ['labour_currency', 'Labour currency']];
  main.innerHTML = `<h1>Settings</h1><div class="panel">
    ${keys.map(([k, l]) => `<div class="row" style="margin-top:6px">${field(l, `<input id="s_${k}" type="text" value="${esc(s[k] ?? '')}">`, '480px')}</div>`).join('')}
    <div class="btns" style="margin-top:12px"><button class="btn primary" id="save">Save settings</button><button class="btn" id="backup">Backup database now</button></div>
    <p class="hint" style="margin-top:14px">Next contractor PO will be: <b>${esc(META.next_po)}</b>. Database file: <span class="kbd">data\\oms.db</span> — copy it regularly to a safe place (or click Backup).</p></div>`;
  $('#save').onclick = async () => { const body = {}; keys.forEach(([k]) => body[k] = $('#s_' + k).value); try { await api('/settings', { method: 'PUT', body }); await loadMeta(); await loadBrand(); toast('Settings saved'); } catch (e) { toast(e.message, true); } };
  $('#backup').onclick = async () => { try { const r = await api('/backup', { method: 'POST' }); toast('Backup saved: ' + r.file); } catch (e) { toast(e.message, true); } };
});

// ------------------------------------------------------------------ boot
function applyUser() {
  document.body.classList.toggle('noprice', !PRICES());
  $$('#side nav a').forEach(a => { if (a.dataset.route) a.style.display = can(a.dataset.route) ? '' : 'none'; });
  $$('#side nav .sec').forEach(sec => {
    let el = sec.nextElementSibling, any = false;
    while (el && !el.classList.contains('sec')) { if (el.style.display !== 'none') any = true; el = el.nextElementSibling; }
    sec.style.display = any ? '' : 'none';
  });
  $('#whoami').innerHTML = `<b>${esc(USER.name || USER.username)}</b><br><span class="small">${esc(USER.role_label)}</span>`;
  document.body.classList.remove('logged-out');
}
function showLogin() {
  USER = null;
  document.body.classList.add('logged-out');
  main.innerHTML = `<div class="login"><div class="box">
    <div class="logo">${esc(BRAND.company_name)}<small>Order Management System</small></div>
    <div class="field"><label>Username</label><input id="l_user" type="text" autocomplete="username" autofocus></div>
    <div class="field" style="margin-top:10px"><label>Password</label><input id="l_pass" type="password" autocomplete="current-password"></div>
    <button class="btn primary" id="l_go" style="margin-top:16px;width:100%">Log in</button>
    <p class="hint" id="l_msg"></p></div></div>`;
  const go = async () => {
    $('#l_msg').textContent = '';
    try {
      USER = await api('/login', { method: 'POST', body: { username: $('#l_user').value, password: $('#l_pass').value } });
      await loadMeta(); applyUser();
      if (!location.hash || location.hash === '#/') location.hash = '#/' + HOME[USER.role]; else navigate();
    } catch (e) { $('#l_msg').textContent = e.message; $('#l_msg').style.color = 'var(--bad)'; }
  };
  $('#l_go').onclick = go;
  $('#l_pass').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#l_user').onkeydown = e => { if (e.key === 'Enter') $('#l_pass').focus(); };
}
$('#logout').onclick = async () => { try { await api('/logout', { method: 'POST' }); } catch (e) { /* ignore */ } location.hash = ''; showLogin(); };
$('#burger').onclick = () => document.body.classList.toggle('nav-open');
(async () => {
  await loadBrand();
  try { USER = await api('/me'); } catch (e) { return showLogin(); }
  await loadMeta(); applyUser();
  if (!location.hash || location.hash === '#/') location.hash = '#/' + HOME[USER.role]; else navigate();
})();
