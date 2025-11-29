const SHEET_ID = '1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg';

// Modo experimental: usar Authorization: Bearer asigacad en lugar de Cookie.
// Por defecto en false porque hoy confirmamos que cookie asigacad funciona.
const USE_BEARER_WITH_ASIGACAD = false;

// ========================================
// CACHE PARA OPTIMIZAR RENDIMIENTO
// ========================================

// Cache global para metadatos de hojas (se resetea cada 30 minutos)
let CACHE_FALLBACK = {
  lastUpdate: null,
  sheetInfo: null,
  sheetActividades: null,
  columnsInfo: null,
  columnsActividades: null,
  CACHE_DURATION: 30 * 60 * 1000 // 30 minutos en milisegundos
};

// Cache para datos de docentes (se mantiene durante la sesión)
let CACHE_DOCENTES = new Map();

// ========================================
// FUNCIONES AUTOMÁTICAS
// ========================================

/**
 * FUNCIÓN PRINCIPAL AUTOMÁTICA
 * Se ejecuta automáticamente cuando llegan nuevas cookies
 * Ahora procesa los 8 periodos más recientes por cada docente
 */
function procesarDatosAutomaticamente() {
  try {
    Logger.log('🔄 Iniciando procesamiento automático...');

    // 1) Verificar cookies
    const cookies = getCookiesFromSheet();
    Logger.log('✅ Cookies obtenidas automáticamente');

    // 2) Lista de docentes (configurable)
    const docentes = [
      { cedula: "1112966620" },
      // Agregar más docentes aquí según necesites
    ];

    // 3) Obtener los 8 periodos más recientes desde el portal
    const periodosTop8 = getUltimosNPeriodosDesdePortal(8);
    Logger.log(`🗓️ Últimos periodos: ${periodosTop8.map(p => p.label).join(', ')}`);

    // 4) Procesar cada combinación docente × periodo
    const resultados = [];
    for (const docente of docentes) {
      for (const p of periodosTop8) {
        try {
          Logger.log(`📋 Procesando ${docente.cedula} - Período: ${p.label} (id=${p.idPeriod})`);
          const datos = extraerDatosDocenteUnivalle(docente.cedula, p.idPeriod);
          resultados.push({
            cedula: docente.cedula,
            periodo: p.idPeriod,         // guardamos id numérico
            periodoLabel: p.label,       // guardamos también el label legible
            datos,
            timestamp: new Date().toISOString(),
          });
          Logger.log(`✅ OK ${docente.cedula} - ${p.label}`);
        } catch (err) {
          Logger.log(`❌ Error ${docente.cedula} - ${p.label}: ${err.toString()}`);
        }
      }
    }

    // 5) Guardar resultados
    guardarResultadosEnSheet(resultados);

    Logger.log(`🎉 Procesamiento completado. ${resultados.length} registros (docente × periodo).`);
    return resultados;

  } catch (error) {
    Logger.log(`❌ Error en procesamiento automático: ${error.toString()}`);
    throw error;
  }
}

function getUltimosPeriodos(n) {
  return getUltimosNPeriodosDesdePortal(n || 8);
}


/**
 * Obtiene los últimos N periodos disponibles desde el portal
 * @param {number} n - Número de periodos a obtener (por defecto 8)
 * @returns {Array} Array de objetos con {idPeriod, year, term, label}
 */
function getUltimosNPeriodosDesdePortal(n = 8) {
  try {
    Logger.log(`🔍 Obteniendo últimos ${n} periodos desde el portal...`);
    
    const cookies = getCookiesFromSheet();
    const url = 'https://proxse26.univalle.edu.co/asignacion/vin_docente.php3';

    const headers = buildAuthHeaders(cookies);

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers,
      muteHttpExceptions: true,
      timeout: 30000
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      throw new Error(`Error HTTP ${responseCode} al obtener periodos`);
    }

    const html = response.getContentText('ISO-8859-1');

    // 1️⃣ Regex para cada option: value + texto interno
    const optionRegex = /<option[^>]*value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
    // 2️⃣ Regex para encontrar dentro del texto algo tipo "2026-1", "2026 - 01", etc.
    const labelRegex = /(\d{4})\s*[-\s]\s*0?([12])\b/;

    const items = [];
    let match;

    while ((match = optionRegex.exec(html)) !== null) {
      const idPeriod = Number(match[1]);
      // Texto visible del option (limpiando tags internos por si acaso)
      const rawLabel = match[2].replace(/<[^>]+>/g, '').trim();

      const m = labelRegex.exec(rawLabel);
      if (!m) {
        // No es un período tipo "AAAA-1" o "AAAA-2", lo ignoramos
        Logger.log(`⚠️ Opción ignorada: value=${idPeriod}, label="${rawLabel}"`);
        continue;
      }

      const year = Number(m[1]);
      const term = Number(m[2]); // 1 o 2 (ya sin el 0 delante)

      if (!year || !term) continue;

      items.push({
        idPeriod,
        year,
        term,
        label: `${year}-${term}` // normalizamos a "2026-1", "2025-2", etc.
      });
    }

    if (items.length === 0) {
      Logger.log('⚠️ No se encontraron periodos en el HTML');
      Logger.log('HTML snippet:', html.substring(0, 1000));
      throw new Error('No se pudieron extraer periodos del portal');
    }

    // Ordenar por año desc, luego término desc
    items.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.term - a.term; // 2 > 1
    });

    // Eliminar duplicados por idPeriod
    const seen = new Set();
    const unique = items.filter(item => {
      if (seen.has(item.idPeriod)) return false;
      seen.add(item.idPeriod);
      return true;
    });

    const resultado = unique.slice(0, n);
    Logger.log(`✅ Periodos obtenidos: ${resultado.map(p => `${p.label}(id=${p.idPeriod})`).join(', ')}`);
    
    return resultado;

  } catch (error) {
    Logger.log(`❌ Error obteniendo periodos: ${error.toString()}`);
    Logger.log('⚠️ Usando periodos de fallback por defecto');
    return [
      { idPeriod: 48, year: 2025, term: 1, label: '2025-1' },
      { idPeriod: 47, year: 2024, term: 2, label: '2024-2' },
      { idPeriod: 46, year: 2024, term: 1, label: '2024-1' },
      { idPeriod: 45, year: 2023, term: 2, label: '2023-2' },
      { idPeriod: 44, year: 2023, term: 1, label: '2023-1' },
      { idPeriod: 43, year: 2022, term: 2, label: '2022-2' },
      { idPeriod: 42, year: 2022, term: 1, label: '2022-1' },
      { idPeriod: 41, year: 2021, term: 2, label: '2021-2' }
    ].slice(0, n);
  }
}

/**
 * Guarda los resultados en una nueva hoja del Google Sheet
 * Ahora incluye el label del periodo para mejor legibilidad
 */
