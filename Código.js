// ============================================================
//  PRODE MUNDIAL 2026 — Google Apps Script
//  Rebeka para Croma | v1.0
// ============================================================
//
//  INSTRUCCIONES DE INSTALACIÓN:
//  1. Abrí tu Google Sheet del prode
//  2. Extensiones → Apps Script
//  3. Pegá todo este código (reemplazá el contenido existente)
//  4. Cambiá API_FOOTBALL_KEY por tu clave de api-football.com
//  5. Guardá (Ctrl+S) → Ejecutar → inicializarSheet()
//  6. Implementar → Nueva implementación → App web
//     - Ejecutar como: Yo
//     - Acceso: Cualquier usuario (para que el panel HTML pueda conectarse)
//  7. Copiá la URL generada → pegala en el panel HTML como SHEET_URL
//  8. Activar triggers: configurarTriggers()
// ============================================================

// ── CONFIGURACIÓN GLOBAL ─────────────────────────────────────
const API_FOOTBALL_KEY = "f2df108e7f6aaa4d7f2d74c6a43b4600"; // api-football.com
const API_FOOTBALL_URL = "https://v3.football.api-sports.io";
const MUNDIAL_2026_ID   = 1;   // ID del Mundial 2026 en api-football
const TEMPORADA         = 2026;

const PUNTOS_EXACTO = 3;  // resultado exacto
const PUNTOS_1X2    = 1;  // solo acertó ganador/empate

// Nombres de hojas
const H_PARTICIPANTES  = "PARTICIPANTES";
const H_FIXTURE        = "FIXTURE";
const H_PRONOSTICOS    = "PRONÓSTICOS";
const H_RESULTADOS     = "RESULTADOS";
const H_RANKING        = "RANKING";

// ── DOGET / DOPOST — Punto de entrada del panel HTML ─────────

function doGet(e) {
  if (!e || !e.parameter) {
    return jsonResponse({ ok: true, mensaje: "Prode Mundial 2026 - API activa ✅" });
  }

  const accion = e.parameter.accion || "";

  if (accion === "ranking")       return jsonResponse(getRanking());
  if (accion === "fixture")       return jsonResponse(getFixture());
  if (accion === "participantes") return jsonResponse(getParticipantes());
  if (accion === "pronosticos") {
    const nombre = e.parameter.nombre || "";
    return jsonResponse(getPronosticosUsuario(nombre));
  }
  if (accion === "getPerfil") {
    const nombre = e.parameter.nombre || "";
    const pin    = e.parameter.pin    || "";
    return jsonResponse(getPerfil(nombre, pin));
  }
  if (accion === "getPerfilPublico") {
    const nombre = e.parameter.nombre || "";
    return jsonResponse(getPerfilPublico(nombre));
  }
  if (accion === "getFoto") {
    const nombre = e.parameter.nombre || "";
    return jsonResponse(getFotoPerfil(nombre));
  }
  if (accion === "estadisticas") {
    return jsonResponse(getEstadisticas());
  }
  if (accion === "pronosticosEnJuego") {
    return jsonResponse(getPronosticosEnJuego());
  }
  if (accion === "verificarPin") {
    const nombre = e.parameter.nombre || "";
    const pin    = e.parameter.pin    || "";
    return jsonResponse(verificarPin(nombre, pin));
  }

  return jsonResponse({ ok: false, mensaje: "Acción no reconocida" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const accion = data.accion || "";

    if (accion === "registrar")          return jsonResponse(registrarParticipante(data));
    if (accion === "pronostico")         return jsonResponse(guardarPronostico(data));
    if (accion === "guardarPronosticos") return jsonResponse(guardarPronosticosLote(data));
    if (accion === "resultado")          return jsonResponse(cargarResultadoManual(data));
    if (accion === "subirFoto")          return jsonResponse(subirFotoPerfil(data));
    if (accion === "editarPerfil")       return jsonResponse(editarPerfil(data));

    return jsonResponse({ ok: false, mensaje: "Acción desconocida" });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── INICIALIZACIÓN DEL SHEET ──────────────────────────────────

function inicializarSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  crearHojaParticipantes(ss);
  crearHojaFixture(ss);
  crearHojaPronosticos(ss);
  crearHojaResultados(ss);
  crearHojaRanking(ss);
  SpreadsheetApp.getUi().alert("✅ Prode inicializado correctamente. ¡A jugar!");
}

function crearHojaParticipantes(ss) {
  let h = ss.getSheetByName(H_PARTICIPANTES);
  if (h) h.clear(); else h = ss.insertSheet(H_PARTICIPANTES);

  h.getRange(1,1,1,8).setValues([[
    "ID","NOMBRE","PIN","WHATSAPP","EMAIL","FECHA_REGISTRO","ACTIVO","FOTO_URL"
  ]]);
  formatearEncabezado(h, 1, 8);
  h.setColumnWidth(1, 50);
  h.setColumnWidth(2, 160);
  h.setColumnWidth(3, 60);
  h.setColumnWidth(4, 130);
  h.setColumnWidth(5, 180);
  h.setColumnWidth(6, 130);
  h.setColumnWidth(7, 70);
  // Columna C (PIN) siempre como texto para preservar ceros iniciales
  h.getRange("C:C").setNumberFormat("@");
}

function crearHojaFixture(ss) {
  let h = ss.getSheetByName(H_FIXTURE);
  if (h) h.clear(); else h = ss.insertSheet(H_FIXTURE);

  h.getRange(1,1,1,10).setValues([[
    "PARTIDO_ID","GRUPO","JORNADA","FECHA","HORA","LOCAL","VISITANTE","GOL_L","GOL_V","ESTADO"
  ]]);
  formatearEncabezado(h, 1, 10);

  // Cargar fixture base del Grupo A (demo — se completa con cargarFixtureDesdeAPI)
  const partidos = getFixtureBase();
  if (partidos.length > 0) {
    h.getRange(2, 1, partidos.length, 10).setValues(partidos);
  }
}

function crearHojaPronosticos(ss) {
  let h = ss.getSheetByName(H_PRONOSTICOS);
  if (h) h.clear(); else h = ss.insertSheet(H_PRONOSTICOS);

  h.getRange(1,1,1,7).setValues([[
    "PARTICIPANTE_ID","NOMBRE","PARTIDO_ID","GOL_L_PRED","GOL_V_PRED","FECHA_CARGA","BLOQUEADO"
  ]]);
  formatearEncabezado(h, 1, 7);
}

function crearHojaResultados(ss) {
  let h = ss.getSheetByName(H_RESULTADOS);
  if (h) h.clear(); else h = ss.insertSheet(H_RESULTADOS);

  h.getRange(1,1,1,6).setValues([[
    "PARTIDO_ID","GOL_L","GOL_V","GANADOR","FECHA_ACTUALIZACION","FUENTE"
  ]]);
  formatearEncabezado(h, 1, 6);
}

function crearHojaRanking(ss) {
  let h = ss.getSheetByName(H_RANKING);
  if (h) h.clear(); else h = ss.insertSheet(H_RANKING);

  h.getRange(1,1,1,10).setValues([[
    "POSICION","NOMBRE","PUNTOS","EXACTOS","ACIERTOS_1X2","PENDIENTES","RACHA","ULTIMA_ACT","FOTO_URL","ERRORES"
  ]]);
  formatearEncabezado(h, 1, 10);
}

function formatearEncabezado(hoja, fila, cols) {
  const r = hoja.getRange(fila, 1, 1, cols);
  r.setBackground("#534AB7");
  r.setFontColor("#FFFFFF");
  r.setFontWeight("bold");
  r.setFontSize(10);
  hoja.setFrozenRows(1);
}

// ── REGISTRO DE PARTICIPANTES ─────────────────────────────────

function registrarParticipante(data) {
  // ── REGISTRO CERRADO ─────────────────────────────────────────
  return { ok: false, mensaje: "El registro está cerrado. El prode ya comenzó." };
  // ─────────────────────────────────────────────────────────────

  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const h   = ss.getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();

  // Verificar si ya existe
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === data.nombre.toLowerCase()) {
      return { ok: false, mensaje: "El nombre '" + data.nombre + "' ya está registrado." };
    }
  }

  const nuevoId = rows.length; // ID autoincremental
  const ahora   = new Date();

  const fila = h.getRange(h.getLastRow() + 1, 1, 1, 7);
  fila.setValues([[
    nuevoId,
    data.nombre     || "",
    data.pin        ? String(data.pin).padStart(4,'0') : "",
    data.whatsapp   || "",
    data.email      || "",
    Utilities.formatDate(ahora, "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm"),
    true
  ]]);
  // Formatear columna PIN como texto para preservar ceros
  h.getRange(h.getLastRow(), 3).setNumberFormat("@");

  return { ok: true, id: nuevoId, mensaje: "¡" + data.nombre + " registrado correctamente!" };
}

