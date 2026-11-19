const DUCKDB_WASM_VERSION = '1.29.0';
const duckdb = await import(`https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_WASM_VERSION}/+esm`);
import { EditorView, basicSetup } from 'https://esm.sh/codemirror@6.0.1';
import { sql as sqlLang, SQLite } from 'https://esm.sh/@codemirror/lang-sql@6.8.0';
import { keymap } from 'https://esm.sh/@codemirror/view@6.35.0';
import { insertTab } from 'https://esm.sh/@codemirror/commands@6.7.1';
import { oneDark } from 'https://esm.sh/@codemirror/theme-one-dark@6.1.2';

const $ = id => document.getElementById(id);
const KEY_Q = 'duckpg:queries', KEY_LAST = 'duckpg:last', DB_PATH = 'opfs://duckpg.db';
const SEED = ``;
const DEFAULT_QUERY = "SELECT cidade, COUNT(*) AS total, AVG(idade) AS idade_media\nFROM clientes\nGROUP BY cidade\nORDER BY total DESC;";
console.log(DEFAULT_QUERY);
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const show = html => { $('out').className=''; $('out').innerHTML = html; };
const fmt = v => v === null || v === undefined ? null
  : typeof v === 'bigint' ? v.toString()
  : typeof v === 'object' ? JSON.stringify(v, (k,x) => typeof x === 'bigint' ? x.toString() : x)
  : String(v);

const editor = new EditorView({
  parent: $('sql'),
  doc: '',
  extensions: [
    basicSetup,
    oneDark,
    sqlLang({ dialect: SQLite }),
    keymap.of([
      { key: 'Mod-Enter', run: () => { run(); return true; } },
      insertTab,
    ]),
  ],
});


const getSQL = () => $('sql').value;
const setSQL = (text) => {
  $('sql').value = text;
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: text },
  });
};
let db, conn, persistent = false, mainCat = 'memory';
let lastResult = null;   // { cols, rows, total, cached, ms }
let currentPage = 0;
let pageSize = 50;
const MAX_CACHE = 50000; // limite de linhas mantidas em memória
const attached = [];

async function init(){
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], {type:'text/javascript'}));
  db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), new Worker(workerUrl));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  try{
    await db.open({ path: DB_PATH, accessMode: duckdb.DuckDBAccessMode.READ_WRITE });
    persistent = true;
  }catch(e){ console.warn('OPFS indisponível, usando memória:', e); }
  conn = await db.connect();
  mainCat = String((await conn.query('SELECT current_database() AS d')).toArray()[0].d);
  if(!(await listTables()).some(t => t.main)){ await conn.query(SEED); }
}

async function listTables(){
  const r = await conn.query(`SELECT table_catalog AS c, table_schema AS s, table_name AS n FROM information_schema.tables
    WHERE table_catalog NOT IN ('system','temp') AND table_schema NOT IN ('information_schema','pg_catalog') ORDER BY 1,2,3`);
  return r.toArray().map(x => {
    const c = String(x.c), sc = String(x.s), n = String(x.n), main = c === mainCat;
    return { main, label: main ? (sc==='main' ? n : `${sc}.${n}`) : `${c}.${sc}.${n}`,
             q: `"${c}"."${sc}"."${n}"`, catalog: c, schema: sc, name: n };
  });
}
async function renderTables(){
  const ul = $('tables'), items = await listTables();
  ul.innerHTML = items.length ? '' : '<li class="empty">Nenhuma tabela</li>';
  items.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="name" title="Ver conteúdo">${esc(t.label)}</button>` + (t.main ? '<button class="small" title="Remover">✕</button>' : '');
    li.children[0].onclick = async () => {
      try{
        const cur = await conn.query('SELECT current_database() AS d, current_schema() AS s');
        const { d, s } = cur.toArray()[0];
        if(String(d) !== t.catalog || String(s) !== t.schema){
          await conn.query(`USE "${t.catalog}"."${t.schema}"`);
        }
        setSQL(`SELECT * FROM "${t.name}" LIMIT 100;`);
        await run();
      }catch(e){
        show(`<div class="msg err">Erro ao selecionar a tabela: ${esc(e.message||e)}</div>`);
      }
    };
    if(t.main) li.children[1].onclick = async () => { if(confirm(`Remover a tabela ${t.label}?`)){ await conn.query(`DROP TABLE ${t.q}`); renderTables(); } };
    ul.appendChild(li);
  });
}
function renderAttached(){
  const ul = $('attached');
  ul.innerHTML = attached.length ? '' : '<li class="empty">Nenhum aberto</li>';
  attached.forEach((a,i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="name" title="${esc(a.file.name)} (${(a.file.size/1048576).toFixed(1)} MB)" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; left:120px;">${esc(a.alias)} <span class="hint">${(a.file.size/1048576).toFixed(0)} MB</span></span><button class="small" title="Fechar">✕</button>`;
    li.children[1].onclick = async () => {
      try{
        await conn.query(`DETACH "${a.alias}"`);
        await db.dropFile(a.file.name);
        await conn.query(`USE "${mainCat}"."main"`);
        attached.splice(i,1);
        renderAttached(); renderTables();
      }catch(e){
        show(`<div class="msg err">Erro ao fechar o banco: ${esc(e.message||e)}</div>`);
      }
    };
    ul.appendChild(li);
  });
}
async function attachDb(file){
  const alias = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g,'_').replace(/^(\d)/,'_$1') || 'banco';
  try{
    const old = attached.findIndex(a => a.alias === alias);
    if(old >= 0){ try{ await conn.query(`DETACH "${alias}"`); }catch(e){} attached.splice(old,1); }
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    await conn.query(`ATTACH '${file.name}' AS "${alias}" (READ_ONLY)`);
    await conn.query(`USE "${alias}"."main"`);
    attached.push({ alias, file });
    renderAttached(); await renderTables();
    setSQL(`-- Tabelas do banco "${alias}"\nSELECT schema_name, table_name, estimated_size AS linhas_aprox, column_count
    FROM duckdb_tables()
    WHERE database_name = '${alias}'
    ORDER BY 1, 2;`);
    await run();
  }catch(e){
    show(`<div class="msg err">Erro ao abrir o banco: ${esc(e.message||e)}\n\nSe a mensagem falar em versão/formato de armazenamento, o arquivo foi criado por um DuckDB mais novo que o do navegador. Ajuste DUCKDB_WASM_VERSION no topo do script.</div>`);
  }
}

