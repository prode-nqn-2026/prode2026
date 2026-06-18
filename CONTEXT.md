# Prode Mundial 2026 — Contexto del Proyecto

## Descripción general
PWA (Progressive Web App) para un prode del Mundial 2026. 28 participantes en Neuquén, Argentina. El organizador carga resultados manualmente desde Google Sheets. El registro está cerrado permanentemente (ya empezó el torneo).

---

## Archivos del proyecto

| Archivo | Descripción |
|---|---|
| `index.html` | Estructura HTML, modales, nav, vistas |
| `style.css` | Estilos (dark theme, variables CSS, responsive) |
| `app.js` | Toda la lógica del frontend (~1800 líneas) |
| `Código.js` | Backend Google Apps Script (~1650 líneas) |
| `sw.js` | Service Worker — actualmente **v41** |
| `manifest.json` | Configuración PWA |

---

## Arquitectura

### Frontend (PWA)
- HTML/CSS/JS puro, sin frameworks
- Service Worker: cache-first para assets, network-first para GAS
- **Para invalidar caché en producción**: subir `CACHE = 'prode2026-vN+1'` en `sw.js`
- `localStorage` para sesión (`prode_user`, `prode_pin`), caché de fixture/ranking (TTL 5 min), fotos
- Auto-refresh inteligente: cada **30 segundos** si hay partido EN JUEGO, cada **5 minutos** si no

### Backend (Google Apps Script)
- URL fija hardcodeada en `app.js` → `SCRIPT_URL_FIJA`
- Publicado como Web App (acceso: Anyone)
- Trigger `marcarPartidosEnJuego` corre cada **1 minuto**

---

## Sheets de Google Sheets

| Hoja | Columnas clave |
|---|---|
| `PARTICIPANTES` | ID, NOMBRE, PIN, WHATSAPP, EMAIL, FOTO_URL |
| `FIXTURE` | PARTIDO_ID, GRUPO, JORNADA, FECHA, HORA, LOCAL, VISITANTE, GOL_L, GOL_V, ESTADO |
| `PRONOSTICOS` | PARTICIPANTE_ID, NOMBRE, PARTIDO_ID, GOL_L_PRED, GOL_V_PRED, FECHA_CARGA, BLOQUEADO |
| `RESULTADOS` | PARTIDO_ID, GOL_L, GOL_V, GANADOR, FECHA_ACTUALIZACION, FUENTE |
| `RANKING` | (calculado por `recalcularRanking()`) |
| `CARGA RESULTADOS` | PARTIDO_ID, FECHA, HORA, LOCAL, GOL_L, -, GOL_V, VISITANTE, ESTADO, FINAL(checkbox) |

---

## API Endpoints

### GET `?accion=...`
| acción | descripción |
|---|---|
| `ranking` | Devuelve ranking completo con puntos, exactos, aciertos |
| `fixture` | Devuelve todos los partidos con estado y goles |
| `pronosticos&nombre=X` | Pronósticos de un participante |
| `pronosticosEnJuego` | Pronósticos de todos para partidos EN JUEGO |
| `getPerfilPublico&nombre=X` | Perfil público de un participante |
| `verificarPin&nombre=X&pin=Y` | Verifica PIN (ya no se usa en startup) |
| `estadisticas` | Estadísticas generales (tab eliminado del frontend) |

### POST `{accion: ...}`
| acción | descripción |
|---|---|
| `registrar` | Registro (bloqueado — devuelve error siempre) |
| `pronostico` | Guardar un pronóstico individual |
| `guardarPronosticos` | Guardar lote de pronósticos (batch) |
| `resultado` | Cargar resultado manual |
| `subirFoto` | Subir foto de perfil |
| `editarPerfil` | Editar whatsapp/email/pin |

---

## Flujo automático de partidos (trigger GAS)

```
[Trigger cada 1 min] → marcarPartidosEnJuego()
  ↓
  Para cada partido en FIXTURE donde estado ∉ [EN JUEGO, FT, AET, PEN, 1H, 2H, HT, ET, AWD, WO]:
    Si ahoraStr >= inicioStr (comparación string "yyyyMMddHHmm" en zona AR):
      → Pone GOL_L=0, GOL_V=0, ESTADO='EN JUEGO' en FIXTURE
      → Busca fila en CARGA RESULTADOS:
          - Si existe y no es FT → pone 0-0 y EN JUEGO
          - Si NO existe → crea la fila con appendRow
  ↓
  Llama a _procesarCargaCore():
    → Lee CARGA RESULTADOS buscando FINAL=true
    → Si hay → actualiza FIXTURE a FT → llama a recalcularRanking()
```

### ⚠️ Timezone — GAS usa UTC internamente
`new Date(year, month, day, hour, min)` en GAS V8 = UTC, NO Argentina.
**Siempre usar** `Utilities.formatDate(fecha, "America/Argentina/Buenos_Aires", "yyyyMMddHHmm")` para comparaciones.

---

## Lógica de estado de partidos (frontend)

