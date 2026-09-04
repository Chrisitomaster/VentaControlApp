// ================================================================
// GOOGLE APPS SCRIPT — VENTACONTROL v2
// ================================================================
// INSTRUCCIONES:
// 1. Abre tu hoja de cálculo → Extensiones → Apps Script
// 2. Reemplaza TODO el código con este
// 3. Ejecuta la función "setup" una vez (se actualiza la cabecera, datos no se borran)
// 4. Implementar → Administrar implementaciones → actualizar versión
//    (O nueva implementación si es la primera vez)
// 5. Copia la URL de la App Web → pégala en la app en APPS_SCRIPT_URL
// ================================================================

var SHEET_NAME = 'REGISTRO';

// Columnas: A-N (1-14) + v2 (O-X 15-24) + v2.2 (Y-AD 25-30) + v2.9 (AE-AF 31-32)
//           + v2.17 hojas y daños (AG-AP 33-42) + v2.21 func (AQ 43) + v2.22 reposición (AR-AU 44-47)
var HEADERS = [
  'Edificio',            // A  1
  'Piso',                // B  2
  'N° Depto',            // C  3
  'Tipo Depto',          // D  4
  'Elemento',            // E  5
  'Tipo Elemento',       // F  6
  'Estado',              // G  7
  'Separación >5mm',     // H  8
  'Descuadre',           // I  9
  'Sin FC11 bajo marco', // J  10
  'Malla EIFS no llega', // K  11
  'Estado Vano',         // L  12
  'Observaciones',       // M  13
  'Última Actualización',// N  14
  // ---- Columnas v2 ----
  'Desaplomado',         // O  15
  'Sin FC11 frente vent',// P  16
  'Malla retorno pulida',// Q  17
  'Vidrio trizado',      // R  18
  'Marco perforado',     // S  19
  'Falta fijación',      // T  20
  'Acc. Pulir Vano',     // U  21
  'Acc. Impermeabilizar',// V  22
  'Acc. Reparar EIFS',   // W  23
  'Acc. Aplomar',        // X  24
  // ---- Columnas v2.2 ----
  'Acc. Sellar Frente',  // Y  25
  'Acc. Reempl. Vidrio', // Z  26
  'Acc. Reparar Marco',  // AA 27
  'Acc. Instalar Fijac', // AB 28
  'Etapa Construcción',  // AC 29
  'Acc. Cargar Mortero', // AD 30
  // ---- Columnas v2.9 ----
  'Sin Impermeabilizar', // AE 31  (deficiencia: rasgo no impermeabilizado)
  'Acc. Imperm. Rasgo',  // AF 32  (acción: impermeabilizar rasgo)
  // ---- Columnas v2.17: hojas y daños críticos ----
  'Falta Hoja Corredera',// AG 33
  'Falta Hoja Fija',     // AH 34
  'Acc. Reponer Hoja',   // AI 35
  'Termopanel Trizado',  // AJ 36
  'PVC Roto',            // AK 37
  'Filtración Agua',     // AL 38
  'Acc. Reparar PVC',    // AM 39
  'Acc. Sellar Filtrac', // AN 40
  'Hoja Corredera',      // AO 41  (tiene / falta / danada)
  'Hoja Fija',           // AP 42  (tiene / falta / danada)
  'Medida Corredera',    // AQ 43  (130 / 128.5)
  'Coment. Hojas',       // AR 44
  // ---- Columna v2.21 ----
  'Funcionam. Deficiente',// AS 45
  // ---- Columnas v2.22: reposición al proveedor ----
  'Reposición Estado',   // AT 46  (porRetirar / enviada / recibida)
  'Repo. Retirada',      // AU 47  (fecha de retiro de obra)
  'Repo. Volvió',        // AV 48  (fecha de retorno)
  'Repo. Detalle',       // AW 49
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // La hoja puede tener menos columnas fisicas que HEADERS (arranca en 26).
  // Sin esto, getRange se cae con "Those columns are out of bounds".
  var faltan = HEADERS.length - sheet.getMaxColumns();
  if (faltan > 0) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), faltan);
    Logger.log('Se agregaron ' + faltan + ' columnas a la hoja.');
  }

  // Solo sobreescribe la fila de cabecera — datos existentes se conservan
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1F4E79')
    .setFontColor('#FFFFFF')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);

  // El filtro debe cubrir TODAS las filas (no solo la cabecera)
  // Si solo cubre row 1, las filas nuevas quedan fuera del filtro
  var existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  var lastRow = Math.max(sheet.getLastRow(), 2);
  sheet.getRange(1, 1, lastRow, HEADERS.length).createFilter();

  var widths = [65,45,75,70,80,150,100,110,80,120,130,110,240,140,90,130,130,90,100,90,110,130,120,90,120,120,120,120,130,130,130,130,
                130,110,120,120,90,110,120,120,110,100,120,180,130,120,110,110,180];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i] || 100);
  }

  // Generar hojas de resumen si ya hay datos
  updateAllSummaries(ss);

  Logger.log('Setup OK. Hojas de resumen creadas. Ahora actualiza (o crea) la implementación como App Web.');
}

