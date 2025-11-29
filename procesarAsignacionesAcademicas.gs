
// ID de la hoja con lista de docentes por periodo
const SHEET_DOCENTES_ID = "1mvCj-5ELwLW14-BwPhw06vneFsKb_dPDI4JuSyQeFZA";

// ID de la hoja principal (donde se guardan asignaciones)
const SHEET_PRINCIPAL_ID = "1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg";

// Encabezados para la hoja de periodo
const ENCABEZADOS_PERIODO = [
  'Cedula',
  'Nombre Profesor',
  'Escuela',
  'Departamento',
  'Tipo de Actividad',
  'Categoría',
  'Nombre de actividad',
  'Número de horas',
  'id',
  'Período',
  'Porcentaje horas',
  'Detalle actividad',
  'Actividad',
  'Vinculación',
  'Dedicación',
  'Nivel',
  'Cargo'
];

/**
 * FUNCIÓN PRINCIPAL - Procesa un periodo completo
 * @param {string} nombrePeriodo - Periodo a procesar (ej: "2025-1")
 * @param {number} idPeriodo - ID numérico del periodo en UV
 */
function procesarPeriodoCompleto(nombrePeriodo, idPeriodo) {
  try {
    Logger.log('====================================');
    Logger.log('🚀 PROCESAMIENTO DE PERIODO');
    Logger.log(`📅 Periodo: ${nombrePeriodo} (ID: ${idPeriodo})`);
    Logger.log('====================================');

    // PASO 1: Obtener hoja limpia del periodo
    Logger.log('\n📝 PASO 1: Preparando hoja del periodo...');
    const hojaDestino = obtenerHojaLimpia(nombrePeriodo);
    Logger.log(`✅ Hoja "${nombrePeriodo}" lista`);

    // PASO 2: Leer cédulas desde hoja "Docentes YYYY-N"
    Logger.log('\n📋 PASO 2: Leyendo lista de docentes...');
    const nombreHojaDocentes = `Docentes ${nombrePeriodo}`;
    const cedulasDocentes = obtenerListadoDocentes(nombreHojaDocentes);

    if (!cedulasDocentes || cedulasDocentes.length === 0) {
      Logger.log(`⚠️ No se encontraron docentes en la hoja "${nombreHojaDocentes}"`);
      return { error: `No hay docentes en la hoja "${nombreHojaDocentes}"` };
    }

    Logger.log(`✅ ${cedulasDocentes.length} docentes encontrados`);
    Logger.log(`📋 Primeras cédulas: ${cedulasDocentes.slice(0, 5).join(', ')}...`);

    // PASO 3: Procesar cada docente
    Logger.log('\n🔄 PASO 3: Procesando asignaciones...');
    let contadorExitosos = 0;
    let contadorErrores = 0;
    const todasLasFilas = [];

    for (let i = 0; i < cedulasDocentes.length; i++) {
      const cedula = cedulasDocentes[i];
      Logger.log(`\n[${i + 1}/${cedulasDocentes.length}] Procesando: ${cedula}`);

      try {
        // Consultar AA del docente
        Logger.log(`  🌐 Consultando asignaciones...`);
        const datosAA = extraerDatosDocenteUnivalle(cedula, idPeriodo);

        if (!datosAA || datosAA.length === 0) {
          Logger.log(`  ⚠️ Sin datos para ${cedula}`);
          contadorErrores++;
          continue;
        }

        // Normalizar datos
        Logger.log(`  📊 Normalizando datos...`);
        const filasNormalizadas = procesarDocenteAA(datosAA[0], cedula, nombrePeriodo);

        if (filasNormalizadas.length > 0) {
          todasLasFilas.push(...filasNormalizadas);
          Logger.log(`  ✅ ${filasNormalizadas.length} filas generadas`);
          contadorExitosos++;
        } else {
          Logger.log(`  ⚠️ Sin actividades para ${cedula}`);
          contadorErrores++;
        }

        // Pausa para no sobrecargar el servidor
        if (i < cedulasDocentes.length - 1) {
          Utilities.sleep(500);
        }

      } catch (error) {
        Logger.log(`  ❌ Error: ${error.toString()}`);
        contadorErrores++;
      }
    }

    // PASO 4: Guardar en la hoja
    Logger.log('\n💾 PASO 4: Guardando datos...');
    if (todasLasFilas.length > 0) {
      insertarFilasEnHoja(hojaDestino, todasLasFilas);
      Logger.log(`✅ ${todasLasFilas.length} filas insertadas`);
    } else {
      Logger.log('⚠️ No hay filas para insertar');
    }

    // RESUMEN
    Logger.log('\n====================================');
    Logger.log('📊 RESUMEN FINAL');
    Logger.log(`✅ Docentes procesados: ${contadorExitosos}`);
    Logger.log(`❌ Errores: ${contadorErrores}`);
    Logger.log(`📝 Total filas: ${todasLasFilas.length}`);
    Logger.log(`📄 Hoja: "${nombrePeriodo}"`);
    Logger.log('====================================');

    return {
      exitosos: contadorExitosos,
      errores: contadorErrores,
      totalFilas: todasLasFilas.length,
      nombreHoja: nombrePeriodo
    };

  } catch (error) {
    Logger.log(`❌ ERROR CRÍTICO: ${error.toString()}`);
    Logger.log(error.stack);
    return { error: error.toString() };
  }
}

