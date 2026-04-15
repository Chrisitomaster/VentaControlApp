# Documento de Traspaso de Contexto — VentaControl v2.4

---

## 1. Vision General del Proyecto

App HTML single-file (PWA) para el control de instalacion de ventanas en el Condominio Alberto Fuchslocher (Osorno, Chile): 34 edificios, 5 pisos cada uno, 4 departamentos por piso + espacios comunes = 4,740 ventanas totales. El objetivo es registrar en campo (desde celular) el estado de cada ventana, inconformidades, sello exterior, funcionalidad, acciones correctivas, y sincronizar con Google Sheets como base de datos compartida.

---

## 2. Stack Tecnologico

| Componente | Detalle |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla — todo en un solo archivo (`VentaControl_v2.html`, ~3800 lineas) |
| Framework | Ninguno. Rendering imperativo via helper `h()` (createElement wrapper) |
| Persistencia local | `localStorage` — clave `ventacontrol_v2` (JSON con todos los datos) |
| Dirty tracking | `localStorage` — clave `vc2_dirty` (Set serializado de keys modificadas) |
| Perfil usuario | `localStorage` — clave `vc2_role` (`editor` / `viewer`) |
| URL backend | Hardcodeada en `DEFAULT_APPS_URL` (ya NO usa localStorage) |
| Backend | Google Apps Script (`AppsScript_VentaControl_v2.js`) desplegado como Web App |
| Base de datos | Google Sheets — Sheet ID: `1Ivnk1kXB1PVMqCAjKLRZzJnC72OdkL0zrIG_KB6WQz8`, hoja `REGISTRO`, 29 columnas (A-AC) |
| PWA | `manifest.json` + `sw.js` (cache-first strategy) |
| Hosting | GitHub Pages — repo `Chrisitomaster/VentaControlApp`, branch `main` |
| Apps Script URL | `https://script.google.com/macros/s/AKfycbzpN-uPtdFawJ9wdxJ8Kc6pes0KWgeb1_Y0MXqOEG_athPggeItLegVVvKwx11egatn/exec` |

---

## 3. Arquitectura y Estructura

```
C:\Proyectos\VentaControl\
|-- VentaControl_v2.html        # App completa (HTML + CSS + JS) ~3800 lineas
|-- sw.js                       # Service Worker — cache-first offline
|-- manifest.json               # PWA manifest
|-- AppsScript_VentaControl_v2.js  # Google Apps Script backend (copiar a Google)
|-- CLAUDE.md                   # Guia para Claude Code
|-- Contexto_VentaControl_v2.md # Este archivo
```

### Estructura interna de `VentaControl_v2.html`:

| Seccion | Lineas aprox. | Contenido |
|---|---|---|
| CSS (`<style>`) | 1-255 | Variables CSS, temas claro/oscuro, componentes UI |
| Configuracion JS | 260-415 | `BLDG_RAW`, `BUILDINGS`, `WIN_DEF`, `COMMON_WIN`, `DEFICIENCIES`, `ACTIONS`, `DEF_ACTION_MAP`, `ESTADOS`, `VANO_OPTS`, `SELLO_ESTADOS`, `EIFS_PHASES` |
| Helpers DOM | 415-430 | `$()`, `$$()`, `h()`, `ts()`, `pct()` |
| Data Model | 430-570 | `DATA`, `dirtyKeys`, `newWindowRecord()`, `saveLocal()`, `updateWindow()` |
| Stats | 575-680 | `getBldgStats()`, `getDeptStats()`, etc. |
| Router | 680-720 | `currentView`, `viewParams`, `navigate()`, `navigateBack()`, `render()` |
| Views | 720-1450 | `renderLogin`, `renderDashboard`, `renderSA`, `renderBuilding`, `renderDept`, `renderGridMap`, `renderCommon` |
| MM Picker | 1453-1570 | `showMmPicker()` — drum-roll 1-50mm |
| Sello Popup | 1572-1700 | `showSelloPopup()` — modal estado sello + grado + comentario |
| Seal Map | 1700-1910 | `renderSealMap()` — grilla sello exterior por posicion/tipo/piso |
| Report | 1910-2110 | `generateReport()`, `renderReport()` |
| Window Detail | 2110-2600 | `renderWindowDetail()`, `renderWindowEC()`, `renderWindowDepto()` |
| Bulk/Modals | 2600-2700 | `showBulkModal()`, `showLegend()`, topbar |
| Sync engine | 2700-2900 | `doSync()`, `buildSyncPayload()`, `mergeFromSheets()` |
| CSV/Import | 2900-3100 | `exportCSV()`, `importCSV()`, migracion v1 |
| Init | 3700-3801 | `initData()`, integrity checks + migration, PWA registration |

