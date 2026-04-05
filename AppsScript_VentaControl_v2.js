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

  var existingFilter = sheet.getFilter();
  if (existingFilter) existingFilter.remove();
  sheet.getRange(1, 1, 1, HEADERS.length).createFilter();

  var widths = [65,45,75,70,80,150,100,110,80,120,130,110,240,140,90,130,130,90,100,90,110,130,120,90,120,120,120,120,130];
  for (var i = 0; i < widths.length; i++) {
    sheet.setColumnWidth(i + 1, widths[i] || 100);
  }

  Logger.log('Setup OK. Ahora actualiza (o crea) la implementación como App Web.');
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

  // BATCH WRITE: sobreescribir todo el rango de datos existentes de una vez
  if (updates > 0 && existing.length > 1) {
    sheet.getRange(2, 1, existing.length - 1, HEADERS.length).setValues(existing.slice(1));
  }

  // BATCH APPEND: agregar todas las filas nuevas de una vez
  if (newRows.length > 0) {
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newRows.length, HEADERS.length).setValues(newRows);
  }

  return {
    status: 'ok', updates: updates, inserts: inserts, timestamp: ts,
    message: updates + ' actualizados, ' + inserts + ' nuevos'
  };
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