/**
 * Obtiene/crea hoja limpia del periodo
 * @param {string} nombreHoja - Nombre de la hoja (ej: "2025-1")
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function obtenerHojaLimpia(nombreHoja) {
  const ss = SpreadsheetApp.openById(SHEET_PRINCIPAL_ID);
  let hoja = ss.getSheetByName(nombreHoja);

  if (!hoja) {
    // Crear hoja nueva
    hoja = ss.insertSheet(nombreHoja);
    Logger.log(`✅ Hoja "${nombreHoja}" creada`);
  } else {
    // Limpiar hoja existente
    hoja.clear({ contentsOnly: false });
    Logger.log(`✅ Hoja "${nombreHoja}" limpiada`);
  }

  // Insertar encabezados
  hoja.getRange(1, 1, 1, ENCABEZADOS_PERIODO.length)
    .setValues([ENCABEZADOS_PERIODO])
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('white');

  // Ajustar anchos de columna
  hoja.setColumnWidth(1, 100);  // Cédula
  hoja.setColumnWidth(2, 200);  // Nombre Profesor
  hoja.setColumnWidth(3, 150);  // Escuela
  hoja.setColumnWidth(7, 250);  // Nombre de actividad

  return hoja;
}

/**
 * Lee cédulas desde hoja "Docentes YYYY-N" del spreadsheet de docentes
 * @param {string} nombreHoja - Nombre de la hoja (ej: "Docentes 2025-1")
 * @returns {Array} - Array de cédulas
 */
function obtenerListadoDocentes(nombreHoja) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_DOCENTES_ID);
    const hoja = ss.getSheetByName(nombreHoja);

    if (!hoja) {
      Logger.log(`❌ No se encontró la hoja: ${nombreHoja}`);
      return [];
    }

    const lastRow = hoja.getLastRow();
    if (lastRow < 2) {
      Logger.log('⚠️ La hoja no tiene datos (solo encabezados)');
      return [];
    }

    // Leer cédulas de columna A (desde fila 2)
    const cedulas = hoja.getRange(2, 1, lastRow - 1, 1).getValues();

    // Filtrar cédulas vacías y convertir a array plano
    const cedulasLimpias = cedulas
      .map(row => String(row[0]).trim())
      .filter(cedula => cedula !== '' && cedula !== 'null' && cedula !== 'undefined');

    return cedulasLimpias;

  } catch (error) {
    Logger.log(`❌ Error obteniendo docentes: ${error.toString()}`);
    return [];
  }
}

/**
 * Procesa datos de AA de un docente y genera filas normalizadas
 * @param {Object} datosAA - Datos de extraerDatosDocenteUnivalle
 * @param {string} cedula - Cédula del docente
 * @param {string} periodo - Periodo (ej: "2025-1")
 * @returns {Array} - Array de filas
 */
