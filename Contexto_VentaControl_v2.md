# Documento de Traspaso de Contexto — VentaControl v2.9

> **PARA LA IA QUE LEA ESTO:** Este archivo es el punto de entrada para cualquier sesión nueva. Léelo completo antes de tocar código. Contiene el estado real del proyecto, decisiones técnicas críticas, y patrones que DEBES respetar para no romper cosas. El archivo principal es `VentaControl_v2.html` (~4900 líneas), single-file, sin bundler, sin framework. Ver también `Roadmap_VentaControl_v2.md` para mejoras priorizadas y patrones helper introducidos en v2.9.

---

## 1. Visión General del Proyecto

App HTML single-file (PWA) para el control de instalación de ventanas en el Condominio Alberto Fuchslocher (Osorno, Chile): **34 edificios, 5 pisos cada uno, 4 departamentos por piso + espacios comunes = 4,740 ventanas totales**. Se usa desde celular en obra. Registra estado de cada ventana, inconformidades, sello exterior, condición de funcionalidad, acciones correctivas. Sincroniza con Google Sheets como base de datos compartida.

**Usuario:** Trabaja en iOS/Android Chrome en obra. Touch es el input principal. Prefer: rápido, sin prompts nativos, gestos intuitivos.

---

## 2. Stack Tecnológico

| Componente | Detalle |
|---|---|
| Frontend | HTML5 + CSS3 + JS vanilla — **todo en un solo archivo** (`VentaControl_v2.html`, ~4900 líneas) |
| Rendering | Imperativo via helper `h(tag, props, children)` (createElement wrapper). NO React, NO Vue. |
| Persistencia local | `localStorage` clave `ventacontrol_v2` (JSON completo) |
| Dirty tracking | `localStorage` clave `vc2_dirty` (Set serializado de keys modificadas) |
| Perfil usuario | `localStorage` clave `vc2_role` (`editor` / `viewer`) |
| URL backend | Hardcodeada en `DEFAULT_APPS_URL` — NO usar localStorage |
| Backend | Google Apps Script desplegado como Web App |
| Base de datos | Google Sheets — Sheet ID `1Ivnk1kXB1PVMqCAjKLRZzJnC72OdkL0zrIG_KB6WQz8`, hoja `REGISTRO` |
| PWA | `manifest.json` + `sw.js` (cache-first) |
| Hosting | GitHub Pages — repo `Chrisitomaster/VentaControlApp`, branch `main` |
| Deploy | `git push origin <worktree-branch>:main` |
| Apps Script URL | `https://script.google.com/macros/s/AKfycbzpN-uPtdFawJ9wdxJ8Kc6pes0KWgeb1_Y0MXqOEG_athPggeItLegVVvKwx11egatn/exec` |

---

## 3. Arquitectura del Archivo Principal

```
C:\Proyectos\VentaControl\
├── VentaControl_v2.html         ← ARCHIVO PRINCIPAL (~4900 líneas)
├── sw.js                        ← Service Worker (cache-first; bumpear CACHE en cada release)
├── manifest.json                ← PWA manifest
├── AppsScript_VentaControl_v2.js ← Google Apps Script (se copia a Google manualmente)
├── Contexto_VentaControl_v2.md  ← Este archivo
├── Roadmap_VentaControl_v2.md   ← Roadmap mejoras + patrones helper v2.9
└── README.md
```

### Mapa de secciones internas (`VentaControl_v2.html`, post-v2.9):