// ----------------------------------------------------------------
function doGet(e) {
  if (!e || !e.parameter) {
    return jsonOut({ status: 'ok', message: 'VentaControl v2 activa. Usa ?action=read' });
  }
  return handleRequest(e);
}

function doPost(e) {
  if (!e || !e.postData) {
    return jsonOut({ status: 'error', message: 'Sin datos POST' });
  }
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var action = '';
    var body = null;

    if (e.parameter && e.parameter.action) {
      action = e.parameter.action;
    } else if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
      action = (body && body.action) || '';
    }

    // Filtro opcional por edificio
    var edifFilter = (e.parameter && e.parameter.edif) ? String(e.parameter.edif) : null;

    var result;
    if (action === 'sync')   result = syncData(body.records || body.rows || []);
    else if (action === 'read')   result = readAll(edifFilter);
    // Aliases
    else if (action === 'push')  result = syncData((body && (body.records || body.rows)) || []);
    else if (action === 'pull')  result = readAll(edifFilter);
    else result = { status: 'error', message: 'Accion no reconocida: ' + action };

    return jsonOut(result);
  } catch (err) {
    return jsonOut({ status: 'error', message: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------
// Convierte valor de celda a Sí/No
function yesNo(v) {
  if (v === undefined || v === null || v === '') return 'No';
  if (typeof v === 'string') {
    var s = v.toLowerCase().trim();
    return (s === 'si' || s === 'sí' || s === '1' || s === 'true') ? 'Sí' : 'No';
  }
  return parseInt(v) ? 'Sí' : 'No';
}

// ----------------------------------------------------------------
function syncData(records) {
  if (!records || !records.length) return { status: 'ok', updates: 0, inserts: 0, message: 'Sin registros' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setup(); sheet = ss.getSheetByName(SHEET_NAME); }

  // Leer todos los datos existentes de una vez
  var existing = sheet.getDataRange().getValues();
  var keyMap = {};
  for (var i = 1; i < existing.length; i++) {
    if (!existing[i][0]) continue;
    var k = String(existing[i][0]).trim() + '-' + String(existing[i][2]).trim() + '-' + String(existing[i][4]).trim();
    if (!keyMap[k]) keyMap[k] = i; // index en existing[] (0-based desde fila 1)
  }

  var ts = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd HH:mm:ss');
  var updates = 0, inserts = 0;
  var newRows = [];

  for (var r = 0; r < records.length; r++) {
    var rec = records[r];
    var key = String(rec.edif) + '-' + String(rec.depto) + '-' + String(rec.elemento || rec.code || '');

    var row = [
      rec.edif,
      rec.piso || '',
      rec.depto,
      rec.tipo_depto || '',
      rec.elemento || rec.code || '',
      rec.tipo_elemento || '',
      rec.estado || '',
      yesNo(rec.separacion),
      yesNo(rec.descuadre),
      yesNo(rec.sinSellador !== undefined ? rec.sinSellador : rec.fc11),
      yesNo(rec.retornoMalla !== undefined ? rec.retornoMalla : rec.eifs),
      rec.vano || rec.estadoVano || '',
      rec.obs || rec.observaciones || '',
      ts,
      yesNo(rec.desaplomo),
      yesNo(rec.sinSelladorFrente),
      yesNo(rec.mallaPulida),
      yesNo(rec.vidrioTrizado),
      yesNo(rec.marcoPerforado),
      yesNo(rec.faltaFijacion),
      rec.act_pulir || '',
      rec.act_impermeabilizar || '',
      rec.act_repararEIFS || '',
      rec.act_aplomar || '',
      rec.act_sellarFrente || '',
      rec.act_reemplazarVidrio || '',
      rec.act_repararMarco || '',
      rec.act_instalarFijacion || '',
      rec.etapa !== undefined ? rec.etapa : '',
      rec.act_cargarMortero || '',
      yesNo(rec.sinImpermeabilizar),                  // AE 31  v2.9
      rec.act_impermeabilizarRasgo || '',             // AF 32  v2.9
      // ---- v2.17 ----
      yesNo(rec.faltaHojaCorredera),                  // AG 33
      yesNo(rec.faltaHojaFija),                       // AH 34
      rec.act_reponerHoja || '',                      // AI 35
      yesNo(rec.termopanelTrizado),                   // AJ 36
      yesNo(rec.pvcRoto),                             // AK 37
      yesNo(rec.filtracionAgua),                      // AL 38
      rec.act_repararPVC || '',                       // AM 39
      rec.act_sellarFiltracion || '',                 // AN 40
      rec.hoja_corredera || '',                       // AO 41
      rec.hoja_fija || '',                            // AP 42
      rec.hoja_medida || '',                          // AQ 43
      rec.hoja_comentario || '',                      // AR 44
      // ---- v2.21 ----
      yesNo(rec.funcionamientoDeficiente),            // AS 45
      // ---- v2.22 ----
      rec.repo_estado || '',                          // AT 46
      rec.repo_fechaRetiro || '',                     // AU 47
      rec.repo_fechaRetorno || '',                    // AV 48
      rec.repo_comentario || '',                      // AW 49
    ];

    if (keyMap[key] !== undefined) {
      // Actualizar fila existente en el array
      existing[keyMap[key]] = row;
      updates++;
    } else {
      // Acumular filas nuevas
      newRows.push(row);
      inserts++;
    }
  }

  // BATCH WRITE: normalizar filas a exactamente HEADERS.length columnas antes de escribir
  // (evita error de dimensiones si la hoja tiene columnas extra o filas antiguas con menos columnas)
  if (updates > 0 && existing.length > 1) {
    var dataRows = existing.slice(1).map(function(r) {
      var normalized = [];
      for (var c = 0; c < HEADERS.length; c++) normalized.push(r[c] !== undefined ? r[c] : '');
      return normalized;
    });
    sheet.getRange(2, 1, dataRows.length, HEADERS.length).setValues(dataRows);
  }

  // BATCH APPEND: agregar todas las filas nuevas de una vez
  if (newRows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, HEADERS.length).setValues(newRows);
  }

  // Re-crear filtro sobre el rango completo de datos
  // (los setValues masivos pueden romperlo, y si solo cubre row 1 las nuevas filas no se filtran)
  try {
    var existingFilter = sheet.getFilter();
    if (existingFilter) existingFilter.remove();
    var totalRows = Math.max(sheet.getLastRow(), 2);
    sheet.getRange(1, 1, totalRows, HEADERS.length).createFilter();
  } catch(fe) { Logger.log('Filter error: ' + fe.toString()); }

  // Actualizar hojas de resumen automáticas (errores aquí no deben romper el sync)
  try { updateAllSummaries(ss); } catch(e) { Logger.log('updateAllSummaries error en sync: ' + e); }

  return {
    status: 'ok', updates: updates, inserts: inserts, timestamp: ts,
    message: updates + ' actualizados, ' + inserts + ' nuevos'
  };
}

// ================================================================
// HOJAS DE RESUMEN AUTOMÁTICAS
// ================================================================

// Columnas de deficiencias (índice 0-based en getValues())
var DEFS_CONFIG = [
  {label:'Separacion >5mm',             col:7,  accion:'Pulir Vano',                accionCol:20},
  {label:'Descuadre',                   col:8,  accion:'Aplomar ventana',            accionCol:23},
  {label:'Ventana desaplomada',         col:14, accion:'Aplomar ventana',            accionCol:23},
  {label:'Sin FC11 bajo marco',         col:9,  accion:'Aplicar sello bajo marco',   accionCol:21},
  {label:'Sin FC11 frente ventana',     col:15, accion:'Aplicar sello frente vent.', accionCol:24},
  {label:'Malla retorno EIFS no llega', col:10, accion:'Reparar retorno EIFS',       accionCol:22},
  {label:'Malla de retorno pulida',     col:16, accion:'Reparar retorno EIFS',       accionCol:22},
  {label:'Vidrio trizado',              col:17, accion:'Reemplazar vidrio',           accionCol:25},
  {label:'Marco perforado',             col:18, accion:'Reparar/sellar marco',        accionCol:26},
  {label:'Falta fijacion en marco',     col:19, accion:'Instalar fijacion',           accionCol:27},
  {label:'Cargar mortero en vano',      col:7,  accion:'Cargar mortero en vano',       accionCol:29},
  {label:'Rasgo sin impermeabilizar',   col:30, accion:'Impermeabilizar rasgo',       accionCol:31},
  {label:'Falta hoja corredera',        col:32, accion:'Reponer hoja faltante',       accionCol:34},
  {label:'Falta hoja fija',             col:33, accion:'Reponer hoja faltante',       accionCol:34},
  {label:'Termopanel trizado',          col:35, accion:'Reemplazar vidrio',           accionCol:25},
  {label:'PVC roto',                    col:36, accion:'Reparar/reemplazar PVC',      accionCol:38},
  {label:'Filtracion (estanqueidad)',   col:37, accion:'Sellar filtracion',           accionCol:39},
  {label:'Funcionamiento deficiente',   col:44, accion:'Revisar funcionamiento',      accionCol:-1},
];

// Función ejecutable manualmente desde el editor para regenerar hojas
function runSummaries() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllSummaries(ss);
  SpreadsheetApp.getUi().alert('Hojas RESUMEN, PENDIENTES, DEFICIENCIAS y REPOSICIONES actualizadas.');
}

// Lee datos una sola vez y actualiza las 3 hojas
function updateAllSummaries(ss) {
  var src = ss.getSheetByName(SHEET_NAME);
  if (!src) { Logger.log('updateAllSummaries: hoja REGISTRO no encontrada'); return; }

  var raw = src.getDataRange().getValues();
  if (raw.length <= 1) { Logger.log('updateAllSummaries: REGISTRO sin datos'); return; }

  // Excluir cabecera y filas vacías
  var data = [];
  for (var i = 1; i < raw.length; i++) {
    if (raw[i][0] !== '' && raw[i][0] !== null) data.push(raw[i]);
  }
  if (!data.length) { Logger.log('updateAllSummaries: sin filas de datos'); return; }

  var ts = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd HH:mm');
  Logger.log('updateAllSummaries: procesando ' + data.length + ' filas');

  try { buildResumen(ss, data, ts); }
  catch(e) { Logger.log('ERROR buildResumen: ' + e + ' | stack: ' + (e.stack||'')); }

  try { buildPendientes(ss, data, ts); }
  catch(e) { Logger.log('ERROR buildPendientes: ' + e + ' | stack: ' + (e.stack||'')); }

  try { buildDeficiencias(ss, data, ts); }
  catch(e) { Logger.log('ERROR buildDeficiencias: ' + e + ' | stack: ' + (e.stack||'')); }

  try { buildReposiciones(ss, data, ts); }
  catch(e) { Logger.log('ERROR buildReposiciones: ' + e + ' | stack: ' + (e.stack||'')); }

  SpreadsheetApp.flush();
  Logger.log('updateAllSummaries: completado');
}

// ----------------------------------------------------------------
// HOJA RESUMEN: avance por torre
function buildResumen(ss, data, ts) {
  var sheet = ss.getSheetByName('RESUMEN');
  if (!sheet) sheet = ss.insertSheet('RESUMEN');
  sheet.clearContents();

  // Agrupar por edificio
  var byEdif = {};
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var edif = String(row[0]).trim();
    if (!byEdif[edif]) byEdif[edif] = [0,0,0,0,0,0,0,0]; // total,inst,pend,noInst,quitar,def,actP,actD
    var b = byEdif[edif];
    b[0]++;
    var est = String(row[6]||'').toLowerCase().replace(/\s/g,'');
    if (est==='instalada')    b[1]++;
    else if (est==='pendiente')    b[2]++;
    else if (est==='noinstalada')  b[3]++;
    else if (est==='quitar')       b[4]++;
    var defCols = [7,8,9,10,14,15,16,17,18,19,30,32,33,35,36,37,44];
    for (var d = 0; d < defCols.length; d++) { if (row[defCols[d]]==='Si' || row[defCols[d]]==='S\u00ed') b[5]++; }
    var actCols = [20,21,22,23,24,25,26,27,29,31,34,38,39];
    for (var ai = 0; ai < actCols.length; ai++) {
      var v = String(row[actCols[ai]]||'').toLowerCase();
      if (v==='pending') b[6]++;
      else if (v==='done') b[7]++;
    }
  }

  // Construir todas las filas en memoria primero, luego escribir de una vez
  var output = [];
  output.push(['RESUMEN DE AVANCE - Condominio Alberto Fuchslocher','','','','','','','','','']);
  output.push(['Actualizado: ' + ts,'','','','','','','','','']);
  output.push(['','','','','','','','','','']);
  output.push(['Torre','Total','Instaladas','Pendientes','No Instaladas','Quitar','% Avance','Inconformidades','Acc. Pend.','Acc. OK']);

  var keys = Object.keys(byEdif).sort(function(a,b){ return parseInt(a)-parseInt(b); });
  var tot = [0,0,0,0,0,0,0,0];
  for (var k = 0; k < keys.length; k++) {
    var b = byEdif[keys[k]];
    var pct = b[0] ? Math.round(b[1]/b[0]*100)+'%' : '0%';
    output.push([parseInt(keys[k]), b[0], b[1], b[2], b[3], b[4], pct, b[5], b[6], b[7]]);
    for (var t = 0; t < 8; t++) tot[t] += b[t];
  }
  var totPct = tot[0] ? Math.round(tot[1]/tot[0]*100)+'%' : '0%';
  output.push(['TOTAL', tot[0], tot[1], tot[2], tot[3], tot[4], totPct, tot[5], tot[6], tot[7]]);

  sheet.getRange(1, 1, output.length, 10).setValues(output);

  // Formato en lote (mínimas llamadas API)
  sheet.getRange(1,1).setFontSize(12).setFontWeight('bold').setFontColor('#1F4E79');
  sheet.getRange(2,1).setFontSize(9).setFontColor('#888888');
  sheet.getRange(4,1,1,10).setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF');
  if (keys.length) {
    sheet.getRange(5,1,keys.length,10).setBackground('#EBF5FB');
    sheet.getRange(5+keys.length,1,1,10).setFontWeight('bold').setBackground('#2471A3').setFontColor('#FFFFFF');
  }
  sheet.setFrozenRows(4);
  for (var c = 1; c <= 10; c++) sheet.autoResizeColumn(c);
  Logger.log('buildResumen: OK, ' + keys.length + ' torres');
}