### Flujo de datos (Sync):

```
[Usuario cambia estado] → updateWindow() → dirtyKeys.add(key) → saveLocal() + saveDirtyKeys()
                                                                        ↓
[Sync button] → doSync():
  1. Pull: fetchWithTimeout(action=read) → mergeFromSheets()  ← SALTA dirty keys (local gana)
  2. Push: buildSyncPayload(dirtyOnly=true) → POST chunks de 100 → Apps Script syncData()
  3. Exito: dirtyKeys.clear() + saveDirtyKeys()
```

---

## 4. Progreso Consolidado (funcionalidades 100% implementadas)

### Core
- [x] 34 edificios con tipos correctos (A, Aa, B, C, Ca, D) y MR en pisos 1 de edif 7, 16, 24, 31
- [x] 4,740 ventanas con keys unicas formato `{edif}-{depto}-{code}` (ej: `16-201-V1-Izq`)
- [x] Espacios comunes con depto `EC{piso}` (ej: `EC1`, `EC5`)
- [x] 6 estados de ventana: `instalada / pendiente / noInstalada / quitar / noInstalar / sinVentana`
- [x] 3 estados de rasgo: `OK / Sobredimensionado / Subdimensionado` (Pulir eliminado)
- [x] Separacion mm: drum-roll picker 1-50mm (reemplaza prompt nativo)
- [x] Badge separacion en perfil: `+Nmm` (naranja) o `−Nmm` (cyan) + descripcion
- [x] Sistema de perfiles: Editor (modifica) / Espectador (solo lectura)
- [x] Tema claro/oscuro con toggle persistente
- [x] Prevencion salida accidental (`beforeunload`)
- [x] Anti-seleccion de texto en long-press (`.win-tile` CSS + contextmenu prevention)

### Deficiencias (10 tipos)
- [x] Separacion >5mm, Descuadre, Desaplomo, Sin FC11 bajo marco, Sin FC11 frente, Malla retorno EIFS, Malla pulida, Vidrio trizado, Marco perforado, Falta fijacion

### Acciones correctivas (9 tipos)
- [x] Pulir Rasgo, Aplomar, Aplicar sello bajo marco, Sellar frente, Reparar EIFS, Reemplazar vidrio, Aplicar sello (era "Reparar marco"), Instalar fijacion, Cargar vano con mortero
- [x] Ciclo completo: activar → completar → reabrir → quitar
- [x] Sugerencia automatica por deficiencia activa (via `DEF_ACTION_MAP`)
- [x] `syncDefToActions()` ELIMINADO — acciones son independientes de deficiencias

### Sello Exterior (nuevo)
- [x] Campo `selloExterior: {estado, grado, comentario}` en cada ventana
- [x] 4 estados: `sellado / pendiente / sinSellar / deficiente` (constante `SELLO_ESTADOS`)
- [x] Grado de deficiencia 1-5 (solo visible cuando estado = 'deficiente')
- [x] Long-press en celda del mapa abre `showSelloPopup` (modal con estado + grado + comentario)
- [x] Tap corto en mapa: cicla `sellado ↔ sinSellar`
- [x] Card "Sello Exterior" en perfil de ventana: badge color + grado + comentario + boton editar
- [x] Informe incluye seccion SELLO EXTERIOR con conteo y lista de deficientes