| Sección | Líneas aprox. | Qué hay |
|---|---|---|
| CSS `<style>` | 1–425 | Variables CSS (claro/oscuro), componentes UI, vista print, badge classes |
| Constantes JS | 426–600 | `BLDG_RAW`, `BUILDINGS`, `WIN_DEF`, `COMMON_WIN`, `DEFICIENCIES`, `ACTIONS`, `DEF_ACTION_MAP`, `ESTADOS`, `VANO_OPTS`, `SELLO_ESTADOS`, `EIFS_PHASES`, `SA_RANGES`, `WINDOW_COLOR_MAPS`, `PRINT_LAYOUT`, `DEBUG` flag |
| Helpers DOM | 609–632 | `$()`, `$$()`, `h()`, `ts()`, `pct()`, `closeOnBackdropClick()`, `closeOverlayOnBackdrop()` |
| Iteration helpers | 695–714 | `forEachWindowInFloor(edif, floor, cb)`, `forEachWindowInBldg(edif, cb)` — itera deptos+comunes con ctx (loc, isCommon, etc.) |
| Search index | 716–746 | `_searchIndex`, `buildSearchIndex()`, `searchWindows(query)` — búsqueda global lazy |
| Data model | 717–855 | `DATA`, `dirtyKeys`, `newWindowRecord()`, `saveLocal()`, `updateWindow()` |
| Stats | 855–1060 | `getBldgStats()`, `getDeptStats()`, `getCommonStats()`, `getSAStats()`, `getGlobalStats()` |
| Router | 970–995 | `currentView`, `viewParams`, `navigate()`, `navigateBack()`, `render()` |
| Vistas principales | 1000–1750 | `renderLogin`, `renderDashboard`, `renderSA`, `renderBuilding`, `renderDept`, `renderGridMap`, `renderCommon` |
| Quick estado / pickers | 1486–1820 | `showQuickEstado`, `showMmPicker` (drum-roll 1–50 mm) |
| Sello Popup | 1820–1980 | `showSelloPopup()` — modal con estado/grado/comentario |
| Seal Map | 2090–2200 | `renderSealMap()` — grilla sello exterior |
| Print views | 2090–2450 | `renderPrint*()` — vista imprimible por edificio |
| Window Detail | 3232–3615 | `renderWindow()`, `renderWindowDetail()` — perfil ventana |
| Bulk/Clear | 3618–3715 | `showBulkModal()`, `applyBulkStatus()`, `confirmClearBuilding()`, `confirmClearDept()` |
| Sync engine | 4282–4540 | `doSync()`, `buildSyncPayload()`, `mergeFromSheets()`, `doPullOnly()`, `doPullSection()` |
| Sync bar / search modal | 4104–4220 | `renderSyncBar()` (incluye botón 🔍), `showSearchModal()` |
| Modals adicionales | 4225–4500 | `showLegend()`, `showExportMenu()`, `showUrlConfig()`, `showLogPanel()` |
| CSV / migración v1 | 4710–4830 | `exportCSV()`, `importCSV()`, `migrateV1()` |
| Init | 4836–4920 | `initData()` — integrity checks, migración de campos, PWA registration, back-button guard |

### Flujo de datos — Sync:

```
[Usuario cambia estado]
  → updateWindow(key, field, value, logMsg)
  → dirtyKeys.add(key)
  → saveLocal() + saveDirtyKeys()

[Botón Sync]
  → doSync():
    1. Pull: GET ?action=read → mergeFromSheets()  ← SALTA dirty keys (local wins)
    2. Push: buildSyncPayload(dirtyOnly=true) → POST chunks de 100 → Apps Script
    3. Éxito: dirtyKeys.clear() + saveDirtyKeys()
```

### Flujo de navegación:

```
navigate(view, params)    → cambia currentView + viewParams → render() → scrollTo(0,0)
navigateBack(view, params) → idem (alias semántico para el botón ←)
topbar(title, backView, backParams) → genera topbar con botón ← que llama navigateBack()
```

---

## 4. Modelo de Datos

### `newWindowRecord()` — estructura actual completa:

```js
{
  estado: 'noInstalada',          // ver ESTADOS
  estadoVano: '',                  // ver VANO_OPTS
  separacionMm: '',                // string '1'-'50', solo si estadoVano es Sobre/Sub
  deficiencias: {
    separacion: false,             // Separación >5mm
    descuadre: false,              // Descuadre de Rasgo (sin sugerencia de acción)
    desaplomo: false,              // Ventana desaplomada
    sinSellador: false,            // Sin FC11 bajo marco
    sinSelladorFrente: false,      // Sin FC11 frente
    retornoMalla: false,           // Malla retorno EIFS
    mallaPulida: false,            // Malla pulida
    vidrioTrizado: false,
    marcoPerforado: false,
    faltaFijacion: false,
    sinImpermeabilizar: false,     // v2.9: rasgo sin impermeabilizar
  },
  acciones: {
    pulir:                {active:false, done:false},
    impermeabilizar:      {active:false, done:false},
    repararEIFS:          {active:false, done:false},
    aplomar:              {active:false, done:false},
    sellarFrente:         {active:false, done:false},
    reemplazarVidrio:     {active:false, done:false},
    repararMarco:         {active:false, done:false},
    instalarFijacion:     {active:false, done:false},
    cargarMortero:        {active:false, done:false},
    impermeabilizarRasgo: {active:false, done:false},  // v2.9
  },
  observaciones: '',
  selloExterior: {
    estado: 'sinSellar',           // sellado | pendiente | sinSellar | deficiente
    grado: 0,                      // 0=sin grado, 1-5 solo si estado=deficiente
    comentario: '',
  },
  funcionalidad: 0,                // 0=sin evaluar, 1=MuyDef, 2=Def, 3=Regular, 4=Buena, 5=Excelente
  historial: [],                   // [{t: timestamp, cambio: string}]
  fotos: [],                       // [{data: base64jpeg, ts: timestamp}]
}
```

