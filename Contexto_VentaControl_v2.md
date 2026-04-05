# Documento de Traspaso de Contexto — VentaControl v2.3

---

## 1. Vision General del Proyecto

App HTML single-file (PWA) para el control de instalacion de ventanas en el Condominio Alberto Fuchslocher (Osorno, Chile): 34 edificios, 5 pisos cada uno, 4 departamentos por piso + espacios comunes = 4,740 ventanas totales. El objetivo es registrar en campo (desde celular) el estado de cada ventana, inconformidades, acciones correctivas, y sincronizar con Google Sheets como base de datos compartida.

---

## 2. Stack Tecnologico

| Componente | Detalle |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla — todo en un solo archivo (`VentaControl_v2.html`, ~2530 lineas) |
| Framework | Ninguno. Rendering imperativo via helper `h()` (createElement wrapper) |
| Persistencia local | `localStorage` — clave `ventacontrol_v2` (JSON con todos los datos) |
| Dirty tracking | `localStorage` — clave `vc2_dirty` (Set serializado de keys modificadas) |
| Perfil usuario | `localStorage` — clave `vc2_role` (`editor` / `viewer`) |
| URL backend | `localStorage` — clave `vc2_apps_url` |
| Backend | Google Apps Script (`AppsScript_VentaControl_v2.js`) desplegado como Web App |
| Base de datos | Google Sheets — Sheet ID: `1Ivnk1kXB1PVMqCAjKLRZzJnC72OdkL0zrIG_KB6WQz8`, hoja `REGISTRO`, 29 columnas (A-AC) |
| PWA | `manifest.json` + `sw.js` (cache-first strategy) |
| Hosting | GitHub Pages — repo `Chrisitomaster/VentaControlApp`, branch `main` |
| Versionamiento | Cache SW: `ventacontrol-v3.3` / App: `v2.3` / DATA.meta.version: `2.0` |

---

## 3. Arquitectura y Estructura

