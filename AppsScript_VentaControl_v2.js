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

// Columnas actuales (A-N = 1-14) + v2 (O-X = 15-24) + v2.2 (Y-AC = 25-29)
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
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

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

  var widths = [65,45,75,70,80,150,100,110,80,120,130,110,240,140,90,130,130,90,100,90,110,130,120,90,120,120,120,120,130];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i] || 100);
  }

  // Generar hojas de resumen si ya hay datos
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  updateAllSummaries(ss);
  Logger.log('Setup OK. Hojas RESUMEN, PENDIENTES y DEFICIENCIAS generadas. Ahora actualiza (o crea) la implementación como App Web.');
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

  // Actualizar hojas de resumen automáticas
  updateAllSummaries(ss);

  return {
    status: 'ok', updates: updates, inserts: inserts, timestamp: ts,
    message: updates + ' actualizados, ' + inserts + ' nuevos'
  };
}

// ================================================================
// HOJAS DE RESUMEN AUTOMÁTICAS
// Todas se regeneran en cada sync desde la hoja REGISTRO
// ================================================================

var DEFS_CONFIG = [
  {label:'Separación >5mm',                col:7,  accionLabel:'Pulir Vano',               accionCol:20},
  {label:'Descuadre',                       col:8,  accionLabel:'Aplomar ventana',           accionCol:23},
  {label:'Ventana desaplomada',             col:14, accionLabel:'Aplomar ventana',           accionCol:23},
  {label:'Sin sellador FC11 bajo marco',    col:9,  accionLabel:'Aplicar sello bajo marco',  accionCol:21},
  {label:'Sin sellador FC11 frente vent.',  col:15, accionLabel:'Aplicar sello frente vent.',accionCol:24},
  {label:'Malla retorno EIFS no llega',     col:10, accionLabel:'Reparar retorno EIFS',      accionCol:22},
  {label:'Malla de retorno pulida',         col:16, accionLabel:'Reparar retorno EIFS',      accionCol:22},
  {label:'Vidrio trizado',                  col:17, accionLabel:'Reemplazar vidrio',          accionCol:25},
  {label:'Marco perforado',                 col:18, accionLabel:'Reparar/sellar marco',       accionCol:26},
  {label:'Falta fijación en marco',         col:19, accionLabel:'Instalar fijación',          accionCol:27},
];

// Punto de entrada: lee datos una vez y actualiza las 3 hojas
function updateAllSummaries(ss) {
  try {
    var src = ss.getSheetByName(SHEET_NAME);
    if (!src) return;
    var raw = src.getDataRange().getValues();
    if (raw.length <= 1) return;
    var dataRows = raw.slice(1).filter(function(r){ return r[0] !== ''; });
    var ts = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd HH:mm');

    updateResumen(ss, dataRows, ts);
    updatePendientes(ss, dataRows, ts);
    updateDeficiencias(ss, dataRows, ts);
  } catch(e) {
    Logger.log('updateAllSummaries error: ' + e.toString());
  }
}