function getParticipantes() {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][6] === true || rows[i][6] === "TRUE") {
      result.push({
        id:       rows[i][0],
        nombre:   rows[i][1],
        whatsapp: rows[i][3],
        email:    rows[i][4]
      });
    }
  }
  return { ok: true, participantes: result };
}

// ── PRONÓSTICOS ───────────────────────────────────────────────

function guardarPronostico(data) {
  // data: { nombre, partido_id, gol_l, gol_v }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // espera hasta 10s para obtener acceso exclusivo
  try {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hp  = ss.getSheetByName(H_PRONOSTICOS);
  const hf  = ss.getSheetByName(H_FIXTURE);

  // Verificar que el partido no haya comenzado y que falten más de 5 minutos
  const fixRows = hf.getDataRange().getValues();
  let estadoPartido = null, fechaPartido = null, horaPartido = null;
  for (let i = 1; i < fixRows.length; i++) {
    if (fixRows[i][0].toString() === data.partido_id.toString()) {
      estadoPartido = fixRows[i][9];
      fechaPartido  = fixRows[i][3];
      horaPartido   = fixRows[i][4];
      break;
    }
  }
  if (estadoPartido === null) return { ok: false, mensaje: "Partido no encontrado." };
  if (estadoPartido !== "NS" && estadoPartido !== "PENDIENTE") {
    return { ok: false, mensaje: "El partido ya comenzó. No podés modificar este pronóstico." };
  }

  // Bloquear 5 minutos antes del inicio
  try {
    const fechaStr = (fechaPartido instanceof Date)
      ? Utilities.formatDate(fechaPartido, "America/Argentina/Buenos_Aires", "dd/MM/yyyy")
      : fechaPartido.toString();
    const horaStr = (horaPartido instanceof Date)
      ? Utilities.formatDate(horaPartido, "America/Argentina/Buenos_Aires", "HH:mm")
      : horaPartido.toString().substring(0, 5);
    const partes = fechaStr.split('/');
    const hParts = horaStr.split(':');
    const inicio = new Date(
      parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]),
      parseInt(hParts[0]), parseInt(hParts[1]), 0
    );
    const ahora = new Date();
    const diffMin = (inicio - ahora) / 60000;
    if (diffMin < 5) {
      return { ok: false, mensaje: "El partido comienza en menos de 5 minutos. Ya no podés modificar este pronóstico." };
    }
  } catch(e) {
    // Si falla el parseo de fecha, no bloquear por este motivo
  }

  // Buscar si ya existe pronóstico para este usuario y partido
  const rows = hp.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === data.nombre.toLowerCase()
        && rows[i][2].toString() === data.partido_id.toString()) {
      // Actualizar fila existente
      hp.getRange(i+1, 4).setValue(data.gol_l);
      hp.getRange(i+1, 5).setValue(data.gol_v);
      hp.getRange(i+1, 6).setValue(new Date());
      return { ok: true, mensaje: "Pronóstico actualizado." };
    }
  }

  // Insertar nuevo pronóstico
  const idPart = obtenerIdParticipante(data.nombre);
  hp.appendRow([
    idPart,
    data.nombre,
    data.partido_id,
    data.gol_l,
    data.gol_v,
    new Date(),
    false
  ]);

  return { ok: true, mensaje: "Pronóstico guardado para " + data.nombre };
  } finally {
    lock.releaseLock();
  }
}

function guardarPronosticosLote(data) {
  // data: { nombre, pronosticos: [{partido_id, gol_l, gol_v}, ...] }
  const pronosticos = data.pronosticos || [];
  let guardados = 0;
  const errores = [];

  for (const p of pronosticos) {
    const r = guardarPronostico({
      nombre:     data.nombre,
      partido_id: p.partido_id,
      gol_l:      p.gol_l,
      gol_v:      p.gol_v
    });
    if (r.ok) guardados++;
    else errores.push(p.partido_id + ': ' + r.mensaje);
  }

  return { ok: true, guardados, total: pronosticos.length, errores };
}

function getPronosticosUsuario(nombre) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PRONOSTICOS);
  const rows = h.getDataRange().getValues();
  const result = [];

  const vistosGet = new Set();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() !== nombre.toLowerCase()) continue;
    const pid = rows[i][2].toString();
    if (vistosGet.has(pid)) continue;
    vistosGet.add(pid);
    result.push({
      partido_id: rows[i][2],
      gol_l:      rows[i][3],
      gol_v:      rows[i][4],
      bloqueado:  rows[i][6]
    });
  }
  return { ok: true, nombre, pronosticos: result };
}

// ── PRONÓSTICOS EN JUEGO (vista pública) ─────────────────────

function getPronosticosEnJuego() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hFix = ss.getSheetByName(H_FIXTURE);
  const hPro = ss.getSheetByName(H_PRONOSTICOS);

  const fixRows = hFix.getDataRange().getValues();
  const proRows = hPro.getDataRange().getValues();

  // Encontrar partidos EN JUEGO
  const enJuego = [];
  for (let i = 1; i < fixRows.length; i++) {
    const estado = fixRows[i][9] ? fixRows[i][9].toString() : '';
    if (estado !== 'EN JUEGO') continue;
    enJuego.push({
      partido_id: fixRows[i][0].toString(),
      local:      fixRows[i][5],
      visitante:  fixRows[i][6],
      gol_l:      fixRows[i][7] !== '' ? fixRows[i][7] : 0,
      gol_v:      fixRows[i][8] !== '' ? fixRows[i][8] : 0,
      jornada:    fixRows[i][2],
      pronosticos: []
    });
  }

  if (enJuego.length === 0) return { ok: true, partidos: [] };

  // Indexar por partido_id para búsqueda rápida
  const idx = {};
  enJuego.forEach((p, i) => { idx[p.partido_id] = i; });

  // Recolectar pronósticos (deduplicar por nombre+partido)
  const vistos = new Set();
  for (let i = 1; i < proRows.length; i++) {
    const pid = proRows[i][2] ? proRows[i][2].toString() : '';
    if (!(pid in idx)) continue;
    const nombre = proRows[i][1] ? proRows[i][1].toString() : '';
    const clave  = nombre + '|' + pid;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    enJuego[idx[pid]].pronosticos.push({
      nombre: nombre,
      gol_l:  proRows[i][3],
      gol_v:  proRows[i][4]
    });
  }

  // Ordenar predicciones por nombre
  enJuego.forEach(p => {
    p.pronosticos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  return { ok: true, partidos: enJuego };
}

// ── ESTADÍSTICAS ─────────────────────────────────────────────

function getEstadisticas() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hPro = ss.getSheetByName(H_PRONOSTICOS);
  const hRes = ss.getSheetByName(H_RESULTADOS);
  const hFix = ss.getSheetByName(H_FIXTURE);

  const resultados = mapearResultados(hRes);
  const pronRows   = hPro.getDataRange().getValues();
  const fixRows    = hFix.getDataRange().getValues();

  // Mapear jornada por partido
  const jornadaMap = {};
  const equiposMap = {};
  for (let i = 1; i < fixRows.length; i++) {
    if (!fixRows[i][0]) continue;
    jornadaMap[fixRows[i][0].toString()] = fixRows[i][2]; // jornada
    equiposMap[fixRows[i][0].toString()] = fixRows[i][5] + ' vs ' + fixRows[i][6];
  }

  // Calcular puntos por jornada por participante
  const jornadas = {}; // { jornada: { nombre: puntos } }

  const vistosEst = new Set();
  for (let i = 1; i < pronRows.length; i++) {
    const nombre    = pronRows[i][1];
    const partidoId = pronRows[i][2].toString();
    const pred_l    = parseInt(pronRows[i][3]);
    const pred_v    = parseInt(pronRows[i][4]);
    const res       = resultados[partidoId];
    if (!res) continue;

    const claveEst = nombre + '|' + partidoId;
    if (vistosEst.has(claveEst)) continue;
    vistosEst.add(claveEst);

    const jornada = jornadaMap[partidoId] || 'Otra';
    if (!jornadas[jornada]) jornadas[jornada] = {};
    if (!jornadas[jornada][nombre]) jornadas[jornada][nombre] = 0;

    const real_l = parseInt(res.gol_l);
    const real_v = parseInt(res.gol_v);

    if (pred_l === real_l && pred_v === real_v) {
      jornadas[jornada][nombre] += 3;
    } else {
      const gr = real_l > real_v ? 'L' : real_v > real_l ? 'V' : 'E';
      const gp = pred_l > pred_v ? 'L' : pred_v > pred_l ? 'V' : 'E';
      if (gr === gp) jornadas[jornada][nombre] += 1;
    }
  }

  // Armar resultado: mejor por jornada
  const mejorPorJornada = [];
  Object.keys(jornadas).sort(function(a,b){return a-b;}).forEach(function(j) {
    const scores = jornadas[j];
    const nombres = Object.keys(scores);
    if (!nombres.length) return;
    nombres.sort(function(a,b){ return scores[b] - scores[a]; });
    const ganadores = nombres.filter(function(n){ return scores[n] === scores[nombres[0]]; });
    mejorPorJornada.push({
      jornada:   j,
      ganadores: ganadores,
      puntos:    scores[nombres[0]]
    });
  });

  // Racha actual del líder
  const hRan   = ss.getSheetByName(H_RANKING);
  const ranRows = hRan.getDataRange().getValues();
  const lider   = ranRows.length > 1 ? ranRows[1][1] : "";

  return {
    ok: true,
    mejorPorJornada,
    lider
  };
}

