# Documento de Traspaso de Contexto — VentaControl v2.5

> **PARA LA IA QUE LEA ESTO:** Este archivo es el punto de entrada para cualquier sesión nueva. Léelo completo antes de tocar código. Contiene el estado real del proyecto, decisiones técnicas críticas, y patrones que DEBES respetar para no romper cosas. El archivo principal es `VentaControl_v2.html` (~3890 líneas), single-file, sin bundler, sin framework.

---

## 1. Visión General del Proyecto

App HTML single-file (PWA) para el control de instalación de ventanas en el Condominio Alberto Fuchslocher (Osorno, Chile): **34 edificios, 5 pisos cada uno, 4 departamentos por piso + espacios comunes = 4,740 ventanas totales**. Se usa desde celular en obra. Registra estado de cada ventana, inconformidades, sello exterior, condición de funcionalidad, acciones correctivas. Sincroniza con Google Sheets como base de datos compartida.

**Usuario:** Trabaja en iOS/Android Chrome en obra. Touch es el input principal. Prefer: rápido, sin prompts nativos, gestos intuitivos.

---

## 2. Stack Tecnológico

| Componente | Detalle |
|---|---|
| Frontend | HTML5 + CSS3 + JS vanilla — **todo en un solo archivo** (`VentaControl_v2.html`, ~3890 líneas) |
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
├── VentaControl_v2.html        ← ÚNICO ARCHIVO A MODIFICAR (~3890 líneas)
├── sw.js                       ← Service Worker (cache-first)
├── manifest.json               ← PWA manifest
├── AppsScript_VentaControl_v2.js ← Google Apps Script (se copia a Google)
└── Contexto_VentaControl_v2.md ← Este archivo
```

### Mapa de secciones internas (`VentaControl_v2.html`):

| Sección | Líneas aprox. | Qué hay |
|---|---|---|
| CSS `<style>` | 1–260 | Variables CSS (claro/oscuro), todos los componentes UI |
| Constantes JS | 260–415 | `BLDG_RAW`, `BUILDINGS`, `WIN_DEF`, `COMMON_WIN`, `DEFICIENCIES`, `ACTIONS`, `DEF_ACTION_MAP`, `ESTADOS`, `VANO_OPTS`, `SELLO_ESTADOS`, `EIFS_PHASES` |
| Helpers DOM | 415–435 | `$()`, `$$()`, `h()`, `ts()`, `pct()` |
| Data model | 435–575 | `DATA`, `dirtyKeys`, `newWindowRecord()`, `saveLocal()`, `updateWindow()` |
| Stats | 575–685 | `getBldgStats()`, `getDeptStats()`, `getCommonStats()`, `getSAStats()` |
| Router | 685–725 | `currentView`, `viewParams`, `navigate()`, `navigateBack()`, `render()` |
| Vistas | 725–1455 | `renderLogin`, `renderDashboard`, `renderSA`, `renderBuilding`, `renderDept`, `renderGridMap`, `renderCommon` |
| Action Report | 1455–1520 | `generateActionReport()`, `renderActionReport()` — informe rápido por acción correctiva |
| MM Picker | 1520–1640 | `showMmPicker()` — drum-roll scroll 1–50 mm |
| Sello Popup | 1640–1770 | `showSelloPopup()` — modal sello con estado/grado/comentario |
| Seal Map | 1770–1980 | `renderSealMap()` — grilla sello exterior |
| Report | 1980–2280 | `generateReport()`, `renderReport()` — informe completo edificio |
| Window Detail | 2115–2650 | `renderWindowDetail()`, `renderWindowEC()`, `renderWindowDepto()` |
| Bulk/Modals | 2650–2720 | `showBulkModal()`, `showLegend()`, `topbar()` |
| Sync engine | 2720–2920 | `doSync()`, `buildSyncPayload()`, `mergeFromSheets()` |
| CSV/Import | 2920–3120 | `exportCSV()`, `importCSV()`, migración v1 |
| Init | 3720–3892 | `initData()` — integrity checks, migración de campos, PWA registration, back-button guard |

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
    descuadre: false,              // Descuadre de Rasgo (renombrado, sin sugerencia de acción)
    desaplomo: false,              // Ventana desaplomada
    sinSellador: false,            // Sin FC11 bajo marco
    sinSelladorFrente: false,      // Sin FC11 frente
    retornoMalla: false,           // Malla retorno EIFS
    mallaPulida: false,            // Malla pulida
    vidrioTrizado: false,
    marcoPerforado: false,
    faltaFijacion: false,
  },
  acciones: {
    pulir:            {active:false, done:false},
    impermeabilizar:  {active:false, done:false},
    repararEIFS:      {active:false, done:false},
    aplomar:          {active:false, done:false},
    sellarFrente:     {active:false, done:false},
    reemplazarVidrio: {active:false, done:false},
    repararMarco:     {active:false, done:false},
    instalarFijacion: {active:false, done:false},
    cargarMortero:    {active:false, done:false},
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

**REGLA CRÍTICA:** Cada vez que se agrega un campo nuevo a `newWindowRecord()`, hay que agregar su migración en **DOS lugares** del loop de `initData()` (loop deptos + loop EC):

```js
// Ejemplo — patrón a seguir:
if(!w.selloExterior) w.selloExterior = {estado:'sinSellar', grado:0, comentario:''};
if(w.funcionalidad === undefined) w.funcionalidad = 0;
if(w.estadoVano === 'Pulir') { w.estadoVano = ''; saveLocal(); }  // migración de valor obsoleto
```

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

### DEFICIENCIAS (10 tipos)

| id | label | DEF_ACTION_MAP |
|---|---|---|
| separacion | Separación >5mm | pulir |
| descuadre | Descuadre de Rasgo | (ninguna — removido) |
| desaplomo | Ventana desaplomada | aplomar |
| sinSellador | Sin FC11 bajo marco | impermeabilizar |
| sinSelladorFrente | Sin FC11 frente | sellarFrente |
| retornoMalla | Malla retorno EIFS | repararEIFS |
| mallaPulida | Malla pulida | repararEIFS |
| vidrioTrizado | Vidrio trizado | reemplazarVidrio |
| marcoPerforado | Marco perforado | repararMarco |
| faltaFijacion | Falta fijación | instalarFijacion |

### ACTIONS (9 acciones correctivas)

| id | label | color CSS |
|---|---|---|
| pulir | Pulir Rasgo | purple |
| aplomar | Aplomar ventana | **blue** |
| impermeabilizar | Aplicar sello bajo marco | cyan |
| sellarFrente | Aplicar sello frente ventana | **blue** |
| repararEIFS | Reparar retorno EIFS | **blue** |
| reemplazarVidrio | Reemplazar vidrio | **cyan** |
| repararMarco | Aplicar sello | **cyan** |
| instalarFijacion | Instalar fijación | purple |
| cargarMortero | Cargar mortero en rasgo | **cyan** |

> **REGLA:** colores de acciones = solo `blue`, `cyan`, `purple`. NUNCA `red`, `orange`, `green` (reservados para estados de ventana).

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
--bg-0, --bg-1, --bg-2, --bg-3
--tx-0, --tx-1, --tx-2
--border, --radius, --radius-sm
```
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