function guardarResultadosEnSheet(resultados) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    
    // Agrupar resultados por periodo
    const resultadosPorPeriodo = {};
    for (const resultado of resultados) {
      const periodoLabel = resultado.periodoLabel || `Periodo-${resultado.periodo}`;
      if (!resultadosPorPeriodo[periodoLabel]) {
        resultadosPorPeriodo[periodoLabel] = [];
      }
      resultadosPorPeriodo[periodoLabel].push(resultado);
    }
    
    // Procesar cada periodo
    for (const [periodoLabel, resultadosPeriodo] of Object.entries(resultadosPorPeriodo)) {
      // Nombre de la hoja basado en el periodo
      const sheetName = `Docentes ${periodoLabel}`;
      let sheet = spreadsheet.getSheetByName(sheetName);
      
      // Crear hoja si no existe
      if (!sheet) {
        sheet = spreadsheet.insertSheet(sheetName);
        // Encabezados
        sheet.getRange('A1:H1').setValues([[
          'Última Actualización', 'Cédula', 'PeriodoID', 'Periodo', 
          'Información Personal', 'Actividades Pregrado', 'Actividades Postgrado', 'Estado'
        ]]);
        // Formato de encabezados
        sheet.getRange('A1:H1').setFontWeight('bold').setBackground('#e0e0e0');
      }
      
      // Obtener datos existentes para comparar
      const lastRow = sheet.getLastRow();
      const existingData = lastRow > 1 ? 
        sheet.getRange(2, 2, lastRow - 1, 1).getValues().flat() : []; // Columna de cédulas
      
      // Crear mapa de filas existentes por cédula
      const existingRows = {};
      existingData.forEach((cedula, index) => {
        if (cedula) existingRows[cedula] = index + 2; // +2 porque empieza en fila 2
      });
      
      // Procesar cada resultado del periodo
      for (const resultado of resultadosPeriodo) {
        const infoPersonal = resultado.datos[0]?.informacionPersonal || {};
        const actividadesPregrado = resultado.datos[0]?.actividadesDocencia?.pregrado || [];
        const actividadesPostgrado = resultado.datos[0]?.actividadesDocencia?.postgrado || [];
        
        const rowData = [
          new Date().toISOString(),          // Timestamp de actualización
          resultado.cedula,
          resultado.periodo,
          resultado.periodoLabel || '',
          JSON.stringify(infoPersonal),
          JSON.stringify(actividadesPregrado),
          JSON.stringify(actividadesPostgrado),
          'Actualizado'                       // Estado
        ];
        
        // Verificar si ya existe una fila para esta cédula
        if (existingRows[resultado.cedula]) {
          // Actualizar fila existente
          const rowNumber = existingRows[resultado.cedula];
          sheet.getRange(rowNumber, 1, 1, 8).setValues([rowData]);
          Logger.log(`📝 Actualizada cédula ${resultado.cedula} en ${sheetName} (fila ${rowNumber})`);
        } else {
          // Agregar nueva fila
          const newRow = sheet.getLastRow() + 1;
          sheet.getRange(newRow, 1, 1, 8).setValues([rowData]);
          existingRows[resultado.cedula] = newRow;
          Logger.log(`➕ Agregada cédula ${resultado.cedula} en ${sheetName} (fila ${newRow})`);
        }
      }
      
      Logger.log(`✅ Procesados ${resultadosPeriodo.length} registros en hoja "${sheetName}"`);
    }
    
    // Opcional: Crear hoja resumen
    crearHojaResumen(spreadsheet);
    
  } catch (error) {
    Logger.log(`❌ Error guardando resultados: ${error.toString()}`);
  }
}

/**
 * Crea una hoja resumen con estadísticas de todas las hojas de periodos
 */
function crearHojaResumen(spreadsheet) {
  try {
    let resumenSheet = spreadsheet.getSheetByName('📊 Resumen General');
    
    if (!resumenSheet) {
      resumenSheet = spreadsheet.insertSheet('📊 Resumen General');
      resumenSheet.getRange('A1:D1').setValues([[
        'Periodo', 'Total Docentes', 'Última Actualización', 'Estado'
      ]]);
      resumenSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    }
    
    // Obtener todas las hojas que empiecen con "Docentes"
    const allSheets = spreadsheet.getSheets();
    const docenteSheets = allSheets.filter(s => s.getName().startsWith('Docentes '));
    
    const resumenData = [];
    for (const sheet of docenteSheets) {
      const sheetName = sheet.getName();
      const periodo = sheetName.replace('Docentes ', '');
      const lastRow = sheet.getLastRow();
      const totalDocentes = lastRow > 1 ? lastRow - 1 : 0;
      
      // Obtener última actualización
      let ultimaActualizacion = '';
      if (totalDocentes > 0) {
        const timestamps = sheet.getRange(2, 1, totalDocentes, 1).getValues().flat();
        const fechas = timestamps.filter(t => t).map(t => new Date(t));
        if (fechas.length > 0) {
          ultimaActualizacion = new Date(Math.max(...fechas)).toISOString();
        }
      }
      
      resumenData.push([
        periodo,
        totalDocentes,
        ultimaActualizacion,
        totalDocentes > 0 ? 'Activo' : 'Vacío'
      ]);
    }
    
    // Ordenar por periodo (año desc, semestre desc)
    resumenData.sort((a, b) => {
      const [yearA, termA] = a[0].split('-').map(Number);
      const [yearB, termB] = b[0].split('-').map(Number);
      if (yearB !== yearA) return yearB - yearA;
      return termB - termA;
    });
    
    // Actualizar hoja resumen
    if (resumenData.length > 0) {
      resumenSheet.getRange(2, 1, resumenSheet.getLastRow(), 4).clear();
      resumenSheet.getRange(2, 1, resumenData.length, 4).setValues(resumenData);
    }
    
    Logger.log('📊 Hoja resumen actualizada');
    
  } catch (error) {
    Logger.log(`⚠️ Error creando resumen: ${error.toString()}`);
  }
}
// ========================================
// FUNCIONES DE CACHE Y OPTIMIZACIÓN
// ========================================

/**
 * Verifica si el cache es válido o necesita actualizarse
 */
function isCacheValid() {
  if (!CACHE_FALLBACK.lastUpdate) return false;
  const now = new Date().getTime();
  return (now - CACHE_FALLBACK.lastUpdate) < CACHE_FALLBACK.CACHE_DURATION;
}

/**
 * Inicializa el cache de metadatos de hojas (solo se ejecuta cuando es necesario)
 */
function initializeFallbackCache() {
  if (isCacheValid()) {
    Logger.log('✅ Cache válido, usando datos cacheados');
    return;
  }
  
  Logger.log('🔄 Inicializando cache de hojas...');
  const startTime = new Date().getTime();
  
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const allSheets = spreadsheet.getSheets();
    
    // Buscar hojas una sola vez
    let sheetInfo = null;
    let sheetActividades = null;
    
    for (const sheet of allSheets) {
      const sheetName = sheet.getName().toLowerCase();
      
      if (!sheetInfo && (sheetName.includes('docentes') || sheetName.includes('personal') || sheetName.includes('info'))) {
        sheetInfo = sheet;
      }
      
      if (!sheetActividades && (
        sheetName.includes('2025') || 
        sheetName.includes('2024') || 
        sheetName.includes('actividades') ||
        sheetName.includes('mar') ||
        sheetName.includes('jul') ||
        sheetName.match(/\d{4}-\d/)
      )) {
        sheetActividades = sheet;
      }
      
      // Salir del bucle si ya encontramos ambas hojas
      if (sheetInfo && sheetActividades) break;
    }
    
    // Obtener headers una sola vez
    let columnsInfo = null;
    let columnsActividades = null;
    
    if (sheetInfo) {
      const headerRowInfo = sheetInfo.getRange('1:1').getValues()[0];
      columnsInfo = {
        headers: headerRowInfo.map(h => h.toString().trim()),
        cedulaIndex: headerRowInfo.findIndex(h => {
          const headerUpper = h.toString().toUpperCase();
          return headerUpper.includes("CEDULA") || 
                 headerUpper.includes("DOCUMENTO") || 
                 headerUpper.includes("ID") ||
                 headerUpper === "DOCENTES";
        })
      };
    }
    
    if (sheetActividades) {
      const headerRowAct = sheetActividades.getRange('1:1').getValues()[0];
      columnsActividades = {
        headers: headerRowAct.map(h => h.toString().trim()),
        cedulaIndex: headerRowAct.findIndex(h => {
          const headerUpper = h.toString().toUpperCase();
          return headerUpper.includes("CEDULA") || 
                 headerUpper.includes("DOCUMENTO") || 
                 headerUpper.includes("ID");
        })
      };
    }
    
    // Actualizar cache
    CACHE_FALLBACK = {
      lastUpdate: new Date().getTime(),
      sheetInfo: sheetInfo,
      sheetActividades: sheetActividades,
      columnsInfo: columnsInfo,
      columnsActividades: columnsActividades,
      CACHE_DURATION: CACHE_FALLBACK.CACHE_DURATION
    };
    
    const endTime = new Date().getTime();
    Logger.log(`✅ Cache inicializado en ${endTime - startTime}ms`);
    Logger.log(`📊 Hojas encontradas: Info=${!!sheetInfo}, Actividades=${!!sheetActividades}`);
    
  } catch (error) {
    Logger.log(`❌ Error inicializando cache: ${error.toString()}`);
    throw error;
  }
}

/**
 * Busca eficientemente datos de un docente en el cache o en las hojas
 */