// ── FOTOS DE PERFIL ──────────────────────────────────────────

function subirFotoPerfil(data) {
  // data: { nombre, pin, fotoBase64, mimeType }
  try {
    // Verificar PIN primero
    const verify = verificarPin(data.nombre, data.pin);
    if (!verify.ok) return verify;

    // Crear carpeta FOTOS_PRODE en Drive si no existe
    const folders = DriveApp.getFoldersByName("FOTOS_PRODE_2026");
    let folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("FOTOS_PRODE_2026");
    }

    // Decodificar base64 y crear archivo
    const decoded  = Utilities.base64Decode(data.fotoBase64);
    const blob     = Utilities.newBlob(decoded, data.mimeType || "image/jpeg", data.nombre + "_foto.jpg");
    
    // Eliminar foto anterior si existe
    const archivos = folder.getFilesByName(data.nombre + "_foto.jpg");
    while (archivos.hasNext()) archivos.next().setTrashed(true);

    // Subir nueva foto
    const archivo  = folder.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId   = archivo.getId();
    const url      = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w300-h400";

    // Guardar URL como texto plano en hoja PARTICIPANTES
    const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
    const rows = h.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][1].toString().toLowerCase() === data.nombre.toLowerCase()) {
        const celda = h.getRange(i + 1, 8);
        celda.setNumberFormat("@"); // formato texto
        celda.setValue(url);        // guardar solo el link
        break;
      }
    }

    return { ok: true, url, mensaje: "Foto subida correctamente" };
  } catch(err) {
    return { ok: false, mensaje: "Error al subir foto: " + err.message };
  }
}

function getFotoPerfil(nombre) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      const valor = rows[i][7] ? rows[i][7].toString() : "";
      const url   = valor.startsWith('http') ? valor : "";
      return { ok: true, url };
    }
  }
  return { ok: false, url: "" };
}

// ── EDICIÓN DE PERFIL ────────────────────────────────────────

function editarPerfil(data) {
  // data: { nombre, pin, campo, valor_nuevo, pin_nuevo (opcional) }
  const verify = verificarPin(data.nombre, data.pin);
  if (!verify.ok) return verify;

  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() !== data.nombre.toLowerCase()) continue;

    if (data.campo === 'pin') {
      if (!data.pin_nuevo || isNaN(data.pin_nuevo)) {
        return { ok: false, mensaje: 'El PIN nuevo debe ser de 4 números.' };
      }
      const pinNuevo = String(data.pin_nuevo).padStart(4, '0');
      const celdaPin = h.getRange(i + 1, 3);
      celdaPin.setNumberFormat("@");
      celdaPin.setValue(pinNuevo);
      return { ok: true, mensaje: 'PIN actualizado correctamente.' };
    }

    if (data.campo === 'whatsapp') {
      h.getRange(i + 1, 4).setValue(data.valor_nuevo);
      return { ok: true, mensaje: 'WhatsApp actualizado correctamente.' };
    }

    if (data.campo === 'email') {
      h.getRange(i + 1, 5).setValue(data.valor_nuevo);
      return { ok: true, mensaje: 'Email actualizado correctamente.' };
    }

    return { ok: false, mensaje: 'Campo no reconocido.' };
  }
  return { ok: false, mensaje: 'Usuario no encontrado.' };
}

function getPerfil(nombre, pin) {
  const verify = verificarPin(nombre, pin);
  if (!verify.ok) return verify;

  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      return {
        ok:        true,
        nombre:    rows[i][1],
        whatsapp:  rows[i][3],
        email:     rows[i][4],
        foto_url:  rows[i][7] || ''
      };
    }
  }
  return { ok: false, mensaje: 'Usuario no encontrado.' };
}

function getPerfilPublico(nombre) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hPar = ss.getSheetByName(H_PARTICIPANTES);
  const hPro = ss.getSheetByName(H_PRONOSTICOS);
  const hRes = ss.getSheetByName(H_RESULTADOS);
  const hRan = ss.getSheetByName(H_RANKING);
  const hFix = ss.getSheetByName(H_FIXTURE);

  // Datos básicos del participante
  const parRows = hPar.getDataRange().getValues();
  let fotoUrl = '', fechaReg = '';
  for (let i = 1; i < parRows.length; i++) {
    if (parRows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      const valorFoto = parRows[i][7] ? parRows[i][7].toString() : "";
      fotoUrl = valorFoto.startsWith('http') ? valorFoto : '';
      fechaReg  = parRows[i][5] || '';
      break;
    }
  }

  // Posición y puntos del ranking
  const ranRows = hRan.getDataRange().getValues();
  let posicion = '—', puntos = 0, exactos = 0, aciertos = 0, pendientes = 0, movimiento = '=';
  for (let i = 1; i < ranRows.length; i++) {
    if (ranRows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      posicion    = ranRows[i][0];
      puntos      = ranRows[i][2] || 0;
      exactos     = ranRows[i][3] || 0;
      aciertos    = ranRows[i][4] || 0;
      pendientes  = ranRows[i][5] || 0;
      movimiento  = ranRows[i][6] || '=';
      break;
    }
  }

  // Pronósticos solo de partidos ya jugados
  const resultados = mapearResultados(hRes);
  const fixRows    = hFix.getDataRange().getValues();
  const fixMap     = {};
  for (let i = 1; i < fixRows.length; i++) {
    if (!fixRows[i][0]) continue;
    fixMap[fixRows[i][0].toString()] = {
      local:     fixRows[i][5],
      visitante: fixRows[i][6],
      estado:    fixRows[i][9],
      fecha:     fixRows[i][3]
    };
  }

  const proRows = hPro.getDataRange().getValues();
  const historial = [];
  const vistosPerf = new Set();
  for (let i = 1; i < proRows.length; i++) {
    if (proRows[i][1].toString().toLowerCase() !== nombre.toLowerCase()) continue;
    const pid = proRows[i][2].toString();
    if (vistosPerf.has(pid)) continue;
    vistosPerf.add(pid);
    const res = resultados[pid];
    const fix = fixMap[pid];
    if (!res || !fix) continue; // solo partidos jugados
    if (fix.estado !== 'FT') continue;

    const pred_l = parseInt(proRows[i][3]);
    const pred_v = parseInt(proRows[i][4]);
    const real_l = parseInt(res.gol_l);
    const real_v = parseInt(res.gol_v);

    let resultado = 'error';
    let ptsPartido = 0;
    if (pred_l === real_l && pred_v === real_v) {
      resultado = 'exacto'; ptsPartido = 3;
    } else {
      const gr = real_l > real_v ? 'L' : real_v > real_l ? 'V' : 'E';
      const gp = pred_l > pred_v ? 'L' : pred_v > pred_l ? 'V' : 'E';
      if (gr === gp) { resultado = '1x2'; ptsPartido = 1; }
    }

    historial.push({
      partido_id: pid,
      local:      fix.local,
      visitante:  fix.visitante,
      pred_l, pred_v, real_l, real_v,
      resultado,
      puntos: ptsPartido
    });
  }

  const errores = historial.filter(h => h.resultado === 'error').length;

  return {
    ok: true,
    nombre, fotoUrl, fechaReg,
    posicion, puntos, exactos, aciertos, pendientes, movimiento, errores,
    historial
  };
}