### Condicion de Funcionalidad (nuevo)
- [x] Campo `funcionalidad: 0-5` en cada ventana (0 = sin evaluar)
- [x] Card en perfil: 5 circulos numerados con colores (rojo→naranja→cyan→azul→verde)
- [x] Etiquetas: Muy Deficiente / Deficiente / Regular / Buena / Excelente
- [x] Toque en mismo numero = deseleccionar (vuelve a 0)
- [x] Informe incluye seccion CONDICION DE FUNCIONALIDAD con conteo por nivel + lista criticos (1-2)

### Mapa de Sello Exterior (nueva vista)
- [x] Vista `renderSealMap()` accesible desde vista edificio
- [x] Grilla por posicion de depto (X01/X02/X03/X04/EC), tipo de ventana, pisos 1-5
- [x] Cada celda = 1 ventana fisica exacta
- [x] Colores por estado: verde/naranja/gris/rojo con simbolos ✓/◷/✗/⚠
- [x] Deficiente muestra `N⚠` con el grado
- [x] Badges resumen al tope: cSellado / cPendiente / cSinSellar / cDeficiente

### Informe de texto
- [x] `generateReport(edif)` genera texto plano con secciones:
  - RESUMEN GENERAL
  - PENDIENTES DE INSTALACION
  - SIN INSTALAR
  - A QUITAR
  - INCONFORMIDADES ACTIVAS
  - ACCIONES CORRECTIVAS PENDIENTES
  - SELLO EXTERIOR (con detalle deficientes)
  - CONDICION DE FUNCIONALIDAD (con lista criticos)
  - RESUMEN POR TIPO (pedido materiales)

### Vistas
- [x] Dashboard global con % bruto y ajustado, 5 SA cards
- [x] Vista SA con listado edificios, badges defectos/acciones, etapa construccion
- [x] Vista edificio: grilla deptos, espacios comunes, resumen, boton mapa sello
- [x] Vista departamento: tiles ventana con long-press picker rapido
- [x] `renderGridMap`: grilla completa del edificio con totales al tope
- [x] Vista detalle ventana: estado / estado rasgo (con mm info) / sello exterior / funcionalidad / deficiencias / acciones / observaciones / fotos / historial
- [x] Mapa de sello exterior por edificio

### Tracker de construccion
- [x] `EIFS_PHASES`: 3 fases (Montaje EPS, Terminaciones, Sellados) con sub-items
- [x] Reemplaza el antiguo `BLDG_STAGES` (6 etapas planas)
- [x] Visible en vista SA por edificio

### Sync
- [x] Sync bidireccional: pull + push dirty keys en chunks de 100
- [x] Proteccion dirty keys: merge remoto NO sobreescribe cambios locales pendientes
- [x] dirtyKeys persistido en localStorage (`vc2_dirty`) — sobrevive reload
- [x] URL hardcodeada en `DEFAULT_APPS_URL` (no mas config manual)
- [x] Pull por seccion: `?edif=N` para descargar solo un edificio

### Otras
- [x] Cambio masivo de estado (por edificio/piso/depto)
- [x] CSV export/import
- [x] Migracion desde v1
- [x] Historial de cambios por ventana (max 50 entradas, deduplicado)
- [x] PWA offline con Service Worker cache-first
- [x] Orientacion de departamentos (Izquierda/Derecha) visible en perfil

---

## 5. Descubrimientos y Decisiones Tecnicas

### Reglas de negocio
- **Key de ventana**: `{edif}-{depto}-{code}` — PK en app y Sheets
- **Building key**: `bld-{edif}`
- **Tipo MR solo en piso 1**: Edif 7 (pos 2,4), 16 (pos 1,3), 24 (pos 1,3), 31 (pos 2,4)
- **Edif 31 correccion**: Piso 2-5 es `['B','A','B','A']`
- **% Ajustado**: `(instaladas - quitar) / total × 100`
- **DEF_ACTION_MAP**: Deficiencia activa sugiere accion; desactivar deficiencia NO quita accion

