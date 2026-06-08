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

  h.getRange(1,1,1,8).setValues([[
    "POSICION","NOMBRE","PUNTOS","EXACTOS","ACIERTOS_1X2","PENDIENTES","RACHA","ULTIMA_ACT"
  ]]);
  formatearEncabezado(h, 1, 8);
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
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const hp  = ss.getSheetByName(H_PRONOSTICOS);
  const hf  = ss.getSheetByName(H_FIXTURE);

  // Verificar que el partido no haya comenzado (búsqueda directa, sin cargar todo el fixture)
  const fixRows = hf.getDataRange().getValues();
  let estadoPartido = null;
  for (let i = 1; i < fixRows.length; i++) {
    if (fixRows[i][0].toString() === data.partido_id.toString()) {
      estadoPartido = fixRows[i][9];
      break;
    }
  }
  if (estadoPartido === null) return { ok: false, mensaje: "Partido no encontrado." };
  if (estadoPartido !== "NS" && estadoPartido !== "PENDIENTE") {
    return { ok: false, mensaje: "El partido ya comenzó. No podés modificar este pronóstico." };
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

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toString().toLowerCase() === nombre.toLowerCase()) {
      result.push({
        partido_id: rows[i][2],
        gol_l:      rows[i][3],
        gol_v:      rows[i][4],
        bloqueado:  rows[i][6]
      });
    }
  }
  return { ok: true, nombre, pronosticos: result };
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

  for (let i = 1; i < pronRows.length; i++) {
    const nombre    = pronRows[i][1];
    const partidoId = pronRows[i][2].toString();
    const pred_l    = parseInt(pronRows[i][3]);
    const pred_v    = parseInt(pronRows[i][4]);
    const res       = resultados[partidoId];
    if (!res) continue;

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
  for (let i = 1; i < proRows.length; i++) {
    if (proRows[i][1].toString().toLowerCase() !== nombre.toLowerCase()) continue;
    const pid = proRows[i][2].toString();
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
  // data: { partido_id, gol_l, gol_v } — para uso interno/admin
  const h    = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(H_FIXTURE);
  const rows = h.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.partido_id.toString()) {
      h.getRange(i+1, 8).setValue(data.gol_l);
      h.getRange(i+1, 9).setValue(data.gol_v);
      h.getRange(i+1, 10).setValue("FT");
      guardarResultadoEnHoja(data.partido_id, data.gol_l, data.gol_v, "MANUAL");
      recalcularRanking();
      return { ok: true, mensaje: "Resultado cargado y ranking actualizado." };
    }
  }
  return { ok: false, mensaje: "Partido no encontrado." };
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

  const scores = {}; // { nombre: { puntos, exactos, aciertos, pendientes } }

  participantes.forEach(function(p) {
    scores[p.nombre] = { puntos:0, exactos:0, aciertos:0, pendientes:0 };
  });

  // Recorrer todos los pronósticos
  for (let i = 1; i < pronRows.length; i++) {
    const nombre    = pronRows[i][1];
    const partidoId = pronRows[i][2].toString();
    const pred_l    = parseInt(pronRows[i][3]);
    const pred_v    = parseInt(pronRows[i][4]);

    if (!scores[nombre]) continue;

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
      }
    }
  }

  // Guardar posiciones anteriores antes de actualizar
  const posAnteriores = {};
  const rowsActuales = hRan.getDataRange().getValues();
  for (let i = 1; i < rowsActuales.length; i++) {
    if (rowsActuales[i][1]) {
      posAnteriores[rowsActuales[i][1].toString()] = rowsActuales[i][0];
    }
  }

  // Ordenar por puntos desc
  const ranking = Object.keys(scores).map(function(n) {
    return { nombre: n, ...scores[n] };
  }).sort(function(a,b) { return b.puntos - a.puntos; });

  // Escribir en hoja RANKING
  hRan.clearContents();
  hRan.getRange(1,1,1,9).setValues([["POSICION","NOMBRE","PUNTOS","EXACTOS","ACIERTOS_1X2","PENDIENTES","RACHA","ULTIMA_ACT","FOTO_URL"]]);
  formatearEncabezado(hRan, 1, 9);

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
    const posAnterior = posAnteriores[r.nombre] || posActual;
    var movimiento = "=";
    if (posAnterior > posActual) movimiento = "↑" + (posAnterior - posActual);
    else if (posAnterior < posActual) movimiento = "↓" + (posActual - posAnterior);
    return [posActual, r.nombre, r.puntos, r.exactos, r.aciertos, r.pendientes, movimiento, ahora, fotoMap[r.nombre]||""];
  });

  if (filas.length > 0) hRan.getRange(2, 1, filas.length, 9).setValues(filas);
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
      foto_url:     rowsR[i][8] || ""
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
        foto_url:     rowsP[i][7] || ""
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

  // Actualizar resultados desde API cada 15 minutos durante el Mundial
  ScriptApp.newTrigger("actualizarResultadosDesdeAPI")
    .timeBased()
    .everyMinutes(15)
    .create();

  // Recalcular ranking cada 15 minutos
  ScriptApp.newTrigger("recalcularRanking")
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log("✅ Triggers configurados: API cada 15min · Ranking cada 15min");
  try {
    SpreadsheetApp.getUi().alert("Triggers activados:\n• Resultados desde API: cada hora\n• Ranking: cada 30 minutos");
  } catch(e) {
    Logger.log("✅ Triggers activados: API cada 1h · Ranking cada 30min");
  }
}

function eliminarTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });
  Logger.log("Todos los triggers eliminados.");
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
    // GRUPO E
    [25,"E",1,"14/06/2026","14:00","Alemania","Curazao","","","NS"],
    [26,"E",1,"14/06/2026","20:00","Costa de Marfil","Ecuador","","","NS"],
    [27,"E",2,"20/06/2026","17:00","Alemania","Costa de Marfil","","","NS"],
    [28,"E",2,"20/06/2026","21:00","Ecuador","Curazao","","","NS"],
    [29,"E",3,"25/06/2026","17:00","Ecuador","Alemania","","","NS"],
    [30,"E",3,"25/06/2026","17:00","Curazao","Costa de Marfil","","","NS"],
    // GRUPO F
    [31,"F",1,"14/06/2026","17:00","Países Bajos","Japón","","","NS"],
    [32,"F",1,"14/06/2026","23:00","Suecia","Túnez","","","NS"],
    [33,"F",2,"20/06/2026","14:00","Países Bajos","Suecia","","","NS"],
    [34,"F",2,"21/06/2026","01:00","Túnez","Japón","","","NS"],
    [35,"F",3,"25/06/2026","20:00","Túnez","Países Bajos","","","NS"],
    [36,"F",3,"25/06/2026","20:00","Japón","Suecia","","","NS"],
    // GRUPO G
    [37,"G",1,"15/06/2026","16:00","Bélgica","Egipto","","","NS"],
    [38,"G",1,"15/06/2026","22:00","Irán","Nueva Zelanda","","","NS"],
    [39,"G",2,"21/06/2026","16:00","Bélgica","Irán","","","NS"],
    [40,"G",2,"21/06/2026","22:00","Nueva Zelanda","Egipto","","","NS"],
    [41,"G",3,"26/06/2026","00:00","Nueva Zelanda","Bélgica","","","NS"],
    [42,"G",3,"26/06/2026","00:00","Egipto","Irán","","","NS"],
    // GRUPO H
    [43,"H",1,"15/06/2026","13:00","España","Cabo Verde","","","NS"],
    [44,"H",1,"15/06/2026","19:00","Arabia Saudita","Uruguay","","","NS"],
    [45,"H",2,"21/06/2026","13:00","España","Arabia Saudita","","","NS"],
    [46,"H",2,"21/06/2026","19:00","Uruguay","Cabo Verde","","","NS"],
    [47,"H",3,"26/06/2026","21:00","Uruguay","España","","","NS"],
    [48,"H",3,"26/06/2026","21:00","Cabo Verde","Arabia Saudita","","","NS"],
    // GRUPO I
    [49,"I",1,"16/06/2026","16:00","Francia","Senegal","","","NS"],
    [50,"I",1,"16/06/2026","19:00","Irak","Noruega","","","NS"],
    [51,"I",2,"22/06/2026","18:00","Francia","Irak","","","NS"],
    [52,"I",2,"22/06/2026","21:00","Noruega","Senegal","","","NS"],
    [53,"I",3,"26/06/2026","16:00","Noruega","Francia","","","NS"],
    [54,"I",3,"26/06/2026","16:00","Senegal","Irak","","","NS"],
    // GRUPO J
    [55,"J",1,"16/06/2026","22:00","Argentina","Argelia","","","NS"],
    [56,"J",1,"17/06/2026","01:00","Austria","Jordania","","","NS"],
    [57,"J",2,"22/06/2026","14:00","Argentina","Austria","","","NS"],
    [58,"J",2,"23/06/2026","00:00","Jordania","Argelia","","","NS"],
    [59,"J",3,"27/06/2026","23:00","Jordania","Argentina","","","NS"],
    [60,"J",3,"27/06/2026","23:00","Argelia","Austria","","","NS"],
    // GRUPO K
    [61,"K",1,"17/06/2026","14:00","Portugal","Rep. Dem. Congo","","","NS"],
    [62,"K",1,"17/06/2026","23:00","Uzbekistán","Colombia","","","NS"],
    [63,"K",2,"23/06/2026","14:00","Portugal","Uzbekistán","","","NS"],
    [64,"K",2,"23/06/2026","23:00","Colombia","Rep. Dem. Congo","","","NS"],
    [65,"K",3,"27/06/2026","20:30","Colombia","Portugal","","","NS"],
    [66,"K",3,"27/06/2026","20:30","Rep. Dem. Congo","Uzbekistán","","","NS"],
    // GRUPO L
    [67,"L",1,"17/06/2026","17:00","Inglaterra","Croacia","","","NS"],
    [68,"L",1,"17/06/2026","20:00","Ghana","Panamá","","","NS"],
    [69,"L",2,"23/06/2026","17:00","Inglaterra","Ghana","","","NS"],
    [70,"L",2,"23/06/2026","20:00","Panamá","Croacia","","","NS"],
    [71,"L",3,"27/06/2026","18:00","Panamá","Inglaterra","","","NS"],
    [72,"L",3,"27/06/2026","18:00","Croacia","Ghana","","","NS"],

    // ── OCTAVOS DE FINAL ─────────────────────────────────────
    [73,"OCTAVOS",49,"29/06/2026","16:00","1ro Grupo A","2do Grupo B","","","NS"],
    [74,"OCTAVOS",49,"29/06/2026","20:00","1ro Grupo C","2do Grupo D","","","NS"],
    [75,"OCTAVOS",50,"30/06/2026","16:00","1ro Grupo E","2do Grupo F","","","NS"],
    [76,"OCTAVOS",50,"30/06/2026","20:00","1ro Grupo G","2do Grupo H","","","NS"],
    [77,"OCTAVOS",51,"01/07/2026","16:00","1ro Grupo I","2do Grupo J","","","NS"],
    [78,"OCTAVOS",51,"01/07/2026","20:00","1ro Grupo K","2do Grupo L","","","NS"],
    [79,"OCTAVOS",52,"02/07/2026","16:00","2do Grupo A","1ro Grupo B","","","NS"],
    [80,"OCTAVOS",52,"02/07/2026","20:00","2do Grupo C","1ro Grupo D","","","NS"],
    [81,"OCTAVOS",53,"03/07/2026","16:00","2do Grupo E","1ro Grupo F","","","NS"],
    [82,"OCTAVOS",53,"03/07/2026","20:00","2do Grupo G","1ro Grupo H","","","NS"],
    [83,"OCTAVOS",54,"04/07/2026","16:00","2do Grupo I","1ro Grupo J","","","NS"],
    [84,"OCTAVOS",54,"04/07/2026","20:00","2do Grupo K","1ro Grupo L","","","NS"],
    [85,"OCTAVOS",55,"05/07/2026","16:00","3ro Mejor 1","3ro Mejor 2","","","NS"],
    [86,"OCTAVOS",55,"05/07/2026","20:00","3ro Mejor 3","3ro Mejor 4","","","NS"],
    [87,"OCTAVOS",56,"06/07/2026","16:00","3ro Mejor 5","3ro Mejor 6","","","NS"],
    [88,"OCTAVOS",56,"06/07/2026","20:00","3ro Mejor 7","3ro Mejor 8","","","NS"],

    // ── CUARTOS DE FINAL ─────────────────────────────────────
    [89,"CUARTOS",57,"09/07/2026","20:00","Ganador P73","Ganador P74","","","NS"],
    [90,"CUARTOS",57,"09/07/2026","16:00","Ganador P75","Ganador P76","","","NS"],
    [91,"CUARTOS",58,"10/07/2026","20:00","Ganador P77","Ganador P78","","","NS"],
    [92,"CUARTOS",58,"10/07/2026","16:00","Ganador P79","Ganador P80","","","NS"],
    [93,"CUARTOS",59,"11/07/2026","20:00","Ganador P81","Ganador P82","","","NS"],
    [94,"CUARTOS",59,"11/07/2026","16:00","Ganador P83","Ganador P84","","","NS"],
    [95,"CUARTOS",60,"12/07/2026","20:00","Ganador P85","Ganador P86","","","NS"],
    [96,"CUARTOS",60,"12/07/2026","16:00","Ganador P87","Ganador P88","","","NS"],

    // ── SEMIFINALES ──────────────────────────────────────────
    [97,"SEMIS",61,"14/07/2026","20:00","Ganador P89","Ganador P90","","","NS"],
    [98,"SEMIS",61,"14/07/2026","16:00","Ganador P91","Ganador P92","","","NS"],
    [99,"SEMIS",62,"15/07/2026","20:00","Ganador P93","Ganador P94","","","NS"],
    [100,"SEMIS",62,"15/07/2026","16:00","Ganador P95","Ganador P96","","","NS"],

    // ── TERCER PUESTO ────────────────────────────────────────
    [101,"TERCER",63,"18/07/2026","20:00","Perdedor SF1","Perdedor SF2","","","NS"],

    // ── FINAL ────────────────────────────────────────────────
    [102,"FINAL",64,"19/07/2026","20:00","Ganador SF1","Ganador SF2","","","NS"],
  ];
}

// ── MENÚ PERSONALIZADO EN EL SHEET ───────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚽ Prode 2026")
    .addItem("🚀 Inicializar hojas", "inicializarSheet")
    .addSeparator()
    .addItem("🌐 Cargar fixture desde API", "cargarFixtureDesdeAPI")
    .addItem("🔄 Actualizar resultados ahora", "actualizarResultadosDesdeAPI")
    .addItem("🏆 Recalcular ranking ahora", "recalcularRanking")
    .addSeparator()
    .addItem("⏱️ Activar triggers automáticos", "configurarTriggers")
    .addItem("🗑️ Eliminar todos los triggers", "eliminarTriggers")
    .addToUi();
}