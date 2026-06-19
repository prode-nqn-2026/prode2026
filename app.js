// ── FUNCIONES TEMPRANAS (modal / tabs) ────────────────────────
function abrirModal(id){
  const el=document.getElementById('modal-'+id);
  if(el) {
    el.classList.add('on');
    // Animar secciones internas del modal en cascada
    const sections = el.querySelectorAll('.modal-section');
    sections.forEach((s, i) => {
      s.style.animation = 'none';
      s.offsetHeight;
      s.style.animation = `fadeUp .3s ease ${i * 60}ms both`;
    });
  }
  if(id==='editar-perfil') cargarDatosPerfil();
  if(id==='cambiar-foto')  prepararModalFoto();
}
function cerrarModal(id){const el=document.getElementById('modal-'+id);if(el)el.classList.remove('on')}
function switchTab(tab){
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  const btn=document.querySelector('.nav-tab[data-tab="'+tab+'"]');
  if(btn)btn.classList.add('active');
  const view=document.getElementById('view-'+tab);
  if(view){
    view.classList.add('active');
    view.style.animation='none';
    view.offsetHeight;
    view.style.animation='';
  }
  localStorage.setItem('prode_tab', tab);
  if(tab==='pronosticos' && currentUser) cargarEnVivo();
  if(tab==='envivo') cargarEnVivoTab();
}

// ── CÓDIGO PRINCIPAL ──────────────────────────────────────────
// ── BANDERAS ──────────────────────────────────────────────────
// Códigos ISO de países para flagcdn.com
const FLAG_CODES = {
  'México':'mx','Sudáfrica':'za','Corea del Sur':'kr','República Checa':'cz',
  'Canadá':'ca','Qatar':'qa','Suiza':'ch','Bosnia':'ba',
  'Brasil':'br','Marruecos':'ma','Haití':'ht','Escocia':'gb-sct',
  'Estados Unidos':'us','Paraguay':'py','Australia':'au','Turquía':'tr',
  'Alemania':'de','Curazao':'cw','Costa de Marfil':'ci','Ecuador':'ec',
  'Países Bajos':'nl','Japón':'jp','Túnez':'tn','Suecia':'se',
  'Bélgica':'be','Egipto':'eg','Irán':'ir','Nueva Zelanda':'nz',
  'España':'es','Cabo Verde':'cv','Arabia Saudita':'sa','Uruguay':'uy',
  'Francia':'fr','Senegal':'sn','Noruega':'no','Irak':'iq',
  'Argentina':'ar','Argelia':'dz','Austria':'at','Jordania':'jo',
  'Portugal':'pt','Rep. Dem. Congo':'cd','Uzbekistán':'uz','Colombia':'co',
  'Inglaterra':'gb-eng','Croacia':'hr','Ghana':'gh','Panamá':'pa',
};

function flag(pais, size=20) {
  const code = FLAG_CODES[pais];
  if (!code) return '<span style="font-size:'+size+'px">🏳️</span>';
  return `<img src="https://flagcdn.com/w40/${code}.png" 
    style="width:${size+4}px;height:${Math.round((size+4)*0.67)}px;object-fit:cover;border-radius:2px;vertical-align:middle;display:inline-block;" 
    alt="${pais}" loading="lazy" onerror="this.style.display='none'"/>`;
}

// ── CONFIG ────────────────────────────────────────────────────
const SCRIPT_URL_FIJA = 'https://script.google.com/macros/s/AKfycbwpCjcP7s8zRMAEMEfKxUVLTBn5B5gzBQ_IqFtB650mLxK_TBvfIo740I6NUUNMbGOs/exec';
let SCRIPT_URL = SCRIPT_URL_FIJA !== 'TU_URL_ACA' ? SCRIPT_URL_FIJA : (localStorage.getItem('prode_url') || '');

// ── FIREBASE CLOUD MESSAGING (push notifications) ──────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAsDIA9Y3W8HEmSjTaWI7cnTR4X5esE9rU",
  authDomain: "prode2026-ecd26.firebaseapp.com",
  projectId: "prode2026-ecd26",
  storageBucket: "prode2026-ecd26.firebasestorage.app",
  messagingSenderId: "748658807388",
  appId: "1:748658807388:web:fcf7b6f69a3bf296118c99"
};
const FCM_VAPID_KEY = "BMTosxulaNYshBY3RPclx0F1knAD68ugfZi7U6hZzeQj2zxoIl9Jh6vNA8_NFTvSczhsuidvDtDQjuu9vc3S2TY";
let fcmMessaging = null;
try {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(FIREBASE_CONFIG);
    fcmMessaging = firebase.messaging();
    fcmMessaging.onMessage(payload => {
      const n = payload.notification || {};
      toast('🔔 ' + (n.title || '') + (n.body ? ': ' + n.body : ''));
    });
  }
} catch(e) { console.warn('Firebase no disponible:', e); }

const AVATARS = [
  {bg:'#0f2a05',fg:'#B8F73C'},{bg:'#05152a',fg:'#5B8FF9'},
  {bg:'#2a1505',fg:'#FFB060'},{bg:'#2a0505',fg:'#FF7070'},
  {bg:'#150528',fg:'#C4A0FF'},{bg:'#052a1a',fg:'#60FFB0'},
  {bg:'#282505',fg:'#FFE060'},{bg:'#051528',fg:'#60AFFF'}
];

let currentUser = null;
let fixtureData  = [];
let pronLocales  = {};
let pronGuardados = {};

// ── CACHE ────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch(e) {}
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch(e) { return null; }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  // Garantizar que el splash se oculte pase lo que pase
  const _splash = document.getElementById('splash');
  if (_splash) {
    setTimeout(() => { _splash.classList.add('hidden'); }, 2500);
    setTimeout(() => { if(_splash) _splash.style.display='none'; }, 3200);
  }

  try {

  // Mostrar datos cacheados instantáneamente
  const cachedRanking = cacheGet('ranking');
  const cachedFixture = cacheGet('fixture');
  if (cachedRanking) renderRankingData(cachedRanking);
  if (cachedFixture) {
    fixtureData = Array.isArray(cachedFixture) ? cachedFixture : (cachedFixture.partidos || []);
    if (fixtureData.length) renderFixtureConModo(fixtureData);
  }

  // Restaurar sesión guardada — instantáneo primero, verificar después
  const savedUser = localStorage.getItem('prode_user');
  const savedPin  = localStorage.getItem('prode_pin');
  if (savedUser && savedPin) {
    // 1. Mostrar sesión INMEDIATAMENTE sin esperar al servidor
    currentUser = savedUser;
    document.getElementById('login-nombre').value         = savedUser;
    document.getElementById('login-pin').value            = savedPin;
    document.getElementById('login-area').style.display   = 'none';
    document.getElementById('pron-area').style.display    = 'block';
    document.getElementById('pron-title').textContent     = savedUser.toUpperCase();
    document.getElementById('perfil-nombre').textContent  = savedUser;
    actualizarHeroBtns();

    // Foto desde caché si existe
    const cachedFoto = localStorage.getItem('prode_foto_' + savedUser);
    if (cachedFoto) mostrarFoto(cachedFoto);

    // 2. Cargar foto y pronósticos en segundo plano — sin verificar PIN
    //    (solo el logout explícito cierra la sesión)
    cargarFotoPerfil(savedUser);
    apiGet('pronosticos', '&nombre=' + encodeURIComponent(savedUser)).then(data => {
      if ((data && data.ok)) {
        pronGuardados = {};
        (data.pronosticos || []).forEach(p => {
          pronGuardados[p.partido_id] = { gl: p.gol_l, gv: p.gol_v };
          pronLocales[p.partido_id]   = { gl: p.gol_l, gv: p.gol_v };
        });
        if (fixtureData.length) renderPron();
      }
    });
  } else {
    // Sin sesión: asegurarse de ocultar tabs de auth
    actualizarHeroBtns();
  }

  // Restaurar último tab visitado
  const _authTabs = ['ranking','pronosticos','estadisticas'];
  const _savedTab = localStorage.getItem('prode_tab') || 'fixture';
  const _canRestore = !_authTabs.includes(_savedTab) || currentUser;
  switchTab(_canRestore ? _savedTab : 'fixture');

  // Cargar todo en paralelo
  if (SCRIPT_URL) {
    Promise.all([
      apiGet('ranking'),
      apiGet('fixture')
    ]).then(([rankData, fixData]) => {
      if ((rankData && rankData.ok))  { cacheSet('ranking', rankData);  renderRankingData(rankData); }
      if ((fixData && fixData.ok))   { fixtureData = fixData.partidos || []; cacheSet('fixture', fixtureData); renderFixtureConModo(fixtureData); if(currentUser) renderPron(); }
    });
  }

  document.querySelectorAll('.overlay').forEach(m=>{
    m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('on'); });
  });
  iniciarContador();

  agendarProximoPoll();

  // Ocultar splash
  const splash = document.getElementById('splash');
  if (splash) {
    const hideSplash = () => {
      splash.classList.add('hidden');
      setTimeout(() => { if(splash) splash.style.display='none'; }, 600);
      setTimeout(() => lanzarConfetti(3000), 400);
    };
    // Si hay cache lo ocultamos rápido, si no esperamos un poco más
    if (cachedRanking || cachedFixture) {
      setTimeout(hideSplash, 600);
    } else {
      setTimeout(hideSplash, 1800);
    }
  }

  } catch(e) {
    // Si algo falla, al menos ocultamos el splash para que la app sea usable
    const s = document.getElementById('splash');
    if (s) { s.classList.add('hidden'); s.style.display='none'; }
    console.error('Init error:', e);
  }
});

// ── API ───────────────────────────────────────────────────────
async function apiGet(accion, extra=''){
  if(!SCRIPT_URL){ toast('Primero conectá el Apps Script',true); return null; }
  try{ const r=await fetch(SCRIPT_URL+'?accion='+accion+extra); return await r.json(); }
  catch{ toast('Error de conexión',true); return null; }
}
async function apiPost(body){
  if(!SCRIPT_URL){ toast('Primero conectá el Apps Script',true); return null; }
  try{ const r=await fetch(SCRIPT_URL,{method:'POST',body:JSON.stringify(body)}); return await r.json(); }
  catch{ toast('Error de conexión',true); return null; }
}

// ── CONEXIÓN ──────────────────────────────────────────────────
function conectar(){
  const url=document.getElementById('script-url').value.trim();
  if(!url.includes('script.google.com')){ setStatus('❌ URL inválida','err'); return; }
  SCRIPT_URL=url; localStorage.setItem('prode_url',url);
  setStatus('<span class="spin"></span> Conectando...','');
  fetch(SCRIPT_URL+'?accion=ranking').then(r=>r.json()).then(d=>{
    if(d.ok!==false){
      setStatus('✅ Conectado','ok');
      setTimeout(()=>document.getElementById('config-banner').style.display='none',1000);
      cargarRanking(); cargarFixture();
      toast('¡Conectado a Google Sheets! ⚡');
    } else setStatus('❌ Error en el script','err');
  }).catch(()=>setStatus('❌ No se pudo conectar. Verificá que esté publicado como app web.','err'));
}
function setStatus(msg,type){
  const el=document.getElementById('config-status');
  el.innerHTML=msg;
  el.style.color=type==='err'?'var(--red)':type==='ok'?'var(--green)':'var(--muted)';
}