### Decisiones tecnicas criticas
- **textarea `onBlur` no `onInput`**: En movil, `onInput` re-renderiza y cierra teclado
- **Long-press touch**: `touchstart/touchmove/touchend` con flags `scrolled` (threshold 10px), `longFired`, `touchHandled` + timer 450ms + vibration
- **sealCell DOM imperativo**: Celdas del mapa de sello usan `document.createElement` (no `h()`) para adjuntar eventos touch correctamente dentro de tabla scrollable
- **showMmPicker scroll-snap**: `scroll-snap-type:y mandatory` en drum div, cada item `scroll-snap-align:center`, `scrollbar-width:none` + clase `.mm-drum` para webkit
- **showSelloPopup self-redraw**: `draw()` interna limpia overlay y reconstruye modal; textarea restaura valor via `setTimeout` despues de cada redraw
- **Sync pull-then-push**: Pull primero para obtener datos remotos; dirty keys protegidas de overwrite
- **Lazy actions panel**: `collectActions()` escanea 4740×8 iteraciones — solo ejecuta al tocar panel
- **Content-Type `text/plain`**: Apps Script requiere esto (no `application/json`) para evitar CORS preflight en POST
- **Chunks de 100**: Apps Script timeout 30s — lotes >200 daban timeout

### Migracion de campos (init loop)
Cada vez que se agrega un campo nuevo a `newWindowRecord()`, se agrega en AMBOS loops del `initData()`:
```js
// Loop deptos
if(!w.selloExterior)w.selloExterior={estado:'sinSellar',grado:0,comentario:''};
if(w.funcionalidad===undefined)w.funcionalidad=0;
if(w.estadoVano==='Pulir'){w.estadoVano='';saveLocal();}
// Loop EC (espacios comunes) — identico
```

### Bugs resueltos (historico)
1. Sync enviaba 4740 ventanas → dirty tracking con Set
2. Apps Script escribia fila x fila → batch `setValues()`
3. Estado "Instalada" de Sheets no matcheaba → `normalizeEstado()`
4. Espacios comunes depto vacio en Sheet → reconstruccion `EC{piso}`
5. Historial repetido → deduplicacion
6. Dashboard crash con panel acciones → lazy loading
7. Sync timeout en cambios masivos → timeout 120s + chunks 100
8. Sync sobreescribia cambios locales → dirty keys protegidas en `mergeFromSheets()`
9. dirtyKeys se perdia al recargar → persistido en `localStorage('vc2_dirty')`
10. Long-press disparaba navegacion + popup simultaneos → flag `touchHandled` + `contextmenu` prevention

---

## 6. Estado Actual Exacto

### Ultima sesion (2026-04-14) — commits realizados

```
70470be Rasgo: quitar Pulir, picker mm carrete, funcionalidad 1-5
c4bc779 Sello exterior: estados ricos con popup, perfil de ventana e informe
9508b07 Mapa de sello: redisenar grilla por posicion de depto x piso
304159a Hardcodear URL de Apps Script para sync automatico
1cb7573 UX overhaul: 19 mejoras de interfaz, nuevos estados y vistas
```

### Estado del repo
- Branch local: `claude/interesting-raman` → pushea a `main` en GitHub
- GitHub Pages: activo, sirve desde `main`
- Todo pusheado, sin cambios pendientes

---

## 7. Proximos Pasos (To-Do)

### Alta prioridad
1. **Sync selloExterior y funcionalidad a Sheets**: Los campos nuevos no se sincronizan aun. Agregar columnas AD (selloEstado), AE (selloGrado), AF (selloComentario), AG (funcionalidad) en Apps Script `HEADERS[]`, `syncData()`, `readAll()`. Actualizar `buildSyncPayload()` y `mergeFromSheets()`.