```javascript
estaJugado(m)    // true si estado === 'FT' (nunca para EN JUEGO)
estaBloqueado(m) // true si EN JUEGO, o faltan < 5 min para el inicio
```

- **5 min antes**: inputs bloqueados visualmente (🔒), calculado en el navegador con hora local
- **A la hora exacta**: trigger GAS pone EN JUEGO + 0-0
- **Al terminar**: organizador tilda FINAL en CARGA RESULTADOS → trigger detecta → FT → ranking

---

## Sistema de puntaje
| Resultado | Puntos |
|---|---|
| Exacto (goles exactos) | +3 |
| 1X2 (solo ganador correcto) | +1 |
| Error | 0 |

---

## Premio
- 70% del pozo → 1er lugar
- 20% del pozo → 2do lugar
- 10% del pozo → 3er lugar

---

## Tabs de navegación (en orden)
1. 🏆 **Ranking** — tabla de posiciones + podio + pozo
2. 📅 **Fixture** — por jornada (default), por grupo, eliminatorias
3. 🔴 **En Vivo** — pronósticos de todos para partidos activos, auto-refresh 30s
4. 📝 **Pronósticos** — inputs del usuario logueado
5. 📋 **Reglas**
6. 📄 **Términos**

---

## Sesión de usuario
- Se guarda en `localStorage`: `prode_user`, `prode_pin`
- Al cargar la app: muestra sesión instantáneamente desde localStorage
- **NO hace verificarPin en background** (causaba deslogueos en F5 por carga paralela de GAS)
- Solo se cierra sesión con logout explícito del usuario

---

## Caché de datos
```javascript
cacheSet('fixture', fixtureData)   // guarda el ARRAY (no el objeto completo)
cacheSet('ranking', rankData)      // guarda el objeto completo de ranking
CACHE_TTL = 5 * 60 * 1000         // 5 minutos
```
Al leer fixture del caché: `Array.isArray(cached) ? cached : (cached.partidos || [])`

---

## Funciones clave del frontend

| Función | Descripción |
|---|---|
| `switchTab(tab)` | Cambia vista, guarda en localStorage, dispara cargas |
| `renderFixtureConModo(partidos)` | Actualiza contadores y renderiza según modo activo |
| `renderFixtureJornada(partidos)` | Render agrupado por fecha (modo default) |
| `renderFixture(partidos)` | Render agrupado por grupo |
| `agendarProximoPoll()` | setTimeout inteligente: 30s si EN JUEGO, 5min si no |
| `cargarEnVivoTab()` | Carga y renderiza tab EN VIVO con datos frescos |
| `actualizarIndicadorEnVivo(bool)` | Muestra/oculta punto rojo en tab EN VIVO |
| `marcarPartidosEnJuego()` | **GAS** — trigger cada 1 min, marca EN JUEGO + 0-0 |
| `_procesarCargaCore()` | **GAS** — procesa CARGA RESULTADOS sin UI |
| `recalcularRanking()` | **GAS** — recalcula puntos, case-insensitive |

---

## Funciones clave del backend (GAS)

| Función | Descripción |
|---|---|
| `marcarPartidosEnJuego()` | Trigger principal — EN JUEGO + 0-0 + procesar resultados |
| `_procesarCargaCore()` | Lee CARGA RESULTADOS, aplica resultados FT |
| `recalcularRanking()` | Recalcula ranking completo (normaliza nombres a lowercase) |
| `configurarTriggers()` | Borra triggers viejos y crea `marcarPartidosEnJuego` cada 1 min |
| `abrirHojaCargaResultados()` | Crea/recrea la hoja CARGA RESULTADOS con todos los partidos |
| `verificarPin(nombre, pin)` | Verifica PIN (padStart 4 dígitos, case-insensitive) |
| `registrarParticipante(data)` | Bloqueado — devuelve error siempre |

---

## Decisiones de diseño importantes

1. **No auto-logout**: el frontend nunca cierra sesión en background, solo el usuario explícitamente
2. **Timezone GAS**: siempre string comparison con `Utilities.formatDate(..., "America/Argentina/Buenos_Aires", "yyyyMMddHHmm")`
3. **Estado EN JUEGO vs FT**: `estaJugado` devuelve `false` para EN JUEGO (para no mostrar score como resultado final)
4. **estadosIgnorar en trigger**: lista negra (skip si ya está en progreso/terminado), no lista blanca — así cualquier estado desconocido igual se procesa
5. **CARGA RESULTADOS auto-create**: si el trigger no encuentra la fila del partido, la crea con `appendRow`
6. **Caché de fixture**: se guarda solo el array `partidos`, no el objeto completo de la respuesta

---

## Cosas que NO hacer
- No usar `new Date(year, month, day, hour, min)` en GAS para Argentina → usa string comparison
- No auto-desloguear en background → causa F5 logout
- No llamar `verificarPin` al inicio de sesión
- No subir versión de SW sin probar en mobile
- No hacer `setInterval` fijo para polling → usar `agendarProximoPoll()` que es adaptativo