// ── RANKING ───────────────────────────────────────────────────
// ── PERFIL PÚBLICO ───────────────────────────────────────────
async function verPerfil(nombre) {
  // Abrir modal con loading
  abrirModal('perfil');
  document.getElementById('perfil-modal-nombre').textContent = nombre;
  document.getElementById('perfil-historial').innerHTML = '<div class="empty" style="padding:20px"><span class="empty-icon">⏳</span>Cargando...</div>';

  // Foto desde caché
  const cached = localStorage.getItem('prode_foto_' + nombre);
  const img = document.getElementById('perfil-foto-img');
  const ph  = document.getElementById('perfil-foto-ph');
  if (cached) { img.src=cached; img.style.display='block'; ph.style.display='none'; }
  else { img.style.display='none'; ph.style.display='block'; }

  // Cargar datos
  const data = await apiGet('getPerfilPublico', '&nombre=' + encodeURIComponent(nombre));
  if (!(data && data.ok)) { document.getElementById('perfil-historial').innerHTML = '<div class="empty">Error al cargar perfil</div>'; return; }

  // Foto real
  if (data.fotoUrl) {
    img.src = data.fotoUrl; img.style.display='block'; ph.style.display='none';
    localStorage.setItem('prode_foto_' + nombre, data.fotoUrl);
  }

  // Datos básicos
  document.getElementById('perfil-modal-pos').textContent = data.posicion !== '—' ? '#' + data.posicion : '—';
  document.getElementById('perfil-modal-pts').textContent = (data.puntos||0) + ' pts';
  const fechaRegFmt = data.fechaReg ? formatFecha(data.fechaReg) : '';
  document.getElementById('perfil-modal-desde').textContent = fechaRegFmt ? 'Desde ' + fechaRegFmt : '';

  // Movimiento
  const mov = data.movimiento || '=';
  const movEl = document.getElementById('perfil-modal-mov');
  if (mov.startsWith('↑'))      { movEl.textContent=mov; movEl.style.color='var(--green)'; }
  else if (mov.startsWith('↓')) { movEl.textContent=mov; movEl.style.color='var(--red)'; }
  else                          { movEl.textContent='='; movEl.style.color='var(--muted)'; }

  // Stats
  document.getElementById('p-exactos').textContent   = data.exactos   || 0;
  document.getElementById('p-aciertos').textContent  = data.aciertos  || 0;
  document.getElementById('p-errores').textContent   = data.errores   || 0;
  document.getElementById('p-pendientes').textContent= data.pendientes|| 0;

  // Barra rendimiento
  const total = (data.exactos||0) + (data.aciertos||0) + (data.errores||0);
  const pct   = total > 0 ? Math.round(((data.exactos||0) + (data.aciertos||0)) / total * 100) : 0;
  document.getElementById('p-pct').textContent = pct + '%';
  document.getElementById('p-barra').style.width = pct + '%';

  // Botón editar si es el propio perfil
  document.getElementById('perfil-edit-btn').style.display =
    currentUser && currentUser.toLowerCase() === nombre.toLowerCase() ? 'block' : 'none';

  // Historial
  const h = data.historial || [];
  if (!h.length) {
    document.getElementById('perfil-historial').innerHTML = '<div class="empty" style="padding:16px"><span class="empty-icon">⏳</span>Sin partidos jugados aún</div>';
    return;
  }

  document.getElementById('perfil-historial').innerHTML = h.map(p => {
    const fl = flag(p.local, 14), fv = flag(p.visitante, 14);
    const color = p.resultado==='exacto' ? 'var(--green)' : p.resultado==='1x2' ? 'var(--gold)' : 'var(--red)';
    const icon  = p.resultado==='exacto' ? '✅' : p.resultado==='1x2' ? '🟡' : '❌';
    const pts   = p.resultado==='exacto' ? '+3' : p.resultado==='1x2' ? '+1' : '0';
    return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:12px;">
      <div>
        <div style="font-weight:500;margin-bottom:2px">${fl} ${p.local} vs ${p.visitante} ${fv}</div>
        <div style="color:var(--muted)">Tu pronóstico: ${p.pred_l}-${p.pred_v} · Real: ${p.real_l}-${p.real_v}</div>
      </div>
      <div style="text-align:center;font-size:16px">${icon}</div>
      <div style="font-family:var(--font-d);font-size:18px;color:${color};min-width:32px;text-align:right">${pts}</div>
    </div>`;
  }).join('');
}

function formatPesos(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function renderPozo(participantes) {
  const INSCRIPCION = 30000;
  const pozo = participantes * INSCRIPCION;
  document.getElementById('pozo-total').textContent = formatPesos(pozo);
  document.getElementById('premio-1').textContent   = formatPesos(pozo * 0.70);
  document.getElementById('premio-2').textContent   = formatPesos(pozo * 0.20);
  document.getElementById('premio-3').textContent   = formatPesos(pozo * 0.10);
}

function renderPodio(ranking) {
  const wrap = document.getElementById('podio-wrap');
  const conPuntos = ranking.filter(r => (r.puntos||0) > 0);
  if (conPuntos.length < 3) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const podioData = [
    { el: 'podio-1', p: conPuntos[0], medal: '🥇', color: '#FFD060', altura: '100px', prize: '70%' },
    { el: 'podio-2', p: conPuntos[1], medal: '🥈', color: '#C0C0C0', altura: '80px',  prize: '20%' },
    { el: 'podio-3', p: conPuntos[2], medal: '🥉', color: '#CD7F32', altura: '60px',  prize: '10%' },
  ];

  podioData.forEach(({ el, p, medal, color, altura, prize }) => {
    const foto  = p.foto_url || localStorage.getItem('prode_foto_' + p.nombre) || '';
    const ini   = p.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    const av    = AVATARS[podioData.indexOf(podioData.find(x=>x.el===el)) % AVATARS.length];
    const avatar = foto
      ? `<img src="${foto}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${color};margin:0 auto 6px;display:block;"/>`
      : `<div style="width:52px;height:52px;border-radius:50%;background:${av.bg};color:${av.fg};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid ${color};margin:0 auto 6px;">${ini}</div>`;
    document.getElementById(el).innerHTML = `
      <div style="margin-bottom:6px">${avatar}</div>
      <div style="font-size:12px;font-weight:600;color:var(--white);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre}</div>
      <div style="font-family:var(--font-d);font-size:16px;color:${color};margin-bottom:4px">${p.puntos} pts</div>
      <div style="background:${color};border-radius:0 0 8px 8px;height:${altura};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
        <div style="font-size:22px">${medal}</div>
        <div style="font-size:10px;font-weight:600;color:#0A0B0D">${prize}</div>
      </div>`;
  });
}

function renderRankingData(data) {
  const r = data.ranking || [];
  document.getElementById('s-part').textContent = r.length;
  renderPozo(r.length);
  renderPodio(r);
  if (!r.length) {
    document.getElementById('ranking-list').innerHTML='<div class="empty"><span class="empty-icon">👥</span>Aún no hay participantes</div>';
    renderStats([]); return;
  }
  document.getElementById('ranking-list').innerHTML = r.map((p,i) => {
    const av = AVATARS[i % AVATARS.length];
    const ini = p.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    const cls = i===0?'p1':i===1?'p2':i===2?'p3':'';
    const fotoUrl = p.foto_url || '';
    const avatarHtml = fotoUrl
      ? `<div class="avatar" style="padding:0;overflow:hidden"><img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>`
      : `<div class="avatar" style="background:${av.bg};color:${av.fg}">${ini}</div>`;
    const esNuevo = (p.puntos||0) === 0 && (p.pendientes||0) === 104;
    const mov = p.movimiento || '=';
    let movHtml = '';
    if (mov.startsWith('↑'))      movHtml = `<span style="font-size:11px;color:var(--green);font-weight:600;margin-left:4px">${mov}</span>`;
    else if (mov.startsWith('↓')) movHtml = `<span style="font-size:11px;color:var(--red);font-weight:600;margin-left:4px">${mov}</span>`;
    else if (!esNuevo)            movHtml = `<span style="font-size:11px;color:var(--muted);margin-left:4px">=</span>`;
    return `<div class="rank-row anim-item ${cls}" style="animation-delay:${i*35}ms;cursor:pointer;" onclick="verPerfil('${p.nombre.replace(/'/g,"\'")}')">
      <div class="pos">${medal||(i+1)}</div>
      ${avatarHtml}
      <div class="player-name">${p.nombre}${movHtml}${esNuevo?' <span class="badge b-green" style="font-size:9px;vertical-align:middle">NUEVO</span>':''}</div>
      <div class="cell"><span class="badge b-green">${p.exactos||0}</span></div>
      <div class="cell"><span class="badge b-gold">${p.aciertos_1x2||0}</span></div>
      <div class="cell"><div style="text-align:center"><span class="badge b-red">${p.errores||0}</span></div></div>
      <div class="pts">${esNuevo?'<span style="color:var(--muted);font-size:14px">—</span>':(p.puntos||0)}</div>
    </div>`;
  }).join('');
  renderStats(r);
}

function renderEstadisticasData(data) {
  const jornadas = data.mejorPorJornada || [];
  if (!jornadas.length) {
    document.getElementById('mejor-jornada-list').innerHTML='<div class="empty"><span class="empty-icon">🏅</span>Los datos aparecerán cuando comiencen los partidos</div>';
  } else {
    document.getElementById('mejor-jornada-list').innerHTML = jornadas.map(j => {
      const ganadores = j.ganadores.join(', ');
      return `<div style="display:flex;align-items:center;gap:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:12px 16px;margin-bottom:8px;">
        <div style="background:rgba(184,247,60,0.1);border:1px solid rgba(184,247,60,0.2);border-radius:8px;padding:8px 12px;text-align:center;min-width:56px;flex-shrink:0;">
          <div style="font-size:9px;color:var(--green);text-transform:uppercase;letter-spacing:.07em">Jornada</div>
          <div style="font-family:var(--font-d);font-size:22px;color:var(--green)">${j.jornada}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🏅 ${ganadores}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${j.puntos} punto${j.puntos!==1?'s':''} en la jornada</div>
        </div>
        <div style="font-family:var(--font-d);font-size:28px;color:var(--green);flex-shrink:0">${j.puntos}</div>
      </div>`;
    }).join('');
  }
}

// ── ELIMINATORIAS ────────────────────────────────────────────
const RONDAS_ELIM = {
  'OCTAVOS': { label:'⚡ Octavos de Final',    color:'rgba(184,247,60,0.15)',  border:'rgba(184,247,60,0.3)'  },
  'CUARTOS': { label:'🔥 Cuartos de Final',    color:'rgba(255,160,50,0.1)',   border:'rgba(255,160,50,0.3)'  },
  'SEMIS':   { label:'💥 Semifinales',         color:'rgba(255,85,85,0.1)',    border:'rgba(255,85,85,0.3)'   },
  'TERCER':  { label:'🥉 Tercer Puesto',       color:'rgba(205,127,50,0.1)',   border:'rgba(205,127,50,0.3)'  },
  'FINAL':   { label:'🏆 Gran Final',          color:'rgba(255,208,96,0.12)',  border:'rgba(255,208,96,0.4)'  },
};

let elimData = [];

async function cargarEliminatorias() {
  // Usar datos del fixture ya cargados si existen
  if (fixtureData.length) {
    elimData = fixtureData.filter(p => RONDAS_ELIM[p.grupo]);
    renderEliminatorias(elimData);
    return;
  }
  // Si no hay fixture, cargar
  const data = await apiGet('fixture');
  if (!(data && data.ok)) return;
  fixtureData = data.partidos || [];
  elimData = fixtureData.filter(p => RONDAS_ELIM[p.grupo]);
  renderEliminatorias(elimData);
}

function filtrarElim(ronda, btn) {
  document.querySelectorAll('#view-eliminatorias .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const lista = ronda ? elimData.filter(p => p.grupo === ronda) : elimData;
  renderEliminatorias(lista);
}

function renderEliminatorias(partidos) {
  if (!(partidos && partidos.length)) {
    document.getElementById('eliminatorias-list').innerHTML = '<div class="empty"><span class="empty-icon">⚡</span>No hay partidos para mostrar</div>';
    return;
  }

  let html = '', rondaAct = '';
  partidos.forEach(m => {
    if (m.grupo !== rondaAct) {
      rondaAct = m.grupo;
      const ronda = RONDAS_ELIM[rondaAct] || { label: rondaAct, color:'transparent', border:'var(--border)' };
      html += `<div style="font-family:var(--font-d);font-size:16px;letter-spacing:.5px;padding:16px 0 8px;color:var(--white)">${ronda.label}</div>`;
    }

    const jugado = estaJugado(m);
    const live   = m.estado==='1H'||m.estado==='2H'||m.estado==='HT';
    const ronda  = RONDAS_ELIM[m.grupo] || { color:'transparent', border:'var(--border)' };
    const fl     = flag(m.local, 22), fv = flag(m.visitante, 22);

    html += `<div style="background:${ronda.color};border:1px solid ${ronda.border};border-radius:var(--r);padding:0;margin-bottom:8px;overflow:hidden;">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
          <div style="font-size:14px;font-weight:600;text-align:right">${m.local}</div>
          <div style="flex-shrink:0">${fl}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:90px;">
          ${jugado||live
            ? `<div style="display:flex;align-items:center;gap:6px;">
                <div style="width:32px;height:32px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:18px">${m.gol_l != null ? m.gol_l : '—'}</div>
                <span style="color:var(--muted);font-size:13px">:</span>
                <div style="width:32px;height:32px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:18px">${m.gol_v != null ? m.gol_v : '—'}</div>
               </div>
               ${live?'<span class="badge b-live" style="font-size:9px">EN VIVO</span>':'<span class="badge b-gray" style="font-size:9px">Final</span>'}`
            : `<div style="font-size:12px;font-weight:500;color:var(--white)">${formatFecha(m.fecha)}</div>
               <div style="font-size:11px;color:var(--muted)">${formatHora(m.hora)} hs</div>`}
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;">
          <div style="flex-shrink:0">${fv}</div>
          <div style="font-size:14px;font-weight:600;text-align:left">${m.visitante}</div>
        </div>
      </div>
    </div>`;
  });

  document.getElementById('eliminatorias-list').innerHTML = html;
}

async function cargarEstadisticas(){
  const data = await apiGet('estadisticas');
  if (!(data && data.ok)) return;
  renderEstadisticasData(data);
}

async function cargarEnVivoTab(){
  const el = document.getElementById('envivo-tab-content');
  if (!el) return;
  el.innerHTML = `<div class="empty"><span class="empty-icon" style="display:inline-block;animation:pulse 1s infinite">📡</span>Cargando...</div>`;
  const data = await apiGet('pronosticosEnJuego');
  actualizarIndicadorEnVivo(data && data.ok && data.partidos.length > 0);
  if (!(data && data.ok) || !data.partidos.length) {
    el.innerHTML = `<div class="empty"><span class="empty-icon">📡</span>Sin partidos en vivo ahora</div>`;
    return;
  }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
      <span style="width:12px;height:12px;background:#e74c3c;border-radius:50%;animation:pulse 1s infinite;flex-shrink:0;display:inline-block;"></span>
      <span style="font-size:20px;font-weight:900;letter-spacing:.12em;color:var(--accent)">EN VIVO</span>
      <span style="font-size:11px;color:var(--muted);margin-left:auto;background:rgba(255,255,255,.06);padding:3px 8px;border-radius:20px;">↻ 30s</span>
    </div>
    ${data.partidos.map(p => renderPartidoEnVivoTab(p)).join('')}
  `;
}

function renderPartidoEnVivoTab(p){
  const prons = p.pronosticos;
  const glActual = Number(p.gol_l), gvActual = Number(p.gol_v);
  const filas = prons.map(pr => {
    const gl = Number(pr.gol_l), gv = Number(pr.gol_v);
    const exacto   = gl === glActual && gv === gvActual;
    const signo    = gl > gv ? 'L' : gv > gl ? 'V' : 'E';
    const signoAct = glActual > gvActual ? 'L' : gvActual > glActual ? 'V' : 'E';
    const acierto  = signo === signoAct;
    const badge = exacto
      ? `<span style="background:#27ae60;color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">✓ Exacto</span>`
      : acierto
      ? `<span style="background:#f39c12;color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">~ 1X2</span>`
      : `<span style="background:rgba(255,255,255,.07);color:var(--muted);border-radius:4px;padding:2px 7px;font-size:11px;">—</span>`;
    return `<tr>
      <td style="padding:7px 10px;font-size:13px;font-weight:500;">${pr.nombre}</td>
      <td style="padding:7px 10px;text-align:center;font-weight:800;font-size:15px;color:var(--text);">${gl}–${gv}</td>
      <td style="padding:7px 10px;text-align:right;">${badge}</td>
    </tr>`;
  }).join('');
  return `
    <div style="background:var(--card);border-radius:14px;padding:16px;margin-bottom:14px;border:1px solid rgba(231,76,60,.25);box-shadow:0 0 18px rgba(231,76,60,.08);">
      <div style="text-align:center;margin-bottom:14px;">
        <div style="font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">${p.jornada||''}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;">
          <span style="font-size:14px;font-weight:700;flex:1;text-align:right;">${p.local}</span>
          <span style="font-size:28px;font-weight:900;color:var(--accent);background:rgba(184,247,60,.08);border-radius:10px;padding:4px 14px;min-width:72px;text-align:center;">${glActual}–${gvActual}</span>
          <span style="font-size:14px;font-weight:700;flex:1;text-align:left;">${p.visitante}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(255,255,255,.07);">
        <thead>
          <tr style="color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;">
            <th style="padding:5px 10px;text-align:left;font-weight:600;">Jugador</th>
            <th style="padding:5px 10px;text-align:center;font-weight:600;">Pronóstico</th>
            <th style="padding:5px 10px;"></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function actualizarIndicadorEnVivo(hayVivo){
  const btn = document.querySelector('.nav-tab[data-tab="envivo"]');
  if (!btn) return;
  btn.classList.toggle('has-live', hayVivo);
}

async function cargarEnVivo(){
  const el = document.getElementById('en-vivo-area');
  if (!el) return;
  const data = await apiGet('pronosticosEnJuego');
  if (!(data && data.ok) || !data.partidos.length) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <span style="display:inline-block;width:10px;height:10px;background:#e74c3c;border-radius:50%;animation:pulse 1s infinite;"></span>
      <span style="font-weight:700;font-size:13px;letter-spacing:.08em;color:var(--accent)">EN VIVO</span>
    </div>
    ${data.partidos.map(p => renderPartidoEnVivo(p)).join('')}
  `;
}

function renderPartidoEnVivo(p){
  const prons = p.pronosticos;
  if (!prons.length) return '';

  // Determinar quién va ganando con su pronóstico actualmente
  const glActual = Number(p.gol_l), gvActual = Number(p.gol_v);

  const filas = prons.map(pr => {
    const gl = Number(pr.gol_l), gv = Number(pr.gol_v);
    // ¿coincide el marcador parcial o sería exacto?
    const exacto  = gl === glActual && gv === gvActual;
    const signo = gl > gv ? 'L' : gv > gl ? 'V' : 'E';
    const signoActual = glActual > gvActual ? 'L' : gvActual > glActual ? 'V' : 'E';
    const acierto1x2 = signo === signoActual;
    const badge = exacto
      ? `<span style="background:#27ae60;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;">✓ Exacto</span>`
      : acierto1x2
      ? `<span style="background:#f39c12;color:#fff;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;">~ 1X2</span>`
      : '';
    return `<tr>
      <td style="padding:6px 8px;font-size:13px;">${pr.nombre}</td>
      <td style="padding:6px 8px;text-align:center;font-weight:700;font-size:14px;">${gl}-${gv}</td>
      <td style="padding:6px 8px;text-align:right;">${badge}</td>
    </tr>`;
  }).join('');

  return `
    <div style="background:var(--card);border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid rgba(255,255,255,.08);">
      <div style="text-align:center;margin-bottom:10px;">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">${p.jornada || ''}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <span style="font-size:13px;font-weight:600;">${p.local}</span>
          <span style="font-size:22px;font-weight:800;color:var(--accent);min-width:54px;text-align:center;">${glActual}-${gvActual}</span>
          <span style="font-size:13px;font-weight:600;">${p.visitante}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(255,255,255,.07);">
        <thead>
          <tr style="color:var(--muted);font-size:11px;text-transform:uppercase;">
            <th style="padding:5px 8px;text-align:left;font-weight:600;">Jugador</th>
            <th style="padding:5px 8px;text-align:center;font-weight:600;">Pronóstico</th>
            <th style="padding:5px 8px;"></th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  `;
}

async function cargarRanking(){
  const data = await apiGet('ranking');
  if (!(data && data.ok)) return;
  cacheSet('ranking', data);
  renderRankingData(data);
}

// Polling inteligente: 30 seg si hay EN JUEGO, 5 min si no
let _pollTimer = null;
function agendarProximoPoll() {
  if (_pollTimer) clearTimeout(_pollTimer);
  const hayEnJuego = fixtureData.some(m => m.estado === 'EN JUEGO');
  const delay = hayEnJuego ? 30 * 1000 : 5 * 60 * 1000;
  _pollTimer = setTimeout(async () => {
    if (!SCRIPT_URL || document.visibilityState === 'hidden') {
      agendarProximoPoll();
      return;
    }
    await Promise.all([cargarRanking(), cargarFixture()]);
    // Si el tab EN VIVO está activo, refrescarlo también
    if (localStorage.getItem('prode_tab') === 'envivo') cargarEnVivoTab();
    agendarProximoPoll();
  }, delay);
}

// ── FIXTURE ───────────────────────────────────────────────────
async function cargarFixture(){
  const data = await apiGet('fixture');
  if (!(data && data.ok)) return;
  fixtureData = data.partidos || [];
  cacheSet('fixture', fixtureData);
  renderFixtureConModo(fixtureData);
  if (currentUser) renderPron();
}

let modoFixture = 'jornada';

function renderFixtureConModo(partidos) {
  // Contadores siempre con el fixture completo
  const todos = fixtureData.length ? fixtureData : partidos;
  const jugados = todos.filter(m => m.estado === 'FT').length;
  const elJugados = document.getElementById('s-jugados');
  const elRestantes = document.getElementById('s-restantes');
  if (elJugados) elJugados.textContent = jugados;
  if (elRestantes) elRestantes.textContent = Math.max(0, todos.length - jugados);
  actualizarIndicadorEnVivo(todos.some(m => m.estado === 'EN JUEGO'));

  if (modoFixture === 'jornada') renderFixtureJornada(partidos);
  else if (modoFixture === 'grupo') renderFixture(partidos);
  // 'elim' se maneja aparte con cargarEliminatorias()
}

function setModoFixture(modo, btn) {
  modoFixture = modo;
  document.getElementById('filtros-grupo').style.display   = modo === 'grupo'   ? 'flex' : 'none';
  document.getElementById('filtros-jornada').style.display = modo === 'jornada' ? 'flex' : 'none';
  document.getElementById('fixture-list').style.display    = modo === 'elim'    ? 'none' : '';
  document.getElementById('fixture-elim').style.display    = modo === 'elim'    ? 'block' : 'none';
  document.getElementById('modo-grupo-btn').classList.toggle('active',   modo === 'grupo');
  document.getElementById('modo-jornada-btn').classList.toggle('active', modo === 'jornada');
  document.getElementById('modo-elim-btn').classList.toggle('active',    modo === 'elim');
  if (modo === 'grupo') {
    document.querySelectorAll('#filtros-grupo .filter-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('#filtros-grupo .filter-btn').classList.add('active');
    renderFixture(fixtureData);
  } else if (modo === 'jornada') {
    document.querySelectorAll('#filtros-jornada .filter-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('#filtros-jornada .filter-btn').classList.add('active');
    renderFixtureJornada(fixtureData);
  } else if (modo === 'elim') {
    cargarEliminatorias();
  }
}

function filtrar(grupo,btn){
  document.querySelectorAll('#filtros-grupo .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  let lista;
  if (!grupo) {
    lista = fixtureData;
  } else if (grupo === 'ELIM') {
    lista = fixtureData.filter(p => ['OCTAVOS','CUARTOS','SEMIS','TERCER','FINAL'].includes(p.grupo));
  } else {
    lista = fixtureData.filter(p => p.grupo === grupo);
  }
  renderFixture(lista);
}

function filtrarJornada(jornada, btn) {
  document.querySelectorAll('#filtros-jornada .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const lista = jornada === 0 ? fixtureData : fixtureData.filter(p => p.jornada == jornada);
  renderFixtureJornada(lista);
}

function renderFixtureJornada(partidos) {
  if(!(partidos && partidos.length)){
    document.getElementById('fixture-list').innerHTML='<div class="empty"><span class="empty-icon">📅</span>No hay partidos para mostrar</div>'; return;
  }

  // Agrupar por fecha
  const porFecha = {};
  partidos.forEach(m => {
    const fecha = formatFecha(m.fecha);
    if (!porFecha[fecha]) porFecha[fecha] = [];
    porFecha[fecha].push(m);
  });

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let diaActualKey = null;

  let html = '';
  let cardIdx = 0;
  const fechasOrdenadas = Object.keys(porFecha).sort((a,b) => {
    // Ordenar por fecha dd/MM/yyyy
    const [da,ma,ya] = a.split('/'); const [db,mb,yb] = b.split('/');
    return new Date(ya,ma-1,da) - new Date(yb,mb-1,db);
  });

  fechasOrdenadas.forEach((fecha, idx) => {
    const ms = porFecha[fecha];
    const [d,mo,y] = fecha.split('/');
    const fechaDate = new Date(y,mo-1,d);
    const esPasado  = fechaDate < hoy;
    const esHoy     = fechaDate.getTime() === hoy.getTime();
    if (esHoy && diaActualKey === null) diaActualKey = 'jdia-' + idx;
    if (diaActualKey === null && fechaDate > hoy) diaActualKey = 'jdia-' + idx; // primer día futuro si no hay "hoy"

    html += `<div class="group-hdr" id="jdia-${idx}" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between" onclick="toggleDiaJornada(${idx})">
      <span>${fecha}${esHoy?' <span class="badge b-green" style="font-size:9px;vertical-align:middle">HOY</span>':''}</span>
      <span id="jdia-arrow-${idx}" style="font-size:11px;color:var(--muted);transition:transform .2s">${esPasado?'▸':'▾'}</span>
    </div>
    <div id="jdia-body-${idx}" style="${esPasado?'display:none':''}">`;
    ms.forEach(m => {
      const jugado = estaJugado(m);
      const live   = m.estado==='1H'||m.estado==='2H'||m.estado==='HT';
      const fl=flag(m.local,22), fv=flag(m.visitante,22);
      const delay = Math.min(cardIdx * 30, 400);
      cardIdx++;
      html += `<div class="match-card anim-item" style="animation-delay:${delay}ms">
        <div class="match-inner">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:1">
            <div style="font-size:14px;font-weight:600;text-align:right">${m.local}</div>
            <div style="font-size:22px;flex-shrink:0">${fl}</div>
          </div>
          <div class="match-center">
            ${jugado||live
              ? `<div class="score-row">
                  <div class="score-pill">${m.gol_l != null ? m.gol_l : '—'}</div>
                  <span class="score-sep">:</span>
                  <div class="score-pill">${m.gol_v != null ? m.gol_v : '—'}</div>
                 </div>
                 ${live?'<span class="badge b-live" style="font-size:9px;margin-top:2px">EN VIVO</span>':'<span class="badge b-gray" style="font-size:9px;margin-top:2px">Final</span>'}`
              : `<div class="match-date">${formatHora(m.hora)} hs</div>
                 <div style="font-size:10px;color:var(--muted)">Grupo ${m.grupo}</div>`}
          </div>
          <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;flex:1">
            <div style="font-size:22px;flex-shrink:0">${fv}</div>
            <div style="font-size:14px;font-weight:600;text-align:left">${m.visitante}</div>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  document.getElementById('fixture-list').innerHTML = html;

  if (diaActualKey) {
    const el = document.getElementById(diaActualKey);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

function toggleDiaJornada(idx) {
  const body  = document.getElementById('jdia-body-' + idx);
  const arrow = document.getElementById('jdia-arrow-' + idx);
  if (!body) return;
  const oculto = body.style.display === 'none';
  body.style.display = oculto ? '' : 'none';
  if (arrow) arrow.textContent = oculto ? '▾' : '▸';
}

function calcularTablaGrupo(partidosGrupo) {
  const stats = {};
  function ensure(team) {
    if (!stats[team]) stats[team] = { equipo: team, pts: 0, j: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0 };
    return stats[team];
  }
  partidosGrupo.forEach(m => {
    ensure(m.local); ensure(m.visitante);
    if (!estaJugado(m) || m.gol_l == null || m.gol_v == null) return;
    const L = stats[m.local], V = stats[m.visitante];
    const gl = m.gol_l, gv = m.gol_v;
    L.j++; V.j++; L.gf += gl; L.gc += gv; V.gf += gv; V.gc += gl;
    if (gl > gv)      { L.g++; L.pts += 3; V.p++; }
    else if (gl < gv) { V.g++; V.pts += 3; L.p++; }
    else              { L.e++; V.e++; L.pts++; V.pts++; }
  });
  return Object.values(stats).sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const dgA = a.gf - a.gc, dgB = b.gf - b.gc;
    if (dgB !== dgA) return dgB - dgA;
    return b.gf - a.gf;
  });
}

function renderTablaGrupo(grupo, partidosGrupo) {
  const tabla  = calcularTablaGrupo(partidosGrupo);
  const enVivo = partidosGrupo.some(m => ['1H','2H','HT','EN JUEGO'].includes(m.estado));
  let html = `<div class="grupo-tabla-wrap">
    <div class="grupo-tabla-titlebar">
      <span>GRUPO ${grupo}</span>
      ${enVivo ? '<span class="badge b-live" style="font-size:9px">🔴 VIVO</span>' : ''}
    </div>
    <div class="grupo-tabla-head">
      <div>#</div><div>Equipos</div><div>PTS</div><div>J</div><div>Gol</div><div>+/-</div><div>G</div><div>E</div><div>P</div>
    </div>`;
  tabla.forEach((t, i) => {
    const pos = i + 1;
    const dot = pos <= 2 ? '<span class="dot dot-green"></span>' : pos === 3 ? '<span class="dot dot-blue"></span>' : '';
    const dif = t.gf - t.gc;
    html += `<div class="grupo-tabla-row${pos===1?' p1':''}">
      <div class="gt-pos">${pos}</div>
      <div class="gt-equipo">${dot}${flag(t.equipo,18)}<span>${t.equipo}</span></div>
      <div class="gt-pts">${t.pts}</div>
      <div>${t.j}</div>
      <div>${t.gf}:${t.gc}</div>
      <div>${dif>0?'+':''}${dif}</div>
      <div>${t.g}</div>
      <div>${t.e}</div>
      <div>${t.p}</div>
    </div>`;
  });
  html += `</div>
    <div class="grupo-tabla-legend">
      <span><span class="dot dot-green"></span> 16avos de final</span>
      <span><span class="dot dot-blue"></span> Posible clasificación</span>
    </div>`;
  return html;
}

function renderFixture(partidos){
  if(!(partidos && partidos.length)){
    document.getElementById('fixture-list').innerHTML='<div class="empty"><span class="empty-icon">📅</span>No hay partidos para mostrar</div>'; return;
  }
  const RONDAS_LABELS_FIXTURE = {
    'OCTAVOS':'⚡ OCTAVOS DE FINAL',
    'CUARTOS':'🔥 CUARTOS DE FINAL',
    'SEMIS':'💥 SEMIFINALES',
    'TERCER':'🥉 TERCER PUESTO',
    'FINAL':'🏆 GRAN FINAL'
  };
  let html='', grupoAct='';
  partidos.forEach(m=>{
    if(m.grupo!==grupoAct){
      grupoAct=m.grupo;
      const esElim=RONDAS_LABELS_FIXTURE[grupoAct];
      if(esElim){
        html+=`<div class="group-hdr" style="color:var(--green);font-size:14px">${esElim}</div>`;
      } else {
        html+=renderTablaGrupo(grupoAct, partidos.filter(p=>p.grupo===grupoAct));
        html+=`<div class="group-hdr">GRUPO ${grupoAct} — PARTIDOS</div>`;
      }
    }
    const jugado = estaJugado(m);
    const live=m.estado==='1H'||m.estado==='2H'||m.estado==='HT';
    const fl=flag(m.local,22), fv=flag(m.visitante,22);
    html+=`<div class="match-card">
      <div class="match-inner">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;flex:1">
          <div style="font-size:14px;font-weight:600;text-align:right">${m.local}</div>
          <div style="font-size:22px;flex-shrink:0">${fl}</div>
        </div>
        <div class="match-center">
          ${jugado||live
            ? `<div class="score-row">
                <div class="score-pill">${m.gol_l != null ? m.gol_l : '—'}</div>
                <span class="score-sep">:</span>
                <div class="score-pill">${m.gol_v != null ? m.gol_v : '—'}</div>
               </div>
               ${live?'<span class="badge b-live" style="font-size:9px;margin-top:2px">EN VIVO</span>':'<span class="badge b-gray" style="font-size:9px;margin-top:2px">Final</span>'}`
            : `<div class="match-date">${formatFecha(m.fecha)}</div>
               <div class="match-time">${formatHora(m.hora)} hs</div>`}
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-start;gap:6px;flex:1">
          <div style="font-size:22px;flex-shrink:0">${fv}</div>
          <div style="font-size:14px;font-weight:600;text-align:left">${m.visitante}</div>
        </div>
      </div>
    </div>`;
  });
  document.getElementById('fixture-list').innerHTML=html;
}

// ── PRONÓSTICOS ───────────────────────────────────────────────
async function loginUser(){
  const n=document.getElementById('login-nombre').value.trim();
  const pin=document.getElementById('login-pin').value.trim();
  if(!n){ document.getElementById('login-nombre').focus(); return; }
  if(!pin){ toast('Ingresá tu PIN',true); document.getElementById('login-pin').focus(); return; }
  const v=await apiGet('verificarPin','&nombre='+encodeURIComponent(n)+'&pin='+encodeURIComponent(pin));
  if(!(v && v.ok)){ toast((v && v.mensaje)||'Nombre o PIN incorrecto ❌',true); return; }
  currentUser=n;
  // Guardar sesión en localStorage
  localStorage.setItem('prode_user', n);
  localStorage.setItem('prode_pin',  pin);
  document.getElementById('login-area').style.display='none';
  document.getElementById('pron-area').style.display='block';
  document.getElementById('pron-title').textContent=n.toUpperCase();
  document.getElementById('perfil-nombre').textContent=n;
  cargarFotoPerfil(n);
  actualizarHeroBtns();

  // Verificar si está primero en el ranking — festejo
  const rankData = await apiGet('ranking');
  if ((rankData && rankData.ok) && rankData.ranking && rankData.ranking.length > 0) {
    const primero = rankData.ranking[0];
    if (primero.nombre.toLowerCase() === n.toLowerCase() && (primero.puntos||0) > 0) {
      setTimeout(() => { lanzarConfetti(5000); mostrarFestejo(n); }, 600);
    }
  }

  const data=await apiGet('pronosticos','&nombre='+encodeURIComponent(n));
  pronGuardados={};
  if((data && data.ok))(data.pronosticos||[]).forEach(p=>{
    pronGuardados[p.partido_id]={gl:p.gol_l,gv:p.gol_v};
    pronLocales[p.partido_id]={gl:p.gol_l,gv:p.gol_v};
  });
  if(!fixtureData.length) await cargarFixture(); else renderPron();
}

function abrirLoginRapido(){
  abrirModal('login');
}

async function loginRapido(){
  const n   = document.getElementById('quick-nombre').value.trim();
  const pin = document.getElementById('quick-pin').value.trim();
  if(!n){ document.getElementById('quick-nombre').focus(); return; }
  if(!pin){ toast('Ingresá tu PIN',true); document.getElementById('quick-pin').focus(); return; }
  const btn = document.getElementById('btn-login-rapido');
  if(btn){ btn.innerHTML='<span class="spin"></span> Entrando...'; btn.disabled=true; }
  const v = await apiGet('verificarPin','&nombre='+encodeURIComponent(n)+'&pin='+encodeURIComponent(pin));
  if(btn){ btn.innerHTML='Entrar →'; btn.disabled=false; }
  if(!(v && v.ok)){ toast((v && v.mensaje)||'Nombre o PIN incorrecto ❌',true); return; }
  cerrarModal('login');
  currentUser=n;
  localStorage.setItem('prode_user',n);
  localStorage.setItem('prode_pin',pin);
  document.getElementById('login-area').style.display='none';
  document.getElementById('pron-area').style.display='block';
  document.getElementById('pron-title').textContent=n.toUpperCase();
  document.getElementById('perfil-nombre').textContent=n;
  cargarFotoPerfil(n);
  actualizarHeroBtns();
  const rankData = await apiGet('ranking');
  if((rankData && rankData.ok) && rankData.ranking && rankData.ranking.length>0){
    const primero=rankData.ranking[0];
    if(primero.nombre.toLowerCase()===n.toLowerCase()&&(primero.puntos||0)>0){
      setTimeout(()=>{ lanzarConfetti(5000); mostrarFestejo(n); },600);
    }
  }
  const data=await apiGet('pronosticos','&nombre='+encodeURIComponent(n));
  pronGuardados={};
  if((data && data.ok))(data.pronosticos||[]).forEach(p=>{
    pronGuardados[p.partido_id]={gl:p.gol_l,gv:p.gol_v};
    pronLocales[p.partido_id]={gl:p.gol_l,gv:p.gol_v};
  });
  if(!fixtureData.length) await cargarFixture(); else renderPron();
}

function logoutUser(){
  currentUser=null; pronLocales={}; pronGuardados={};
  document.getElementById('login-area').style.display='block';
  document.getElementById('pron-area').style.display='none';
  document.getElementById('login-nombre').value='';
  document.getElementById('login-pin').value='';
  document.getElementById('save-bar').classList.remove('on');
  limpiarFoto();
  actualizarHeroBtns();
  // Limpiar sesión guardada
  localStorage.removeItem('prode_user');
  localStorage.removeItem('prode_pin');
}

function renderPron(){
  if(!fixtureData.length) return;

  // Agrupar por DÍA (como el fixture por jornada)
  const grupos = {};
  const RONDAS_NOMBRES = {
    'OCTAVOS':'⚡ Octavos de Final',
    'CUARTOS':'🔥 Cuartos de Final',
    'SEMIS':'💥 Semifinales',
    'TERCER':'🥉 Tercer Puesto',
    'FINAL':'🏆 Gran Final'
  };

  fixtureData.forEach(m => {
    let key, titulo;
    if (RONDAS_NOMBRES[m.grupo]) {
      key    = 'ELIM_' + m.grupo;
      titulo = RONDAS_NOMBRES[m.grupo];
    } else {
      // Agrupar por fecha
      const fechaFmt = formatFecha(m.fecha);
      key    = 'DIA_' + (m.fecha || 'sin-fecha').replace(/\//g, '-');
      titulo = fechaFmt || m.fecha;
    }
    if (!grupos[key]) grupos[key] = { titulo, partidos: [], key };
    grupos[key].partidos.push(m);
  });

  // Ordenar grupos por fecha
  const gruposOrdenados = Object.values(grupos).sort((a, b) => {
    // Eliminatorias van al final
    if (a.key.startsWith('ELIM_') && !b.key.startsWith('ELIM_')) return 1;
    if (!a.key.startsWith('ELIM_') && b.key.startsWith('ELIM_')) return -1;
    if (a.key.startsWith('ELIM_') && b.key.startsWith('ELIM_')) return 0;
    // Ordenar por fecha dd/MM/yyyy
    const [da,ma,ya] = a.titulo.split('/');
    const [db,mb,yb] = b.titulo.split('/');
    try { return new Date(ya,ma-1,da) - new Date(yb,mb-1,db); } catch(e) { return 0; }
  });

  const acordeon = document.getElementById('pron-acordeon');
  acordeon.innerHTML = '';

  // Abrir la primera jornada con partidos abiertos por defecto
  let primeraAbierta = false;

  gruposOrdenados.forEach((g, idx) => {
    const totalPartidos = g.partidos.length;
    const abiertos  = g.partidos.filter(m => !estaJugado(m)).length;
    const jugados   = totalPartidos - abiertos;
    const pronCarg  = g.partidos.filter(m => (pronLocales[m.id] && pronLocales[m.id].gl) !== '' && (pronLocales[m.id] && pronLocales[m.id].gv) !== '').length;
    const tieneAbiertos = abiertos > 0;
    const abrirPorDefecto = tieneAbiertos && !primeraAbierta;
    if (abrirPorDefecto) primeraAbierta = true;

    // Header del acordeón
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="acord-header ${abrirPorDefecto?'open':''}" onclick="toggleAcord('${g.key}')">
        <div>
          <div class="acord-title">${g.titulo}</div>
          <div class="acord-meta">${totalPartidos} partidos · ${abiertos} abiertos · ${pronCarg} pronósticos cargados</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${mostrarCampana(g) ? `<button id="rec-btn-${g.key}" style="background:transparent;border:none;font-size:20px;cursor:pointer;z-index:10;position:relative;padding:4px 8px;" title="Activar recordatorio">
            ${recordatorioActivo(g.key) ? '🔔' : '🔕'}
          </button>` : ''}
          <span class="acord-arrow">▼</span>
        </div>
      </div>
      <div class="acord-body ${abrirPorDefecto?'open':''}" id="acord-${g.key}">
        <div style="display:grid;grid-template-columns:1fr 80px 1fr 72px;gap:6px;padding:8px 14px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border);">
          <div>Local</div><div style="text-align:center">Marcador</div><div>Visitante</div><div style="text-align:center">Estado</div>
        </div>
        <div id="rows-${g.key}"></div>
      </div>`;
    acordeon.appendChild(div);

    // Agregar evento al botón recordatorio por separado para evitar propagación
    const recBtn = document.getElementById('rec-btn-' + g.key);
    if (recBtn) {
      const partAbiertos = g.partidos.filter(m => !estaJugado(m)).map(m => m.fecha + ' ' + m.hora);
      const tituloJornada = g.titulo;
      const keyJornada = g.key;
      recBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        toggleRecordatorio(keyJornada, tituloJornada, partAbiertos);
      });
    }

    // Filas de partidos
    const rowsEl = document.getElementById('rows-' + g.key);
    rowsEl.innerHTML = g.partidos.map(m=>{
    const p=pronLocales[m.id]||{gl:'',gv:''};
    const jugado   = estaJugado(m);
    const bloqueado = !jugado && estaBloqueado(m);
    const fl=flag(m.local), fv=flag(m.visitante);

    // Calcular resultado del pronóstico
    let badge='', resultStyle='', resHtml='';
    if(jugado && p.gl!=='' && p.gv!==''){
      const rl=parseInt(m.gol_l), rv=parseInt(m.gol_v);
      const pl=parseInt(p.gl),    pv=parseInt(p.gv);
      if(pl===rl && pv===rv){
        // Exacto ✅
        badge='<span class="badge b-green" style="font-size:10px">✅ Exacto +3</span>';
        resultStyle='background:rgba(184,247,60,0.05);border-left:3px solid var(--green)';
      } else {
        const ganReal = rl>rv?'L':rv>rl?'V':'E';
        const ganPred = pl>pv?'L':pv>pl?'V':'E';
        if(ganReal===ganPred){
          // 1X2 🟡
          badge='<span class="badge b-gold" style="font-size:10px">🟡 1X2 +1</span>';
          resultStyle='background:rgba(255,208,96,0.05);border-left:3px solid var(--gold)';
        } else {
          // Error ❌
          badge='<span class="badge b-red" style="font-size:10px">❌ Errado</span>';
          resultStyle='background:rgba(255,85,85,0.04);border-left:3px solid var(--red)';
        }
      }
      // Mostrar resultado real abajo
      resHtml=`<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:3px">Real: ${rl} - ${rv}</div>`;
    } else if(jugado && (p.gl===''||p.gv==='')){
      badge='<span class="badge b-red" style="font-size:10px">❌ Sin pron.</span>';
      resultStyle='background:rgba(255,85,85,0.04);border-left:3px solid var(--red)';
      const rl=parseInt(m.gol_l)||0, rv=parseInt(m.gol_v)||0;
      resHtml=`<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:3px">Real: ${rl} - ${rv}</div>`;
    } else if(bloqueado){
      badge='<span class="badge" style="font-size:10px;background:rgba(255,255,255,.10);color:var(--muted)">🔒 Cerrado</span>';
      resultStyle='';
    } else if(!jugado){
      badge='<span class="badge b-green" style="font-size:10px">Abierto</span>';
      resultStyle='';
    } else {
      badge='<span class="badge b-gray" style="font-size:10px">Pendiente</span>';
      resultStyle='';
    }

    const localAbrev = abreviar(m.local);
    const visitAbrev  = abreviar(m.visitante);
    return `<div class="match-row-pron" style="${resultStyle};border-bottom:1px solid var(--border);padding:10px 14px;${resultStyle?'border-left:3px solid;':''}">
      <div style="display:grid;grid-template-columns:1fr 80px 1fr 72px;gap:6px;align-items:center;">
        <!-- LOCAL -->
        <div style="display:flex;align-items:center;gap:5px;min-width:0;">
          ${fl}
          <span style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${localAbrev}</span>
        </div>
        <!-- MARCADOR -->
        <div style="display:flex;align-items:center;justify-content:center;gap:4px;">
          <input class="score-in" type="number" min="0" max="20" value="${p.gl}" placeholder="?" ${jugado||bloqueado?'disabled':''}
            oninput="setPron(${m.id},'gl',this.value)" onchange="setPron(${m.id},'gl',this.value)"
            style="width:32px;height:32px;font-size:14px;${bloqueado?'opacity:.45;cursor:not-allowed':''}"/>
          <span style="color:var(--muted);font-size:12px">${bloqueado?'🔒':':'}</span>
          <input class="score-in" type="number" min="0" max="20" value="${p.gv}" placeholder="?" ${jugado||bloqueado?'disabled':''}
            oninput="setPron(${m.id},'gv',this.value)" onchange="setPron(${m.id},'gv',this.value)"
            style="width:32px;height:32px;font-size:14px;${bloqueado?'opacity:.45;cursor:not-allowed':''}"/>
        </div>
        <!-- VISITANTE -->
        <div style="display:flex;align-items:center;gap:5px;min-width:0;">
          ${fv}
          <span style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${visitAbrev}</span>
        </div>
        <!-- ESTADO -->
        <div style="text-align:center">${badge}${resHtml}</div>
      </div>
    </div>`;
    }).join('');
  });

  actualizarResumenPron();
}

function toggleAcord(key) {
  const header = document.querySelector(`[onclick="toggleAcord('${key}')"]`);
  const body   = document.getElementById('acord-' + key);
  if (!header || !body) return;
  const opening = !body.classList.contains('open');
  header.classList.toggle('open');
  body.classList.toggle('open');
  // Animar las filas al abrir
  if (opening) {
    body.querySelectorAll('.match-row-pron').forEach((row, i) => {
      row.style.animation = 'none';
      row.offsetHeight;
      row.style.animation = `fadeUp .25s ease ${i * 25}ms both`;
    });
  }
}

// ── SISTEMA DE RECORDATORIOS ─────────────────────────────────
const DIAS_ANTES = 5;

function getFechaPartido(fechaStr, horaStr) {
  try {
    const [dia, mes, anio] = fechaStr.split('/');
    const [hh, mm] = horaStr.split(':');
    return new Date(parseInt(anio), parseInt(mes)-1, parseInt(dia), parseInt(hh), parseInt(mm), 0);
  } catch(e) { return null; }
}

function mostrarCampana(g) {
  if (!g.partidos) return false;
  const ahora = new Date();
  return g.partidos.some(m => {
    if (estaJugado(m)) return false;
    const fp = getFechaPartido(m.fecha, m.hora);
    if (!fp) return false;
    const diasFalta = (fp - ahora) / (1000*60*60*24);
    return diasFalta >= 0 && diasFalta <= DIAS_ANTES;
  });
}

function recordatorioActivo(key) {
  const saved = JSON.parse(localStorage.getItem('prode_recordatorios') || '{}');
  return !!saved[key];
}

function toggleRecordatorio(key, jornada, fechasHoras) {
  const activo = recordatorioActivo(key);
  if (activo) {
    const saved = JSON.parse(localStorage.getItem('prode_recordatorios') || '{}');
    delete saved[key];
    localStorage.setItem('prode_recordatorios', JSON.stringify(saved));
    actualizarCampana(key, false);
    toast('🔕 Recordatorio desactivado');
    return;
  }
  if (!('Notification' in window) || !fcmMessaging) { toast('Tu navegador no soporta notificaciones 😕', true); return; }
  if (Notification.permission === 'denied') { abrirModal('notif-ayuda'); return; }
  if (Notification.permission === 'granted') { guardarYActivar(key, jornada); return; }
  abrirModal('notif-permiso');
  document.getElementById('btn-pedir-notif').onclick = function() {
    cerrarModal('notif-permiso');
    Notification.requestPermission().then(perm => {
      if (perm !== 'granted') { abrirModal('notif-ayuda'); return; }
      guardarYActivar(key, jornada);
    });
  };
}

async function guardarYActivar(key, jornada) {
  try {
    const reg = window.swRegistration || await navigator.serviceWorker.ready;
    const token = await fcmMessaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) { toast('No se pudo activar el recordatorio 😕', true); return; }
    await apiPost({ accion: 'guardarPushToken', nombre: currentUser || 'anonimo', token });

    const saved = JSON.parse(localStorage.getItem('prode_recordatorios') || '{}');
    saved[key] = { jornada };
    localStorage.setItem('prode_recordatorios', JSON.stringify(saved));
    actualizarCampana(key, true);
    toast('🔔 Recordatorio activado para ' + jornada);
  } catch(e) {
    console.error(e);
    toast('No se pudo activar el recordatorio 😕', true);
  }
}

function actualizarCampana(key, activo) {
  const btn = document.getElementById('rec-btn-' + key);
  if (btn) btn.textContent = activo ? '🔔' : '🔕';
}


// Abreviar nombres de equipos largos para móvil
function abreviar(nombre) {
  const abrev = {
    'República Checa': 'Rep. Checa',
    'Corea del Sur': 'Corea del Sur',
    'Arabia Saudita': 'Arabia S.',
    'Costa de Marfil': 'C. de Marfil',
    'Países Bajos': 'P. Bajos',
    'Nueva Zelanda': 'N. Zelanda',
    'Rep. Dem. Congo': 'R.D. Congo',
    'Estados Unidos': 'EE.UU.',
    'Cabo Verde': 'Cabo Verde',
  };
  return abrev[nombre] || nombre;
}

function estaJugado(m) {
  // EN JUEGO = bloqueado pero no terminado, no cuenta como jugado
  if (m.estado === 'EN JUEGO') return false;
  if (m.estado === 'FT' || m.estado === '1H' || m.estado === '2H' || m.estado === 'HT' || m.estado === 'ET' || m.estado === 'P') return true;
  if (m.gol_l !== '' && m.gol_l !== undefined && m.gol_l !== null) return true;
  if (!m.fecha || !m.hora) return false;
  try {
    const [dia, mes, anio] = m.fecha.split('/');
    const [hh, mm] = m.hora.split(':');
    const fechaPartido = new Date(parseInt(anio), parseInt(mes)-1, parseInt(dia), parseInt(hh), parseInt(mm), 0);
    return new Date() >= fechaPartido;
  } catch(e) { return false; }
}

// Bloqueado = EN JUEGO, o faltan menos de 5 min para el inicio
function estaBloqueado(m) {
  if (estaJugado(m)) return false; // ya jugado se maneja aparte
  if (m.estado === 'EN JUEGO') return true;
  if (!m.fecha || !m.hora) return false;
  try {
    const [dia, mes, anio] = m.fecha.split('/');
    const [hh, mm] = m.hora.split(':');
    // Horario en hora Argentina — comparación directa con el dispositivo (también en AR)
    const fechaPartido = new Date(parseInt(anio), parseInt(mes)-1, parseInt(dia), parseInt(hh), parseInt(mm), 0);
    const diffMin = (fechaPartido - new Date()) / 60000;
    return diffMin >= 0 && diffMin < 5;
  } catch(e) { return false; }
}

function actualizarResumenPron(){
  let exactos=0, aciertos=0, errores=0, puntos=0;
  fixtureData.forEach(m=>{
    const jugado=estaJugado(m);
    if(!jugado) return;
    const p=pronLocales[m.id]||{gl:'',gv:''};
    if(p.gl===''||p.gv===''){errores++;return;}
    const rl=parseInt(m.gol_l),rv=parseInt(m.gol_v);
    const pl=parseInt(p.gl),pv=parseInt(p.gv);
    if(pl===rl&&pv===rv){exactos++;puntos+=3;}
    else{
      const gr=rl>rv?'L':rv>rl?'V':'E';
      const gp=pl>pv?'L':pv>pl?'V':'E';
      if(gr===gp){aciertos++;puntos+=1;}
      else errores++;
    }
  });
  const el=document.getElementById('pron-resumen');
  if(!el) return;
  if(exactos+aciertos+errores===0){el.innerHTML='';return;}
  el.innerHTML=`
    <div style="background:rgba(184,247,60,0.08);border:1px solid rgba(184,247,60,0.2);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Exactos</div>
      <div style="font-family:var(--font-d);font-size:26px;color:var(--green)">${exactos}</div>
    </div>
    <div style="background:rgba(255,208,96,0.08);border:1px solid rgba(255,208,96,0.2);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">1X2</div>
      <div style="font-family:var(--font-d);font-size:26px;color:var(--gold)">${aciertos}</div>
    </div>
    <div style="background:rgba(184,247,60,0.06);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">Mis puntos</div>
      <div style="font-family:var(--font-d);font-size:26px;color:var(--white)">${puntos}</div>
    </div>`;
}

let _autoSaveTimer = null;
function setPron(id,campo,val){
  if(!pronLocales[id]) pronLocales[id]={gl:'',gv:''};
  pronLocales[id][campo]=val;
  checkUnsaved();
  // Auto-guardado: espera 1.5s sin cambios y guarda solo
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => guardarTodos(true), 1500);
}
function checkUnsaved(){
  let n=0;
  Object.keys(pronLocales).forEach(id=>{
    const l=pronLocales[id],g=pronGuardados[id]||{};
    if((l.gl!==''||l.gv!=='')&&(l.gl!=g.gl||l.gv!=g.gv)) n++;
  });
  document.getElementById('save-count').textContent=n;
  document.getElementById('save-bar').classList.toggle('on',n>0);
}
async function guardarTodos(silencioso=false){
  if(!currentUser) return;
  const pendientes = [];
  Object.keys(pronLocales).forEach(id => {
    const p = pronLocales[id];
    const g = pronGuardados[id] || {};
    if (p.gl !== '' && p.gv !== '' && (p.gl != g.gl || p.gv != g.gv)) {
      pendientes.push({ partido_id: id, gol_l: p.gl, gol_v: p.gv });
    }
  });
  if (!pendientes.length) return;

  const btn = document.querySelector('#save-bar .btn-primary');
  if (!silencioso && btn) { btn.innerHTML = '<span class="spin"></span> Guardando...'; btn.disabled = true; }

  const r = await apiPost({ accion: 'guardarPronosticos', nombre: currentUser, pronosticos: pendientes });

  if (!silencioso && btn) { btn.innerHTML = '💾 Guardar todo'; btn.disabled = false; }

  if ((r && r.ok)) {
    pendientes.forEach(p => { pronGuardados[p.partido_id] = { gl: p.gol_l, gv: p.gol_v }; });
    checkUnsaved();
    toast('✅ Guardado');
  } else {
    toast((r && r.mensaje) || 'Error al guardar', true);
  }
}

// ── ESTADÍSTICAS ──────────────────────────────────────────────
function renderStats(ranking){
  const el = document.getElementById('stats-list');
  if (!el) return;
  if(!(ranking && ranking.length)){
    el.innerHTML='<div class="empty"><span class="empty-icon">📊</span>Sin datos aún</div>'; return;
  }
  const maxPts=Math.max(...ranking.map(r=>r.puntos||0),1);
  el.innerHTML=ranking.map((p,i)=>{
    const av      = AVATARS[i%AVATARS.length];
    const ini     = p.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    const pct     = Math.round((p.puntos||0)/maxPts*100);
    const fotoUrl = p.foto_url || localStorage.getItem('prode_foto_' + p.nombre) || '';
    const avatarHtml = fotoUrl
      ? `<div class="avatar" style="padding:0;overflow:hidden;flex-shrink:0"><img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;"/></div>`
      : `<div class="avatar" style="background:${av.bg};color:${av.fg};flex-shrink:0">${ini}</div>`;
    const medal = i===0?'🥇 ':i===1?'🥈 ':i===2?'🥉 ':'';
    return `<div class="stats-row">
      ${avatarHtml}
      <div class="bar-wrap">
        <div class="bar-name">${medal}${p.nombre}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="bar-pts">${p.puntos||0}</div>
    </div>`;
  }).join('');
}

// ── REGISTRO ──────────────────────────────────────────────────
async function registrar(){
  const nombre=document.getElementById('reg-nombre').value.trim();
  const pin=document.getElementById('reg-pin').value.trim();
  if(!nombre){ document.getElementById('reg-nombre').focus(); return; }
  if(!pin||pin.length!==4||isNaN(pin)){ toast('El PIN debe ser de exactamente 4 números',true); return; }
  const btn=document.getElementById('btn-reg');
  btn.innerHTML='<span class="spin"></span> Guardando...'; btn.disabled=true;
  const data=await apiPost({accion:'registrar',nombre,pin,whatsapp:document.getElementById('reg-wa').value.trim(),email:document.getElementById('reg-email').value.trim()});
  btn.innerHTML='Registrarme →'; btn.disabled=false;
  if((data && data.ok)){
    cerrarModal('registro');
    toast('🎉 '+(data.mensaje||'¡Registrado!'));
    ['reg-nombre','reg-pin','reg-wa','reg-email'].forEach(id=>document.getElementById(id).value='');
    cargarRanking();
  } else toast((data && data.mensaje)||'Error al registrar',true);
}

// ── HELPERS ───────────────────────────────────────────────────
function formatFecha(f){
  if(!f) return '';
  if(typeof f==='string'&&f.includes('T')){
    return new Date(f).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Argentina/Buenos_Aires'});
  }
  if(f instanceof Date) return f.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
  return String(f).split('T')[0]||f;
}
function formatHora(h){
  if(!h) return '';
  if(h instanceof Date) return h.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'});
  if(typeof h==='string'&&h.includes('T')) return new Date(h).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'});
  return String(h).substring(0,5);
}
// ── FOTO DE PERFIL ───────────────────────────────────────────
let fotoFileLocal = null;
let fotoFileModal = null;

async function cargarFotoPerfil(nombre) {
  const data = await apiGet('getFoto', '&nombre=' + encodeURIComponent(nombre));
  if ((data && data.ok) && data.url) {
    localStorage.setItem('prode_foto_' + nombre, data.url);
    // Actualizar foto en el modal si está abierto
    const img = document.getElementById('modal-foto-img');
    const ph  = document.getElementById('modal-foto-ph');
    if (img && data.url) { img.src=data.url; img.style.display='block'; if(ph) ph.style.display='none'; }
  }
}

function previsualizarFotoModal(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('La foto no puede superar 5MB', true); return; }
  fotoFileModal = file;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('modal-foto-img');
    const ph  = document.getElementById('modal-foto-ph');
    img.src = e.target.result; img.style.display = 'block'; ph.style.display = 'none';
    document.getElementById('btn-subir-foto-modal').style.display = 'inline-flex';
    document.getElementById('modal-foto-status').textContent = 'Foto lista para subir';
  };
  reader.readAsDataURL(file);
}

async function subirFotoModal() {
  if (!fotoFileModal || !currentUser) return;
  const btn = document.getElementById('btn-subir-foto-modal');
  btn.innerHTML = '<span class="spin"></span> Subiendo...'; btn.disabled = true;
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result.split(',')[1];
    const res = await apiPost({
      accion: 'subirFoto', nombre: currentUser,
      pin: localStorage.getItem('prode_pin') || '',
      fotoBase64: base64, mimeType: fotoFileModal.type
    });
    btn.innerHTML = 'Guardar foto →'; btn.disabled = false;
    if ((res && res.ok)) {
      localStorage.setItem('prode_foto_' + currentUser, res.url);
      cerrarModal('cambiar-foto');
      fotoFileModal = null;
      toast('📸 Foto actualizada');
      cargarRanking();
    } else {
      toast((res && res.mensaje) || 'Error al subir la foto', true);
    }
  };
  reader.readAsDataURL(fotoFileModal);
}