// Función legacy para compatibilidad (llama a updateAllSummaries)
function updateResumen(ss, dataRows, ts) {
  try {
    if (!dataRows) {
      // Llamada directa (ej. desde setup)
      var src = ss.getSheetByName(SHEET_NAME);
      if (!src) return;
      var raw = src.getDataRange().getValues();
      if (raw.length <= 1) return;
      dataRows = raw.slice(1).filter(function(r){ return r[0] !== ''; });
      ts = Utilities.formatDate(new Date(), 'America/Santiago', 'yyyy-MM-dd HH:mm');
    }

    var sheet = ss.getSheetByName('RESUMEN');
    if (!sheet) sheet = ss.insertSheet('RESUMEN');
    sheet.clearContents();
    sheet.clearFormats();

    // --- Agregar por edificio ---
    var byEdif = {};
    dataRows.forEach(function(row) {
      var edif = String(row[0]).trim();
      if (!byEdif[edif]) byEdif[edif] = {total:0,inst:0,pend:0,noInst:0,quitar:0,def:0,actP:0,actD:0};
      var b = byEdif[edif];
      b.total++;
      var est = String(row[6]||'').toLowerCase();
      if (est==='instalada') b.inst++;
      else if (est==='pendiente') b.pend++;
      else if (est==='noinstalada') b.noInst++;
      else if (est==='quitar') b.quitar++;
      [7,8,9,10,14,15,16,17,18,19].forEach(function(c){ if(row[c]==='Sí') b.def++; });
      for(var a=20;a<=27;a++){
        var v=String(row[a]||'').toLowerCase();
        if(v==='pending') b.actP++;
        else if(v==='done') b.actD++;
      }
    });

    // --- Cabecera del sheet ---
    sheet.getRange(1,1).setValue('RESUMEN DE AVANCE — Condominio Alberto Fuchslocher')
      .setFontSize(12).setFontWeight('bold').setFontColor('#1F4E79');
    sheet.getRange(2,1).setValue('Actualizado: '+ts).setFontColor('#888888').setFontSize(9);

    var hdrs = ['Torre','Total','Instaladas','Pendientes','No Instaladas','Quitar','% Avance','Inconformidades','Acc. Pend.','Acc. OK'];
    var HDR_ROW = 4;
    sheet.getRange(HDR_ROW,1,1,hdrs.length).setValues([hdrs])
      .setFontWeight('bold').setBackground('#1F4E79').setFontColor('#FFFFFF').setHorizontalAlignment('center');

    // --- Filas de datos ---
    var keys = Object.keys(byEdif).sort(function(a,b){ return parseInt(a)-parseInt(b); });
    var totals = {total:0,inst:0,pend:0,noInst:0,quitar:0,def:0,actP:0,actD:0};
    var rows = keys.map(function(ek){
      var b = byEdif[ek];
      Object.keys(totals).forEach(function(k){ totals[k] += b[k]; });
      return [parseInt(ek), b.total, b.inst, b.pend, b.noInst, b.quitar, b.total?b.inst/b.total:0, b.def, b.actP, b.actD];
    });

    if (rows.length) {
      var dataRange = sheet.getRange(HDR_ROW+1, 1, rows.length, hdrs.length);
      dataRange.setValues(rows);
      sheet.getRange(HDR_ROW+1, 7, rows.length, 1).setNumberFormat('0%').setHorizontalAlignment('center');
      // Colores alternos
      for (var r=0; r<rows.length; r++) {
        sheet.getRange(HDR_ROW+1+r,1,1,hdrs.length).setBackground(r%2===0?'#EBF5FB':'#FFFFFF');
      }
      // Fila TOTAL
      var tr = HDR_ROW+1+rows.length;
      sheet.getRange(tr,1,1,hdrs.length).setValues([['TOTAL',totals.total,totals.inst,totals.pend,totals.noInst,totals.quitar,totals.total?totals.inst/totals.total:0,totals.def,totals.actP,totals.actD]])
        .setFontWeight('bold').setBackground('#2471A3').setFontColor('#FFFFFF');
      sheet.getRange(tr,7).setNumberFormat('0%').setHorizontalAlignment('center');
    }

    sheet.setFrozenRows(HDR_ROW);
    for (var c=1; c<=hdrs.length; c++) sheet.autoResizeColumn(c);
  } catch(e) { Logger.log('updateResumen error: '+e.toString()); }
}

// ----------------------------------------------------------------
// HOJA PENDIENTES: ventanas no instaladas o pendientes, enumeradas
function updatePendientes(ss, dataRows, ts) {
  try {
    var sheet = ss.getSheetByName('PENDIENTES');
    if (!sheet) sheet = ss.insertSheet('PENDIENTES');
    sheet.clearContents();
    sheet.clearFormats();

    sheet.getRange(1,1).setValue('VENTANAS NO INSTALADAS / PENDIENTES — Condominio Alberto Fuchslocher')
      .setFontSize(12).setFontWeight('bold').setFontColor('#922B21');
    sheet.getRange(2,1).setValue('Actualizado: '+ts).setFontColor('#888888').setFontSize(9);

    var pending = dataRows.filter(function(r){
      var est = String(r[6]||'').toLowerCase();
      return est==='noinstalada' || est==='pendiente';
    });

    pending.sort(function(a,b){
      var ea=parseInt(a[0]), eb=parseInt(b[0]);
      if(ea!==eb) return ea-eb;
      var pa=parseInt(a[1]), pb=parseInt(b[1]);
      if(pa!==pb) return pa-pb;
      return String(a[2]).localeCompare(String(b[2]));
    });

    sheet.getRange(3,1).setValue('Total: '+pending.length+' ventanas')
      .setFontWeight('bold').setFontColor('#922B21');

    var hdrs = ['#','Torre','Piso','N° Depto','Tipo Depto','Recinto','Tipo Ventana','Estado','Estado Vano','Observaciones'];
    sheet.getRange(5,1,1,hdrs.length).setValues([hdrs])
      .setFontWeight('bold').setBackground('#922B21').setFontColor('#FFFFFF').setHorizontalAlignment('center');

    if (pending.length) {
      var rows = pending.map(function(r,i){
        var est = String(r[6]||'').toLowerCase();
        var estLabel = est==='noinstalada'?'No Instalada':'Pendiente';
        return [i+1, r[0], r[1], r[2], r[3]||'', r[5]||'', r[4]||'', estLabel, r[11]||'', r[12]||''];
      });
      sheet.getRange(6,1,rows.length,hdrs.length).setValues(rows);
      for (var r=0; r<rows.length; r++) {
        var est2 = String(pending[r][6]||'').toLowerCase();
        var bg = est2==='noinstalada' ? '#FDEDEC' : '#FEF9E7';
        sheet.getRange(6+r,1,1,hdrs.length).setBackground(bg);
      }
    } else {
      sheet.getRange(6,1).setValue('✓ Todas las ventanas están instaladas')
        .setFontColor('#1E8449').setFontWeight('bold');
    }

    sheet.setFrozenRows(5);
    for (var c=1; c<=hdrs.length; c++) sheet.autoResizeColumn(c);
  } catch(e) { Logger.log('updatePendientes error: '+e.toString()); }
}