function verificarPin(nombre, pin) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();
  // Normalizar PIN: siempre 4 dígitos con cero a la izquierda
  const pinNorm = String(pin).padStart(4, '0');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      const pinGuardado = String(rows[i][2]).padStart(4, '0');
      if (pinGuardado === pinNorm) {
        return { ok: true, mensaje: "PIN correcto" };
      } else {
        return { ok: false, mensaje: "PIN incorrecto. Verificá los 4 números." };
      }
    }
  }
  return { ok: false, mensaje: "El nombre '" + nombre + "' no está registrado." };
}

function obtenerIdParticipante(nombre) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_PARTICIPANTES);
  const rows = h.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === nombre.toLowerCase()) return rows[i][0];
  }
  return -1;
}

// ── FIXTURE ───────────────────────────────────────────────────

function getFixture() {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  const rows = h.getDataRange().getValues();
  const partidos = [];

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    // Formatear fecha y hora correctamente
    var fechaVal = rows[i][3];
    var horaVal  = rows[i][4];
    var fechaStr = "";
    var horaStr  = "";

    if (fechaVal instanceof Date) {
      fechaStr = Utilities.formatDate(fechaVal, "America/Argentina/Buenos_Aires", "dd/MM/yyyy");
    } else {
      fechaStr = fechaVal ? fechaVal.toString() : "";
    }

    if (horaVal instanceof Date) {
      horaStr = Utilities.formatDate(horaVal, "America/Argentina/Buenos_Aires", "HH:mm");
    } else {
      horaStr = horaVal ? horaVal.toString().substring(0, 5) : "";
    }

    partidos.push({
      id:        rows[i][0],
      grupo:     rows[i][1],
      jornada:   rows[i][2],
      fecha:     fechaStr,
      hora:      horaStr,
      local:     rows[i][5],
      visitante: rows[i][6],
      gol_l:     rows[i][7],
      gol_v:     rows[i][8],
      estado:    rows[i][9]
    });
  }
  return { ok: true, partidos };
}

function cargarResultadoManual(data) {
  // data: { partido_id, gol_l, gol_v, final (opcional) }
  // Si final=true → marca FT y computa puntos. Si no → EN JUEGO, solo actualiza score.
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  const rows = h.getDataRange().getValues();
  const esFinal = data.final === true || data.final === "true";

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.partido_id.toString()) {
      h.getRange(i+1, 8).setValue(data.gol_l);
      h.getRange(i+1, 9).setValue(data.gol_v);
      h.getRange(i+1, 10).setValue(esFinal ? "FT" : "EN JUEGO");
      if (esFinal) {
        guardarResultadoEnHoja(data.partido_id, data.gol_l, data.gol_v, "MANUAL");
        recalcularRanking();
        return { ok: true, mensaje: "Partido finalizado y ranking actualizado." };
      }
      return { ok: true, mensaje: "Score actualizado (partido en juego)." };
    }
  }
  return { ok: false, mensaje: "Partido no encontrado." };
}

// Marca automáticamente los partidos que ya arrancaron como EN JUEGO con 0-0
function marcarPartidosEnJuego() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hf  = ss.getSheetByName(H_FIXTURE);
  const rows = hf.getDataRange().getValues();
  const ahora = new Date();

  // Hora actual en Argentina como string comparable "yyyyMMddHHmm"
  const ahoraStr = Utilities.formatDate(ahora, "America/Argentina/Buenos_Aires", "yyyyMMddHHmm");

  function partidoStr(fechaVal, horaVal) {
    try {
      const fechaStr = (fechaVal instanceof Date)
        ? Utilities.formatDate(fechaVal, "America/Argentina/Buenos_Aires", "dd/MM/yyyy")
        : fechaVal.toString();
      const horaStr = (horaVal instanceof Date)
        ? Utilities.formatDate(horaVal, "America/Argentina/Buenos_Aires", "HH:mm")
        : horaVal.toString().substring(0, 5);
      const p = fechaStr.split('/'), h = horaStr.split(':');
      // Formato comparable: yyyyMMddHHmm
      return p[2] + p[1].padStart(2,'0') + p[0].padStart(2,'0') + h[0].padStart(2,'0') + h[1].padStart(2,'0');
    } catch(e) { return null; }
  }

  for (let i = 1; i < rows.length; i++) {
    const estado = rows[i][9] ? rows[i][9].toString() : '';
    // Saltear solo estados que ya están en curso o finalizados
    const estadosIgnorar = ['EN JUEGO', 'FT', 'AET', 'PEN', '1H', '2H', 'HT', 'ET', 'AWD', 'WO'];
    if (estadosIgnorar.includes(estado)) continue;
    const inicio = partidoStr(rows[i][3], rows[i][4]);
    if (!inicio) continue;
    if (ahoraStr >= inicio) {
      hf.getRange(i+1, 8).setValue(0);
      hf.getRange(i+1, 9).setValue(0);
      hf.getRange(i+1, 10).setValue('EN JUEGO');
      Logger.log('Partido en juego: ' + rows[i][5] + ' vs ' + rows[i][6]);

      // Poner 0-0 en CARGA RESULTADOS — si no existe la fila, la crea
      const hc = ss.getSheetByName('CARGA RESULTADOS');
      if (hc) {
        const cRows = hc.getDataRange().getValues();
        const pid = rows[i][0].toString();
        let encontrado = false;
        for (let j = 1; j < cRows.length; j++) {
          if (cRows[j][0] && cRows[j][0].toString() === pid) {
            encontrado = true;
            const estadoCarga = cRows[j][8] ? cRows[j][8].toString() : '';
            if (estadoCarga !== 'FT') {
              hc.getRange(j+1, 5).setValue(0); // GOL_L
              hc.getRange(j+1, 7).setValue(0); // GOL_V
              hc.getRange(j+1, 9).setValue('EN JUEGO'); // ESTADO
              Logger.log('0-0 puesto en CARGA RESULTADOS: ' + rows[i][5] + ' vs ' + rows[i][6]);
            }
            break;
          }
        }
        if (!encontrado) {
          // La fila no existe → crearla automáticamente
          hc.appendRow([
            rows[i][0],  // PARTIDO_ID
            rows[i][3],  // FECHA
            rows[i][4],  // HORA
            rows[i][5],  // LOCAL
            0,           // GOL_L
            '-',
            0,           // GOL_V
            rows[i][6],  // VISITANTE
            'EN JUEGO',  // ESTADO
            false        // FINAL
          ]);
          Logger.log('Fila creada en CARGA RESULTADOS: ' + rows[i][5] + ' vs ' + rows[i][6]);
        }
      }
    }
  }

  // Procesar resultados cargados en la hoja CARGA RESULTADOS (silencioso)
  try {
    const res = _procesarCargaCore();
    if (res.procesados > 0) Logger.log('✅ Carga resultados: ' + res.procesados + ' partido(s) procesado(s).');
    if (res.errores.length)  Logger.log('⚠️ Errores: ' + res.errores.join(', '));
  } catch(e) {
    Logger.log('Error al procesar CARGA RESULTADOS: ' + e.message);
  }
}