### Migración de campos en `initData()`:

**REGLA CRÍTICA:** Cada vez que se agrega un campo nuevo a `newWindowRecord()`, hay que agregar su migración en **DOS lugares** del loop de `initData()` integrity check (loop deptos + loop EC, ~líneas 4868/4875 y 4891/4897). Hay arrays hardcoded con todos los ids de defs y acciones — agregar el nuevo id ahí también.

```js
// Patrón a seguir — en initData integrity loop:
['pulir',...,'cargarMortero','impermeabilizarRasgo'].forEach(a=>{       // ← agregar id
  if(!w.acciones[a]) w.acciones[a] = {active:false, done:false};
});
['separacion',...,'faltaFijacion','sinImpermeabilizar'].forEach(f=>{    // ← agregar id
  if(w.deficiencias[f]===undefined) w.deficiencias[f] = false;
});
if(!w.selloExterior) w.selloExterior = {estado:'sinSellar', grado:0, comentario:''};
if(w.funcionalidad === undefined) w.funcionalidad = 0;
if(w.estadoVano === 'Pulir') { w.estadoVano = ''; saveLocal(); }  // migración valor obsoleto
```

**Sitios adicionales a actualizar al agregar def/action nueva:**
1. `DEFICIENCIES` o `ACTIONS` array (constantes ~líneas 491/504).
2. `DEF_ACTION_MAP` si la def auto-activa una acción.
3. `WINDOW_COLOR_MAPS.actionColorMap` para color en GridMap.
4. `newWindowRecord()` (~línea 768).
5. Migración initData (4 sitios — 2 deptos + 2 EC, ~líneas 4868/4875/4891/4897).
6. `buildSyncPayload` row builder (~línea 4515).
7. `mergeFromSheets` dmap + actions array (~línea 4668/4680).
8. `_searchIndex=null` se invalida solo via `forEachWindowInBldg` reuse — no requiere cambio.
9. **Apps Script** `HEADERS`, `widths`, `syncData` row, `DEFS_CONFIG`, `buildResumen` defCols/actCols, `readAll` — ver `AppsScript_VentaControl_v2.js`.

---

## 5. Constantes Clave (NO renombrar)

### ESTADOS (6 estados de ventana)

```js
const ESTADOS = [
  {id:'instalada',   label:'Instalada',   sym:'✓', cls:'sel-instalada'},   // verde
  {id:'pendiente',   label:'Pendiente',   sym:'◷', cls:'sel-pendiente'},   // naranja
  {id:'noInstalada', label:'No Instalada',sym:'✗', cls:'sel-noinstalada'}, // neutro sin color
  {id:'quitar',      label:'Quitar',      sym:'↩', cls:'sel-quitar'},      // rojo
  {id:'noInstalar',  label:'No Instalar', sym:'⊘', cls:'sel-noinstalar'},  // morado
  {id:'sinVentana',  label:'Sin Ventana', sym:'▢', cls:'sel-sinventana'},  // blanco/gris claro
];
```

### VANO_OPTS (estado de rasgo)

```js
const VANO_OPTS = ['OK', 'Sobredimensionado', 'Subdimensionado'];
// 'Pulir' fue eliminado. Registros viejos con estadoVano='Pulir' se limpian en init.
```

### SELLO_ESTADOS (estado de sello exterior)

```js
const SELLO_ESTADOS = [
  {id:'sellado',    label:'Sellado',         sym:'✓'},
  {id:'pendiente',  label:'Pendiente',       sym:'◷'},
  {id:'sinSellar',  label:'Sin Sellar',      sym:'✗'},
  {id:'deficiente', label:'Sello Deficiente',sym:'⚠'},
];
```

### DEFICIENCIAS (11 tipos)

| id | label | icon | DEF_ACTION_MAP |
|---|---|---|---|
| separacion | Separación >5mm | ↔ | pulir |
| descuadre | Descuadre de Rasgo | ◇ | (ninguna — removido) |
| desaplomo | Ventana desaplomada | 📐 | aplomar |
| sinSellador | Sin FC11 bajo marco | 💧 | impermeabilizar |
| sinSelladorFrente | Sin FC11 frente | 💦 | sellarFrente |
| retornoMalla | Malla retorno EIFS | 🔲 | repararEIFS |
| mallaPulida | Malla pulida | ⚠ | repararEIFS |
| vidrioTrizado | Vidrio trizado | 🔍 | reemplazarVidrio |
| marcoPerforado | Marco perforado | 🔧 | repararMarco |
| faltaFijacion | Falta fijación en marco | 🔩 | instalarFijacion |
| **sinImpermeabilizar** | **Rasgo sin impermeabilizar** | 🌧 | **impermeabilizarRasgo** (v2.9) |