// ----------------------------------------------------------------
// HOJA DEFICIENCIAS: una tabla por cada tipo de inconformidad
function updateDeficiencias(ss, dataRows, ts) {
  try {
    var sheet = ss.getSheetByName('DEFICIENCIAS');
    if (!sheet) sheet = ss.insertSheet('DEFICIENCIAS');
    sheet.clearContents();
    sheet.clearFormats();
    // Quitar merges previos
    try { sheet.getRange(1,1,sheet.getMaxRows(),sheet.getMaxColumns()).breakApart(); } catch(me){}

    sheet.getRange(1,1).setValue('INCONFORMIDADES POR TIPO — Condominio Alberto Fuchslocher')
      .setFontSize(12).setFontWeight('bold').setFontColor('#6C3483');
    sheet.getRange(2,1).setValue('Actualizado: '+ts).setFontColor('#888888').setFontSize(9);

    var hdrs = ['#','Torre','Piso','N° Depto','Tipo Depto','Recinto','Tipo Ventana','Estado','Vano','Acción Requerida','Estado Acción','Observaciones'];
    var BG_SECTIONS = ['#F5EEF8','#EBF5FB','#E9F7EF','#FEF9E7','#FDEDEC','#F0F3F4','#FFF3E0','#EAF2FF','#F0FFF4','#FFF8DC'];
    var currentRow = 4;

    DEFS_CONFIG.forEach(function(def, di) {
      var affected = dataRows.filter(function(r){ return r[def.col]==='Sí'; });
      if (!affected.length) return;

      affected.sort(function(a,b){
        var ea=parseInt(a[0]),eb=parseInt(b[0]);
        if(ea!==eb) return ea-eb;
        var pa=parseInt(a[1]),pb=parseInt(b[1]);
        if(pa!==pb) return pa-pb;
        return String(a[2]).localeCompare(String(b[2]));
      });

      var bg = BG_SECTIONS[di % BG_SECTIONS.length];

      // Título de sección
      sheet.getRange(currentRow,1,1,hdrs.length).merge()
        .setValue('  ' + def.label.toUpperCase() + '  —  ' + affected.length + ' caso(s)')
        .setFontWeight('bold').setFontSize(11).setFontColor('#FFFFFF')
        .setBackground('#2C3E50').setVerticalAlignment('middle')
        .setHeight && sheet.setRowHeight(currentRow, 28);
      currentRow++;

      // Headers de la tabla
      sheet.getRange(currentRow,1,1,hdrs.length).setValues([hdrs])
        .setFontWeight('bold').setBackground('#566573').setFontColor('#FFFFFF').setHorizontalAlignment('center');
      currentRow++;

      // Filas de datos
      var tableData = affected.map(function(r,i){
        var av = String(r[def.accionCol]||'').toLowerCase();
        var aLabel = av==='done'?'✓ Completada': av==='pending'?'⏳ Pendiente':'— Sin iniciar';
        return [i+1, r[0], r[1], r[2], r[3]||'', r[5]||'', r[4]||'', r[6]||'', r[11]||'', def.accionLabel, aLabel, r[12]||''];
      });
      sheet.getRange(currentRow,1,tableData.length,hdrs.length).setValues(tableData);

      // Colorear filas alternas + columna estado acción
      for (var ri=0; ri<tableData.length; ri++) {
        sheet.getRange(currentRow+ri,1,1,hdrs.length).setBackground(ri%2===0?bg:'#FFFFFF');
        var aStatus = tableData[ri][10];
        var aBg = aStatus.indexOf('Completada')>=0?'#D5F5E3':aStatus.indexOf('Pendiente')>=0?'#FDEBD0':'#F2F3F4';
        sheet.getRange(currentRow+ri,11).setBackground(aBg).setHorizontalAlignment('center');
      }
      currentRow += tableData.length + 2; // espacio entre secciones
    });

    for (var c=1; c<=hdrs.length; c++) sheet.autoResizeColumn(c);
  } catch(e) { Logger.log('updateDeficiencias error: '+e.toString()); }
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
    });
  }

  return { status: 'ok', records: records };
}