// Cargar foto actual al abrir modal cambiar-foto
function prepararModalFoto() {
  if (!currentUser) return;
  fotoFileModal = null;
  document.getElementById('btn-subir-foto-modal').style.display = 'none';
  document.getElementById('modal-foto-status').textContent = '';
  const cached = localStorage.getItem('prode_foto_' + currentUser);
  const img = document.getElementById('modal-foto-img');
  const ph  = document.getElementById('modal-foto-ph');
  if (cached) { img.src=cached; img.style.display='block'; if(ph) ph.style.display='none'; }
  else { if(img) img.style.display='none'; if(ph) ph.style.display='block'; }
  document.getElementById('modal-foto-input').value = '';
}

function mostrarFoto(src) {}  // mantener compatibilidad
function limpiarFoto() {}

// ── CONFETTI & FESTEJO ───────────────────────────────────────

const CONFETTI_COLORS = ['#B8F73C','#FFD060','#FF5555','#5B8FF9','#C4A0FF','#60FFB0','#FF9060','#FFFFFF'];
let confettiAnimId = null;
let particulas = [];

function lanzarConfetti(duracion = 4000) {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  particulas = [];

  // Crear partículas
  for (let i = 0; i < 180; i++) {
    particulas.push({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height - canvas.height,
      w:      Math.random() * 10 + 5,
      h:      Math.random() * 5 + 3,
      color:  CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rot:    Math.random() * 360,
      rotV:   (Math.random() - 0.5) * 6,
      vx:     (Math.random() - 0.5) * 3,
      vy:     Math.random() * 4 + 2,
      alpha:  1,
    });
  }

  const fin = Date.now() + duracion;

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ahora = Date.now();
    const restante = fin - ahora;

    particulas.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.rot += p.rotV;
      if (restante < 1000) p.alpha = Math.max(0, restante / 1000);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x + p.w/2, p.y + p.h/2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();

      // Reiniciar si sale de pantalla
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    });

    if (ahora < fin) {
      confettiAnimId = requestAnimationFrame(animar);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
    }
  }

  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  animar();
}