### ACTIONS (10 acciones correctivas)

| id | label | icon | color CSS |
|---|---|---|---|
| pulir | Pulir Rasgo | 🟣 | purple |
| aplomar | Aplomar ventana | 📐 | blue |
| impermeabilizar | Aplicar sello bajo marco | 💧 | cyan |
| sellarFrente | Aplicar sello frente ventana | 💦 | blue |
| repararEIFS | Reparar retorno EIFS | 🔧 | blue |
| reemplazarVidrio | Reemplazar vidrio | 🔍 | cyan |
| repararMarco | Aplicar sello | 🪣 | cyan |
| instalarFijacion | Instalar fijación | 🔩 | purple |
| cargarMortero | Cargar mortero en rasgo | 🏗 | cyan |
| **impermeabilizarRasgo** | **Impermeabilizar rasgo** | 🛡 | **yellow** (v2.9) |

> **REGLA:** colores de acciones = `blue`, `cyan`, `purple`, `yellow` (yellow nuevo en v2.9 para distinguir impermeabilización de rasgo). NUNCA `red`, `orange`, `green` (reservados para estados de ventana).

---

## 6. Paleta de Colores — Referencia Completa

### Estados de ventana (únicos, sin mezcla):

| Estado | Color | CSS class |
|---|---|---|
| Instalada | `--ac-green` | `.sel-instalada` |
| Pendiente | `--ac-orange` | `.sel-pendiente` |
| No Instalada | Neutro (sin bg) | `.sel-noinstalada` |
| Quitar | `--ac-red` | `.sel-quitar` |
| No Instalar | `--ac-purple` | `.sel-noinstalar` |
| Sin Ventana | `#f0f4f8` / `#cbd5e1` (dark) con texto `#1e293b` | `.sel-sinventana` |

### Deficiencias e inconformidades:
- Chip activo: `--ac-cyan` (era red — cambiado para no confundir con "Quitar")

### Acciones correctivas:
- Check "completado": `--ac-blue` (era green — cambiado para no confundir con "Instalada")
- Colores por acción: blue / cyan / purple (ver tabla ACTIONS arriba)

### Variables CSS disponibles:
```css
--ac-blue, --ac-blue-soft
--ac-green, --ac-green-soft
--ac-orange, --ac-orange-soft
--ac-red, --ac-red-soft
--ac-purple, --ac-purple-soft
--ac-cyan, --ac-cyan-soft
--ac-yellow, --ac-yellow-soft   /* v2.9 — usado por acción impermeabilizarRasgo */
--bg-0, --bg-1, --bg-2, --bg-3
--tx-0, --tx-1, --tx-2
--border, --radius, --radius-sm
```

Badge classes: `.badge-blue`, `.badge-green`, `.badge-orange`, `.badge-red`, `.badge-purple`, `.badge-cyan`, `.badge-yellow` (v2.9).
Tema oscuro via `[data-theme="dark"]`. Overrides específicos por tema: `[data-theme="dark"] .clase-especifica { ... }`.

---

## 7. Estructura de Edificios

### BLDG_RAW — formato: `[edif, tipo, sa, [tipos_p1], [tipos_p2-5] o null=igual]`

- `null` en el 5to campo significa pisos 2-5 = mismos tipos que piso 1
- Posiciones: 0=X01, 1=X02, 2=X03, 3=X04

### Edificios con MR (tipo especial) en piso 1:

| Edif | p1 | p2-5 |
|---|---|---|
| 7 | `['B','MR','B','MR']` | `['B','B','B','B']` |
| 16 | `['MR','B','MR','B']` | `['A','B','A','B']` |
| 24 | `['MR','B','MR','B']` | `['A','B','A','B']` |
| 31 | `['B','MR','B','MR']` | `['B','A','B','A']` |

### Tipos de departamento y sus ventanas:

```js
WIN_DEF = {
  A:  [V1-Izq, V1-Der, V1_D2, V1_D3, V3, V4, V1a],      // 7 ventanas
  B:  [V2, V1_D2, V1_D3, V3, V4, V1a],                    // 6 ventanas
  MR: [V5_1, V5_2, V5_3, V5a, V6_1, V6_2, V7],            // 7 ventanas
  // (Aa, C, Ca, D son variantes — ver código)
}
```

