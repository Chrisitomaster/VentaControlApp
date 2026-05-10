# Roadmap VentaControl v2

**Última actualización:** 2026-05-01
**Versión actual app:** v2.8 + refactor mantenibilidad

Documento vivo con análisis del estado actual, recomendaciones de mejora priorizadas, y notas para futuras sesiones con Claude Opus.

---

## 1. Contexto

VentaControl es una **PWA single-file** (vanilla JS, ~4,860 líneas en `VentaControl_v2.html`) para auditoría de instalación y calidad de **4,740 ventanas** en 34 edificios (Condominio Alberto Fuchslocher, Osorno).

**Stack:**
- Frontend: HTML + CSS + JS vanilla, helper `h()` para DOM imperativo.
- Persistencia local: `localStorage` (3 keys: `ventacontrol_v2`, `vc2_dirty`, `vc2_role`).
- Sync: Google Apps Script Web App ↔ Google Sheets (hoja `REGISTRO`).
- Hosting: GitHub Pages (`Chrisitomaster/VentaControlApp`, branch `main`).
- PWA: `manifest.json` + `sw.js` (cache-first).

**Modelo de datos:**
- 4,740 ventanas con: estado (6 valores), rasgo, separación mm, deficiencias (10), acciones correctivas (9), sello exterior, funcionalidad (0–5), historial, fotos.
- 34 edificios × 5 pisos × (4 deptos + EC) = ~700 ventanas por edificio.
- 5 SA (sectores administrativos) agrupando edificios.

**Restricciones del usuario (memoria):**
- Mantener single-file (no separar CSS/JS).
- Comportamiento idéntico en refactors (cero regresiones).
- Push a `main` al terminar; el usuario revisa desde celular.
- Comunicación caveman mode.

---

## 2. Sesión actual (2026-05-01) — Refactor mantenibilidad

5 commits granulares aplicados al `main`:

| Hash | Cambio | Δ líneas |
|---|---|---|
| `7731c7b` | Cleanup: DEBUG flag, defaults selloExterior, !important | +7 −6 |
| `9293910` | `WINDOW_COLOR_MAPS` global (estadoBg/Border/Text/actionColorMap) | +10 −5 |
| `454da6f` | Helper `closeOnBackdropClick` — 8 overlays unificados | +11 −8 |
| `5e62dab` | Helpers `forEachWindowIn{Floor,Bldg}` + migrar `initData` | +24 −20 |
| `888a00d` | Migrar 6 loops anidados duplicados → helpers | +17 −55 |

**Neto:** ~50 líneas de duplicación eliminadas. Comportamiento preservado.

**Helpers nuevos disponibles para futuras sesiones:**
- `WINDOW_COLOR_MAPS.{estadoBg,estadoBorder,estadoText,actionColorMap}` — color maps ventana/acción.
- `closeOnBackdropClick(e)` — handler para overlays inline.
- `closeOverlayOnBackdrop(ov)` — wrapper para overlays con addEventListener.
- `forEachWindowInFloor(edif, floor, cb)` — itera deptos+comunes de un piso.
- `forEachWindowInBldg(edif, cb)` — itera todo un edificio (deptos primero, luego comunes).
- `DEBUG` flag — gate para console.logs no críticos.

**Decisiones intencionales (NO refactorizar sin pensar):**
- 3 variantes locales de `selloColors` se dejaron intencionalmente: `showSelloPopup` (txt:tx-1), `renderSealMap` (txt:tx-2), `renderWindowDetail` (yellow vs orange en pendiente). No son duplicación — son variantes de diseño.
- Línea 296 `.print-mode .topbar...display:none !important` se mantiene (necesario en pantalla print-mode, complementa media print línea ~400).

---

## 3. Recomendaciones priorizadas

### Tier 1 — Quick wins (alto valor, bajo esfuerzo) — ✅ TODOS COMPLETADOS (v2.10)

| # | Mejora | Estado |
|---|---|---|
| 1 | Búsqueda global ventana/depto (botón 🔍 sync bar) | ✅ v2.9 commit `6aba3de` |
| 2 | Filtros adicionales GridMap (estado + deficiencia, además de acción) | ✅ v2.10 |
| 3 | Backup automático local al sync (3 snapshots rotativos sin fotos en localStorage, modal para restaurar) | ✅ v2.10 |
| 4 | Dark mode toggle visible (ya existía: slider en topbar línea 1109) | ✅ pre-existente |
| 5 | Quick-jumper 34 edificios en dashboard (grid 8col por SA, color por avance) | ✅ v2.10 |

### Tier 2 — Features alto valor (esfuerzo medio)