function buscarDocenteOptimizado(cedula, idPeriod) {
  // Verificar cache de docentes primero
  const cacheKey = `${cedula}-${idPeriod}`;
  if (CACHE_DOCENTES.has(cacheKey)) {
    Logger.log(`✅ Datos encontrados en cache para ${cedula}`);
    return CACHE_DOCENTES.get(cacheKey);
  }
  
  // Inicializar cache de hojas si es necesario
  initializeFallbackCache();
  
  const startTime = new Date().getTime();
  let informacionPersonal = {};
  const actividadesDocencia = { pregrado: [], postgrado: [], direccionTesis: [] };
  
  // 1. Buscar información personal (optimizado)
  if (CACHE_FALLBACK.sheetInfo && CACHE_FALLBACK.columnsInfo && CACHE_FALLBACK.columnsInfo.cedulaIndex !== -1) {
    try {
      informacionPersonal = buscarInformacionPersonalOptimizada(cedula);
    } catch (error) {
      Logger.log(`⚠️ Error buscando info personal: ${error.toString()}`);
    }
  }
  
  // 2. Buscar actividades (optimizado)
  if (CACHE_FALLBACK.sheetActividades && CACHE_FALLBACK.columnsActividades && CACHE_FALLBACK.columnsActividades.cedulaIndex !== -1) {
    try {
      const actividades = buscarActividadesOptimizadas(cedula);
      actividadesDocencia.pregrado = actividades.pregrado;
      actividadesDocencia.postgrado = actividades.postgrado;
    } catch (error) {
      Logger.log(`⚠️ Error buscando actividades: ${error.toString()}`);
    }
  }
  
  // Crear resultado
  const resultado = [{
    periodo: idPeriod,
    informacionPersonal: informacionPersonal,
    actividadesDocencia: actividadesDocencia,
    actividadesInvestigacion: [],
    actividadesExtension: [],
    actividadesIntelectualesOArtisticas: [],
    actividadesAdministrativas: [],
    actividadesComplementarias: [],
    docenteEnComision: []
  }];
  
  // Guardar en cache
  CACHE_DOCENTES.set(cacheKey, resultado);
  
  const endTime = new Date().getTime();
  Logger.log(`⚡ Búsqueda optimizada completada en ${endTime - startTime}ms para ${cedula}`);
  
  return resultado;
}

/**
 * Busca información personal usando rangos optimizados
 */
function buscarInformacionPersonalOptimizada(cedula) {
  const sheet = CACHE_FALLBACK.sheetInfo;
  const columns = CACHE_FALLBACK.columnsInfo;
  
  // Obtener solo la columna de cédulas para buscar la fila
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {};
  
  const cedulaColumn = String.fromCharCode(65 + columns.cedulaIndex); // A, B, C, etc.
  const cedulasRange = sheet.getRange(`${cedulaColumn}2:${cedulaColumn}${lastRow}`);
  const cedulas = cedulasRange.getValues().flat();
  
  // Buscar índice de la cédula
  const filaIndex = cedulas.findIndex(c => c && c.toString().trim() == cedula);
  
  if (filaIndex === -1) {
    Logger.log(`⚠️ Cédula ${cedula} no encontrada en información personal`);
    return {};
  }
  
  // Obtener solo la fila específica del docente
  const filaDocente = filaIndex + 2; // +2 porque empezamos en fila 2 y findIndex es 0-based
  const datosRange = sheet.getRange(`A${filaDocente}:${String.fromCharCode(65 + columns.headers.length - 1)}${filaDocente}`);
  const datosFila = datosRange.getValues()[0];
  
  // Mapear datos
  const informacion = {};
  columns.headers.forEach((header, index) => {
    informacion[header] = datosFila[index] || "";
  });
  
  Logger.log(`✅ Información personal encontrada para ${cedula} en fila ${filaDocente}`);
  return informacion;
}

/**
 * Busca actividades usando rangos optimizados
 */
function buscarActividadesOptimizadas(cedula) {
  const sheet = CACHE_FALLBACK.sheetActividades;
  const columns = CACHE_FALLBACK.columnsActividades;
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { pregrado: [], postgrado: [] };
  
  // Obtener solo la columna de cédulas
  const cedulaColumn = String.fromCharCode(65 + columns.cedulaIndex);
  const cedulasRange = sheet.getRange(`${cedulaColumn}2:${cedulaColumn}${lastRow}`);
  const cedulas = cedulasRange.getValues().flat();
  
  // Encontrar todas las filas que coinciden con la cédula
  const filasCoincidentes = [];
  cedulas.forEach((c, index) => {
    if (c && c.toString().trim() == cedula) {
      filasCoincidentes.push(index + 2); // +2 porque empezamos en fila 2
    }
  });
  
  if (filasCoincidentes.length === 0) {
    Logger.log(`⚠️ Cédula ${cedula} no encontrada en actividades`);
    return { pregrado: [], postgrado: [] };
  }
  
  // Obtener datos solo de las filas que coinciden (en lotes para optimizar)
  const actividades = { pregrado: [], postgrado: [] };
  
  for (const fila of filasCoincidentes) {
    const datosRange = sheet.getRange(`A${fila}:${String.fromCharCode(65 + columns.headers.length - 1)}${fila}`);
    const datosFila = datosRange.getValues()[0];
    
    // Mapear actividad
    const actividad = {};
    columns.headers.forEach((header, index) => {
      actividad[header] = datosFila[index] || "";
    });
    
    // Normalizar y clasificar
    const actividadNormalizada = mapearActividadDesdeFallback(actividad, columns.headers);
    
    if (esActividadPostgrado(actividadNormalizada)) {
      actividades.postgrado.push(actividadNormalizada);
    } else {
      actividades.pregrado.push(actividadNormalizada);
    }
  }
  
  Logger.log(`✅ Actividades encontradas para ${cedula}: ${actividades.pregrado.length} pregrado, ${actividades.postgrado.length} postgrado`);
  return actividades;
}

// ========================================
// LÓGICA DE EXTRACCIÓN PRINCIPAL Y FALLBACK
// ========================================

function extraerDatosDocenteUnivalle(cedula = "1112966620", idPeriod = 48) {
  try {
    Logger.log(`🌍 Intentando extracción web para cédula ${cedula}, período ${idPeriod}...`);
    
    // 1. Verificar credenciales (tolerante)
    const cookies = getCookiesFromSheet();
    if (!cookies.PHPSESSID && !cookies.asigacad) {
      throw new Error('No se encontraron credenciales válidas (PHPSESSID y asigacad vacíos)');
    }

    // 2. Preparar petición
    const url = `https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3?cedula=${cedula}&periodo=${idPeriod}`;
    const options = {
      method: "get",
      headers: buildAuthHeaders(cookies),
      muteHttpExceptions: true,
      timeout: 30000
    };

    // 3. Realizar petición
    Logger.log(`📡 Enviando petición a: ${url}`);
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const html = response.getContentText("ISO-8859-1");

    Logger.log(`📊 Respuesta HTTP: ${responseCode}`);

    if (responseCode !== 200) {
      const errorMessages = {
        401: 'No autorizado - cookies expiradas o inválidas',
        403: 'Acceso prohibido - verificar permisos',
        404: 'Página no encontrada - posible cambio en el servidor',
        500: 'Error interno del servidor',
        502: 'Bad Gateway - servidor no disponible',
        503: 'Servicio no disponible',
        504: 'Gateway timeout - servidor demasiado lento'
      };
      
      const errorMsg = errorMessages[responseCode] || `Error HTTP ${responseCode}`;
      throw new Error(`${errorMsg} (código: ${responseCode})`);
    }

    if (!html || html.length < 100) {
      throw new Error('Respuesta vacía o muy corta del servidor');
    }

    if (html.includes('error') || html.includes('Error') || html.includes('ERROR')) {
      throw new Error('El servidor devolvió una página de error');
    }

    // 4. Procesar HTML
    Logger.log(`✅ Respuesta válida recibida, procesando HTML...`);
    const resultado = procesarHTML(html, idPeriod);
    
    if (!resultado || resultado.length === 0) {
      throw new Error('El procesamiento HTML no devolvió datos válidos');
    }

    // 5. ENRIQUECER informacionPersonal CON DATOS DESDE SHEETS
    try {
      const infoBase = resultado[0].informacionPersonal || {};
      const infoSheets = obtenerInformacionDocenteDesdeSheets(cedula); // nueva función

      if (infoSheets && Object.keys(infoSheets).length > 0) {
        // Fusionamos: lo que venga de Sheets complementa/sobrescribe campos faltantes
        resultado[0].informacionPersonal = Object.assign({}, infoBase, infoSheets);
        Logger.log(`✅ informacionPersonal enriquecida para ${cedula}`);
      } else {
        Logger.log(`ℹ️ No se encontraron datos adicionales en Sheets para ${cedula}`);
      }
    } catch (mergeError) {
      Logger.log(`⚠️ Error al enriquecer informacionPersonal desde Sheets: ${mergeError.toString()}`);
    }
    
    Logger.log(`✅ Extracción web exitosa para ${cedula}`);
    return resultado;
    
  } catch (error) {
    Logger.log(`⚠️ Falló la extracción web para ${cedula}: ${error.toString()}`);
    Logger.log(`🛡️ Activando sistema de fallback desde Google Sheets...`);
    
    // Fallback: aquí buscarDocenteOptimizado YA usa buscarInformacionPersonalOptimizada,
    // así que informacionPersonal ya tendrá CATEGORIA, VINCULACION, etc.
    try {
      const resultadoFallback = buscarDocenteOptimizado(cedula, idPeriod);
      Logger.log(`✅ Fallback optimizado exitoso para ${cedula}`);
      return resultadoFallback;
    } catch (fallbackError) {
      Logger.log(`❌ También falló el fallback optimizado para ${cedula}: ${fallbackError.toString()}`);
      return [{
        periodo: idPeriod,
        informacionPersonal: { CEDULA: cedula },
        actividadesDocencia: { pregrado: [], postgrado: [], direccionTesis: [] },
        actividadesInvestigacion: [],
        actividadesExtension: [],
        actividadesIntelectualesOArtisticas: [],
        actividadesAdministrativas: [],
        actividadesComplementarias: [],
        docenteEnComision: []
      }];
    }
  }
}