```
C:\Proyectos\VentaControl\
|-- VentaControl_v2.html        # App completa (HTML + CSS + JS) ~2530 lineas
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
| Configuracion JS | 260-378 | `BLDG_RAW`, `BUILDINGS`, `WIN_DEF`, `COMMON_WIN`, `DEFICIENCIES`, `ACTIONS`, `DEF_ACTION_MAP`, `ESTADOS`, `VANO_OPTS`, `BLDG_STAGES` |
| Helpers DOM | 380-410 | `$()`, `$$()`, `h()` (createElement builder), `ts()`, `pct()` |
| Data Model | 415-542 | `DATA`, `dirtyKeys`, `saveDirtyKeys/loadDirtyKeys`, `saveLocal()`, `updateWindow()`, `syncDefToActions()` |
| Stats | 546-655 | `getBldgStats()`, `getDeptStats()`, `getCommonStats()`, `getSAStats()`, `getGlobalStats()` |
| Router | 656-704 | `currentView`, `viewParams`, `navigate()`, `render()` |
| Views | 705-1530 | `renderLogin`, `renderDashboard`, `renderSA`, `renderBuilding`, `renderDept`, `renderWindow`/`renderWindowDetail`, `renderCommon` |
| Acciones correctivas | 1550-1780 | `renderLazyActionsCard()`, `collectActions()`, `renderActionsPanel()`, `renderActionDetail()` |
| Sync bar | 1807-1822 | `renderSyncBar()` |
| Modales/UI | 1824-1950 | `showLegend()`, `showExportMenu()`, topbar, bulk/clear |
| Sync engine | 1955-2100 | `doSync()`, `doPullOnly()`, `doPullSection()`, `doFullSync()`, `buildSyncPayload()` |
| Debug | 2158-2190 | `vcLog[]`, `logMsg()`, `showLogPanel()` |
| Merge | 2195-2320 | `mergeFromSheets()` con proteccion dirty keys |
| CSV/Import | 2320-2430 | `exportCSV()`, `importCSV()`, migracion v1 |
| Init | 2480-2530 | `initData()`, integrity checks, PWA registration |

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
- [x] 4 estados de ventana: instalada/pendiente/noInstalada/quitar con iconos
- [x] 3 estados de vano: OK/Sobredimensionado/Pulir
- [x] Sistema de perfiles: Editor (modifica) / Espectador (solo lectura)
- [x] Tema claro/oscuro con toggle persistente

### Deficiencias (10 tipos)
- [x] Separacion >5mm, Descuadre, Desaplomo, Sin FC11 bajo marco, Sin FC11 frente, Malla retorno EIFS, Malla pulida, Vidrio trizado, Marco perforado, Falta fijacion

### Acciones correctivas (8 tipos)
- [x] Pulir, Aplomar, Impermeabilizar (sello bajo marco), Sellar frente, Reparar EIFS, Reemplazar vidrio, Reparar marco, Instalar fijacion
- [x] Ciclo completo: activar → completar → reabrir → quitar
- [x] Auto-activacion desde deficiencias via `DEF_ACTION_MAP` + `syncDefToActions()`
- [x] Panel lazy-load en dashboard y SA (evita escanear 4740 ventanas en cada render)
- [x] Vista detalle por tipo de accion con badges de importancia y toggle masivo

### Vistas
- [x] Dashboard global con % bruto y ajustado, 5 SA cards
- [x] Vista SA con listado de edificios, badges de defectos/acciones, comentario edificio
- [x] Vista edificio: grilla deptos por piso, espacios comunes con botones rapidos, resumen inconformidades, mapa incidencias
- [x] Vista departamento: listado ventanas con estado rapido, iconos deficiencias/acciones, resumen incidencias
- [x] Vista detalle ventana: todas las propiedades, deficiencias colapsables, acciones, observaciones, historial
- [x] Vista espacios comunes (PV1, PV2, V8, V9)

### Tracker de construccion
- [x] 6 etapas EIFS por edificio (EPS muro → Granulado)
- [x] Etapa visible en listado de edificios en SA
- [x] Sincronizable con Google Sheets (columna AC)

### Sync
- [x] Sync bidireccional: pull + push dirty keys en chunks de 100
- [x] Proteccion dirty keys: merge remoto NO sobreescribe cambios locales pendientes
- [x] dirtyKeys persistido en localStorage (`vc2_dirty`) — sobrevive reload
- [x] Timeout de 120s por chunk push, 45s para pull
- [x] Pull por seccion: `?edif=N` para descargar solo un edificio
- [x] Normalizacion de estado y vano al importar desde Sheets
- [x] Reconstruccion de depto para espacios comunes (`EC{piso}`)
- [x] Sync completo manual (marca todas las keys dirty y envia)

### Otras
- [x] Cambio masivo de estado (por edificio/piso/depto)
- [x] Limpiar datos (por depto y por edificio, con confirmacion doble)
- [x] CSV export/import
- [x] Migracion desde v1 (localStorage `ventacontrol_data`)
- [x] Historial de cambios por ventana (deduplicado, max 50 entradas)
- [x] Leyenda de iconos y colores (menu ⋮)
- [x] Log de diagnostico (menu ⋮ → "Ver Log")
- [x] PWA offline con Service Worker cache-first

---

## 5. Descubrimientos y Decisiones Tecnicas

### Reglas de negocio
- **Key de ventana**: `{edif}-{depto}-{code}` — es la PK tanto en la app como en Sheets (columnas A+C+E)
- **Building key**: `bld-{edif}` — para datos a nivel edificio (comments, stage)
- **Tipo MR solo en piso 1**: Edif 7 (pos 2,4), 16 (pos 1,3), 24 (pos 1,3), 31 (pos 2,4). Pisos 2-5 son distinto layout
- **Edif 31 correccion**: Piso 2-5 es `['B','A','B','A']` (era `['B','MR','B','MR']` — corregido en v2.2)
- **% Ajustado**: `(instaladas - quitar) / total × 100` — descuenta ventanas marcadas para retirar
- **DEF_ACTION_MAP**: Una deficiencia activa automaticamente su accion correctiva, pero desactivar la deficiencia NO desactiva la accion (puede ser independiente)

### Decisiones tecnicas criticas
- **textarea `onBlur` no `onInput`**: En movil, `onInput` dispara re-render que cierra el teclado. Solucion: solo guardar al perder foco.
- **Sync pull-then-push**: El pull siempre va primero para obtener datos de otros usuarios. Los dirty keys se protegen del overwrite remoto.
- **Lazy actions panel**: `collectActions(1,34)` escanea 4740 ventanas × 8 acciones = ~37,920 iteraciones. En dashboard se colapsaba/crasheaba el navegador movil. Solucion: `renderLazyActionsCard()` que solo ejecuta `collectActions()` cuando el usuario toca el panel.
- **Content-Type `text/plain`**: Apps Script requiere esto (no `application/json`) para evitar CORS preflight en POST.
- **Chunks de 100**: Apps Script tiene timeout de 30s por ejecucion. Lotes de 200 daban timeout; 100 es seguro.
- **`fetchWithTimeout()` con `Promise.race`**: El `fetch` nativo no tiene timeout. Wrapper con `setTimeout` + reject.
- **`normalizeEstado()`**: Sheets devuelve "Instalada" (mayuscula) pero la app usa "instalada" (minuscula). Tambien mapea "Si" → "instalada", "No" → "noInstalada".

### Bugs resueltos (historico)
1. Sync enviaba las 4740 ventanas cada vez → dirty tracking con Set
2. Apps Script escribia fila por fila → batch writes con single `setValues()`
3. Estado "Instalada" de Sheets no matcheaba "instalada" de app → `normalizeEstado()`
4. Espacios comunes con depto vacio en Sheet → reconstruccion `EC{piso}`
5. EstadoVano no coincidia en detalle → `normalizeVano()`
6. Historial repetido por clicks multiples → deduplicacion (skip si ultimo entry = mismo)
7. Dashboard crasheaba con panel acciones globales → lazy loading (`renderLazyActionsCard`)
8. Sync timeout en cambios masivos (2 edificios = ~280 keys) → timeout 120s + chunks 100
9. Barra sync se sobreponía al contenido → `padding-bottom:120px` + layout compacto
10. **Sync sobreescribia cambios locales**: `mergeFromSheets()` pisaba datos dirty con valores viejos de Sheets → ahora salta dirty keys (local wins)
11. **dirtyKeys se perdia al recargar pagina** → persistido en `localStorage('vc2_dirty')`

---

## 6. Estado Actual Exacto

### Ultima tarea completada
Fix critico de sincronizacion: `mergeFromSheets()` ahora salta keys con cambios locales pendientes (`dirtyKeys`). Las dirty keys se persisten en localStorage para sobrevivir recargas.

### Archivos modificados en la ultima sesion (2026-04-05)
- `VentaControl_v2.html`: Lazy actions panel, dirty key protection en merge, dirty persistence, version bumped a v2.3
- `sw.js`: Cache bumped a `ventacontrol-v3.3`
- `manifest.json`: Version bumped a v2.3

### Commits realizados hoy (2026-04-05)
```
3b8670a Fix sync overwriting local changes: dirty keys protected from merge
6fe1891 Fix 3 bugs: crash en acciones correctivas, timeout sync, barra inferior
```

### Estado del repo
- Branch: `master` local → pushea a `main` en GitHub (`git push origin master:main`)
- GitHub Pages: activo, sirve desde `main`
- Todo pusheado, sin cambios pendientes

---

## 7. Proximos Pasos (To-Do Inmediato)

### 1. Nueva deficiencia: "Vano subdimensionado/ajustado"
Agregar una 11va deficiencia para registrar cuando el rasgo de la ventana queda muy ajustado a la medida, impidiendo la instalacion de la ventana despues de aplicar malla EIFS + yeso. Su accion correctiva correspondiente es **Pulir Vano**. Ademas, corregir el mapeo actual: la deficiencia "Separacion >5mm" debe tener como accion correctiva **"Cargar con mortero"** (nueva accion, no pulir). Implica:
- Agregar `{id:'vanoAjustado', label:'Vano subdimensionado', icon:'📏'}` a `DEFICIENCIES[]` (~linea 323)
- Agregar nueva accion `{id:'cargarMortero', label:'Cargar vano con mortero', icon:'...', color:'...'}` a `ACTIONS[]` (~linea 336)
- Actualizar `DEF_ACTION_MAP`: `separacion → cargarMortero` (era `pulir`), `vanoAjustado → pulir`
- Agregar campo `vanoAjustado` a `newWindowRecord().deficiencias` (~linea 488)
- Agregar campo `cargarMortero` a `newWindowRecord().acciones` (~linea 490)
- Actualizar `AppsScript_VentaControl_v2.js`: nuevas columnas en HEADERS, syncData, readAll
- Actualizar `buildSyncPayload()` y `mergeFromSheets()` con los nuevos campos

### 2. Filtro rapido por edificio en panel de acciones correctivas
Actualmente `renderLazyActionsCard` carga todo el rango (1-34 en dashboard, start-end en SA). Agregar un dropdown/selector de edificio que filtre las acciones mostradas. Aplica a dashboard y SA.

### 3. Preservar scroll position al navegar atras
Actualmente `navigate()` hace `window.scrollTo(0,0)` siempre. Al volver de un depto a la vista de edificio, se pierde la posicion de scroll. Solucion: guardar `scrollY` antes de navegar forward y restaurarlo al navegar back. Implementar un stack de navegacion:
```js
const navStack = [];
function navigate(view, params={}) {
  navStack.push({ view: currentView, params: viewParams, scrollY: window.scrollY });
  currentView = view;
  viewParams = params;
  render();
  window.scrollTo(0, 0);
}
function goBack() {
  const prev = navStack.pop();
  if (prev) {
    currentView = prev.view;
    viewParams = prev.params;
    render();
    requestAnimationFrame(() => window.scrollTo(0, prev.scrollY));
  }
}
```
Actualizar todos los botones "← Volver" para usar `goBack()` en vez de `navigate(parentView)`.

---

## Variables y constantes clave (no renombrar)

| Variable | Uso |
|---|---|
| `DATA` | Objeto raiz con `.windows`, `.buildings`, `.meta` |
| `DATA.windows[key]` | Record de ventana. Key: `{edif}-{depto}-{code}` |
| `DATA.buildings[bKey(edif)]` | `{comment, accionesPendientes, stage}` |
| `dirtyKeys` | `Set<string>` — keys modificadas sin sync |
| `DEFICIENCIES` | Array de `{id, label, icon}` — 10 deficiencias |
| `ACTIONS` | Array de `{id, label, icon, color}` — 8 acciones correctivas |
| `DEF_ACTION_MAP` | `{defId: actionId}` — mapeo deficiencia → accion |
| `ESTADOS` | 4 estados de ventana: instalada/pendiente/noInstalada/quitar |
| `VANO_OPTS` | `['OK','Sobredimensionado','Pulir']` |
| `BLDG_STAGES` | 6 etapas de construccion EIFS |
| `currentView` | Vista activa: dashboard/sa/building/dept/window/common/actionDetail |
| `viewParams` | Parametros de vista: `{edif, depto, code, loc, sa, actionId, ...}` |
| `syncing` | Boolean — previene sync concurrente |
| `APPS_SCRIPT_URL` | URL del Web App de Apps Script |
| `SHEET_ID` | ID de la hoja de Google Sheets |

## Google Sheets — Columnas actuales (29)

```
A:Edificio  B:Piso  C:N°Depto  D:TipoDepto  E:Elemento  F:TipoElemento  G:Estado
H:Separacion>5mm  I:Descuadre  J:SinFC11bajomarco  K:MallaEIFS  L:EstadoVano
M:Observaciones  N:UltimaActualizacion  O:Desaplomado  P:SinFC11frente
Q:MallaRetornoPulida  R:VidrioTrizado  S:MarcoPerforado  T:FaltaFijacion
U:Acc.PulirVano  V:Acc.Impermeabilizar  W:Acc.RepararEIFS  X:Acc.Aplomar
Y:Acc.SellarFrente  Z:Acc.Reempl.Vidrio  AA:Acc.RepararMarco  AB:Acc.InstalarFijac
AC:EtapaConstruccion
```

Al agregar la nueva deficiencia (vano subdimensionado) y accion (cargar mortero), se deben agregar 2 columnas nuevas (AD, AE) tanto en `HEADERS[]` del Apps Script como en `syncData()` y `readAll()`.

---

*Documento generado: 2026-04-05 — Version app: v2.3 — Cache SW: v3.3*