// ── API FOOTBALL — ACTUALIZACIÓN AUTOMÁTICA ───────────────────

function actualizarResultadosDesdeAPI() {
  if (!API_FOOTBALL_KEY || API_FOOTBALL_KEY === "TU_CLAVE_AQUI") {
    Logger.log("⚠️ Configurá tu API_FOOTBALL_KEY para activar la actualización automática.");
    return;
  }

  const url = API_FOOTBALL_URL + "/fixtures?league=" + MUNDIAL_2026_ID + "&season=" + TEMPORADA + "&status=FT";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key":  API_FOOTBALL_KEY,
      "x-rapidapi-host": "v3.football.api-sports.io"
    },
    muteHttpExceptions: true
  };

  try {
    const resp   = UrlFetchApp.fetch(url, options);
    const json   = JSON.parse(resp.getContentText());
    const fixtures = json.response || [];

    Logger.log("API: " + fixtures.length + " partidos finalizados encontrados.");

    fixtures.forEach(function(f) {
      const id    = f.fixture.id;
      const gol_l = f.goals.home;
      const gol_v = f.goals.away;

      // Buscar por ID de API en fixture (columna A debe tener el ID de api-football)
      actualizarFilaFixture(id, gol_l, gol_v);
      guardarResultadoEnHoja(id, gol_l, gol_v, "API");
    });

    recalcularRanking();
    Logger.log("✅ Resultados actualizados y ranking recalculado.");

  } catch(err) {
    Logger.log("❌ Error al consultar API: " + err.message);
  }
}

function cargarFixtureDesdeAPI() {
  // Carga el fixture completo del Mundial 2026 desde la API (ejecutar una vez)
  if (API_FOOTBALL_KEY === "TU_CLAVE_AQUI") {
    SpreadsheetApp.getUi().alert("Primero configurá tu API_FOOTBALL_KEY en el script.");
    return;
  }

  const url = API_FOOTBALL_URL + "/fixtures?league=" + MUNDIAL_2026_ID + "&season=" + TEMPORADA;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key":  API_FOOTBALL_KEY,
      "x-rapidapi-host": "v3.football.api-sports.io"
    }
  };

  const resp     = UrlFetchApp.fetch(url, options);
  const json     = JSON.parse(resp.getContentText());
  const fixtures = json.response || [];

  const h  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  h.clearContents();
  h.getRange(1,1,1,10).setValues([["PARTIDO_ID","GRUPO","JORNADA","FECHA","HORA","LOCAL","VISITANTE","GOL_L","GOL_V","ESTADO"]]);
  formatearEncabezado(h, 1, 10);

  const filas = fixtures.map(function(f, idx) {
    const fecha = new Date(f.fixture.date);
    const tz    = "America/Argentina/Buenos_Aires";
    return [
      f.fixture.id,
      f.league.round || "Grupo",
      idx + 1,
      Utilities.formatDate(fecha, tz, "dd/MM/yyyy"),
      Utilities.formatDate(fecha, tz, "HH:mm"),
      f.teams.home.name,
      f.teams.away.name,
      "",
      "",
      f.fixture.status.short
    ];
  });

  if (filas.length > 0) h.getRange(2, 1, filas.length, 10).setValues(filas);
  SpreadsheetApp.getUi().alert("✅ " + filas.length + " partidos cargados desde la API.");
}

function actualizarFilaFixture(partidoId, gol_l, gol_v) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  const rows = h.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === partidoId.toString()) {
      h.getRange(i+1, 8).setValue(gol_l);
      h.getRange(i+1, 9).setValue(gol_v);
      h.getRange(i+1, 10).setValue("FT");
      return;
    }
  }
}

function guardarResultadoEnHoja(partidoId, gol_l, gol_v, fuente) {
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_RESULTADOS);
  const rows = h.getDataRange().getValues();
  const ganador = gol_l > gol_v ? "LOCAL" : gol_v > gol_l ? "VISITANTE" : "EMPATE";
  const ahora   = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === partidoId.toString()) {
      h.getRange(i+1, 2).setValue(gol_l);
      h.getRange(i+1, 3).setValue(gol_v);
      h.getRange(i+1, 4).setValue(ganador);
      h.getRange(i+1, 5).setValue(ahora);
      h.getRange(i+1, 6).setValue(fuente);
      return;
    }
  }
  h.appendRow([partidoId, gol_l, gol_v, ganador, ahora, fuente]);
}

// ── CÁLCULO DE RANKING ────────────────────────────────────────

function recalcularRanking() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hPro = ss.getSheetByName(H_PRONOSTICOS);
  const hRes = ss.getSheetByName(H_RESULTADOS);
  const hPar = ss.getSheetByName(H_PARTICIPANTES);
  const hRan = ss.getSheetByName(H_RANKING);

  const resultados    = mapearResultados(hRes);
  const participantes = getParticipantes().participantes;
  const pronRows      = hPro.getDataRange().getValues();

  const scores = {}; // { nombreLower: { display, puntos, exactos, aciertos, pendientes } }

  participantes.forEach(function(p) {
    scores[p.nombre.toLowerCase()] = { display: p.nombre, puntos:0, exactos:0, aciertos:0, pendientes:0, errores:0 };
  });

  // Recorrer todos los pronósticos (ignorar duplicados nombre+partido)
  const vistos = new Set();
  for (let i = 1; i < pronRows.length; i++) {
    const nombreRaw = pronRows[i][1] ? pronRows[i][1].toString() : '';
    const nombre    = nombreRaw.toLowerCase();
    const partidoId = pronRows[i][2].toString();
    const pred_l    = parseInt(pronRows[i][3]);
    const pred_v    = parseInt(pronRows[i][4]);

    if (!scores[nombre]) continue;

    const clave = nombre + '|' + partidoId;
    if (vistos.has(clave)) continue; // duplicado, ignorar
    vistos.add(clave);

    const res = resultados[partidoId];
    if (!res) {
      scores[nombre].pendientes++;
      continue;
    }

    const real_l = parseInt(res.gol_l);
    const real_v = parseInt(res.gol_v);

    if (pred_l === real_l && pred_v === real_v) {
      // Resultado exacto
      scores[nombre].puntos  += PUNTOS_EXACTO;
      scores[nombre].exactos++;
    } else {
      // Verificar si acertó 1X2
      const pred_ganador = pred_l > pred_v ? "LOCAL" : pred_v > pred_l ? "VISITANTE" : "EMPATE";
      const real_ganador = real_l > real_v ? "LOCAL" : real_v > real_l ? "VISITANTE" : "EMPATE";
      if (pred_ganador === real_ganador) {
        scores[nombre].puntos   += PUNTOS_1X2;
        scores[nombre].aciertos++;
      } else {
        scores[nombre].errores++;
      }
    }
  }

  // Guardar posiciones anteriores antes de actualizar
  const posAnteriores = {};
  const rowsActuales = hRan.getDataRange().getValues();
  for (let i = 1; i < rowsActuales.length; i++) {
    if (rowsActuales[i][1]) {
      posAnteriores[rowsActuales[i][1].toString().toLowerCase()] = rowsActuales[i][0];
    }
  }

  // Ordenar por puntos desc (usar nombre display, no la key lowercase)
  const ranking = Object.keys(scores).map(function(n) {
    return { nombre: scores[n].display, ...scores[n] };
  }).sort(function(a,b) { return b.puntos - a.puntos; });

  // Escribir en hoja RANKING
  hRan.clearContents();
  hRan.getRange(1,1,1,10).setValues([["POSICION","NOMBRE","PUNTOS","EXACTOS","ACIERTOS_1X2","PENDIENTES","RACHA","ULTIMA_ACT","FOTO_URL","ERRORES"]]);
  formatearEncabezado(hRan, 1, 10);

  const ahora = Utilities.formatDate(new Date(), "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm");
  // Obtener fotos de participantes
  const hParFotos = ss.getSheetByName(H_PARTICIPANTES);
  const parRows   = hParFotos.getDataRange().getValues();
  const fotoMap   = {};
  for (let i = 1; i < parRows.length; i++) {
    fotoMap[parRows[i][1]] = parRows[i][7] || "";
  }

  const filas = ranking.map(function(r, idx) {
    const posActual  = idx + 1;
    const posAnterior = posAnteriores[r.nombre.toLowerCase()] || posActual;
    var movimiento = "—";
    if (posAnterior > posActual) movimiento = "↑" + (posAnterior - posActual);
    else if (posAnterior < posActual) movimiento = "↓" + (posActual - posAnterior);
    return [posActual, r.nombre, r.puntos, r.exactos, r.aciertos, r.pendientes, movimiento, ahora, fotoMap[r.nombre]||"", r.errores];
  });

  if (filas.length > 0) hRan.getRange(2, 1, filas.length, 10).setValues(filas);
  Logger.log("🏆 Ranking actualizado: " + filas.length + " participantes.");
}