function obtenerInformacionDocenteDesdeSheets(cedula) {
  try {
    // Aseguramos que el cache de hojas está inicializado
    initializeFallbackCache();

    if (!CACHE_FALLBACK.sheetInfo || !CACHE_FALLBACK.columnsInfo || CACHE_FALLBACK.columnsInfo.cedulaIndex === -1) {
      Logger.log('⚠️ No hay hoja de información personal configurada en CACHE_FALLBACK');
      return {};
    }

    // Reutilizamos la búsqueda optimizada que ya tienes
    const info = buscarInformacionPersonalOptimizada(cedula);
    Logger.log(`✅ Información personal desde Sheets para ${cedula}: ${JSON.stringify(info)}`);
    return info || {};
  } catch (error) {
    Logger.log(`⚠️ Error obteniendo información personal desde Sheets para ${cedula}: ${error.toString()}`);
    return {};
  }
}


/**
 * FUNCIÓN DE FALLBACK LEGACY (DEPRECIADA): Usa buscarDocenteOptimizado en su lugar.
 * Mantenida por compatibilidad pero redirige a la versión optimizada.
 */
function obtenerDatosDesdeFallbackSheets(cedula, idPeriod) {
  Logger.log('⚠️ Usando función legacy obtenerDatosDesdeFallbackSheets, considera usar buscarDocenteOptimizado');
  return buscarDocenteOptimizado(cedula, idPeriod);
}

/**
 * Mapea flexiblemente los datos de actividades desde las hojas de fallback
 * a la estructura normalizada esperada
 */
function mapearActividadDesdeFallback(actividad, headers) {
  const actividadNormalizada = {
    "CODIGO": "",
    "GRUPO": "",
    "TIPO": "",
    "NOMBRE DE ASIGNATURA": "",
    "CRED": "",
    "PORC": "",
    "FREC": "",
    "INTEN": "",
    "HORAS SEMESTRE": ""
  };
  
  // Mapeo flexible de columnas comunes
  const mapeoColumnas = {
    // Para CODIGO
    codigo: ["código", "code", "id", "idperíodo", "idperiodo", "periodo"],
    // Para TIPO
    tipo: ["tipo", "type", "tipo de actividad", "categoria", "categoría"],
    // Para NOMBRE DE ASIGNATURA
    nombre: ["nombre", "name", "nombre de actividad", "asignatura", "materia", "curso"],
    // Para HORAS SEMESTRE
    horas: ["horas", "hours", "número de horas", "numero de horas", "horas semestre"],
    // Para PORC
    porcentaje: ["porcentaje", "porc", "porcentaje horas", "%"],
    // Para GRUPO
    grupo: ["grupo", "group", "seccion", "sección"]
  };
  
  // Iterar sobre cada header y mapear según coincidencias
  headers.forEach(header => {
    const headerLower = header.toLowerCase().trim();
    const valor = actividad[header] || "";
    
    // Mapear CODIGO
    if (mapeoColumnas.codigo.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["CODIGO"] = valor;
    }
    // Mapear TIPO
    else if (mapeoColumnas.tipo.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["TIPO"] = valor;
    }
    // Mapear NOMBRE DE ASIGNATURA
    else if (mapeoColumnas.nombre.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["NOMBRE DE ASIGNATURA"] = valor;
    }
    // Mapear HORAS SEMESTRE
    else if (mapeoColumnas.horas.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["HORAS SEMESTRE"] = valor;
    }
    // Mapear PORC
    else if (mapeoColumnas.porcentaje.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["PORC"] = valor;
    }
    // Mapear GRUPO
    else if (mapeoColumnas.grupo.some(pattern => headerLower.includes(pattern))) {
      actividadNormalizada["GRUPO"] = valor;
    }
  });
  
  return actividadNormalizada;
}

/**
 * TRIGGER DIARIO AUTOMÁTICO
 * Se ejecuta automáticamente cada día
 */
function triggerDiarioAutomatico() {
  Logger.log('🌅 Ejecutando trigger diario automático...');
  return procesarDatosAutomaticamente();
}

/**
 * TRIGGER CADA 8 HORAS
 * Se ejecuta cuando llegan nuevas cookies (cada 8 horas)
 */