function mostrarFestejo(nombre) {
  // Banner de festejo
  const banner = document.createElement('div');
  banner.id = 'festejo-banner';
  banner.style.cssText = `
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);
    background:linear-gradient(135deg,#1a2e05,#0f1a03);
    border:2px solid var(--green);border-radius:20px;
    padding:28px 36px;text-align:center;z-index:301;
    box-shadow:0 0 60px rgba(184,247,60,0.3);
    animation:festejoIn .4s cubic-bezier(.34,1.56,.64,1) forwards;
  `;
  banner.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px">🏆</div>
    <div style="font-family:var(--font-d);font-size:32px;color:var(--green);letter-spacing:1px">¡VAS PRIMERO!</div>
    <div style="font-size:16px;color:var(--white);margin-top:6px;font-weight:500">${nombre}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">Seguí así campeón 🔥</div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => {
    banner.style.animation = 'festejoOut .3s ease forwards';
    setTimeout(() => banner.remove(), 300);
  }, 3000);
}

// Agregar keyframes de animación
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes festejoIn  { from{transform:translate(-50%,-50%) scale(0);opacity:0} to{transform:translate(-50%,-50%) scale(1);opacity:1} }
  @keyframes festejoOut { from{transform:translate(-50%,-50%) scale(1);opacity:1} to{transform:translate(-50%,-50%) scale(0.8);opacity:0} }