### Espacios comunes por piso:
- `EC{piso}` como depto (ej: EC1, EC3)
- Ventanas: PV1 (Mampara Acceso), PV2 (Mampara Trasera), V8 (Ventanal Escalera), V9 (Ventana Escalera)

### Key única de ventana:
```
{edif}-{depto}-{code}   →   ej: "16-201-V1-Izq",  "7-EC3-PV1"
```
`deptNum(floor, posIdx) = floor*100 + (posIdx+1)` → piso 2, pos 0 = depto 201

---

## 8. Patrones de Código Críticos

### Renderizado con `h()`:
```js
h('div', {className:'card', style:{padding:'10px'}, onClick:()=>{}}, [
  h('span', {}, ['texto']),
  condicion ? h('div', {}, ['...']) : null,
].filter(Boolean))
```

### Long-press en mobile (patrón estándar):
```js
let pressTimer=null, longFired=false, touchHandled=false, scrolled=false, startX=0, startY=0;
el.addEventListener('touchstart',(ev)=>{
  longFired=false; touchHandled=false; scrolled=false;
  startX=ev.touches[0].clientX; startY=ev.touches[0].clientY;
  pressTimer=setTimeout(()=>{
    if(scrolled)return;
    longFired=true; touchHandled=true;
    navigator.vibrate&&navigator.vibrate(50);
    // acción long-press
  },450);
},{passive:true});
el.addEventListener('touchmove',(ev)=>{
  if(Math.abs(ev.touches[0].clientX-startX)>10||Math.abs(ev.touches[0].clientY-startY)>10){
    scrolled=true; clearTimeout(pressTimer);
  }
},{passive:true});
el.addEventListener('touchend',()=>{
  clearTimeout(pressTimer);
  if(!longFired&&!scrolled){ touchHandled=true; /* acción tap corto */ }
},{passive:true});
el.addEventListener('click',()=>{
  if(!touchHandled&&!scrolled){ /* acción click desktop */ }
  touchHandled=false; longFired=false; scrolled=false;
});
el.addEventListener('contextmenu',(ev)=>ev.preventDefault());
```

### Elementos touch dentro de tablas scrollables (sealCell):
Usar **`document.createElement` imperativo**, NO `h()`, para poder adjuntar eventos touch correctamente. Ver `sealCell()` como referencia.

### Overlay/Modal pattern (post-v2.9):
```js
// Tipo A — overlay creado con createElement, listener separado:
const overlay = document.createElement('div');
overlay.className = 'overlay';
closeOverlayOnBackdrop(overlay);  // helper v2.9
overlay.appendChild(modal);
document.body.appendChild(overlay);

// Tipo B — overlay creado con h() inline:
const overlay = h('div',{className:'overlay', onClick:closeOnBackdropClick}, [
  h('div',{className:'modal'},[...contenido...])
]);
document.body.appendChild(overlay);
```

### Guardar y navegar desde modal:
```js
// Siempre: actualizar data → saveLocal() → cerrar overlay → re-render vista
w.campo = valor;
saveLocal();
overlay.remove();
renderVistaActual();
```

### updateWindow — dos firmas:
```js
updateWindow(key, 'campo', valor, 'descripcion historial');  // campo simple
updateWindow(key, (w)=>{ w.acciones.pulir.done=true; }, null, 'descripcion'); // mutación compleja
```

### showMmPicker — drum-roll para separacionMm:
```js
showMmPicker(currentMm, label, (mm)=>{
  w.separacionMm = mm;
  saveLocal();
  updateWindow(key, 'estadoVano', v, `Rasgo: ... → ${v} (${mm}mm)`);
  renderWindowDetail(...);
});
```

### showSelloPopup — modal completo sello exterior:
```js
showSelloPopup(key, code, deptoLabel, ()=>renderSealMap());
// onDone callback se llama al guardar
```

### Navegación next/prev en perfil de ventana:
```js
// Calcular siblings desde key
const [edifPart, deptoStr] = key.split('-');
// deptoStr puede ser '201' (depto normal) o 'EC3' (espacio común)
// Si es EC: getCommonWindows(floor)
// Si no: getDeptWindows(getDeptType(edif, floor, posIdx))
// Mostrar ◀ prev · N/Total · next ▶
```

---

## 9. Decisiones Técnicas Críticas