function triggerCada8Horas() {
  Logger.log('⏰ Ejecutando trigger cada 8 horas...');
  return procesarDatosAutomaticamente();
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Obtiene las cookies más recientes desde Google Sheets
 */
function getCookiesFromSheet() {
  try {
    let sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Cookies');
    if (!sheet) sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Siac Cookies');
    if (!sheet) throw new Error('No se encontró la hoja "Cookies" o "Siac Cookies"');
    
    const range = sheet.getRange('A2:C2'); // [timestamp, phpsessid, asigacad]
    const values = range.getValues();
    if (!values || !values[0]) throw new Error('Fila de cookies vacía');
    
    const [timestamp, phpsessidRaw, asigacadRaw] = values[0];
    const phpsessid = (phpsessidRaw || '').toString().trim();
    const asigacad  = (asigacadRaw  || '').toString().trim();
    
    // Nuevo: permitir que solo exista asigacad
    if (!phpsessid && !asigacad) {
      throw new Error('No hay credenciales válidas (faltan ambos: PHPSESSID y asigacad)');
    }
    
    // Check de antigüedad informativo (no bloqueante)
    if (timestamp) {
      const cookieTime = new Date(timestamp);
      const now = new Date();
      const hoursDiff = (now - cookieTime) / (1000 * 60 * 60);
      if (hoursDiff > 25) Logger.log(`⚠️ Las credenciales tienen ${hoursDiff.toFixed(1)} horas de antigüedad`);
    }
    
    Logger.log(`✅ Credenciales: PHPSESSID=${phpsessid ? phpsessid.substring(0,10)+'...' : '(vacío)'}; asigacad=${asigacad ? asigacad.substring(0,10)+'...' : '(vacío)'}`);
    return { PHPSESSID: phpsessid, asigacad: asigacad, timestamp: timestamp };
  } catch (error) {
    Logger.log(`❌ Error al obtener cookies: ${error.toString()}`);
    throw new Error(`Error al obtener cookies: ${error.toString()}`);
  }
}

/**
 * Construye los headers de autenticación basado en las credenciales disponibles
 * Usa Cookie por defecto, con soporte experimental para Bearer
 */
function buildAuthHeaders(cookies) {
  const headers = {};
  const cookieParts = [];
  
  // Modo cookie (por defecto)
  if (!USE_BEARER_WITH_ASIGACAD) {
    if (cookies.asigacad)  cookieParts.push(`asigacad=${encodeURIComponent(cookies.asigacad)}`);
    if (cookies.PHPSESSID) cookieParts.push(`PHPSESSID=${encodeURIComponent(cookies.PHPSESSID)}`);
    
    if (cookieParts.length > 0) {
      headers['Cookie'] = cookieParts.join('; ');
      Logger.log(`🔐 Auth por Cookie: ${headers['Cookie'].replace(/=.*/g,'=***')}`);
    } else {
      Logger.log('⚠️ No hay cookies disponibles para autenticación');
    }
  } else {
    // Modo bearer experimental
    if (cookies.asigacad) {
      headers['Authorization'] = `Bearer ${cookies.asigacad}`;
      Logger.log('🔐 Auth por Bearer asigacad (modo experimental habilitado)');
    } else if (cookies.PHPSESSID) {
      headers['Cookie'] = `PHPSESSID=${encodeURIComponent(cookies.PHPSESSID)}`;
      Logger.log('🔐 Auth por Cookie con PHPSESSID (sin asigacad)');
    }
  }
  
  return headers;
}

/**
 * Determina si una actividad de docencia es de postgrado basándose en sus propiedades.
 * Mejora la clasificación para evitar mezclas entre pregrado y postgrado
 * @param {object} actividad - El objeto de la actividad con claves como "CODIGO", "NOMBRE DE ASIGNATURA", etc.
 * @returns {boolean} - True si es postgrado, false si no.
 */
function esActividadPostgrado(actividad) {
  if (!actividad) return false;

  var codigo = String(actividad.CODIGO || "").trim();
  var nombre = String(actividad["NOMBRE DE ASIGNATURA"] || "").toUpperCase().trim();
  var tipo = String(actividad.TIPO || "").toUpperCase().trim();
  var grupo = String(actividad.GRUPO || "").toUpperCase().trim();

  // Si no hay información suficiente, clasificar como pregrado por defecto
  if (!codigo && !nombre && !tipo && !grupo) {
    Logger.log("🎓 PREGRADO por falta de información");
    return false;
  }

  // Criterio 1: Palabras clave explícitas de postgrado (más confiable)
  var keywordsPostgrado = [
    "MAESTRIA", "MAESTRÍA", "MAGISTER", "MASTER", "MAESTR",
    "DOCTORADO", "DOCTORAL", "PHD", "DOCTOR",
    "ESPECIALIZA", "ESPECIALIZACION", "ESPECIALIZACIÓN",
    "POSTGRADO", "POSGRADO", "POST-GRADO", "POST GRADO",
    "POSTGRADUADO", "POSGRADUADO"
  ];

  for (var i = 0; i < keywordsPostgrado.length; i++) {
    var keyword = keywordsPostgrado[i];
    if (nombre.indexOf(keyword) !== -1 || tipo.indexOf(keyword) !== -1 || grupo.indexOf(keyword) !== -1) {
      Logger.log("🎓 POSTGRADO por keyword \"" + keyword + "\": " + codigo + " - " + nombre);
      return true;
    }
  }

  // Criterio 2: Palabras clave explícitas de pregrado (para evitar falsos positivos)
  var keywordsPregrado = [
    "LICENCIATURA", "INGENIERIA", "INGENERÍA", "BACHILLERATO",
    "TECNOLOGIA", "TECNOLOGÍA", "PROFESIONAL", "CARRERA",
    "PREGRADO", "PRIMER CICLO", "UNDERGRADUATE"
  ];

  for (var j = 0; j < keywordsPregrado.length; j++) {
    var keywordPreg = keywordsPregrado[j];
    if (nombre.indexOf(keywordPreg) !== -1 || tipo.indexOf(keywordPreg) !== -1 || grupo.indexOf(keywordPreg) !== -1) {
      Logger.log("🎓 PREGRADO por keyword \"" + keywordPreg + "\": " + codigo + " - " + nombre);
      return false;
    }
  }
  
  // Criterio 3: Códigos de asignatura (validar que sea un código numérico válido)
  // Códigos que empiezan con 7, 8, 9 son típicamente postgrado
  if (codigo && /^[7-9]\d{3,}$/.test(codigo)) {
    Logger.log("🎓 POSTGRADO por código alto: " + codigo + " - " + nombre);
    return true;
  }

  // Códigos de pregrado típicos (1-6)
  if (codigo && /^[1-6]\d{3,}$/.test(codigo)) {
    Logger.log("🎓 PREGRADO por código bajo: " + codigo + " - " + nombre);
    return false;
  }

  // Criterio 4: Si el código empieza con letras que indican postgrado
  if (codigo && /^(M|D|E|P)[A-Z0-9]/.test(codigo.toUpperCase())) {
    // M = Maestría, D = Doctorado, E = Especialización, P = Postgrado
    Logger.log("🎓 POSTGRADO por código con letra: " + codigo + " - " + nombre);
    return true;
  }

  // Por defecto, clasificar como pregrado (más común)
  Logger.log("🎓 PREGRADO por defecto: " + codigo + " - " + nombre);
  return false;
}

/**
 * Procesa el HTML extraído y asegura el formato específico de las estructuras
 */
function procesarHTML(html, idPeriod) {
  // Función para decodificar entidades HTML comunes
  function decodeEntities(text) {
    var entities = {
      '&aacute;': 'á', '&Aacute;': 'Á',
      '&eacute;': 'é', '&Eacute;': 'É',
      '&iacute;': 'í', '&Iacute;': 'Í',
      '&oacute;': 'ó', '&Oacute;': 'Ó',
      '&uacute;': 'ú', '&Uacute;': 'Ú',
      '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
      '&amp;': '&', '&quot;': '"',
      '&lt;': '<', '&gt;': '>',
      '&nbsp;': ' '
    };
    return text.replace(/&[a-zA-Z]+;/g, function(match) {
      return entities[match] || match;
    });
  }

  function removeAccents(str) {
    if (!str) return str;
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function extractCells(rowHtml) {
    var cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (!cellMatches) return [];
    return cellMatches.map(function(cellHtml) {
      cellHtml = cellHtml.replace(/<\/?t[dh][^>]*>/gi, '');
      cellHtml = cellHtml.replace(/<[^>]+>/g, '');
      cellHtml = cellHtml.replace(/\s*\n\s*/g, ' ').trim();
      cellHtml = cellHtml.replace(/:$/, '').trim(); // CORRECCIÓN: Quitar dos puntos al final
      cellHtml = decodeEntities(cellHtml);
      cellHtml = removeAccents(cellHtml);
      return cellHtml;
    });
  }

  // Función para normalizar estructura de pregrado/postgrado
  function normalizarEstructuraAsignatura(obj, headers) {
    var estructuraNormalizada = {
      "CODIGO": "", "GRUPO": "", "TIPO": "", "NOMBRE DE ASIGNATURA": "",
      "CRED": "", "PORC": "", "FREC": "", "INTEN": "", "HORAS SEMESTRE": ""
    };
    headers.forEach(function(header) {
      var headerUpper = header.toUpperCase();
      var valor = obj[header] || "";
      if (headerUpper.includes("CODIGO")) estructuraNormalizada["CODIGO"] = valor;
      else if (headerUpper.includes("GRUPO")) estructuraNormalizada["GRUPO"] = valor;
      else if (headerUpper.includes("TIPO")) estructuraNormalizada["TIPO"] = valor;
      else if (headerUpper.includes("NOMBRE") && headerUpper.includes("ASIGNATURA")) estructuraNormalizada["NOMBRE DE ASIGNATURA"] = valor;
      else if (headerUpper.includes("CRED")) estructuraNormalizada["CRED"] = valor;
      else if (headerUpper.includes("PORC")) estructuraNormalizada["PORC"] = valor;
      else if (headerUpper.includes("FREC")) estructuraNormalizada["FREC"] = valor;
      else if (headerUpper.includes("INTEN")) estructuraNormalizada["INTEN"] = valor;
      // Mejorar extracción de HORAS SEMESTRE - ser más flexible
      else if ((headerUpper.includes("HORAS") && headerUpper.includes("SEMESTRE")) ||
               headerUpper === "HORAS SEMESTRE" ||
               (headerUpper.includes("HORAS") && !headerUpper.includes("TOTAL")) ||
               headerUpper === "HORAS") {
        estructuraNormalizada["HORAS SEMESTRE"] = valor;
      }
    });
    return estructuraNormalizada;
  }

  // Función para normalizar estructura de dirección de tesis
  function normalizarEstructuraTesis(obj, headers) {
    var estructuraNormalizada = {
      "CODIGO ESTUDIANTE": "", "COD PLAN": "", "TITULO DE LA TESIS": "", "HORAS SEMESTRE": ""
    };
    
    Logger.log("🎯 Normalizando tesis con headers: " + headers.join(" | "));
    Logger.log("🎯 Datos originales: " + JSON.stringify(obj));
    
    // Itera sobre los encabezados encontrados en la tabla y mapea los valores
    headers.forEach(function(header) {
      var headerUpper = header.toUpperCase().trim();
      var valor = obj[header] || "";

      Logger.log(`🔍 Procesando header: "${header}" (normalizado: "${headerUpper}") = "${valor}"`);

      // Mapeo más flexible para CODIGO ESTUDIANTE
      if (headerUpper.includes("CODIGO") && headerUpper.includes("ESTUDIANTE")) {
        estructuraNormalizada["CODIGO ESTUDIANTE"] = valor;
        Logger.log(`✅ Mapeado CODIGO ESTUDIANTE: ${valor}`);
      } 
      // Mapeo para COD PLAN
      else if (headerUpper.includes("COD") && headerUpper.includes("PLAN")) {
        estructuraNormalizada["COD PLAN"] = valor;
        Logger.log(`✅ Mapeado COD PLAN: ${valor}`);
      }
      // Mapeo alternativo para PLAN solo
      else if (headerUpper === "PLAN" || headerUpper.includes("PLAN")) {
        estructuraNormalizada["COD PLAN"] = valor;
        Logger.log(`✅ Mapeado COD PLAN (alternativo): ${valor}`);
      }
      // Mapeo para TITULO DE LA TESIS
      else if (headerUpper.includes("TITULO") && headerUpper.includes("TESIS")) {
        estructuraNormalizada["TITULO DE LA TESIS"] = valor;
        Logger.log(`✅ Mapeado TITULO DE LA TESIS: ${valor}`);
      }
      // Mapeo alternativo para TITULO solo
      else if (headerUpper === "TITULO" || headerUpper.includes("TITULO")) {
        estructuraNormalizada["TITULO DE LA TESIS"] = valor;
        Logger.log(`✅ Mapeado TITULO DE LA TESIS (alternativo): ${valor}`);
      }
      // Mapeo para HORAS SEMESTRE
      else if (headerUpper.includes("HORAS") && headerUpper.includes("SEMESTRE")) {
        estructuraNormalizada["HORAS SEMESTRE"] = valor;
        Logger.log(`✅ Mapeado HORAS SEMESTRE: ${valor}`);
      }
      // Mapeo alternativo para HORAS solo
      else if (headerUpper === "HORAS" || headerUpper.includes("HORAS")) {
        estructuraNormalizada["HORAS SEMESTRE"] = valor;
        Logger.log(`✅ Mapeado HORAS SEMESTRE (alternativo): ${valor}`);
      }
      else {
        Logger.log(`⚠️ Header no mapeado: "${header}"`);
      }
    });

    Logger.log("🎯 Tesis normalizada final: " + JSON.stringify(estructuraNormalizada));
    return estructuraNormalizada;
  }

  var tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches || tableMatches.length === 0) {
    Logger.log("No se encontró ninguna tabla.");
    return [];
  }
  Logger.log("=== PROCESANDO " + tableMatches.length + " TABLAS ===");

  var informacionPersonal = {};
  var actividadesDocencia = { pregrado: [], postgrado: [], direccionTesis: [] };
  var actividadesInvestigacion = [];
  var actividadesExtension = [];
  var actividadesIntelectualesOArtisticas = [];
  var actividadesAdministrativas = [];
  var actividadesComplementarias = [];
  var docenteEnComision = [];
  var contadorDocencia = 0;

  tableMatches.map(function(tableHtml) {
    var rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rowMatches || rowMatches.length < 1) return;

    var headers = extractCells(rowMatches[0]);
    var headersNorm = headers.map(h => h.toUpperCase());
    Logger.log("=== PROCESANDO TABLA ===");
    Logger.log("Headers originales: " + headers.join(" | "));

    // Tabla de información personal - Mejorar detección con múltiples variaciones
    var tieneCedula = headersNorm.some(function(h) {
      return h.includes("CEDULA") || 
             h.includes("DOCUMENTO") || 
             h === "DOCENTES" ||
             h.includes("IDENTIFICACION");
    });
    var tieneApellido = headersNorm.some(function(h) {
      return h.includes("APELLIDO") || 
             h.includes("APELLIDOS") ||
             h.includes("NOMBRE");
    });
    
    if (tieneCedula && tieneApellido) {
      if (rowMatches.length >= 2) {
        var values = extractCells(rowMatches[1]);
        headers.forEach(function(header, i) {
          var valor = values[i] || "";
          // Normalizar nombres de campos comunes
          var headerNorm = header.toUpperCase().trim();
          if (headerNorm.includes("CEDULA") || headerNorm === "DOCENTES" || headerNorm.includes("DOCUMENTO")) {
            informacionPersonal["CEDULA"] = valor;
          }
          if (headerNorm.includes("1 APELLIDO") || headerNorm === "APELLIDO1" || headerNorm === "PRIMER APELLIDO") {
            informacionPersonal["1 APELLIDO"] = valor;
          }
          if (headerNorm.includes("2 APELLIDO") || headerNorm === "APELLIDO2" || headerNorm === "SEGUNDO APELLIDO") {
            informacionPersonal["2 APELLIDO"] = valor;
          }
          if (headerNorm === "NOMBRE" || headerNorm.includes("NOMBRES")) {
            informacionPersonal["NOMBRE"] = valor;
          }
          // Mapear VINCULACION
          if (headerNorm.includes("VINCULACION") || headerNorm.includes("VINCULACIÓN")) {
            informacionPersonal["VINCULACION"] = valor;
          }
          // Mapear CATEGORIA
          if (headerNorm.includes("CATEGORIA") || headerNorm.includes("CATEGORÍA") || headerNorm === "CARGO") {
            informacionPersonal["CATEGORIA"] = valor;
          }
          // Mapear DEDICACION
          if (headerNorm.includes("DEDICACION") || headerNorm.includes("DEDICACIÓN")) {
            informacionPersonal["DEDICACION"] = valor;
          }
          // Mapear NIVEL ALCANZADO
          if (headerNorm.includes("NIVEL ALCANZADO") || headerNorm.includes("NIVEL")) {
            informacionPersonal["NIVEL ALCANZADO"] = valor;
            informacionPersonal["NIVEL"] = valor; // También guardar como NIVEL para compatibilidad
          }
          // Guardar también el header original para compatibilidad
          informacionPersonal[header] = valor;
        });
      }
      return;
    }

    // Lógica para clasificar asignaturas individualmente
    // Mejorar detección: debe tener CODIGO y NOMBRE DE ASIGNATURA, pero NO debe ser tesis
    var esTablaAsignaturas = headersNorm.some(function(h) { return h === "CODIGO" || h.includes("CODIGO"); }) && 
                            headersNorm.some(function(h) { return h.includes("NOMBRE") && h.includes("ASIGNATURA"); }) &&
                            !headersNorm.some(function(h) { return h.includes("ESTUDIANTE") && h.includes("CODIGO"); });
    
    if (esTablaAsignaturas) {
      Logger.log("🎓 Detectada tabla de asignaturas. Procesando fila por fila...");
      Logger.log("🎓 Headers de asignaturas: " + headers.join(" | "));
      
      var contadorPregradoTabla = 0;
      var contadorPostgradoTabla = 0;
      
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        var cells = extractCells(row);
        
        // Saltar filas vacías o que sean solo separadores
        if (cells.every(function(c) { return c === "" || c.trim() === ""; })) continue;
        
        // Validar que la fila tenga al menos código o nombre
        var tieneCodigo = cells.some(function(c, idx) {
          var header = headers[idx] || "";
          return header.toUpperCase().includes("CODIGO") && c && c.trim() !== "";
        });
        var tieneNombre = cells.some(function(c, idx) {
          var header = headers[idx] || "";
          return header.toUpperCase().includes("NOMBRE") && c && c.trim() !== "";
        });
        
        if (!tieneCodigo && !tieneNombre) continue;

        var obj = {};
        for (var ci = 0; ci < headers.length && ci < cells.length; ci++) {
          obj[headers[ci]] = cells[ci] || "";
        }
        
        var estructuraNormalizada = normalizarEstructuraAsignatura(obj, headers);
        
        // Validar que la actividad tenga información mínima antes de clasificar
        if (!estructuraNormalizada.CODIGO && !estructuraNormalizada["NOMBRE DE ASIGNATURA"]) {
          Logger.log("⚠️ Actividad sin código ni nombre, omitiendo");
          continue;
        }
        
        if (esActividadPostgrado(estructuraNormalizada)) {
          actividadesDocencia.postgrado.push(estructuraNormalizada);
          contadorPostgradoTabla++;
          Logger.log("✅ POSTGRADO: " + estructuraNormalizada.CODIGO + " - " + estructuraNormalizada["NOMBRE DE ASIGNATURA"]);
        } else {
          actividadesDocencia.pregrado.push(estructuraNormalizada);
          contadorPregradoTabla++;
          Logger.log("✅ PREGRADO: " + estructuraNormalizada.CODIGO + " - " + estructuraNormalizada["NOMBRE DE ASIGNATURA"]);
        }
      }
      
      Logger.log("🎓 Tabla de asignaturas procesada: " + contadorPregradoTabla + " pregrado, " + contadorPostgradoTabla + " postgrado");
      contadorDocencia++;
      return;
    }

    // Detección más flexible para tablas de dirección de tesis
    var esTablaTesis = (
      (headersNorm.some(h => h.includes("CODIGO") && h.includes("ESTUDIANTE")) || 
       headersNorm.some(h => h === "CODIGO ESTUDIANTE")) &&
      (headersNorm.some(h => h.includes("TITULO") && h.includes("TESIS")) ||
       headersNorm.some(h => h === "TITULO DE LA TESIS") ||
       headersNorm.some(h => h === "TITULO"))
    );
    
    // Detección alternativa si tiene las columnas típicas de tesis
    if (!esTablaTesis) {
      var tieneCodigoEst = headersNorm.some(h => h.includes("ESTUDIANTE"));
      var tienePlan = headersNorm.some(h => h.includes("PLAN"));
      var tieneTitulo = headersNorm.some(h => h.includes("TITULO"));
      
      if (tieneCodigoEst && tienePlan && tieneTitulo) {
        esTablaTesis = true;
        Logger.log("🎯 Tabla de tesis detectada por combinación alternativa");
      }
    }
    
    if (esTablaTesis) {
      Logger.log("🎯 Encontrada tabla de dirección de tesis con headers: " + headers.join(", "));
      for (var ri2 = 1; ri2 < rowMatches.length; ri2++) {
        var row = rowMatches[ri2];
        var cells = extractCells(row);
        if (cells.every(c => c === "")) continue;

        var obj = {};
        for (var ci = 0; ci < headers.length && ci < cells.length; ci++) {
          obj[headers[ci]] = cells[ci] || "";
        }
        var estructuraNormalizada = normalizarEstructuraTesis(obj, headers);
        
        // Validar que la tesis tenga información mínima
        if (estructuraNormalizada["CODIGO ESTUDIANTE"] || estructuraNormalizada["TITULO DE LA TESIS"]) {
          actividadesDocencia.direccionTesis.push(estructuraNormalizada);
          Logger.log("🎯 Agregada tesis: " + JSON.stringify(estructuraNormalizada));
        } else {
          Logger.log("⚠️ Tesis sin información mínima, omitiendo");
        }
      }
      return;
    }

    var processed = false;
    
    // El resto de la lógica de detección de tablas se mantiene

    // 1. ACTIVIDADES INTELECTUALES
    if (headersNorm.some(h => h.includes("APROBADO")) && headersNorm.includes("TIPO") && headersNorm.includes("NOMBRE")) {
      Logger.log("--> Detectada como: ACTIVIDADES INTELECTUALES");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        actividadesIntelectualesOArtisticas.push(obj);
      }
      processed = true;
    }
    
    // 2. ACTIVIDADES DE INVESTIGACION
    if (!processed && headersNorm.some(h => h.includes("PROYECTO DE INVESTIGACION"))) {
      Logger.log("--> Detectada como: ACTIVIDADES DE INVESTIGACION");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        actividadesInvestigacion.push(obj);
      }
      processed = true;
    }

    // 3. ACTIVIDADES COMPLEMENTARIAS
    if (!processed && headersNorm.some(h => h.includes("PARTICIPACION EN"))) {
      Logger.log("--> Detectada como: ACTIVIDADES COMPLEMENTARIAS");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        actividadesComplementarias.push(obj);
      }
      processed = true;
    }

    // 4. DOCENTE EN COMISION
    if (!processed && headersNorm.some(h => h.includes("TIPO DE COMISION"))) {
      Logger.log("--> Detectada como: DOCENTE EN COMISION");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        docenteEnComision.push(obj);
      }
      processed = true;
    }

    // 5. ACTIVIDADES ADMINISTRATIVAS
    if (!processed && headersNorm.includes("CARGO") && headersNorm.includes("DESCRIPCION DEL CARGO")) {
      Logger.log("--> Detectada como: ACTIVIDADES ADMINISTRATIVAS");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        actividadesAdministrativas.push(obj);
      }
      processed = true;
    }
    
    // 6. ACTIVIDADES DE EXTENSION
    if (!processed && headersNorm.includes("TIPO") && headersNorm.includes("NOMBRE") && headersNorm.includes("HORAS SEMESTRE") &&
        !headersNorm.some(h => h.includes("APROBADO"))) {
      Logger.log("--> Detectada como: ACTIVIDADES DE EXTENSION");
      for (var ri = 1; ri < rowMatches.length; ri++) {
        var row = rowMatches[ri];
        if (extractCells(row).every(c => c === "")) continue;
        var obj = {};
        headers.forEach((header, ci) => { obj[header] = extractCells(row)[ci] || ""; });
        actividadesExtension.push(obj);
      }
      processed = true;
    }

    if (!processed) {
      Logger.log("⚠️ TABLA NO PROCESADA - Headers: " + headers.join(" | "));
    } else {
      Logger.log("✅ Tabla procesada correctamente");
    }
  });

  var salida = [{
    periodo: idPeriod,
    informacionPersonal: informacionPersonal,
    actividadesDocencia: actividadesDocencia,
    actividadesInvestigacion: actividadesInvestigacion,
    actividadesExtension: actividadesExtension,
    actividadesIntelectualesOArtisticas: actividadesIntelectualesOArtisticas,
    actividadesAdministrativas: actividadesAdministrativas,
    actividadesComplementarias: actividadesComplementarias,
    docenteEnComision: docenteEnComision
  }];

  Logger.log("=== RESUMEN FINAL ===");
  Logger.log("Actividades de docencia pregrado: " + actividadesDocencia.pregrado.length);
  Logger.log("Actividades de docencia postgrado: " + actividadesDocencia.postgrado.length);
  Logger.log("Dirección de tesis: " + actividadesDocencia.direccionTesis.length);
  Logger.log(JSON.stringify(salida, null, 2));
  return salida;
}