// ----------------------------------------------------------------
// HOJA PENDIENTES: ventanas no instaladas / pendientes
function buildPendientes(ss, data, ts) {
  var sheet = ss.getSheetByName('PENDIENTES');
  if (!sheet) sheet = ss.insertSheet('PENDIENTES');
  sheet.clearContents();

  // Filtrar y ordenar
  var pending = [];
  for (var i = 0; i < data.length; i++) {
    var est = String(data[i][6]||'').toLowerCase().replace(/\s/g,'');
    if (est === 'noinstalada' || est === 'pendiente') pending.push(data[i]);
  }
  pending.sort(function(a,b){
    var d = parseInt(a[0])-parseInt(b[0]);
    if (d) return d;
    d = parseInt(a[1])-parseInt(b[1]);
    if (d) return d;
    return String(a[2]) > String(b[2]) ? 1 : -1;
  });

  var output = [];
  output.push(['VENTANAS NO INSTALADAS / PENDIENTES - Condominio Alberto Fuchslocher','','','','','','','','','']);
  output.push(['Actualizado: ' + ts,'','','','','','','','','']);
  output.push(['Total: ' + pending.length + ' ventanas','','','','','','','','','']);
  output.push(['','','','','','','','','','']);
  output.push(['#','Torre','Piso','N Depto','Tipo Depto','Recinto','Tipo Ventana','Estado','Estado Vano','Observaciones']);

  for (var i = 0; i < pending.length; i++) {
    var r = pending[i];
    var est2 = String(r[6]||'').toLowerCase().replace(/\s/g,'');
    output.push([i+1, r[0], r[1], r[2], r[3]||'', r[5]||'', r[4]||'',
                 est2==='noinstalada'?'No Instalada':'Pendiente', r[11]||'', r[12]||'']);
  }

  sheet.getRange(1, 1, output.length, 10).setValues(output);
  sheet.getRange(1,1).setFontSize(12).setFontWeight('bold').setFontColor('#922B21');
  sheet.getRange(2,1).setFontSize(9).setFontColor('#888888');
  sheet.getRange(3,1).setFontWeight('bold').setFontColor('#922B21');
  sheet.getRange(5,1,1,10).setFontWeight('bold').setBackground('#922B21').setFontColor('#FFFFFF');
  sheet.setFrozenRows(5);
  for (var c = 1; c <= 10; c++) sheet.autoResizeColumn(c);
  Logger.log('buildPendientes: OK, ' + pending.length + ' ventanas pendientes');
}