`;
document.head.appendChild(styleEl);

// ── CONTADOR REGRESIVO ───────────────────────────────────────

const INICIO_MUNDIAL = '2026-06-11T16:00:00'; // México vs Sudáfrica — primer partido

const PARTIDOS_ARG = [
  { fecha: '2026-06-16T22:00:00', rival: 'vs Argelia 🇩🇿',  grupo: 'Grupo J', duracion: 105 },
  { fecha: '2026-06-22T14:00:00', rival: 'vs Austria 🇦🇹',   grupo: 'Grupo J', duracion: 105 },
  { fecha: '2026-06-27T23:00:00', rival: 'vs Jordania 🇯🇴',  grupo: 'Grupo J', duracion: 105 },
];

let contadorInterval = null;

function iniciarContador() {
  const ahora   = new Date();
  const mundial = new Date(INICIO_MUNDIAL);
  const wrap    = document.getElementById('contador-wrap');
  if (!wrap) return;

  if (contadorInterval) clearInterval(contadorInterval);

  // FASE 1 — Falta para que empiece el Mundial
  if (ahora < mundial) {
    wrap.style.display = 'block';
    document.getElementById('cnt-label').textContent  = '🌍 Falta para el Mundial 2026';
    document.getElementById('cnt-rival').textContent  = 'México vs Sudáfrica · Partido inaugural';
    contadorInterval = setInterval(() => {
      const diff = new Date(INICIO_MUNDIAL) - new Date();
      if (diff <= 0) { clearInterval(contadorInterval); iniciarContador(); return; }
      actualizarNums(diff);
    }, 1000);
    actualizarNums(new Date(INICIO_MUNDIAL) - ahora);
    return;
  }

  // FASE 2 — Mundial en curso, buscar próximo partido de Argentina
  const proximo = PARTIDOS_ARG.find(p => {
    const fin = new Date(new Date(p.fecha).getTime() + p.duracion * 60000);
    return fin > ahora;
  });

  if (!proximo) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  const inicioPart = new Date(proximo.fecha);
  const finPart    = new Date(inicioPart.getTime() + proximo.duracion * 60000);

  // Partido en curso
  if (ahora >= inicioPart && ahora < finPart) {
    document.getElementById('cnt-label').textContent = '🇦🇷 ¡Argentina está jugando!';
    document.getElementById('cnt-rival').textContent = proximo.rival + ' · ' + proximo.grupo;
    document.getElementById('cnt-dias').textContent  = '⚽';
    document.getElementById('cnt-horas').textContent = '⚽';
    document.getElementById('cnt-min').textContent   = '⚽';
    document.getElementById('cnt-seg').textContent   = '⚽';
    // Revisar cada minuto si terminó
    contadorInterval = setInterval(() => {
      if (new Date() >= finPart) { clearInterval(contadorInterval); iniciarContador(); }
    }, 30000);
    return;
  }

  // Próximo partido de Argentina
  document.getElementById('cnt-label').textContent = '🇦🇷 Próximo partido de Argentina';
  document.getElementById('cnt-rival').textContent = proximo.rival + ' · ' + proximo.grupo;

  contadorInterval = setInterval(() => {
    const diff = new Date(proximo.fecha) - new Date();
    if (diff <= 0) { clearInterval(contadorInterval); iniciarContador(); return; }
    actualizarNums(diff);
  }, 1000);
  actualizarNums(new Date(proximo.fecha) - ahora);
}

function actualizarNums(diff) {
  const dias  = Math.floor(diff / (1000*60*60*24));
  const horas = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
  const mins  = Math.floor((diff % (1000*60*60)) / (1000*60));
  const segs  = Math.floor((diff % (1000*60)) / 1000);
  document.getElementById('cnt-dias').textContent  = String(dias).padStart(2,'0');
  document.getElementById('cnt-horas').textContent = String(horas).padStart(2,'0');
  document.getElementById('cnt-min').textContent   = String(mins).padStart(2,'0');
  document.getElementById('cnt-seg').textContent   = String(segs).padStart(2,'0');
}

// ── MENÚ USUARIO ─────────────────────────────────────────────
function toggleMenuUsuario() {
  const menu = document.getElementById('menu-usuario');
  const btn  = document.getElementById('btn-logueado');
  if (menu.style.display === 'none' || !menu.style.display) {
    const rect       = btn.getBoundingClientRect();
    const menuHeight = 220; // altura estimada del menú
    const spaceAbajo = window.innerHeight - rect.bottom;

    if (spaceAbajo < menuHeight) {
      // Poco espacio abajo — abrir hacia arriba
      menu.style.top    = 'auto';
      menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
    } else {
      // Abrir hacia abajo
      menu.style.bottom = 'auto';
      menu.style.top    = (rect.bottom + 8) + 'px';
    }
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
}

function cerrarMenuUsuario() {
  const menu = document.getElementById('menu-usuario');
  if (menu) menu.style.display = 'none';
}

// Cerrar menú al hacer clic afuera
document.addEventListener('click', e => {
  const wrap = document.getElementById('btn-logueado');
  if (wrap && !wrap.contains(e.target)) cerrarMenuUsuario();
});

async function cargarDatosPerfil() {
  if (!currentUser) return;
  const pin = (document.getElementById('login-pin') && document.getElementById('login-pin').value) || (document.getElementById('quick-pin') && document.getElementById('quick-pin').value) || '';
  const data = await apiGet('getPerfil', '&nombre=' + encodeURIComponent(currentUser) + '&pin=' + encodeURIComponent(pin));
  if ((data && data.ok)) {
    document.getElementById('edit-wa').value    = data.whatsapp || '';
    document.getElementById('edit-email').value = data.email    || '';
  }
}

async function guardarPerfil() {
  const pin = document.getElementById('edit-pin-confirm').value.trim();
  if (!pin) { toast('Ingresá tu PIN para confirmar', true); return; }
  const btn = document.getElementById('btn-guardar-perfil');
  btn.innerHTML = '<span class="spin"></span> Guardando...'; btn.disabled = true;

  const wa    = document.getElementById('edit-wa').value.trim();
  const email = document.getElementById('edit-email').value.trim();

  let ok = 0;
  if (wa) {
    const r = await apiPost({ accion:'editarPerfil', nombre:currentUser, pin, campo:'whatsapp', valor_nuevo:wa });
    if ((r && r.ok)) ok++;
    else { toast((r && r.mensaje) || 'Error al guardar', true); btn.innerHTML='Guardar →'; btn.disabled=false; return; }
  }
  if (email) {
    const r = await apiPost({ accion:'editarPerfil', nombre:currentUser, pin, campo:'email', valor_nuevo:email });
    if ((r && r.ok)) ok++;
  }

  btn.innerHTML = 'Guardar →'; btn.disabled = false;
  cerrarModal('editar-perfil');
  document.getElementById('edit-pin-confirm').value = '';
  toast('✅ Datos actualizados');
}

async function cambiarPin() {
  const pinActual  = document.getElementById('pin-actual').value.trim();
  const pinNuevo   = document.getElementById('pin-nuevo').value.trim();
  const pinConfirm = document.getElementById('pin-nuevo-confirm').value.trim();

  if (!pinActual) { toast('Ingresá tu PIN actual', true); return; }
  if (pinNuevo.length !== 4 || isNaN(pinNuevo)) { toast('El PIN nuevo debe ser de 4 números', true); return; }
  if (pinNuevo !== pinConfirm) { toast('Los PINs nuevos no coinciden', true); return; }

  const btn = document.getElementById('btn-cambiar-pin');
  btn.innerHTML = '<span class="spin"></span> Cambiando...'; btn.disabled = true;

  const res = await apiPost({ accion:'editarPerfil', nombre:currentUser, pin:pinActual, campo:'pin', pin_nuevo:pinNuevo });
  btn.innerHTML = 'Cambiar PIN →'; btn.disabled = false;

  if ((res && res.ok)) {
    cerrarModal('cambiar-pin');
    ['pin-actual','pin-nuevo','pin-nuevo-confirm'].forEach(id => document.getElementById(id).value = '');
    // Actualizar PIN guardado en los campos de login
    const loginPin = document.getElementById('login-pin');
    if (loginPin) loginPin.value = pinNuevo;
    toast('🔐 PIN cambiado correctamente');
  } else {
    toast((res && res.mensaje) || 'Error al cambiar PIN', true);
  }
}

function actualizarHeroBtns() {
  const btnUnirme   = document.getElementById('btn-unirme');
  const btnLogin    = document.getElementById('btn-login');
  const btnLogueado = document.getElementById('btn-logueado');
  const heroNombre  = document.getElementById('hero-nombre-usuario');

  // Mostrar/ocultar tabs que requieren auth
  document.querySelectorAll('.nav-tab[data-auth="true"]').forEach(t => {
    t.style.display = currentUser ? 'inline-block' : 'none';
  });

  if (currentUser) {
    if(btnUnirme)   btnUnirme.style.display   = 'none';
    if(btnLogin)    btnLogin.style.display     = 'none';
    if(btnLogueado) { btnLogueado.style.display = 'flex'; }
    if(heroNombre)  heroNombre.textContent     = currentUser;
    const menuNombre = document.getElementById('menu-nombre');
    if(menuNombre) menuNombre.textContent = currentUser;
  } else {
    // Ocultar "Unirme" a partir del 11/06/2026 12:00 hora Argentina (UTC-3 = 15:00 UTC)
    const cierreRegistro = new Date(Date.UTC(2026, 5, 11, 15, 0, 0)); // 11 jun 2026 12:00 AR
    const registroCerrado = new Date() >= cierreRegistro;
    if(btnUnirme)   btnUnirme.style.display   = registroCerrado ? 'none' : '';
    if(btnLogin)    btnLogin.style.display     = '';
    if(btnLogueado) btnLogueado.style.display  = 'none';
    if(heroNombre)  heroNombre.textContent     = '';
  }
}

function bienvenida(n){
  toast('¡Bienvenido ' + n + '! ⚽');
}

function toast(msg,err=false){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='on'+(err?' err':'');
  clearTimeout(t._t); t._t=setTimeout(()=>t.className='',2800);
}

let _saveTipTimer = null;
function mostrarSaveTip(){
  const tip = document.getElementById('save-tip');
  if (!tip) return;
  clearTimeout(_saveTipTimer);
  tip.classList.add('visible');
}

function ocultarSaveTip(){
  const tip = document.getElementById('save-tip');
  if (!tip) return;
  _saveTipTimer = setTimeout(() => tip.classList.remove('visible'), 1000);
}