function mapearResultados(hoja) {
  const rows = hoja.getDataRange().getValues();
  const map  = {};
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    map[rows[i][0].toString()] = {
      gol_l:   rows[i][1],
      gol_v:   rows[i][2],
      ganador: rows[i][3]
    };
  }
  return map;
}

function getRanking() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const hRan  = ss.getSheetByName(H_RANKING);
  const hPar  = ss.getSheetByName(H_PARTICIPANTES);
  const rowsR = hRan.getDataRange().getValues();
  const rowsP = hPar.getDataRange().getValues();
  const ranking = [];
  const nombresEnRanking = [];

  // Primero cargar los que ya tienen puntos en el ranking
  for (let i = 1; i < rowsR.length; i++) {
    if (!rowsR[i][0]) continue;
    nombresEnRanking.push(rowsR[i][1].toString().toLowerCase());
    ranking.push({
      posicion:     rowsR[i][0],
      nombre:       rowsR[i][1],
      puntos:       rowsR[i][2] || 0,
      exactos:      rowsR[i][3] || 0,
      aciertos_1x2: rowsR[i][4] || 0,
      pendientes:   rowsR[i][5] || 0,
      movimiento:   rowsR[i][6] || "=",
      ultima_act:   rowsR[i][7] || "",
      foto_url:     rowsR[i][8] || "",
      errores:      rowsR[i][9] || 0
    });
  }

  // Agregar participantes registrados que aún no tienen puntos
  for (let i = 1; i < rowsP.length; i++) {
    if (!rowsP[i][1]) continue;
    if (rowsP[i][6] !== true && rowsP[i][6] !== "TRUE") continue;
    const nombre = rowsP[i][1].toString();
    if (nombresEnRanking.indexOf(nombre.toLowerCase()) === -1) {
      ranking.push({
        posicion:     ranking.length + 1,
        nombre:       nombre,
        puntos:       0,
        exactos:      0,
        aciertos_1x2: 0,
        pendientes:   104,
        ultima_act:   "",
        foto_url:     rowsP[i][7] || "",
        errores:      0
      });
    }
  }

  // Ordenar por puntos desc
  ranking.sort(function(a, b) { return b.puntos - a.puntos; });
  ranking.forEach(function(r, i) { r.posicion = i + 1; });

  return { ok: true, ranking };
}

// ── TRIGGERS AUTOMÁTICOS ──────────────────────────────────────

function configurarTriggers() {
  // Eliminar triggers existentes para evitar duplicados
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Marcar partidos en juego cada 1 minuto
  ScriptApp.newTrigger("marcarPartidosEnJuego")
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log("✅ Trigger configurado: marcarPartidosEnJuego cada 1min");
  try {
    SpreadsheetApp.getUi().alert("✅ Trigger activado:\n• Marcar partidos EN JUEGO: cada 1 minuto");
  } catch(e) {
    Logger.log("✅ Trigger activado: marcarPartidosEnJuego cada 1min");
  }
}

function eliminarTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log("Todos los triggers eliminados.");
}

// ── SINCRONIZAR IDs DE FIXTURE CON API ───────────────────────
// Cruza equipos LOCAL/VISITANTE con la API y actualiza solo la col A del FIXTURE.
// Los pronósticos NO se tocan pero sus partido_id quedan desactualizados —
// después de correr esta función hay que correr migrarPronosticosIDs().
function sincronizarIDsConAPI() {
  // Traducción español → inglés para matchear con la API
  const TRADUCCION = {
    "méxico": "mexico", "mxico": "mexico",
    "corea del sur": "south korea",
    "república checa": "czech republic", "repblica checa": "czech republic",
    "países bajos": "netherlands", "pases bajos": "netherlands",
    "alemania": "germany",
    "francia": "france",
    "españa": "spain", "espaa": "spain",
    "bélgica": "belgium", "blgica": "belgium",
    "suecia": "sweden",
    "suiza": "switzerland",
    "dinamarca": "denmark",
    "rumania": "romania",
    "polonia": "poland",
    "austria": "austria",
    "noruega": "norway",
    "escocia": "scotland",
    "turquía": "turkey", "turqua": "turkey",
    "japón": "japan", "japn": "japan",
    "irán": "iran", "irn": "iran",
    "egipto": "egypt",
    "marruecos": "morocco",
    "argelia": "algeria",
    "senegal": "senegal",
    "ghana": "ghana",
    "haití": "haiti", "hait": "haiti",
    "arabia saudita": "saudi arabia",
    "emiratos árabes": "uae", "emiratos rabes": "uae",
    "estados unidos": "usa",
    "costa de marfil": "ivory coast",
    "rep. dem. congo": "dr congo",
    "cabo verde": "cape verde",
    "nueva zelanda": "new zealand",
    "países bajos": "netherlands",
    "curazao": "curacao",
    "jordania": "jordan",
    "uzbekistán": "uzbekistan", "uzbekistn": "uzbekistan",
    "colombia": "colombia",
    "argentina": "argentina",
    "brasil": "brazil",
    "portugal": "portugal",
    "croacia": "croatia",
    "panamá": "panama", "panam": "panama",
    "paraguay": "paraguay",
    "uruguay": "uruguay",
    "canadá": "canada", "canad": "canada",
    "australia": "australia",
    "inglaterra": "england",
    "bosnia": "bosnia",
    "qatar": "qatar",
    "irak": "iraq",
    "túnez": "tunisia", "tinez": "tunisia", "tnez": "tunisia",
    "ecuador": "ecuador",
    "sudáfrica": "south africa", "sudfrica": "south africa"
  };

  function quitarAcentos(s) {
    return s.replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
            .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/[ñ]/g,'n');
  }
  function norm(s) {
    const lower = s.toString().toLowerCase().trim();
    const sinAcento = quitarAcentos(lower);
    return TRADUCCION[lower] || TRADUCCION[sinAcento] || sinAcento;
  }

  const url = API_FOOTBALL_URL + "/fixtures?league=" + MUNDIAL_2026_ID + "&season=" + TEMPORADA;
  const resp = UrlFetchApp.fetch(url, {
    headers: {
      "x-rapidapi-key":  API_FOOTBALL_KEY,
      "x-rapidapi-host": "v3.football.api-sports.io"
    },
    muteHttpExceptions: true
  });
  const apiFixtures = JSON.parse(resp.getContentText()).response || [];

  // Mapa: "local|visitante" (en inglés normalizado) → id de API
  const apiMap = {};
  apiFixtures.forEach(function(f) {
    const key = norm(f.teams.home.name) + '|' + norm(f.teams.away.name);
    apiMap[key] = f.fixture.id;
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hf = ss.getSheetByName(H_FIXTURE);
  const rows = hf.getDataRange().getValues();

  let actualizados = 0, noEncontrados = [];

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][5]) continue; // saltar filas vacías o eliminatorias
    const local     = norm(rows[i][5]);
    const visitante = norm(rows[i][6]);
    // Saltar partidos de eliminatorias (tienen "Ganador", "1ro", etc.)
    if (local.includes("ganador") || local.includes("1ro") || local.includes("2do") ||
        local.includes("3ro") || local.includes("perdedor")) continue;
    const key = local + '|' + visitante;
    if (apiMap[key]) {
      hf.getRange(i + 1, 1).setValue(apiMap[key]);
      actualizados++;
    } else {
      noEncontrados.push(rows[i][5] + ' vs ' + rows[i][6] + '  [norm: ' + local + ' | ' + visitante + ']');
    }
  }

  const msg = "✅ IDs actualizados: " + actualizados + "\n" +
    (noEncontrados.length ? "⚠️ No encontrados (" + noEncontrados.length + "):\n" + noEncontrados.join("\n") : "");
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(e) { Logger.log("(corré desde el menú para ver el alert)"); }
}