// ----------------------------------------------------------------
// HOJA DEFICIENCIAS: una sección por tipo, escrito todo en lote
function buildDeficiencias(ss, data, ts) {
  var sheet = ss.getSheetByName('DEFICIENCIAS');
  if (!sheet) sheet = ss.insertSheet('DEFICIENCIAS');
  sheet.clearContents();

  var hdrs = ['#','Torre','Piso','N Depto','Tipo Depto','Recinto','Tipo Ventana','Estado','Vano','Accion Requerida','Estado Accion','Observaciones'];
  var NCOLS = hdrs.length;

  // Helper: rellena fila hasta NCOLS con celdas vacías
  function pad(arr) {
    while (arr.length < NCOLS) arr.push('');
    return arr;
  }

  // Construir todo el contenido en memoria
  var output = [];
  output.push(pad(['INCONFORMIDADES POR TIPO - Condominio Alberto Fuchslocher']));
  output.push(pad(['Actualizado: ' + ts]));
  output.push(new Array(NCOLS).fill(''));

  var headerRows = []; // filas que son encabezados de sección o de tabla (para formatear después)
  var subHdrRows = [];

  for (var di = 0; di < DEFS_CONFIG.length; di++) {
    var def = DEFS_CONFIG[di];
    var affected = [];
    for (var i = 0; i < data.length; i++) {
      var defVal = String(data[i][def.col]||'');
      var actVal = String(data[i][def.accionCol]||'').toLowerCase();
      // Incluir si tiene la deficiencia marcada O si tiene la acción activa/completada
      var hasDef = (defVal === 'Si' || defVal === 'S\u00ed');
      var hasAct = (actVal === 'pending' || actVal === 'done');
      if (hasDef || hasAct) affected.push(data[i]);
    }
    if (!affected.length) continue;

    affected.sort(function(a,b){
      var d = parseInt(a[0])-parseInt(b[0]);
      if (d) return d;
      d = parseInt(a[1])-parseInt(b[1]);
      if (d) return d;
      return String(a[2]) > String(b[2]) ? 1 : -1;
    });

    // Fila título de la sección
    var sectionRow = output.length + 1; // +1 porque Sheets es 1-based
    var titlePad = new Array(NCOLS).join(',').split(','); // array de N-1 celdas vacías
    output.push([def.label.toUpperCase() + ' - ' + affected.length + ' caso(s)'].concat(titlePad.slice(0, NCOLS-1)));
    headerRows.push(sectionRow);

    // Fila headers de columna
    var subRow = output.length + 1;
    output.push(hdrs.slice());
    subHdrRows.push(subRow);

    // Filas de datos
    for (var i = 0; i < affected.length; i++) {
      var r = affected[i] || [];
      // sv: extrae valor seguro de la fila (undefined → '')
      var sv = function(idx) { var v = r[idx]; return (v !== undefined && v !== null) ? v : ''; };
      var av = String(sv(def.accionCol)).toLowerCase();
      var aLabel = av==='done' ? 'Completada' : av==='pending' ? 'Pendiente' : 'Sin iniciar';
      output.push([i+1, sv(0), sv(1), sv(2), sv(3)||'', sv(5)||'', sv(4)||'',
                   sv(6)||'', sv(11)||'', def.accion, aLabel, sv(12)||'']);
    }
    output.push(new Array(NCOLS).fill('')); // fila separadora
  }

  if (output.length <= 3) {
    output.push(pad(['Sin inconformidades registradas']));
  }

  // Escribir todo de una sola vez
  sheet.getRange(1, 1, output.length, NCOLS).setValues(output);

  // Formato por bloques (pocas llamadas API)
  sheet.getRange(1,1).setFontSize(12).setFontWeight('bold').setFontColor('#6C3483');
  sheet.getRange(2,1).setFontSize(9).setFontColor('#888888');
  for (var hi = 0; hi < headerRows.length; hi++) {
    sheet.getRange(headerRows[hi], 1, 1, NCOLS)
      .setFontWeight('bold').setFontSize(11).setBackground('#2C3E50').setFontColor('#FFFFFF');
  }
  for (var si = 0; si < subHdrRows.length; si++) {
    sheet.getRange(subHdrRows[si], 1, 1, NCOLS)
      .setFontWeight('bold').setBackground('#566573').setFontColor('#FFFFFF');
  }
  for (var c = 1; c <= NCOLS; c++) sheet.autoResizeColumn(c);
  Logger.log('buildDeficiencias: OK, ' + headerRows.length + ' tipos con datos');
}