| Problema | Solución adoptada |
|---|---|
| textarea en móvil cierra teclado | `onBlur` en vez de `onInput` |
| Long-press vs scroll en tabla | flags `scrolled/longFired/touchHandled` + threshold 10px |
| sealCell touch events en `<table>` | `document.createElement` imperativo (no `h()`) |
| MmPicker sin barra scroll webkit | `.mm-drum::-webkit-scrollbar{display:none}` inyectado una vez |
| showSelloPopup redraw + textarea | `draw()` interna; textarea value restaurado via `setTimeout` |
| Sync sobreescribe cambios locales | `mergeFromSheets()` salta dirty keys |
| Apps Script CORS preflight | `Content-Type: text/plain` (no application/json) |
| Apps Script timeout | Chunks de 100 ventanas, timeout 120s |
| Back button / swipe exit Android | `history.pushState` + `popstate` listener + `confirm()` |
| posSection edificios MR mixtos | `floorCodes[f]` por piso; separador visual P1 vs P2-5; `—` donde no existe tipo |
| Lazy actions panel | `collectActions()` solo ejecuta al tocar el panel (evita scan 4740×9) |

### Back-button guard (init):
```js
const _vcBase = location.href.split('#')[0];
if(!history.state?.vc) history.pushState({vc:'app'},'', _vcBase+'#vc');
window.addEventListener('popstate', ()=>{
  history.pushState({vc:'app'},'', _vcBase+'#vc');  // re-push sentinel
  if(confirm('¿Salir de VentaControl?\n\nTus datos están guardados en el dispositivo.'))
    history.go(-2);
});
window.addEventListener('beforeunload', (e)=>{ e.preventDefault(); e.returnValue=''; }); // desktop fallback
```

### posSection — lógica edificios MR:
```js
// Para cada posición, obtener códigos de ventanas POR PISO (no solo piso 1)
const floorCodes = {};
for(let f=1;f<=5;f++) floorCodes[f] = getDeptWindows(getDeptType(e,f,posIdx)).map(([c])=>c);
// Códigos únicos en orden de aparición (piso 1 primero)
const allCodes = [], seen = new Set();
for(let f=1;f<=5;f++) floorCodes[f].forEach(c=>{ if(!seen.has(c)){ seen.add(c); allCodes.push(c); }});
// Celda ausente cuando tipo del piso no tiene esa ventana → td con '—'
```

---

## 10. Funcionalidades Implementadas (estado actual)

### Core
- [x] 34 edificios, tipos A/Aa/B/C/Ca/D/MR, 4740 ventanas
- [x] 6 estados ventana con paleta de colores única
- [x] 3 estados de rasgo: OK / Sobredimensionado / Subdimensionado
- [x] Drum-roll picker 1–50 mm (sin prompt nativo)
- [x] Badge separación `+Nmm`/`−Nmm` en perfil con botón editar
- [x] Navegación prev/next entre ventanas del mismo depto
- [x] Back-button / swipe-exit protection (Android PWA)
- [x] Tema claro/oscuro, persistente

### Deficiencias (10) — color cyan cuando activa
- [x] Descuadre renombrado a "Descuadre de Rasgo", sin sugerencia automática de acción
- [x] Resto: separación, desaplomo, FC11 bajo/frente, malla retorno/pulida, vidrio, marco, fijación

### Acciones Correctivas (9) — colores blue/cyan/purple
- [x] Ciclo: activar → completar → reabrir → quitar
- [x] Sugerencia automática por deficiencia (DEF_ACTION_MAP), excepto descuadre
- [x] Check "completado" en azul (no verde)

### Sello Exterior
- [x] 4 estados: sellado / pendiente / sinSellar / deficiente
- [x] Grado 1–5 (solo para deficiente)
- [x] showSelloPopup: modal con estado + grado + comentario
- [x] Card en perfil de ventana
- [x] Vista renderSealMap: grilla por posición (X01–X04, EC) × tipo ventana × piso 1–5
- [x] Edificios MR: sección muestra P1 (MR) + P2-5 (A/B) separadas con divisor visual
- [x] Tap corto = cicla sellado↔sinSellar; long-press = popup completo
- [x] Informe incluye sección SELLO EXTERIOR

### Condición de Funcionalidad
- [x] Rating 0–5 por ventana (0 = sin evaluar)
- [x] 5 círculos numerados en perfil, colores rojo→naranja→cyan→azul→verde
- [x] Etiquetas: Muy Deficiente / Deficiente / Regular / Buena / Excelente
- [x] Informe incluye sección CONDICIÓN DE FUNCIONALIDAD con lista críticos (1–2)

### Informe de texto — secciones:
1. RESUMEN GENERAL
2. PENDIENTES DE INSTALACIÓN
3. SIN INSTALAR
4. A QUITAR
5. INCONFORMIDADES ACTIVAS
6. ACCIONES CORRECTIVAS PENDIENTES
7. SELLO EXTERIOR
8. CONDICIÓN DE FUNCIONALIDAD
9. PEDIDO DE VENTANAS (solo estado `sinVentana`, columnas: Depto, Tipo, Orientación)