// ========================================
// FUNCIONES DE PRUEBA Y UTILIDADES
// ========================================

/**
 * Función de prueba para verificar que las cookies se obtienen correctamente
 */
function testCookies() {
  try {
    const cookies = getCookiesFromSheet();
    Logger.log('✅ Prueba exitosa');
    Logger.log(`Timestamp: ${cookies.timestamp || '(sin timestamp)'}`);
    Logger.log(`PHPSESSID: ${cookies.PHPSESSID ? cookies.PHPSESSID.substring(0, 10)+'...' : '(vacío)'}`);
    Logger.log(`asigacad: ${cookies.asigacad ? cookies.asigacad.substring(0, 10)+'...' : '(vacío)'}`);
  } catch (error) {
    Logger.log('❌ Error en prueba: ' + error.toString());
  }
}

/**
 * Función de prueba para verificar la extracción de periodos
 */
function testGetPeriodos() {
  try {
    const periodos = getUltimosNPeriodosDesdePortal(8);
    Logger.log('✅ Periodos obtenidos exitosamente:');
    periodos.forEach(p => {
      Logger.log(`  - ${p.label} (id=${p.idPeriod})`);
    });
  } catch (error) {
    Logger.log('❌ Error obteniendo periodos: ' + error.toString());
  }
}