const getQueries = () => { try{ return JSON.parse(store.get(KEY_Q)||'[]'); }catch(e){ return []; } };
function renderSaved(){
  const ul = $('saved'), qs = getQueries();
  ul.innerHTML = qs.length ? '' : '<li class="empty">Nenhuma ainda</li>';
  qs.forEach((q,i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="name" title="${esc(q.sql)}">${esc(q.name)}</button><button class="small" title="Excluir">✕</button>`;
    li.children[0].onclick = () => { setSQL(q.sql); $('qname').value = q.name; };
    li.children[1].onclick = () => { const a=getQueries(); a.splice(i,1); store.set(KEY_Q, JSON.stringify(a)); renderSaved(); };
    ul.appendChild(li);
  });
}
function saveQuery(){
  const sql = getSQL().trim(); if(!sql) return;
  const name = $('qname').value.trim() || ('Query ' + (getQueries().length+1));
  const qs = getQueries(), idx = qs.findIndex(q => q.name === name);
  if(idx>=0) qs[idx].sql = sql; else qs.push({name, sql});
  const ok = store.set(KEY_Q, JSON.stringify(qs));
  renderSaved();
  show(ok ? `<div class="msg ok">Query “${esc(name)}” salva.</div>` : '<div class="msg err">Não foi possível salvar (armazenamento indisponível).</div>');
}
function kindOf(t){

  const s = String(t);    
  if(/^(Int|Uint|Float|Decimal)/.test(s)) return 'num';
  if(/^(Timestamp|Date|Time|Interval)/.test(s)) return 'date';
  if(/^Bool/.test(s)) return 'bool';
  if(/^(Utf8|LargeUtf8|Dictionary)/.test(s)) return 'text';
  if(/^(Binary|LargeBinary|List|Struct|Map)/.test(s)) return 'json';
  return 'text';
}
async function run(){
  const sql = getSQL();
  if(!sql.trim() || !conn) return;
  store.set(KEY_LAST, sql);
  $('run').disabled = true;
  console.log(sql);
  const t0 = performance.now();
  try{
    const t = await conn.query(sql);
    const ms = (performance.now()-t0).toFixed(1);
    const cols = t.schema.fields.map(f => f.name);
    const types = t.schema.fields.map(f => kindOf(f.type));

    if(!cols.length){
      lastResult = null;
      show(`<div class="msg ok">Executado com sucesso em ${ms} ms.</div>`);
      await renderTables();
      $('run').disabled = false;
      return;
    }

    const total  = t.numRows;
    const cached = Math.min(total, MAX_CACHE);
    const rows   = new Array(cached);
    for(let j = 0; j < cached; j++){
      const row = new Array(cols.length);
      for(let i = 0; i < cols.length; i++) row[i] = t.getChildAt(i).get(j);
      rows[j] = row;
    }

    lastResult = { cols, rows, total, cached, ms };
    currentPage = 0;
    renderPage(types);
    await renderTables();
  }catch(e){
    lastResult = null;
    show(`<div class="msg err">Erro: ${esc(e.message||e)}</div>`);
  }
  $('run').disabled = false;
}
function renderPage(types){
  if(!lastResult) return;
  const { cols, rows, total, cached, ms } = lastResult;
  const totalPages = Math.max(1, Math.ceil(cached / pageSize));
  if(currentPage >= totalPages) currentPage = totalPages - 1;
  if(currentPage < 0) currentPage = 0;

  const start = currentPage * pageSize;
  const end   = Math.min(start + pageSize, cached);
  const pageRows = rows.slice(start, end);
  
  const body = pageRows.map((row, k) => {
    const n = start + k + 1;
    return '<tr><td class="rownum">' + n + '</td>'
      + row.map((v, i) => {
    const s = fmt(v);
    if(s === null) return '<td class="null">NULL</td>';
    const k = types[i];
    const num = (k === 'num') ? ' num' : '';
    return `<td class="cell ${k}${num}">${esc(s)}</td>`;
  }).join('')
      + '</tr>';
  }).join('');

  const truncated = cached < total;
  const warn = truncated
    ? `<div class="hint warn"> Resultado tem ${total} linhas — apenas as primeiras ${cached} foram carregadas. Use LIMIT/OFFSET na query para ver além.</div>`
    : '';

  show(`
    <div class="pager">
      <button data-pg="first" ${currentPage===0?'disabled':''} title="Primeira">«</button>
      <button data-pg="prev"  ${currentPage===0?'disabled':''} title="Anterior">‹</button>
      <span class="pager-info">
        Página <input type="number" id="pageno" min="1" max="${totalPages}" value="${currentPage+1}" > de ${totalPages}
        · linhas ${start+1}–${end} de ${total}
      </span>
      <button data-pg="next" ${end>=cached?'disabled':''} title="Próxima">›</button>
      <button data-pg="last" ${end>=cached?'disabled':''} title="Última">»</button>
      <label class="pager-size">por página
        <select id="pagesize">
          ${[25,50,100,250,500,1000].map(n => `<option value="${n}" ${n===pageSize?'selected':''}>${n}</option>`).join('')}
        </select>
      </label>
      <span class="hint">· ${ms} ms</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th class="rownum">#</th>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${body || `<tr><td colspan="${cols.length+1}" class="empty">0 linhas</td></tr>`}</tbody>
      </table>
    </div>
    ${warn}
  `);

  $('out').querySelectorAll('[data-pg]').forEach(btn => {
    btn.onclick = () => {
      const a = btn.dataset.pg;
      if(a === 'first') currentPage = 0;
      else if(a === 'prev') currentPage--;
      else if(a === 'next') currentPage++;
      else if(a === 'last') currentPage = totalPages - 1;
      renderPage(types);
      const w = $('out').querySelector('.table-wrap');
      if(w) w.scrollTop = 0;
    };
  });

  const pn = $('pageno');
  if(pn) pn.onchange = () => {
    let v = parseInt(pn.value, 10) || 1;
    v = Math.max(1, Math.min(totalPages, v));
    currentPage = v - 1;
    renderPage();
  };

  $('pagesize').onchange = (e) => {
    pageSize = parseInt(e.target.value, 10) || 50;
    currentPage = 0;
    renderPage();
  };
}
async function importFile(file){
  const ext = file.name.split('.').pop().toLowerCase();
  const table = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_]/g,'_').replace(/^(\d)/,'_$1') || 'dados';
  const reader = { csv:'read_csv_auto', tsv:'read_csv_auto', parquet:'read_parquet', json:'read_json_auto' }[ext];
  if(!reader){ show('<div class="msg err">Formato não suportado. Use CSV, TSV, Parquet ou JSON.</div>'); return; }
  try{
    await db.registerFileBuffer(file.name, new Uint8Array(await file.arrayBuffer()));
    await conn.query(`CREATE OR REPLACE TABLE "${table}" AS SELECT * FROM ${reader}('${file.name}')`);
    console.log(`SELECT * FROM "${table}"`);
    setSQL(`SELECT * FROM "${table}" LIMIT 100;`);
    await renderTables(); await run();
  }catch(e){ show(`<div class="msg err">Erro ao importar: ${esc(e.message||e)}</div>`); }
}

async function resetDb(){
  if(!confirm('Apagar todas as tabelas e voltar ao banco de exemplo?')) return;
  for(const t of (await listTables()).filter(t => t.main)) await conn.query(`DROP TABLE ${t.q}`);
  await conn.query(SEED); await renderTables();
  show('<div class="msg ok">Banco resetado.</div>');
}

$('run').onclick = run; $('save').onclick = saveQuery; $('reset').onclick = resetDb;
$('dbfile').onchange = e => { if(e.target.files[0]) attachDb(e.target.files[0]); e.target.value=''; };
$('file').onchange = e => { if(e.target.files[0]) importFile(e.target.files[0]); e.target.value=''; };


setSQL(store.get(KEY_LAST) || DEFAULT_QUERY);
renderSaved(); renderAttached();
try{
  await init();
  $('status').textContent = persistent ? 'DuckDB-WASM · dados salvos no navegador (OPFS)' : 'DuckDB-WASM · dados apenas em memória nesta sessão';
  await renderTables();
  $('run').disabled = false;
  show('<div class="empty">Pronto. Escreva uma query e clique em Executar.</div>');
}catch(e){
  $('status').textContent = 'Falha ao iniciar';
  show(`<div class="msg err">Não foi possível iniciar o DuckDB-WASM: ${esc(e.message||e)}\nVerifique sua conexão com a internet.</div>`);
}