function procesarDocenteAA(datosAA, cedula, periodo) {
  const filas = [];

  try {
    const infPersonal = datosAA.informacionPersonal || {};
    const nombreCompleto = construirNombreCompleto(infPersonal);
    const escuela = determinarEscuela(infPersonal);
    const departamento = determinarDepartamento(infPersonal);

    const categoria = infPersonal.CATEGORIA || infPersonal.categoria || '';
    const vinculacion = infPersonal.VINCULACION || infPersonal.vinculacion || '';
    const dedicacion = infPersonal.DEDICACION || infPersonal.dedicacion || '';
    const nivel = infPersonal.NIVEL || infPersonal['NIVEL ALCANZADO'] || '';
    const cargo = infPersonal.CARGO || '';

    // DOCENCIA - PREGRADO
    const pregrado = datosAA.actividadesDocencia?.pregrado || [];
    pregrado.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Docencia',
        categoria: 'Pregrado',
        nombreActividad: actividad['NOMBRE DE ASIGNATURA'] || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: actividad.CODIGO || '',
        periodo,
        porcentajeHoras: actividad.PORC || '',
        detalleActividad: construirDetalleDocencia(actividad),
        actividad: 'Pregrado',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // DOCENCIA - POSTGRADO
    const postgrado = datosAA.actividadesDocencia?.postgrado || [];
    postgrado.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Docencia',
        categoria: 'Postgrado',
        nombreActividad: actividad['NOMBRE DE ASIGNATURA'] || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: actividad.CODIGO || '',
        periodo,
        porcentajeHoras: actividad.PORC || '',
        detalleActividad: construirDetalleDocencia(actividad),
        actividad: 'Postgrado',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // DOCENCIA - TESIS
    const tesis = datosAA.actividadesDocencia?.direccionTesis || [];
    tesis.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Docencia',
        categoria: 'Tesis',
        nombreActividad: actividad['TITULO DE LA TESIS'] || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: actividad['CODIGO ESTUDIANTE'] || '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: `Plan: ${actividad['COD PLAN'] || ''}`,
        actividad: 'Tesis',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // INVESTIGACIÓN
    const investigacion = datosAA.actividadesInvestigacion || [];
    investigacion.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Investigación',
        categoria: determinarCategoriaInvestigacion(actividad),
        nombreActividad: actividad['NOMBRE DEL PROYECTO DE INVESTIGACION'] || actividad.NOMBRE || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: actividad.CODIGO || '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: '',
        actividad: 'Investigación',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // EXTENSIÓN
    const extension = datosAA.actividadesExtension || [];
    extension.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Extensión',
        categoria: actividad.TIPO || '',
        nombreActividad: actividad.NOMBRE || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: '',
        actividad: 'Extensión',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // INTELECTUALES
    const intelectuales = datosAA.actividadesIntelectualesOArtisticas || [];
    intelectuales.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Intelectuales',
        categoria: actividad.TIPO || '',
        nombreActividad: actividad.NOMBRE || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: `Aprobado por: ${actividad['APROBADO POR'] || ''}`,
        actividad: 'Intelectuales',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // ADMINISTRATIVAS
    const administrativas = datosAA.actividadesAdministrativas || [];
    administrativas.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Administrativas',
        categoria: actividad.CARGO || '',
        nombreActividad: actividad['DESCRIPCION DEL CARGO'] || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: '',
        actividad: 'Administrativas',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // COMPLEMENTARIAS
    const complementarias = datosAA.actividadesComplementarias || [];
    complementarias.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Complementarias',
        categoria: actividad['PARTICIPACION EN'] || '',
        nombreActividad: actividad.NOMBRE || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: '',
        actividad: 'Complementarias',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

    // COMISIÓN
    const comision = datosAA.docenteEnComision || [];
    comision.forEach(actividad => {
      filas.push(construirFilaAsignacion({
        cedula, nombreCompleto, escuela, departamento,
        tipoActividad: 'Comisión',
        categoria: actividad['TIPO DE COMISION'] || '',
        nombreActividad: actividad.DESCRIPCION || '',
        numeroHoras: actividad['HORAS SEMESTRE'] || 0,
        id: '',
        periodo,
        porcentajeHoras: '',
        detalleActividad: '',
        actividad: 'Comisión',
        vinculacion, dedicacion, nivel, cargo
      }));
    });

  } catch (error) {
    Logger.log(`❌ Error procesando ${cedula}: ${error.toString()}`);
  }

  return filas;
}

/**
 * Construye fila con formato de encabezados
 */