### Informe rápido por Acción Correctiva (renderActionReport)
- [x] Vista detallada: tabla ventanas con Dpto, Recinto, Tipo, Estado, Observaciones
- [x] Vista resumen: tabla agregada por depto con contes de ventanas
- [x] Botones copy/share/download (patrón idéntico a report)
- [x] Acceso desde vistabuilding: card "Informes por Acción Correctiva" con botones por acción pendiente
- [x] Acceso desde renderActionDetail: botón "📋 Ver informe detallado — Edif. X" (solo si single-building)

### Vistas disponibles:
- `dashboard` → `sa` → `building` → `dept` → `window` (detalle ventana)
- `building` → `sealmap` (mapa sello exterior)
- `building` → `gridmap` (grilla completa)
- `building` / `dept` → `report`

### Tracker de construcción:
- `EIFS_PHASES`: 3 fases (Montaje EPS, Terminaciones, Sellados) con sub-items
- Visible en vista SA por edificio

### Sync:
- Bidireccional pull+push, dirty keys protegidas, chunks de 100
- URL hardcodeada (no configurable por usuario)
- Pull parcial por edificio: `?edif=N`

---

## 11. Google Sheets — Columnas (32 columnas, sheet `REGISTRO`)

```
A:Edificio  B:Piso  C:N°Depto  D:TipoDepto  E:Elemento  F:TipoElemento  G:Estado
H:Separacion>5mm  I:Descuadre  J:SinFC11bajomarco  K:MallaEIFS  L:EstadoVano
M:Observaciones  N:UltimaActualizacion
─── v2 ───
O:Desaplomado  P:SinFC11frente  Q:MallaRetornoPulida  R:VidrioTrizado
S:MarcoPerforado  T:FaltaFijacion
U:Acc.PulirVano  V:Acc.Impermeabilizar  W:Acc.RepararEIFS  X:Acc.Aplomar
─── v2.2 ───
Y:Acc.SellarFrente  Z:Acc.Reempl.Vidrio  AA:Acc.RepararMarco  AB:Acc.InstalarFijac
AC:EtapaConstruccion  AD:Acc.CargarMortero
─── v2.9 ───
AE:SinImpermeabilizar (def)  AF:Acc.Imperm.Rasgo
─── PENDIENTE AGREGAR (selloExterior + funcionalidad NO sincronizan aún) ───
AG:SelloEstado  AH:SelloGrado  AI:SelloComentario  AJ:Funcionalidad  AK:SeparacionMm
```

**Nota deploy v2.9:** las columnas AE/AF requieren ejecutar `setup()` en Apps Script una vez para que la hoja real reciba los headers. El push/pull funciona aunque la hoja aún no tenga las columnas (`syncData` escribe celdas vacías; `readAll` lee `''` → coerce a 0/'').

---

---

## 12. Estado del Repositorio

### Commits recientes (sesión 2026-05-07/08, v2.9):
```
d388216 feat(apps-script): persistir sinImpermeabilizar + impermeabilizarRasgo en Sheets
1b42b53 feat(v2.9): nueva deficiencia 'Rasgo sin impermeabilizar' + acción 'Impermeabilizar rasgo'
6aba3de feat: búsqueda global de ventanas + Roadmap doc
888a00d refactor: migrar 6 loops anidados a forEachWindowIn{Floor,Bldg}
5e62dab refactor: helpers forEachWindowInFloor / forEachWindowInBldg
454da6f refactor: helper closeOnBackdropClick — unifica cierre de overlay
9293910 refactor: centralizar color maps en WINDOW_COLOR_MAPS
7731c7b refactor: cleanup trivial — DEBUG flag, selloExterior defaults, !important
```

**Helpers nuevos (post-v2.9, ya disponibles):**
- `forEachWindowInFloor`, `forEachWindowInBldg` — iteración de ventanas (no escribir loops anidados nuevos).
- `WINDOW_COLOR_MAPS.{estadoBg,estadoBorder,estadoText,actionColorMap}` — colores estado/acción centralizados.
- `closeOnBackdropClick(e)` / `closeOverlayOnBackdrop(ov)` — cierre de modales por click en backdrop.
- `searchWindows(q)` / `showSearchModal()` — búsqueda global con índice lazy.
- `DEBUG` flag — gate para console.logs no críticos.