/**
 * Función de prueba para verificar la extracción de tesis
 */
function testTesisExtraction() {
  try {
    const datos = extraerDatosDocenteUnivalle("1112966620", 48);
    Logger.log('✅ Datos extraídos');
    Logger.log('Información personal: ' + JSON.stringify(datos[0].informacionPersonal));
    Logger.log('Actividades de docencia: ' + JSON.stringify(datos[0].actividadesDocencia));
    Logger.log('Dirección de tesis encontradas: ' + datos[0].actividadesDocencia.direccionTesis.length);
    datos[0].actividadesDocencia.direccionTesis.forEach((tesis, index) => {
      Logger.log(`Tesis ${index + 1}: ` + JSON.stringify(tesis));
    });
  } catch (error) {
    Logger.log('❌ Error en prueba de tesis: ' + error.toString());
  }
}

/**
 * Función de prueba específica para el sistema de fallback OPTIMIZADO
 */
function testFallbackSystem() {
  Logger.log('🧪 === PRUEBA DEL SISTEMA DE FALLBACK OPTIMIZADO ===');
  
  try {
    // Limpiar cache para prueba desde cero
    limpiarCacheFallback();
    
    // Probar directamente el fallback optimizado
    Logger.log('🔄 Probando fallback optimizado...');
    const inicio = new Date().getTime();
    const datosFallback = buscarDocenteOptimizado("1112966620", 48);
    const fin = new Date().getTime();
    
    Logger.log(`⚡ Tiempo de consulta: ${fin - inicio}ms`);
    
    if (datosFallback && datosFallback.length > 0) {
      Logger.log('✅ Fallback optimizado exitoso!');
      Logger.log('📊 Información personal:', JSON.stringify(datosFallback[0].informacionPersonal));
      Logger.log('📚 Actividades pregrado:', datosFallback[0].actividadesDocencia.pregrado.length);
      Logger.log('🎓 Actividades postgrado:', datosFallback[0].actividadesDocencia.postgrado.length);
      
      // Mostrar algunas actividades de ejemplo
      if (datosFallback[0].actividadesDocencia.pregrado.length > 0) {
        Logger.log('📝 Ejemplo actividad pregrado:', JSON.stringify(datosFallback[0].actividadesDocencia.pregrado[0]));
      }
      if (datosFallback[0].actividadesDocencia.postgrado.length > 0) {
        Logger.log('📝 Ejemplo actividad postgrado:', JSON.stringify(datosFallback[0].actividadesDocencia.postgrado[0]));
      }
      
      // Probar segunda consulta para verificar cache
      Logger.log('🔄 Probando consulta desde cache...');
      const inicioCache = new Date().getTime();
      buscarDocenteOptimizado("1112966620", 48);
      const finCache = new Date().getTime();
      Logger.log(`⚡ Tiempo desde cache: ${finCache - inicioCache}ms`);
      
      verificarEstadoCache();
      
    } else {
      Logger.log('❌ Fallback devolvió datos vacíos');
    }
    
  } catch (error) {
    Logger.log('❌ Error en prueba de fallback: ' + error.toString());
  }
  
  Logger.log('🧪 === FIN PRUEBA FALLBACK OPTIMIZADO ===');
}