function construirFilaAsignacion(datos) {
  return [
    String(datos.cedula || ''),
    String(datos.nombreCompleto || ''),
    String(datos.escuela || ''),
    String(datos.departamento || ''),
    String(datos.tipoActividad || ''),
    String(datos.categoria || ''),
    String(datos.nombreActividad || ''),
    parseFloat(datos.numeroHoras || 0),
    String(datos.id || ''),
    String(datos.periodo || ''),
    String(datos.porcentajeHoras || ''),
    String(datos.detalleActividad || ''),
    String(datos.actividad || ''),
    String(datos.vinculacion || ''),
    String(datos.dedicacion || ''),
    String(datos.nivel || ''),
    String(datos.cargo || '')
  ];
}

/**
 * Construye nombre completo
 */
function construirNombreCompleto(infPersonal) {
  const nombres = infPersonal.NOMBRES || infPersonal.nombres || '';
  const apellido1 = infPersonal['PRIMER APELLIDO'] || infPersonal.primerApellido || infPersonal['1 APELLIDO'] || '';
  const apellido2 = infPersonal['SEGUNDO APELLIDO'] || infPersonal.segundoApellido || infPersonal['2 APELLIDO'] || '';
  return `${nombres} ${apellido1} ${apellido2}`.trim();
}

/**
 * Determina escuela
 */
function determinarEscuela(infPersonal) {
  const escuela = infPersonal.ESCUELA || infPersonal.escuela || '';
  return namesSchool[escuela] || escuela || 'N/A';
}

/**
 * Determina departamento
 */
function determinarDepartamento(infPersonal) {
  const departamento = infPersonal.DEPARTAMENTO || infPersonal.departamento || '';
  return namesDepartament[departamento] || departamento || 'Escuela';
}

/**
 * Construye detalle de docencia
 */
function construirDetalleDocencia(actividad) {
  const detalles = [];
  if (actividad.GRUPO) detalles.push(`Grupo: ${actividad.GRUPO}`);
  if (actividad.TIPO) detalles.push(`Tipo: ${actividad.TIPO}`);
  if (actividad.CRED) detalles.push(`Créditos: ${actividad.CRED}`);
  if (actividad.FREC) detalles.push(`Frecuencia: ${actividad.FREC}`);
  if (actividad.INTEN) detalles.push(`Intensidad: ${actividad.INTEN}`);
  return detalles.join(' | ');
}

/**
 * Determina categoría de investigación
 */
function determinarCategoriaInvestigacion(actividad) {
  const nombre = String(actividad['NOMBRE DEL PROYECTO DE INVESTIGACION'] || actividad.NOMBRE || '').toUpperCase();
  if (nombre.includes('ANTEPROYECTO')) {
    return 'Anteproyecto';
  }
  return 'Proyecto';
}

/**
 * Inserta filas en hoja
 */
function insertarFilasEnHoja(hoja, filas) {
  try {
    if (!filas || filas.length === 0) {
      Logger.log('⚠️ No hay filas para insertar');
      return;
    }

    const startRow = hoja.getLastRow() + 1;

    if (startRow + filas.length > hoja.getMaxRows()) {
      const extraRowsNeeded = (startRow + filas.length) - hoja.getMaxRows();
      hoja.insertRowsAfter(hoja.getMaxRows(), extraRowsNeeded);
    }

    const numCols = filas[0].length;
    hoja.getRange(startRow, 1, filas.length, numCols).setValues(filas);

    Logger.log(`✅ ${filas.length} filas insertadas`);

  } catch (error) {
    Logger.log(`❌ Error insertando filas: ${error.toString()}`);
    throw error;
  }
}

/**
 * FUNCIÓN DE EJEMPLO - Procesar 2025-1
 */
function EJEMPLO_procesarPeriodo2025_1() {
  const resultado = procesarPeriodoCompleto("2025-1", 48);
  Logger.log('\n📊 RESULTADO:');
  Logger.log(JSON.stringify(resultado, null, 2));
}

/**
 * FUNCIÓN DE EJEMPLO - Procesar 2024-2
 */
function EJEMPLO_procesarPeriodo2024_2() {
  const resultado = procesarPeriodoCompleto("2024-2", 47);
  Logger.log('\n📊 RESULTADO:');
  Logger.log(JSON.stringify(resultado, null, 2));
}