// ----------------------------------------------------------------
// HOJA REPOSICIONES: ventanas enviadas al proveedor y su estado (v2.22)
function buildReposiciones(ss, data, ts) {
  var sheet = ss.getSheetByName('REPOSICIONES');
  if (!sheet) sheet = ss.insertSheet('REPOSICIONES');
  sheet.clearContents();

  var LABELS = {porRetirar:'Por retirar', enviada:'En el proveedor', recibida:'Repuesta en obra'};
  var ORDEN  = ['porRetirar','enviada','recibida'];

  var filas = [];
  for (var i = 0; i < data.length; i++) {
    var est = String(data[i][45] || '').trim();
    if (!est) continue;
    filas.push(data[i]);
  }

  var out = [];
  out.push(['REPOSICIONES DE VENTANAS - Condominio Alberto Fuchslocher','','','','','','','','','']);
  out.push(['Actualizado: ' + ts,'','','','','','','','','']);
  out.push(['','','','','','','','','','']);

  var conteo = {porRetirar:0, enviada:0, recibida:0};
  for (var i = 0; i < filas.length; i++) {
    var e = String(filas[i][45] || '').trim();
    if (conteo[e] !== undefined) conteo[e]++;
  }
  out.push(['RESUMEN','','','','','','','','','']);
  for (var k = 0; k < ORDEN.length; k++) {
    out.push([LABELS[ORDEN[k]], conteo[ORDEN[k]] || 0,'','','','','','','','']);
  }
  out.push(['TOTAL', filas.length,'','','','','','','','']);
  out.push(['','','','','','','','','','']);

  var headerRows = [];
  out.push(['#','Torre','Piso','N Depto','Elemento','Recinto','Estado Repo.','Retirada','Volvio','Detalle']);
  headerRows.push(out.length);

  filas.sort(function(a,b){
    var oa = ORDEN.indexOf(String(a[45]||'').trim());
    var ob = ORDEN.indexOf(String(b[45]||'').trim());
    if (oa !== ob) return oa - ob;
    var d = parseInt(a[0]) - parseInt(b[0]);
    if (d) return d;
    return String(a[2]) > String(b[2]) ? 1 : -1;
  });

  for (var i = 0; i < filas.length; i++) {
    var r = filas[i];
    var e = String(r[45]||'').trim();
    out.push([i+1, r[0], r[1], r[2], r[4]||'', r[5]||'',
              LABELS[e] || e, r[46]||'', r[47]||'', r[48]||'']);
  }
  if (!filas.length) out.push(['Sin ventanas en reposicion','','','','','','','','','']);

  sheet.getRange(1, 1, out.length, 10).setValues(out);
  sheet.getRange(1,1).setFontSize(12).setFontWeight('bold').setFontColor('#B9770E');
  sheet.getRange(2,1).setFontSize(9).setFontColor('#888888');
  sheet.getRange(4,1).setFontWeight('bold');
  for (var hi = 0; hi < headerRows.length; hi++) {
    sheet.getRange(headerRows[hi], 1, 1, 10)
      .setFontWeight('bold').setBackground('#B9770E').setFontColor('#FFFFFF');
  }
  sheet.setFrozenRows(headerRows.length ? headerRows[0] : 1);
  for (var c = 1; c <= 10; c++) sheet.autoResizeColumn(c);
  Logger.log('buildReposiciones: OK, ' + filas.length + ' ventanas');
}