2. **Filtro rapido por edificio en panel de acciones correctivas**: `renderLazyActionsCard` carga rango 1-34. Agregar dropdown de edificio para filtrar.

### Media prioridad
3. **Preservar scroll position al navegar atras**: `navigate()` hace `scrollTo(0,0)` siempre. Guardar `scrollY` en navStack y restaurar al volver.

4. **Picker mm editable desde mapa de sello**: Cuando se edita separacionMm en mapa, abrir picker en lugar del prompt.

---

## 8. Variables y Constantes Clave (no renombrar)

| Variable | Uso |
|---|---|
| `DATA` | Objeto raiz con `.windows`, `.buildings`, `.meta` |
| `DATA.windows[key]` | Record de ventana. Key: `{edif}-{depto}-{code}` |
| `DATA.buildings[bKey(edif)]` | `{comment, accionesPendientes, stageItems}` |
| `dirtyKeys` | `Set<string>` — keys modificadas sin sync |
| `DEFICIENCIES` | Array `{id, label, icon}` — 10 deficiencias |
| `ACTIONS` | Array `{id, label, icon, color}` — 9 acciones correctivas |
| `DEF_ACTION_MAP` | `{defId: actionId}` — mapeo deficiencia → accion |
| `ESTADOS` | 6 estados: instalada/pendiente/noInstalada/quitar/noInstalar/sinVentana |
| `VANO_OPTS` | `['OK','Sobredimensionado','Subdimensionado']` |
| `SELLO_ESTADOS` | `[{id,label,sym}]` — 4 estados de sello exterior |
| `EIFS_PHASES` | 3 fases construccion con sub-items (reemplaza BLDG_STAGES) |
| `DEFAULT_APPS_URL` | URL hardcodeada del Web App de Apps Script |
| `currentView` | Vista activa |
| `viewParams` | Parametros de vista activa |
| `syncing` | Boolean — previene sync concurrente |

### Estructura `newWindowRecord()` actual:
```js
{
  estado: 'noInstalada',
  estadoVano: '',
  separacionMm: '',
  deficiencias: { separacion, descuadre, desaplomo, sinSellador, sinSelladorFrente,
                  retornoMalla, mallaPulida, vidrioTrizado, marcoPerforado, faltaFijacion },
  acciones: { pulir, impermeabilizar, repararEIFS, aplomar, sellarFrente,
              reemplazarVidrio, repararMarco, instalarFijacion, cargarMortero },
  observaciones: '',
  selloExterior: { estado: 'sinSellar', grado: 0, comentario: '' },
  funcionalidad: 0,   // 0=sin evaluar, 1-5 rating
  historial: [],
  fotos: []
}
```

## 9. Google Sheets — Columnas actuales (29) + pendientes

```
A:Edificio  B:Piso  C:N°Depto  D:TipoDepto  E:Elemento  F:TipoElemento  G:Estado
H:Separacion>5mm  I:Descuadre  J:SinFC11bajomarco  K:MallaEIFS  L:EstadoVano
M:Observaciones  N:UltimaActualizacion  O:Desaplomado  P:SinFC11frente
Q:MallaRetornoPulida  R:VidrioTrizado  S:MarcoPerforado  T:FaltaFijacion
U:Acc.PulirVano  V:Acc.Impermeabilizar  W:Acc.RepararEIFS  X:Acc.Aplomar
Y:Acc.SellarFrente  Z:Acc.Reempl.Vidrio  AA:Acc.RepararMarco  AB:Acc.InstalarFijac
AC:EtapaConstruccion
--- PENDIENTE AGREGAR ---
AD:SelloEstado  AE:SelloGrado  AF:SelloComentario  AG:Funcionalidad
```

---

*Documento actualizado: 2026-04-14 — Version app: v2.4 — ~3800 lineas*