/**
 * Función para forzar el uso del fallback (útil para pruebas)
 */
function testFallbackForzado() {
  Logger.log('🧪 === PRUEBA DE FALLBACK FORZADO ===');
  
  try {
    // Simular que la extracción web falló
    Logger.log('🛡️ Activando fallback forzado...');
    const datos = buscarDocenteOptimizado("1112966620", 48);
    
    Logger.log('✅ Resultado del fallback forzado:');
    Logger.log('- Período:', datos[0]?.periodo);
    Logger.log('- Info personal disponible:', Object.keys(datos[0]?.informacionPersonal || {}).length > 0);
    Logger.log('- Actividades pregrado:', datos[0]?.actividadesDocencia?.pregrado?.length || 0);
    Logger.log('- Actividades postgrado:', datos[0]?.actividadesDocencia?.postgrado?.length || 0);
    
    return datos;
    
  } catch (error) {
    Logger.log('❌ Error en fallback forzado: ' + error.toString());
    return [];
  }
}

/**
 * Función para comparar rendimiento entre fallback original y optimizado
 */
function testComparacionRendimiento() {
  Logger.log('🏃 === COMPARACIÓN DE RENDIMIENTO ===');
  
  const cedula = "1112966620";
  const periodo = 48;
  
  // Limpiar cache para prueba justa
  limpiarCacheFallback();
  
  // Prueba con sistema optimizado
  Logger.log('🚀 Probando sistema OPTIMIZADO...');
  const inicioOptimizado = new Date().getTime();
  
  try {
    const datosOptimizados = buscarDocenteOptimizado(cedula, periodo);
    const finOptimizado = new Date().getTime();
    const tiempoOptimizado = finOptimizado - inicioOptimizado;
    
    Logger.log(`✅ Sistema optimizado: ${tiempoOptimizado}ms`);
    Logger.log(`📊 Datos obtenidos: ${datosOptimizados[0]?.actividadesDocencia?.pregrado?.length || 0} pregrado, ${datosOptimizados[0]?.actividadesDocencia?.postgrado?.length || 0} postgrado`);
    
    // Segunda consulta para medir cache
    const inicioCache = new Date().getTime();
    buscarDocenteOptimizado(cedula, periodo);
    const finCache = new Date().getTime();
    const tiempoCache = finCache - inicioCache;
    
    Logger.log(`⚡ Con cache: ${tiempoCache}ms (mejora: ${((tiempoOptimizado - tiempoCache) / tiempoOptimizado * 100).toFixed(1)}%)`);
    
  } catch (error) {
    Logger.log('❌ Error en sistema optimizado: ' + error.toString());
  }
  
  Logger.log('🏃 === FIN COMPARACIÓN ===');
}

/**
 * Limpia el cache de fallback para forzar nueva consulta
 */
function limpiarCacheFallback() {
  CACHE_FALLBACK.lastUpdate = null;
  CACHE_DOCENTES.clear();
  Logger.log('🧹 Cache de fallback limpiado');
}

/**
 * Función para verificar el estado del cache
 */
function verificarEstadoCache() {
  Logger.log('📊 === ESTADO DEL CACHE ===');
  
  const now = new Date().getTime();
  const isValid = isCacheValid();
  
  Logger.log(`Cache válido: ${isValid}`);
  
  if (CACHE_FALLBACK.lastUpdate) {
    const edad = (now - CACHE_FALLBACK.lastUpdate) / 1000;
    Logger.log(`Edad del cache: ${edad.toFixed(1)} segundos`);
  } else {
    Logger.log('Cache no inicializado');
  }
  
  Logger.log(`Docentes en cache: ${CACHE_DOCENTES.size}`);
  Logger.log(`Hojas encontradas: Info=${!!CACHE_FALLBACK.sheetInfo}, Actividades=${!!CACHE_FALLBACK.sheetActividades}`);
  
  if (CACHE_FALLBACK.columnsInfo) {
    Logger.log(`Columnas info: ${CACHE_FALLBACK.columnsInfo.headers.length}, índice cédula: ${CACHE_FALLBACK.columnsInfo.cedulaIndex}`);
  }
  
  if (CACHE_FALLBACK.columnsActividades) {
    Logger.log(`Columnas actividades: ${CACHE_FALLBACK.columnsActividades.headers.length}, índice cédula: ${CACHE_FALLBACK.columnsActividades.cedulaIndex}`);
  }
}

/**
 * Función para precargar el cache (útil para mejorar rendimiento)
 */
function precargarCache() {
  Logger.log('🔄 Precargando cache...');
  const inicio = new Date().getTime();
  
  try {
    initializeFallbackCache();
    const fin = new Date().getTime();
    Logger.log(`✅ Cache precargado en ${fin - inicio}ms`);
    verificarEstadoCache();
  } catch (error) {
    Logger.log('❌ Error precargando cache: ' + error.toString());
  }
}

/**
 * Función para usar SOLO el fallback optimizado (sin intentar extracción web)
 * Útil cuando sabemos que el servidor está caído
 */
function extraerDatosSoloFallback(cedula = "1112966620", idPeriod = 48) {
  Logger.log(`🛡️ Usando SOLO fallback optimizado para cédula ${cedula}, período ${idPeriod}`);
  return buscarDocenteOptimizado(cedula, idPeriod);
}

/**
 * Función para procesar múltiples docentes con fallback optimizado
 */
function procesarDocentesConFallbackOptimizado(docentes) {
  Logger.log('🚀 Procesando docentes con fallback optimizado...');
  
  // Precargar cache una sola vez
  precargarCache();
  
  const resultados = [];
  const inicio = new Date().getTime();
  
  for (const docente of docentes) {
    try {
      Logger.log(`📋 Procesando: ${docente.cedula} - Período: ${docente.periodo}`);
      const datos = buscarDocenteOptimizado(docente.cedula, docente.periodo);
      resultados.push({
        cedula: docente.cedula,
        periodo: docente.periodo,
        datos: datos,
        timestamp: new Date().toISOString()
      });
      Logger.log(`✅ Docente ${docente.cedula} procesado`);
    } catch (error) {
      Logger.log(`❌ Error procesando ${docente.cedula}: ${error.toString()}`);
    }
  }
  
  const fin = new Date().getTime();
  Logger.log(`🎉 ${resultados.length} docentes procesados en ${fin - inicio}ms (promedio: ${((fin - inicio) / docentes.length).toFixed(1)}ms por docente)`);
  
  return resultados;
}