### Estado:
- Worktree de trabajo: `C:\Proyectos\VentaControl\.claude\worktrees\print-letter\`
- Branch local: `print-letter` (trackea `origin/main`)
- Deploy: `git push origin HEAD:main` (la rama local NO se llama main, hay que ser explícito)
- Repo principal en `C:\Proyectos\VentaControl\` está en branch `master` (atrás respecto a main — no usar para edits)
- Todo pusheado ✓

---

## 13. Próximos Pasos (To-Do)

### Completado en sesión 2026-05-07/08 (v2.9)
- [x] Refactor mantenibilidad — DEBUG flag, color maps globales, helpers iteración + overlay (5 commits)
- [x] Búsqueda global ventana/depto/edif (botón 🔍 en sync bar) — `showSearchModal` + `searchWindows`
- [x] Roadmap doc (`Roadmap_VentaControl_v2.md`) con mejoras priorizadas en 5 tiers
- [x] Nueva deficiencia `sinImpermeabilizar` + acción `impermeabilizarRasgo` con color amarillo distintivo
- [x] Apps Script actualizado: persiste `sinImpermeabilizar` (col AE) y `impermeabilizarRasgo` (col AF)
- [x] Bug-fix: `act_cargarMortero` ahora se cuenta en stats RESUMEN (no se contaba antes)

### Pendiente para próxima sesión

**Action manual (no automatizable):**
- Re-deployar Apps Script en Google: pegar `AppsScript_VentaControl_v2.js` actualizado, ejecutar `setup()`, crear nueva versión del deployment. La URL no cambia.

### Alta prioridad
1. **Sync `selloExterior` + `funcionalidad` a Sheets** — siguen sin sincronizarse:
   - Agregar columnas AG–AK en `HEADERS[]` del Apps Script
   - Actualizar `syncData()`, `readAll()`, `buildSyncPayload()`, `mergeFromSheets()`
2. **Filtro por edificio en panel de acciones correctivas** (`renderLazyActionsCard`).
3. **Backup automático local** — descarga JSON al sync exitoso o guarda en IndexedDB. localStorage = pérdida silenciosa al limpiar pestaña.

### Media prioridad
4. **Preservar scroll al navegar atrás** — `navigateBack()` ya tiene infra de `scrollHistory`, pero `navigate()` siempre hace scrollTo(0,0). Verificar restauración funciona.
5. **Scroll position en gridmap** — al volver de detalle ventana → restaurar posición.
6. **PWA installability** — manifest.json usa data: URI. Generar PNG reales (icon-192.png, icon-512.png).
7. **Filtros adicionales en GridMap** (por estado, por deficiencia) — infra de filtro por acción ya existe.
8. **Dark mode toggle visible** — variables CSS ya existen, falta UI.

Ver `Roadmap_VentaControl_v2.md` Tier 1–5 para detalle completo.

---

## 14. Bugs Resueltos (histórico completo)

1. Sync enviaba 4740 ventanas → dirty tracking con Set
2. Apps Script escribía fila por fila → batch `setValues()`
3. Estado "Instalada" de Sheets no matcheaba → `normalizeEstado()`
4. Espacios comunes depto vacío en Sheet → reconstrucción `EC{piso}`
5. Historial repetido → deduplicación (skip si último entry = mismo)
6. Dashboard crash con panel acciones → lazy loading (`renderLazyActionsCard`)
7. Sync timeout en cambios masivos → timeout 120s + chunks 100
8. Sync sobreescribía cambios locales → dirty keys protegidas en `mergeFromSheets()`
9. dirtyKeys se perdía al recargar → persistido en `localStorage('vc2_dirty')`
10. Long-press disparaba nav + popup simultáneos → flag `touchHandled` + `contextmenu` prevention
11. posSection MR solo mostraba P1 → `floorCodes[f]` por piso, separador visual, `—` donde no aplica
12. GridMap filtros no mostraban todas las acciones → `deptNum(edif,f,p)` pasaba edif como parámetro floor (bug línea 1476) → corregido a `deptNum(f,p)`
13. Informe rápido por acción no era descubrible → agregada card en renderBuilding con botones directos por acción
14. Comentarios/observaciones no eran visibles → movidos al tope de building/window/dept con highlight naranja
15. (v2.9) `act_cargarMortero` no se contaba en stats RESUMEN del Apps Script → reemplazo `for(a=20;a<=27)` por `actCols=[20-27,29,31]`
16. (v2.9) `def_vanoAjustado` era código zombie en Apps Script (escribía pos 30 pero normalize truncaba a HEADERS.length=30) → eliminado, columna 30 reasignada a `sinImpermeabilizar`

---

*Actualizado: 2026-05-08 — Versión: v2.9 — Líneas: ~4920*