// Después de sincronizarIDsConAPI(), corré esta función para actualizar
// los partido_id en PRONÓSTICOS con los nuevos IDs de la API.
function migrarPronosticosIDs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hf = ss.getSheetByName(H_FIXTURE);
  const hp = ss.getSheetByName(H_PRONOSTICOS);

  // Construir mapa viejo ID → nuevo ID desde el fixture
  // (el fixture ya tiene los nuevos IDs en col A, guardamos el orden original)
  // En realidad necesitamos: índice de fila → nuevo ID
  // Pero los pronósticos tienen el ID viejo (1,2,3...).
  // Solución: el fixture original tenía IDs 1,2,3... en orden de fila.
  // Fila 2 = partido 1, Fila 3 = partido 2, etc.
  const fixRows = hf.getDataRange().getValues();
  const mapaViejo = {}; // { filaIndex: nuevoId }
  for (let i = 1; i < fixRows.length; i++) {
    mapaViejo[i] = fixRows[i][0]; // nuevo ID (ya sincronizado)
  }

  // Los pronósticos tienen partido_id = 1,2,3... (índice de fila en fixture)
  const pronRows = hp.getDataRange().getValues();
  let migrados = 0;
  for (let i = 1; i < pronRows.length; i++) {
    const viejoId = parseInt(pronRows[i][2]);
    if (!viejoId || !mapaViejo[viejoId]) continue;
    hp.getRange(i + 1, 3).setValue(mapaViejo[viejoId]);
    migrados++;
  }

  const msg = "✅ Pronósticos migrados: " + migrados;
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

function debugNombresAPI() {
  const url = API_FOOTBALL_URL + "/fixtures?league=" + MUNDIAL_2026_ID + "&season=" + TEMPORADA;
  const resp = UrlFetchApp.fetch(url, {
    headers: { "x-rapidapi-key": API_FOOTBALL_KEY, "x-rapidapi-host": "v3.football.api-sports.io" },
    muteHttpExceptions: true
  });
  const raw = resp.getContentText();
  const json = JSON.parse(raw);
  Logger.log("HTTP status: " + resp.getResponseCode());
  Logger.log("errors: " + JSON.stringify(json.errors));
  Logger.log("results: " + json.results);
  Logger.log("respuesta (primeros 500 chars): " + raw.substring(0, 500));

  const fixtures = json.response || [];
  fixtures.slice(0, 5).forEach(function(f) {
    Logger.log("API: '" + f.teams.home.name + "' vs '" + f.teams.away.name + "'");
  });
}

// ── FIXTURE BASE (demo hasta tener la API) ────────────────────

function getFixtureBase() {
  // Fixture oficial Mundial 2026 — horarios hora Argentina
  return [
    // GRUPO A
    [1,"A",1,"11/06/2026","16:00","México","Sudáfrica","","","NS"],
    [2,"A",1,"11/06/2026","23:00","Corea del Sur","República Checa","","","NS"],
    [3,"A",2,"18/06/2026","13:00","República Checa","Sudáfrica","","","NS"],
    [4,"A",2,"18/06/2026","22:00","México","Corea del Sur","","","NS"],
    [5,"A",3,"24/06/2026","22:00","República Checa","México","","","NS"],
    [6,"A",3,"24/06/2026","22:00","Sudáfrica","Corea del Sur","","","NS"],
    // GRUPO B
    [7,"B",1,"12/06/2026","16:00","Canadá","Bosnia","","","NS"],
    [8,"B",1,"13/06/2026","16:00","Qatar","Suiza","","","NS"],
    [9,"B",2,"18/06/2026","16:00","Suiza","Bosnia","","","NS"],
    [10,"B",2,"18/06/2026","19:00","Canadá","Qatar","","","NS"],
    [11,"B",3,"24/06/2026","16:00","Suiza","Canadá","","","NS"],
    [12,"B",3,"24/06/2026","16:00","Bosnia","Qatar","","","NS"],
    // GRUPO C
    [13,"C",1,"13/06/2026","19:00","Brasil","Marruecos","","","NS"],
    [14,"C",1,"13/06/2026","22:00","Haití","Escocia","","","NS"],
    [15,"C",2,"19/06/2026","19:00","Escocia","Marruecos","","","NS"],
    [16,"C",2,"19/06/2026","22:00","Brasil","Haití","","","NS"],
    [17,"C",3,"24/06/2026","19:00","Escocia","Brasil","","","NS"],
    [18,"C",3,"24/06/2026","19:00","Marruecos","Haití","","","NS"],
    // GRUPO D
    [19,"D",1,"12/06/2026","22:00","Estados Unidos","Paraguay","","","NS"],
    [20,"D",1,"14/06/2026","01:00","Australia","Turquía","","","NS"],
    [21,"D",2,"19/06/2026","16:00","Estados Unidos","Australia","","","NS"],
    [22,"D",2,"20/06/2026","01:00","Turquía","Paraguay","","","NS"],
    [23,"D",3,"25/06/2026","23:00","Turquía","Estados Unidos","","","NS"],
    [24,"D",3,"25/06/2026","23:00","Paraguay","Australia","","","NS"],
  ];
}

// ── MENÚ ─────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚽ Prode 2026')
    .addItem('📋 Abrir hoja Carga Resultados', 'abrirHojaCargaResultados')
    .addItem('💾 Procesar resultados cargados', 'procesarCargaResultados')
    .addItem('🏆 Recalcular ranking', 'recalcularRankingUI')
    .addSeparator()
    .addItem('⏱️ Activar triggers automáticos', 'configurarTriggers')
    .addItem('🗑️ Eliminar triggers', 'eliminarTriggers')
    .addToUi();
}