| # | Mejora | Por qué |
|---|---|---|
| 6 | **Fotos por ventana** con compresión cliente (canvas resize → base64 < 100KB) | Ya hay `fotos:[]` en record sin UI. Sin compresión = quota localStorage rota. |
| 7 | **Asignación de acciones a personas** (`assignedTo` field) | Coordinación cuadrillas. Hoy solo `active/done`. |
| 8 | **Conflict resolution UI** al merge sync (campo cambiado por A vs B) | Hoy dirty keys protege locales pero pierde silenciosamente cambios remotos. |
| 9 | **Cronograma EIFS con fechas** (inicio/fin planificado vs real por fase) | Hoy fases solo complete/partial. Falta dimensión temporal. |
| 10 | **Comentario con foto adjunta** | Reportes terreno → "vidrio trizado, ver foto". |

### Tier 3 — Robustez / mantenibilidad

| # | Mejora | Por qué |
|---|---|---|
| 11 | **Schema versioning del DATA** (campo `meta.version` ya existe — usar para migrations explícitas) | Migrations hoy esparcidas en `initData`. Centralizar. |
| 12 | **Smoke tests con Playwright** (login → toggle estado → reload → persiste) | Cada commit hoy depende de revisión visual desde celular. |
| 13 | **Audit log agregado** (quién/cuándo a nivel app) | Hoy historial es por ventana. Falta vista global. |
| 14 | **Auth real** (PIN compartido al menos, no solo localStorage role) | Cualquiera con la URL puede ser editor. |

### Tier 4 — UX / Performance

| # | Mejora | Por qué |
|---|---|---|
| 15 | **Touch gestures** (swipe izq/der entre ventanas del depto) | Más rápido que volver a lista. |
| 16 | **Virtualization en GridMap** (~700 cells por edificio) | Mobile lento al renderizar todo. |
| 17 | **PDF directo via jsPDF** (no `window.print()`) | Print actual depende de navegador, varía por device. |
| 18 | **QR por ventana** (impreso en obra → escanear → abre detalle) | Identificación in-situ rápida. |

### Tier 5 — Reportes / dominio

| # | Mejora | Por qué |
|---|---|---|
| 19 | **Dashboard ejecutivo** (% avance por SA, KPIs comparativos) | Hoy solo conteos por edificio. |
| 20 | **Progreso temporal** (gráfico semana/mes) | Para gerencia, no para terreno. |
| 21 | **Export por SA / por contratista** | Hoy solo CSV completo. |

---

## 4. Orden recomendado de ataque

1. **Tier 1 completo** — 5 quick wins, mejoras tangibles inmediatas en terreno.
2. **Tier 2 #6 (fotos)** — desbloquea uso real en obra. Ya hay infra preparada.
3. **Tier 3 #12 (smoke tests)** — antes de seguir agregando features. Protege contra regresiones.
4. **Tier 2 #8 (conflict resolution)** — bug latente que crece con más usuarios concurrentes.
5. Resto según valor de negocio.

---

## 5. Notas para futuras sesiones con Opus

### Cómo iniciar una sesión productiva

**Contexto que el agente debe tener:**
1. Leer este archivo (`Roadmap_VentaControl_v2.md`).
2. Leer `Contexto_VentaControl_v2.md` (estructura técnica detallada).
3. Conocer las restricciones del usuario (single-file, push a main, caveman mode).

**Worktree de trabajo:**
- El archivo principal está en `C:\Proyectos\VentaControl\.claude\worktrees\print-letter\VentaControl_v2.html`.
- La rama local `print-letter` trackea `origin/main`. Push: `git push origin HEAD:main`.

### Patrones a seguir

- **Helper `h(tag, attrs, children)`** para crear DOM. Usar siempre, no `innerHTML` (XSS seguro).
- **`updateWindow(key, field, value, label)`** para mutar ventanas — agrega historial automáticamente y marca dirty key.
- **`saveLocal()`** debounced (400ms) vs **`saveLocalNow()`** inmediato — usar el segundo solo cuando reload inminente.
- **`forEachWindowInBldg/Floor`** para iterar — no escribir loops anidados nuevos.
- **`WINDOW_COLOR_MAPS`** para colores de estado/acción — no redefinir locales.
- **`closeOnBackdropClick`** + className `overlay` para modales.
- **`renderSyncBar()`** debe ir al final de cada vista para que sync sea siempre visible.
- **Estados ventana**: `instalada | pendiente | noInstalada | quitar | noInstalar | sinVentana`. Si agregas otro, actualizar `ESTADOS`, `getBldgStats`, color maps, leyenda, y migration en `initData`.

### Anti-patrones (evitar)