// ----------------------------------------------------------------
function readAll(edifFilter) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { status: 'ok', records: [] };

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'ok', records: [] };

  var records = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    // Filtrar por edificio si se especificó
    if (edifFilter && String(row[0]).trim() !== edifFilter) continue;

    function sv(v) { return (v === 'Sí' || v === 'Si') ? 1 : 0; }
    // Sheets puede devolver un Date en columnas con formato fecha; la app
    // espera siempre 'YYYY-MM-DD'.
    function fechaStr(v) {
      if (!v) return '';
      if (Object.prototype.toString.call(v) === '[object Date]') {
        return Utilities.formatDate(v, 'America/Santiago', 'yyyy-MM-dd');
      }
      return String(v);
    }

    records.push({
      edif:             row[0],
      piso:             row[1],
      depto:            String(row[2]),
      tipo_depto:       row[3] || '',
      elemento:         String(row[4]),
      tipo_elemento:    row[5] || '',
      estado:           row[6] || '',
      separacion:       sv(row[7]),
      descuadre:        sv(row[8]),
      sinSellador:      sv(row[9]),
      retornoMalla:     sv(row[10]),
      vano:             row[11] || '',
      obs:              row[12] || '',
      // Nuevas columnas (pueden estar vacías en filas antiguas)
      desaplomo:        sv(row[14] || ''),
      sinSelladorFrente:sv(row[15] || ''),
      mallaPulida:      sv(row[16] || ''),
      vidrioTrizado:    sv(row[17] || ''),
      marcoPerforado:   sv(row[18] || ''),
      faltaFijacion:    sv(row[19] || ''),
      act_pulir:        row[20] || '',
      act_impermeabilizar: row[21] || '',
      act_repararEIFS:  row[22] || '',
      act_aplomar:      row[23] || '',
      act_sellarFrente: row[24] || '',
      act_reemplazarVidrio: row[25] || '',
      act_repararMarco: row[26] || '',
      act_instalarFijacion: row[27] || '',
      etapa:            row[28] || '',
      act_cargarMortero:    row[29] || '',
      // ---- v2.9 ----
      sinImpermeabilizar:      sv(row[30] || ''),
      act_impermeabilizarRasgo: row[31] || '',
      // ---- v2.17 ----
      faltaHojaCorredera:      sv(row[32] || ''),
      faltaHojaFija:           sv(row[33] || ''),
      act_reponerHoja:            row[34] || '',
      termopanelTrizado:       sv(row[35] || ''),
      pvcRoto:                 sv(row[36] || ''),
      filtracionAgua:          sv(row[37] || ''),
      act_repararPVC:             row[38] || '',
      act_sellarFiltracion:       row[39] || '',
      hoja_corredera:             row[40] || '',
      hoja_fija:                  row[41] || '',
      hoja_medida:                row[42] || '',
      hoja_comentario:            row[43] || '',
      // ---- v2.21 ----
      funcionamientoDeficiente: sv(row[44] || ''),
      // ---- v2.22 ----
      repo_estado:                row[45] || '',
      repo_fechaRetiro:      fechaStr(row[46]),
      repo_fechaRetorno:     fechaStr(row[47]),
      repo_comentario:            row[48] || '',
    });
  }

  return { status: 'ok', records: records };
}