function cargarResultadoUI() {
  const hf   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  const rows = hf.getDataRange().getValues();

  // Armar filas HTML de partidos no finalizados
  let filas = '';
  for (let i = 1; i < rows.length; i++) {
    const estado = rows[i][9] ? rows[i][9].toString() : '';
    if (estado === 'FT') continue; // ya jugado
    const id    = rows[i][0];
    const local = rows[i][5];
    const visit = rows[i][6];
    const fecha = rows[i][3];
    const hora  = rows[i][4];
    const glL   = rows[i][7] !== '' ? rows[i][7] : '';
    const glV   = rows[i][8] !== '' ? rows[i][8] : '';
    filas += '<tr>' +
      '<td style="padding:6px 8px;color:#aaa;font-size:12px">' + fecha + ' ' + hora + 'hs</td>' +
      '<td style="padding:6px 8px;text-align:right;font-weight:600">' + local + '</td>' +
      '<td style="padding:4px;text-align:center"><input type="number" min="0" max="30" value="' + glL + '" id="gl_' + id + '" style="width:42px;text-align:center;background:#1a1d24;border:1px solid #444;color:#fff;border-radius:4px;padding:4px"></td>' +
      '<td style="padding:4px 2px;text-align:center;color:#888">-</td>' +
      '<td style="padding:4px;text-align:center"><input type="number" min="0" max="30" value="' + glV + '" id="gv_' + id + '" style="width:42px;text-align:center;background:#1a1d24;border:1px solid #444;color:#fff;border-radius:4px;padding:4px"></td>' +
      '<td style="padding:6px 8px;font-weight:600">' + visit + '</td>' +
      '<td style="padding:4px;text-align:center"><input type="checkbox" id="ok_' + id + '" title="Marcar para guardar"></td>' +
      '</tr>';
  }

  const html = HtmlService.createHtmlOutput(`
    <style>body{font-family:Arial,sans-serif;background:#0e1420;color:#f0f0ec;margin:0;padding:12px}
    table{width:100%;border-collapse:collapse}tr:hover{background:rgba(255,255,255,.04)}
    th{background:#1a1d24;padding:8px;font-size:11px;color:#888;text-transform:uppercase}
    button{background:#b8f73c;color:#0a0b0d;border:none;padding:10px 24px;border-radius:999px;font-weight:700;cursor:pointer;font-size:14px;margin-top:12px}
    </style>
    <p style="color:#888;font-size:12px;margin-bottom:8px">✅ Marcá los partidos que querés guardar y hacé click en Guardar.</p>
    <table><thead><tr>
      <th>Fecha</th><th>Local</th><th colspan="3">Resultado</th><th>Visitante</th><th>✓</th>
    </tr></thead><tbody>` + filas + `</tbody></table>
    <button onclick="guardar()">💾 Guardar marcados</button>
    <div id="msg" style="margin-top:8px;color:#b8f73c;font-size:13px"></div>
    <script>
    function guardar(){
      const checks = document.querySelectorAll('input[type=checkbox]:checked');
      if(!checks.length){document.getElementById('msg').textContent='No marcaste ningún partido.';return;}
      const partidos = [];
      checks.forEach(c=>{
        const id = c.id.replace('ok_','');
        const gl = document.getElementById('gl_'+id).value;
        const gv = document.getElementById('gv_'+id).value;
        if(gl===''||gv===''){return;}
        partidos.push({partido_id:id, gol_l:parseInt(gl), gol_v:parseInt(gv)});
      });
      document.getElementById('msg').textContent = 'Guardando '+partidos.length+' resultado(s)...';
      google.script.run
        .withSuccessHandler(r=>{document.getElementById('msg').textContent=r;})
        .withFailureHandler(e=>{document.getElementById('msg').textContent='Error: '+e.message;})
        .guardarResultadosDesdeUI(partidos);
    }
    </script>`)
    .setWidth(680).setHeight(500);

  SpreadsheetApp.getUi().showModalDialog(html, '⚽ Cargar resultados');
}

function guardarResultadosDesdeUI(partidos) {
  let ok = 0, err = [];
  partidos.forEach(function(p) {
    const r = cargarResultadoManual(p);
    if (r.ok) ok++; else err.push(r.mensaje);
  });
  recalcularRanking();
  return '✅ ' + ok + ' resultado(s) guardado(s).' + (err.length ? ' Errores: ' + err.join(', ') : '');
}

function recalcularRankingUI() {
  recalcularRanking();
  SpreadsheetApp.getUi().alert('✅ Ranking actualizado correctamente.');
}

function abrirHojaCargaResultados() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hf  = ss.getSheetByName(H_FIXTURE);
  const nombre = 'CARGA RESULTADOS';

  // Crear o limpiar la hoja
  let hc = ss.getSheetByName(nombre);
  if (!hc) hc = ss.insertSheet(nombre);
  else hc.clearContents();

  // Encabezado
  const header = [['PARTIDO_ID','FECHA','HORA','LOCAL','GOL_L','','GOL_V','VISITANTE','ESTADO','FINAL']];
  hc.getRange(1,1,1,10).setValues(header);
  formatearEncabezado(hc, 1, 10);

  // Llenar con todos los partidos del fixture
  const fixRows = hf.getDataRange().getValues();
  const datos = [];
  for (let i = 1; i < fixRows.length; i++) {
    if (!fixRows[i][0]) continue;
    const estado = fixRows[i][9] ? fixRows[i][9].toString() : 'NS';
    const esFT = estado === 'FT';
    datos.push([
      fixRows[i][0],   // PARTIDO_ID
      fixRows[i][3],   // FECHA
      fixRows[i][4],   // HORA
      fixRows[i][5],   // LOCAL
      fixRows[i][7] !== '' ? fixRows[i][7] : '', // GOL_L
      '-',
      fixRows[i][8] !== '' ? fixRows[i][8] : '', // GOL_V
      fixRows[i][6],   // VISITANTE
      estado,
      esFT             // FINAL (checkbox, true si ya es FT)
    ]);
  }

  if (datos.length > 0) {
    hc.getRange(2, 1, datos.length, 10).setValues(datos);
    // Columna FINAL como checkbox
    const rngFinal = hc.getRange(2, 10, datos.length, 1);
    rngFinal.setDataValidation(
      SpreadsheetApp.newDataValidation().requireCheckbox().build()
    );
  }

  // Formato visual
  hc.setColumnWidth(1, 90);
  hc.setColumnWidth(2, 100);
  hc.setColumnWidth(3, 70);
  hc.setColumnWidth(4, 160);
  hc.setColumnWidth(5, 60);
  hc.setColumnWidth(6, 30);
  hc.setColumnWidth(7, 60);
  hc.setColumnWidth(8, 160);
  hc.setColumnWidth(9, 80);
  hc.setColumnWidth(10, 70);

  // Resaltar columnas GOL_L y GOL_V
  if (datos.length > 0) {
    hc.getRange(2, 5, datos.length, 1).setBackground('#1e3a1e').setFontWeight('bold').setHorizontalAlignment('center');
    hc.getRange(2, 7, datos.length, 1).setBackground('#1e3a1e').setFontWeight('bold').setHorizontalAlignment('center');
    hc.getRange(2, 6, datos.length, 1).setHorizontalAlignment('center').setFontColor('#888888');
    hc.getRange(2, 10, datos.length, 1).setHorizontalAlignment('center');
  }

  // Ir a la hoja
  ss.setActiveSheet(hc);
  SpreadsheetApp.getUi().alert('✅ Hoja lista.\n• Ingresá los goles en GOL_L y GOL_V.\n• Tildá FINAL ✓ cuando el partido terminó.\n• Usá "Procesar resultados cargados" del menú.');
}

// Núcleo sin UI — usado tanto por el trigger como por el menú manual
function _procesarCargaCore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hc = ss.getSheetByName('CARGA RESULTADOS');
  if (!hc) return { procesados: 0, errores: [] };

  const rows = hc.getDataRange().getValues();
  let procesados = 0, errores = [], huboFinal = false;

  for (let i = 1; i < rows.length; i++) {
    const id      = rows[i][0];
    const glL     = rows[i][4];
    const glV     = rows[i][6];
    const estado  = rows[i][8] ? rows[i][8].toString() : '';
    const esFinal = rows[i][9] === true || rows[i][9] === 'TRUE';

    if (!id || glL === '' || glV === '') continue; // sin resultado cargado
    if (estado === 'FT') continue;                 // ya finalizado, no tocar

    const r = cargarResultadoManual({
      partido_id: id.toString(),
      gol_l: parseInt(glL),
      gol_v: parseInt(glV),
      final: esFinal
    });

    if (r.ok) {
      hc.getRange(i + 1, 9).setValue(esFinal ? 'FT' : 'EN JUEGO');
      procesados++;
      if (esFinal) huboFinal = true;
    } else {
      errores.push('Partido ' + id + ': ' + r.mensaje);
    }
  }

  if (huboFinal) recalcularRanking();

  return { procesados, errores };
}

// Llamado desde el menú — muestra alerta con resultado
function procesarCargaResultados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName('CARGA RESULTADOS')) {
    SpreadsheetApp.getUi().alert('❌ Primero abrí la hoja desde el menú.');
    return;
  }
  const { procesados, errores } = _procesarCargaCore();
  const msg = '✅ ' + procesados + ' partido(s) actualizado(s).\n' +
    '(Solo los tildados como FINAL computan puntos)' +
    (errores.length ? '\n⚠️ ' + errores.join('\n') : '');
  SpreadsheetApp.getUi().alert(msg);
}