- ❌ No agregar dependencias externas (Vue/React/etc.). Mantener vanilla.
- ❌ No separar CSS/JS a archivos externos.
- ❌ No usar `console.log` directo en producción — usar `if(DEBUG)` o `logMsg()` (que gatea internamente).
- ❌ No crear archivos `.md` planning/decision a menos que el usuario lo pida.
- ❌ No agregar campos a `newWindowRecord()` sin agregar también la migration en `initData` para datos legacy.
- ❌ No tocar la lógica de `dirtyKeys` sin entender: protege cambios locales durante sync pull.

### Verificación end-to-end estándar

Sin tests automatizados (TODO #12). Verificación manual:

1. Abrir `VentaControl_v2.html` en navegador.
2. Login editor → toggle estado en ventana → ver historial.
3. GridMap edif 1 → filtrar por acción → contador ok.
4. SealMap edif 1 → tap larga celda → modal sello → guardar.
5. Bulk Change scope=floor y building → verifica.
6. Clear Building → resetea ventanas.
7. Print Ctrl+P → vista correcta, fondo blanco.
8. Sync push manual → no rompe.
9. Recargar → DATA persiste.

### Backlog de TODOs heredados (Contexto_VentaControl_v2.md)

- Sync de campos `selloExterior` y `funcionalidad` a Google Sheets.
- Filtro por edificio en panel de acciones globales.
- Preservar scroll al re-renderizar.

---

## 6. Plan implementación: #1 Búsqueda global

### Objetivo
Modal con input de búsqueda. Al tipear, filtra ventanas en vivo. Click en resultado navega directo al detalle.

### Diseño UX

**Trigger:**
- Botón 🔍 en `renderSyncBar()` (al lado del icono ⋮ del menú) para acceso desde cualquier vista.
- Atajo opcional: `Ctrl+K` o `/` (mobile no aplica).

**Modal:**
- Overlay estándar (usa `closeOnBackdropClick`).
- Input autofocus.
- Lista debajo: max 30 resultados.
- Cada resultado: ícono estado, código ventana, depto, edif, badge acción pendiente si aplica.
- Click → cierra modal + `navigate('window', {edif, depto, win, code})`.
- Estados vacíos: "Tipea para buscar", "Sin resultados para 'xxx'".

### Lógica de búsqueda

**Sintaxis soportada (todo case-insensitive):**
- Código ventana: `v8`, `pv1`, `v01`
- Depto: `301`, `ec3`, `ec1`
- Edificio: `5`, `edif 12`, `edificio 1`
- Key directa: `5-301-V8`
- Combinaciones libres: `12 v8` → busca ventanas V8 del edif 12

**Algoritmo:**
1. Normalizar query: lowercase, split por espacios → tokens.
2. Por cada ventana, construir `searchText = "edif{edif} {edif} {depto} {code} {key}".toLowerCase()`.
3. Match: TODOS los tokens deben aparecer en searchText (AND lógico).
4. Ordenar resultados: prefijo match > substring match. Limitar a 30.

**Performance:**
- Index pre-construido (`SEARCH_INDEX`) en initData o lazy.
- 4,740 entradas × `.includes()` es < 5ms en cualquier dispositivo.

### Cambios al código

**1. Helper `buildSearchIndex()` — junto a otros helpers (línea ~700, después de `forEachWindowInBldg`):**

```js
let _searchIndex=null;
function buildSearchIndex(){
  const idx=[];
  for(const edif of Object.keys(BUILDINGS)){
    forEachWindowInBldg(edif, (w, key, ctx)=>{
      const deptoStr=String(ctx.depto);
      const searchText=`edif${edif} ${edif} ${deptoStr} ${ctx.code} ${key}`.toLowerCase();
      idx.push({key, edif:parseInt(edif), depto:ctx.depto, code:ctx.code, isCommon:ctx.isCommon, searchText});
    });
  }
  _searchIndex=idx;
}
function searchWindows(query){
  if(!_searchIndex) buildSearchIndex();
  const tokens=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(!tokens.length) return [];
  return _searchIndex
    .filter(e=>tokens.every(t=>e.searchText.includes(t)))
    .slice(0,30);
}
```

**2. Función `showSearchModal()` — junto a `showLegend()` (línea ~4150):**

```js
function showSearchModal(){
  const overlay=h('div',{className:'overlay',onClick:closeOnBackdropClick},[
    h('div',{className:'modal',style:{maxHeight:'90vh',overflowY:'auto',width:'min(95vw,500px)'}},[
      h('div',{style:{display:'flex',gap:'8px',alignItems:'center',marginBottom:'12px'}},[
        h('span',{style:{fontSize:'1.1rem'}},['🔍']),
        h('input',{
          id:'search-input',type:'text',placeholder:'Buscar: V8, 301, edif 5, 5-301-V8...',
          style:{flex:1,padding:'10px 12px',fontSize:'0.95rem',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-2)',color:'var(--tx-1)'},
          onInput:(e)=>renderResults(e.target.value),
        }),
        h('button',{className:'btn btn-sm btn-ghost',onClick:()=>overlay.remove()},['✕']),
      ]),
      h('div',{id:'search-results',style:{display:'flex',flexDirection:'column',gap:'4px'}},[
        h('p',{style:{fontSize:'0.82rem',color:'var(--tx-2)',padding:'8px 4px'}},['Tipea código ventana, depto, edificio o key…']),
      ]),
    ]),
  ]);
  document.body.appendChild(overlay);
  setTimeout(()=>$('#search-input',overlay)?.focus(),50);

  function renderResults(q){
    const cont=$('#search-results',overlay);
    cont.innerHTML='';
    if(!q.trim()){
      cont.appendChild(h('p',{style:{fontSize:'0.82rem',color:'var(--tx-2)',padding:'8px 4px'}},['Tipea código ventana, depto, edificio o key…']));
      return;
    }
    const results=searchWindows(q);
    if(!results.length){
      cont.appendChild(h('p',{style:{fontSize:'0.82rem',color:'var(--tx-2)',padding:'8px 4px'}},['Sin resultados para "'+q+'"']));
      return;
    }
    results.forEach(r=>{
      const w=DATA.windows[r.key];
      const estado=(w&&w.estado)||'noInstalada';
      const estObj=ESTADOS.find(e=>e.id===estado);
      cont.appendChild(h('button',{
        className:'btn btn-ghost',
        style:{justifyContent:'flex-start',gap:'10px',padding:'10px 12px',fontSize:'0.85rem',textAlign:'left'},
        onClick:()=>{
          overlay.remove();
          const isCommon=r.isCommon;
          const dParam=isCommon?r.depto:r.depto;
          navigate('window',{edif:String(r.edif),depto:dParam,win:r.code,code:r.code});
        },
      },[
        h('span',{style:{fontSize:'1.1rem',width:'24px',textAlign:'center'}},[estObj?estObj.sym:'?']),
        h('span',{style:{fontFamily:'var(--font-mono)',fontWeight:'700',minWidth:'48px'}},[r.code]),
        h('span',{style:{color:'var(--tx-2)',fontSize:'0.78rem',minWidth:'56px'}},[String(r.depto)]),
        h('span',{style:{color:'var(--tx-2)',fontSize:'0.78rem',flex:1}},['Edif. '+r.edif]),
      ]));
    });
  }
}
```

**3. Botón en topbar — agregar en `renderSyncBar()`:**

Insertar botón 🔍 antes del botón ⋮.

```js
h('button',{className:'btn btn-sm btn-ghost',style:{padding:'8px 12px',fontSize:'0.95rem'},onClick:showSearchModal},['🔍']),
```

### Consideraciones

- **Index invalidation:** si en sesión se agregan ventanas via migración → `_searchIndex=null` antes del fresh build. Hoy `migrateV1` y `initData` agregan ventanas — invalidar al final de ambos.
- **Mobile keyboard:** autofocus puede traer el teclado encima del modal. Modal con `maxHeight:90vh` + `overflow:auto` mitiga.
- **Navegación:** función `navigate('window', {...})` ya existe — verificar parámetros que espera (mirar callsites en `winTile`).
- **Resultado para EC:** los espacios comunes tienen depto = `EC{floor}` (string). Navigate debe aceptar tanto número como string.

### Verificación

1. Recargar app, abrir search.
2. Tipear "V8" → debe mostrar 34 ventanas V8 (una por edificio, piso 5 generalmente).
3. Tipear "301" → ventanas del depto 301 de TODOS los edificios.
4. Tipear "5 v8" → V8 del edif 5.
5. Tipear "5-301-V8" → 1 resultado exacto.
6. Click resultado → navega a window detail correcto.
7. Cerrar con ✕, con Esc, con click en backdrop → todos cierran.
8. Recargar página, repetir → index se reconstruye correcto.

### Riesgos

- **Index stale tras migración:** mitigar invalidando al final de migration paths.
- **Performance en mobile viejo:** 4,740 entries × includes es seguro, pero si crece a 10K+ considerar fuse.js o trie.
- **Conflicto navigate params:** verificar que `depto` string vs number no rompe `renderWindow`.

---

## 7. Cambios de versión sugeridos

Tras implementar features Tier 1, bumpear a **v2.9** y actualizar:
- Línea ~4844: `if(DEBUG)console.log('VentaControl v2.X — '+totalWins+' ventanas cargadas');`
- Título HTML.
- README.md.
- Este documento.