### Overlay/Modal pattern:
```js
const overlay = h('div',{className:'overlay',onClick:(e)=>{if(e.target===overlay)overlay.remove();}}, [
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

## 11. Google Sheets — Columnas

```
A:Edificio  B:Piso  C:N°Depto  D:TipoDepto  E:Elemento  F:TipoElemento  G:Estado
H:Separacion>5mm  I:Descuadre  J:SinFC11bajomarco  K:MallaEIFS  L:EstadoVano
M:Observaciones  N:UltimaActualizacion  O:Desaplomado  P:SinFC11frente
Q:MallaRetornoPulida  R:VidrioTrizado  S:MarcoPerforado  T:FaltaFijacion
U:Acc.PulirVano  V:Acc.Impermeabilizar  W:Acc.RepararEIFS  X:Acc.Aplomar
Y:Acc.SellarFrente  Z:Acc.Reempl.Vidrio  AA:Acc.RepararMarco  AB:Acc.InstalarFijac
AC:EtapaConstruccion
──── PENDIENTE AGREGAR ────
AD:SelloEstado  AE:SelloGrado  AF:SelloComentario  AG:Funcionalidad  AH:SeparacionMm
```

---

## 12. Estado del Repositorio

### Commits recientes:

**Sesión 2026-04-25:**
```
436078f fix: PEDIDO DE VENTANAS — solo sinVentana, con tipo/depto/orientación
3ae1831 feat: comentarios arriba + acceso directo a informes por acción
87f7c36 feat: informe rápido por acción + fix filtros gridmap
31b9280 v2.5: dashboard, stats, navigation, gridmap, touch targets overhaul
43c0242 docs: contexto v2.5 — guía completa para sesiones futuras de IA
```

**Sesión 2026-04-16:**
```
db27f40 Paleta de colores: estados únicos, inconformidades y acciones distintos
5daf995 4 mejoras: mapa sello MR, nav ventana, salida segura, descuadre
73388c1 docs: actualizar contexto v2.4
70470be Rasgo: quitar Pulir, picker mm carrete, funcionalidad 1-5
c4bc779 Sello exterior: estados ricos con popup, perfil de ventana e informe
9508b07 Mapa de sello: rediseñar grilla por posición de depto × piso
304159a Hardcodear URL de Apps Script para sync automático
1cb7573 UX overhaul: 19 mejoras de interfaz, nuevos estados y vistas
```

### Estado:
- Worktree: `C:\Proyectos\VentaControl\.claude\worktrees\interesting-raman\`
- Branch local: `claude/interesting-raman`
- Deploy: `git push origin claude/interesting-raman:main`
- Todo pusheado ✓

---

## 13. Próximos Pasos (To-Do)

### Completado en sesión 2026-04-25
- [x] Informe rápido por acción correctiva (renderActionReport con dos tablas: detalle + resumen)
- [x] Acceso directo desde vista building (card "Informes por Acción Correctiva" + botones por acción)
- [x] Acceso desde renderActionDetail (botón "📋 Ver informe detallado")
- [x] Comentarios/observaciones movidos al tope de cada vista (building, window, dept) con visual destacado
- [x] Fix gridmap: filtro deptNum corregido (eliminada referencia incorrecta a `edif`)
- [x] PEDIDO DE VENTANAS: solo sinVentana, columnas tipo/depto/orientación

### Alta prioridad
1. **Sync nuevos campos a Sheets** — `selloExterior` y `funcionalidad` NO se sincronizan aún:
   - Agregar columnas AD–AH en `HEADERS[]` del Apps Script
   - Actualizar `syncData()` y `readAll()` en AppsScript
   - Actualizar `buildSyncPayload()` (agregar campos al objeto de cada ventana)
   - Actualizar `mergeFromSheets()` (leer y aplicar campos nuevos)

2. **Filtro por edificio en panel de acciones correctivas** — `renderLazyActionsCard` carga rango 1–34. Agregar selector de edificio para acotar.

### Media prioridad
3. **Preservar scroll al navegar atrás** — `navigate()` siempre hace `scrollTo(0,0)`. Guardar `scrollY` en navStack y restaurar al `navigateBack()`.

4. **Scroll position en gridmap** — Al volver de detalle ventana a gridmap, restaurar posición.

5. **PWA installability** — manifest.json usa data: URI para icon. Generar PNG reales (icon-192.png, icon-512.png) y actualizar manifest.

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

---

*Actualizado: 2026-04-25 — Versión: v2.5 — Líneas: ~3890*
