/**
 * Parser de HTML para extraer datos del portal Univalle
 * Basado en la lógica de procesarHTML de searchState.gs
 */

import type {
  DatosDocente,
  InformacionPersonal,
  ActividadesDocencia,
  ActividadPregradoPostgrado,
  ActividadTesis,
} from '@/shared/types/docente.types';

// Variable de configuración para habilitar logs detallados
const DEBUG_PARSER = process.env.NODE_ENV === 'development' || process.env.DEBUG_PARSER === 'true';

/**
 * Función de logging condicional
 */
function debugLog(...args: any[]) {
  if (DEBUG_PARSER) {
    console.log('[HTML-PARSER]', ...args);
  }
}

/**
 * Decodifica entidades HTML comunes
 */
function decodeEntities(text: string): string {
  const entities: Record<string, string> = {
    '&aacute;': 'á',
    '&Aacute;': 'Á',
    '&eacute;': 'é',
    '&Eacute;': 'É',
    '&iacute;': 'í',
    '&Iacute;': 'Í',
    '&oacute;': 'ó',
    '&Oacute;': 'Ó',
    '&uacute;': 'ú',
    '&Uacute;': 'Ú',
    '&ntilde;': 'ñ',
    '&Ntilde;': 'Ñ',
    '&amp;': '&',
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-zA-Z]+;/g, (match) => entities[match] || match);
}

/**
 * Remueve acentos de un string
 */
function removeAccents(str: string): string {
  if (!str) return str;
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrae una actividad de investigación de una fila, buscando inteligentemente el nombre del proyecto
 * Similar al enfoque de Puppeteer pero usando el HTML ya parseado
 */
function extraerActividadInvestigacionDeFila(
  cells: string[],
  headers: string[],
  headersOriginales?: string[],
  rowHtml?: string
): Record<string, any> | null {
  const obj: Record<string, any> = {};
  let nombreProyecto = '';
  let aprobadoPor = '';
  let escuelaDpto = '';
  let horasSemestre = '';
  
  // Mapear usando headers si están disponibles
  if (headers.length > 0) {
    headers.forEach((header, ci) => {
      const valor = cells[ci]?.trim() || '';
      const headerUpper = header.toUpperCase().trim();
      
      obj[header] = valor;
      
      // Extraer APROBADO POR
      if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
        aprobadoPor = valor;
        obj['APROBADO POR'] = valor;
      }
      
      // Extraer nombre del proyecto
      if (headerUpper.includes('NOMBRE') && 
          (headerUpper.includes('PROYECTO') || 
           headerUpper.includes('ANTEPROYECTO') || 
           headerUpper.includes('PROPUESTA') ||
           headerUpper.includes('INVESTIGACION'))) {
        if (valor && valor !== '–' && valor !== '-' && !valor.match(/^[\s\-–]+$/)) {
          nombreProyecto = valor;
          obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = valor;
        }
      }
      
      // Extraer Escuela o Dpto
      if (headerUpper.includes('ESCUELA') || 
          headerUpper.includes('DPTO') || 
          headerUpper.includes('DEPARTAMENTO')) {
        escuelaDpto = valor;
        obj['Escuela o Dpto'] = valor;
      }
      
      // Extraer HORAS SEMESTRE
      if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
          headerUpper === 'HORAS SEMESTRE' ||
          (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL'))) {
        horasSemestre = valor;
        obj['HORAS SEMESTRE'] = valor;
      }
    });
  }
  
  // Si no se encontró el nombre del proyecto, buscar en todas las celdas
  if (!nombreProyecto) {
    // Buscar la celda más larga que no sea un header conocido
    let mejorCandidato = { celda: '', indice: -1, longitud: 0 };
    
    for (let ci = 0; ci < cells.length; ci++) {
      const celda = cells[ci]?.trim() || '';
      if (!celda || celda.length < 10) continue;
      
      const celdaUpper = celda.toUpperCase();
      const header = headers[ci] || '';
      const headerUpper = header.toUpperCase();
      
      // Excluir headers conocidos, guiones, números, etc.
      const esHeaderConocido = 
        celdaUpper.includes('ESCUELA') ||
        celdaUpper.includes('DPTO') ||
        celdaUpper.includes('DEPARTAMENTO') ||
        celdaUpper.includes('APROBADO') ||
        headerUpper.includes('HORAS') ||
        headerUpper.includes('APROBADO') ||
        celda === '–' ||
        celda === '-' ||
        celda.match(/^[\s\-–]+$/) ||
        celda.match(/^\d+\.?\d*$/) || // Solo números
        celda.length < 15; // Muy corto
      
      if (!esHeaderConocido && celda.length > mejorCandidato.longitud) {
        mejorCandidato = { celda, indice: ci, longitud: celda.length };
      }
    }
    
    if (mejorCandidato.celda && mejorCandidato.longitud > 15) {
      nombreProyecto = mejorCandidato.celda;
      obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = mejorCandidato.celda;
      debugLog(`     📝 Nombre del proyecto encontrado (búsqueda inteligente): "${mejorCandidato.celda.substring(0, 50)}..."`);
    }
  }
  
  // Si aún no se encontró y tenemos el HTML de la fila, buscar directamente en el HTML
  if (!nombreProyecto && rowHtml) {
    // Extraer texto de todas las celdas td que tengan width (típicamente contienen el nombre del proyecto)
    const celdasConWidth = rowHtml.match(/<td[^>]*width[^>]*>([\s\S]*?)<\/td>/gi);
    if (celdasConWidth) {
      for (const celdaHtml of celdasConWidth) {
        let texto = celdaHtml.replace(/<[^>]+>/g, '');
        texto = decodeEntities(texto);
        texto = texto.trim();
        
        if (texto.length > 20 && 
            !texto.toUpperCase().includes('ESCUELA') &&
            !texto.toUpperCase().includes('DPTO') &&
            !texto.toUpperCase().includes('DEPARTAMENTO') &&
            !texto.match(/^\d+\.?\d*$/)) {
          nombreProyecto = texto;
          obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = texto;
          debugLog(`     📝 Nombre del proyecto encontrado en HTML (celda con width): "${texto.substring(0, 50)}..."`);
          break;
        }
      }
    }
  }
  
  // Buscar horas si no se encontró
  if (!horasSemestre) {
    for (let ci = 0; ci < cells.length; ci++) {
      const celda = cells[ci]?.trim() || '';
      if (celda.match(/^\d+\.?\d*$/)) {
        horasSemestre = celda;
        obj['HORAS SEMESTRE'] = celda;
        break;
      }
    }
  }
  
  // Validar que tenga al menos horas o nombre
  if (!horasSemestre && !nombreProyecto) {
    return null;
  }
  
  return obj;
}

/**
 * Extrae el texto de una celda HTML, manejando divs y fonts anidados
 * Similar a textContent en el navegador
 */
function extraerTextoDeCelda(celdaHtml: string): string {
  // Remover todos los tags HTML y obtener solo el texto
  let texto = celdaHtml.replace(/<[^>]+>/g, '');
  texto = decodeEntities(texto);
  texto = texto.replace(/\s+/g, ' ').trim();
  return texto;
}

/**
 * Extrae celdas de una fila HTML, manejando colspan
 */
function extractCells(rowHtml: string): string[] {
  const cellMatches = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
  if (!cellMatches) return [];

  const cells: string[] = [];
  
  cellMatches.forEach((cellMatch) => {
    // Extraer el atributo colspan si existe
    const colspanMatch = cellMatch.match(/colspan=["']?(\d+)["']?/i);
    const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;
    
    // Extraer el contenido de la celda usando la función especializada
    const cellContent = extraerTextoDeCelda(cellMatch);
    
    // Agregar la celda tantas veces como indique colspan
    for (let i = 0; i < colspan; i++) {
      cells.push(cellContent);
    }
  });

  return cells;
}

/**
 * Normaliza estructura de asignatura (pregrado/postgrado)
 */
function normalizarEstructuraAsignatura(
  obj: Record<string, string>,
  headers: string[]
): ActividadPregradoPostgrado {
  const estructuraNormalizada: ActividadPregradoPostgrado = {
    CODIGO: '',
    GRUPO: '',
    TIPO: '',
    'NOMBRE DE ASIGNATURA': '',
    CRED: '',
    PORC: '',
    FREC: '',
    INTEN: '',
    'HORAS SEMESTRE': '',
  };

  headers.forEach((header) => {
    const headerUpper = header.toUpperCase();
    const valor = obj[header] || '';

    if (headerUpper.includes('CODIGO')) estructuraNormalizada.CODIGO = valor;
    else if (headerUpper.includes('GRUPO')) estructuraNormalizada.GRUPO = valor;
    else if (headerUpper.includes('TIPO')) estructuraNormalizada.TIPO = valor;
    else if (headerUpper.includes('NOMBRE') && headerUpper.includes('ASIGNATURA'))
      estructuraNormalizada['NOMBRE DE ASIGNATURA'] = valor;
    else if (headerUpper.includes('CRED')) estructuraNormalizada.CRED = valor;
    else if (headerUpper.includes('PORC')) estructuraNormalizada.PORC = valor;
    else if (headerUpper.includes('FREC')) estructuraNormalizada.FREC = valor;
    else if (headerUpper.includes('INTEN')) estructuraNormalizada.INTEN = valor;
    else if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
             headerUpper === 'HORAS SEMESTRE' ||
             (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
             headerUpper === 'HORAS')
      estructuraNormalizada['HORAS SEMESTRE'] = valor;
  });

  return estructuraNormalizada;
}

/**
 * Normaliza estructura de dirección de tesis
 */
function normalizarEstructuraTesis(
  obj: Record<string, string>,
  headers: string[]
): ActividadTesis {
  const estructuraNormalizada: ActividadTesis = {
    'CODIGO ESTUDIANTE': '',
    'COD PLAN': '',
    'TITULO DE LA TESIS': '',
    'HORAS SEMESTRE': '',
  };

  headers.forEach((header) => {
    const headerUpper = header.toUpperCase().trim();
    const valor = obj[header] || '';

    // IMPORTANTE: Primero copiar todos los campos al objeto normalizado
    // Esto asegura que campos adicionales como "APROBADO POR" y "NOMBRE DEL ANTEPROYECTO" se guarden
    estructuraNormalizada[header] = valor;

    // Luego normalizar campos específicos
    if (headerUpper.includes('CODIGO') && headerUpper.includes('ESTUDIANTE')) {
      estructuraNormalizada['CODIGO ESTUDIANTE'] = valor;
    } else if (headerUpper.includes('COD') && headerUpper.includes('PLAN')) {
      estructuraNormalizada['COD PLAN'] = valor;
    } else if (headerUpper === 'PLAN' || headerUpper.includes('PLAN')) {
      estructuraNormalizada['COD PLAN'] = valor;
    } else if (headerUpper.includes('TITULO') && headerUpper.includes('TESIS')) {
      estructuraNormalizada['TITULO DE LA TESIS'] = valor;
    } else if (headerUpper === 'TITULO' || headerUpper.includes('TITULO')) {
      estructuraNormalizada['TITULO DE LA TESIS'] = valor;
    } else if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
      estructuraNormalizada['APROBADO POR'] = valor;
    } else if (headerUpper.includes('NOMBRE') && 
               (headerUpper.includes('ANTEPROYECTO') || 
                headerUpper.includes('PROPUESTA') || 
                headerUpper.includes('INVESTIGACION'))) {
      // Normalizar el nombre del anteproyecto o propuesta de investigación
      estructuraNormalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = valor;
      // También guardar como TITULO DE LA TESIS si no hay otro título
      if (!estructuraNormalizada['TITULO DE LA TESIS']) {
        estructuraNormalizada['TITULO DE LA TESIS'] = valor;
      }
    } else if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
               headerUpper === 'HORAS SEMESTRE' ||
               (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
               headerUpper === 'HORAS') {
      estructuraNormalizada['HORAS SEMESTRE'] = valor;
    }
  });

  return estructuraNormalizada;
}

/**
 * Determina si una actividad es de postgrado
 * Mejora la clasificación para evitar mezclas entre pregrado y postgrado
 */
function esActividadPostgrado(actividad: ActividadPregradoPostgrado): boolean {
  if (!actividad) {
    debugLog(`     ⚠️ esActividadPostgrado: actividad es null/undefined`);
    return false;
  }

  const codigo = String(actividad.CODIGO || '').trim();
  const nombre = String(actividad['NOMBRE DE ASIGNATURA'] || '').toUpperCase().trim();
  const tipo = String(actividad.TIPO || '').toUpperCase().trim();
  const grupo = String(actividad.GRUPO || '').toUpperCase().trim();

  debugLog(`     🔍 Evaluando clasificación: codigo="${codigo}", nombre="${nombre}", tipo="${tipo}", grupo="${grupo}"`);

  // Si no hay información suficiente, clasificar como pregrado por defecto
  if (!codigo && !nombre && !tipo && !grupo) {
    debugLog(`     ⚠️ Sin información suficiente, clasificando como PREGRADO por defecto`);
    return false;
  }

  // IMPORTANTE: Priorizar detección de postgrado primero (como en Google Apps Script)
  // Criterio 1: Palabras clave explícitas de postgrado (PRIORIDAD ALTA - verificar primero)
  const keywordsPostgrado = [
    'MAESTRIA',
    'MAESTRÍA',
    'MAGISTER',
    'MASTER',
    'MAESTR',
    'DOCTORADO',
    'DOCTORAL',
    'PHD',
    'DOCTOR',
    'ESPECIALIZA',
    'ESPECIALIZACION',
    'ESPECIALIZACIÓN',
    'POSTGRADO',
    'POSGRADO',
    'POST-GRADO',
    'POST GRADO',
    'POSTGRADUADO',
    'POSGRADUADO',
  ];

  for (const keyword of keywordsPostgrado) {
    if (nombre.includes(keyword) || tipo.includes(keyword) || grupo.includes(keyword)) {
      debugLog(`     🎓 POSTGRADO detectado por keyword "${keyword}" en nombre/tipo/grupo`);
      return true;
    }
  }

  // Criterio 2: Palabras clave explícitas de pregrado (para evitar falsos positivos)
  const keywordsPregrado = [
    'LICENCIATURA',
    'INGENIERIA',
    'INGENERÍA',
    'BACHILLERATO',
    'TECNOLOGIA',
    'TECNOLOGÍA',
    'PROFESIONAL',
    'CARRERA',
    'PREGRADO',
    'PRIMER CICLO',
    'UNDERGRADUATE',
    'TECNICO',
    'TÉCNICO',
  ];

  for (const keyword of keywordsPregrado) {
    if (nombre.includes(keyword) || tipo.includes(keyword) || grupo.includes(keyword)) {
      debugLog(`     🎓 PREGRADO detectado por keyword "${keyword}"`);
      return false;
    }
  }

  // Criterio 3: Códigos de postgrado (PRIORIDAD MEDIA - verificar ANTES de pregrado)
  // IMPORTANTE: Verificar que sea un código numérico válido (puede tener letras al final como "618050C")
  // Limpiar código de letras para análisis
  const codigoLimpio = codigo.replace(/[A-Za-z]/g, '');
  
  if (codigoLimpio && /^\d+$/.test(codigoLimpio)) {
    // IMPORTANTE: Códigos que empiezan con 61 seguido de 7-9 (ej: 618050, 618131, 619180)
    // Estos son códigos de postgrado comunes en Univalle - verificar PRIMERO antes de clasificarlos como pregrado
    if (/^61[7-9]\d{2,}$/.test(codigoLimpio)) {
      debugLog(`🎓 POSTGRADO por código empezando con 61[7-9]: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
      return true;
    }
    
    // Códigos que empiezan con 7, 8, 9
    if (/^[7-9]\d{2,}$/.test(codigoLimpio)) {
      debugLog(`🎓 POSTGRADO por código empezando con 7-9: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
      return true;
    }
    
    // Códigos que empiezan con 0 seguido de 7-9 (ej: 0701, 0801, 0901)
    if (/^0[7-9]\d{2,}$/.test(codigoLimpio)) {
      debugLog(`🎓 POSTGRADO por código 0[7-9]: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
      return true;
    }
    
    // Códigos que empiezan con 62 seguido de 7-9 pueden ser postgrado
    if (/^62[7-9]\d{2,}$/.test(codigoLimpio)) {
      debugLog(`🎓 POSTGRADO por código empezando con 62[7-9]: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
      return true;
    }
    
    // Códigos de 4+ dígitos donde el segundo dígito es 7-9 Y no empieza con 1-6
    // (ej: puede haber códigos como 7701, 8701, 9701 que son postgrado)
    if (codigoLimpio.length >= 4) {
      const primerDigito = codigoLimpio[0];
      const segundoDigito = codigoLimpio[1];
      const tercerDigito = codigoLimpio.length >= 3 ? codigoLimpio[2] : '';
      
      // Códigos que empiezan con 61 y el tercer dígito es 7-9 (redundante con verificación anterior, pero por si acaso)
      if (primerDigito === '6' && segundoDigito === '1' && ['7', '8', '9'].includes(tercerDigito)) {
        debugLog(`🎓 POSTGRADO por código 61[7-9]: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
        return true;
      }
      
      // Códigos que no empiezan con 1-6 y el segundo dígito es 7-9
      if (!['1', '2', '3', '4', '5', '6'].includes(primerDigito) && 
          ['7', '8', '9'].includes(segundoDigito)) {
        debugLog(`🎓 POSTGRADO por código con segundo dígito 7-9: ${codigo} (limpio: ${codigoLimpio}) - ${nombre}`);
        return true;
      }
    }
  }

  // Criterio 4: Códigos de pregrado (PRIORIDAD MEDIA - verificar DESPUÉS de postgrado)
  // IMPORTANTE: Excluir códigos que empiezan con 61[7-9] que ya fueron identificados como postgrado
  if (codigoLimpio && /^\d+$/.test(codigoLimpio)) {
    // Códigos que empiezan con 1-5 son típicamente pregrado
    if (/^[1-5]\d{3,}$/.test(codigoLimpio)) {
      debugLog(`     🎓 PREGRADO detectado por código que empieza con 1-5: ${codigo} (limpio: ${codigoLimpio})`);
      return false;
    }
    
    // Códigos que empiezan con 0 seguido de 1-6 (ej: 0101, 0601)
    if (/^0[1-6]\d{2,}$/.test(codigoLimpio)) {
      debugLog(`     🎓 PREGRADO detectado por código 0[1-6]: ${codigo} (limpio: ${codigoLimpio})`);
      return false;
    }
    
    // Códigos que empiezan con 6: pueden ser pregrado o postgrado
    // Ya verificamos 61[7-9] como postgrado arriba
    // Códigos que empiezan con 60, 62-69 (excepto 61[7-9]) son generalmente pregrado
    if (/^6\d{3,}$/.test(codigoLimpio)) {
      // Si ya pasó las verificaciones de postgrado (61[7-9], 62[7-9]), entonces es pregrado
      // O si es 60, 63-66, 69, o 61[0-6], entonces es pregrado
      const segundoDigito = codigoLimpio.length >= 2 ? codigoLimpio[1] : '';
      if (segundoDigito === '0' || 
          (['3', '4', '5', '6', '9'].includes(segundoDigito)) ||
          (segundoDigito === '1' && codigoLimpio.length >= 3 && !['7', '8', '9'].includes(codigoLimpio[2])) ||
          (segundoDigito === '2' && codigoLimpio.length >= 3 && !['7', '8', '9'].includes(codigoLimpio[2]))) {
        debugLog(`     🎓 PREGRADO detectado por código empezando con 6: ${codigo} (limpio: ${codigoLimpio})`);
        return false;
      }
    }
  }

  // Criterio 5: Si el código empieza con letras que indican postgrado
  if (codigo && /^(M|D|E|P)[A-Z0-9]/.test(codigo.toUpperCase())) {
    // M = Maestría, D = Doctorado, E = Especialización, P = Postgrado
    debugLog(`🎓 POSTGRADO por código con letra: ${codigo} - ${nombre}`);
    return true;
  }
  
  // Criterio 5b: Si el código tiene 4+ dígitos y el segundo dígito es 7-9 (ej: 7701)
  if (codigo && /^\d[7-9]\d{2,}$/.test(codigo)) {
    debugLog(`🎓 POSTGRADO por código con segundo dígito 7-9: ${codigo} - ${nombre}`);
    return true;
  }

  // Criterio 6: Si el código empieza con letras que indican pregrado
  if (codigo && /^(L|I|T|B)[A-Z0-9]/.test(codigo.toUpperCase())) {
    // L = Licenciatura, I = Ingeniería, T = Tecnología, B = Bachillerato
    debugLog(`     🎓 PREGRADO detectado por código con letra inicial: ${codigo}`);
    return false;
  }

  // Criterio 7: Buscar en el código patrones que puedan indicar postgrado
  // Códigos de 4 dígitos donde el primer dígito puede ser 7, 8, 9
  // O códigos que tienen estructura específica de postgrado
  if (codigo && codigo.length >= 3) {
    const primerDigito = codigo[0];
    const segundoDigito = codigo[1];
    
    // Si el código tiene estructura numérica y empieza con 7-9
    if (/^\d+$/.test(codigo)) {
      if (['7', '8', '9'].includes(primerDigito)) {
        debugLog(`     🎓 POSTGRADO detectado por código numérico empezando con ${primerDigito}: ${codigo}`);
        return true;
      }
      
      // Si el segundo dígito es 7-9 (ej: 1701, 2701 podría ser postgrado)
      // PERO esto puede ser muy amplio, así que lo hacemos más restrictivo
      // Solo si el código es de 4+ dígitos y el segundo es 7-9 Y no empieza con 1-6
      if (codigo.length >= 4 && !['1', '2', '3', '4', '5', '6'].includes(primerDigito) && 
          ['7', '8', '9'].includes(segundoDigito)) {
        debugLog(`     🎓 POSTGRADO detectado por código con segundo dígito ${segundoDigito}: ${codigo}`);
        return true;
      }
    }
  }

  // Por defecto, clasificar como pregrado (más común)
  debugLog(`     🎓 Clasificando como PREGRADO por defecto (sin criterios claros de postgrado)`);
  return false;
}

/**
 * Verifica si un texto es un header conocido (no un valor)
 */
function esHeaderConocido(texto: string): boolean {
  const textoUpper = texto.toUpperCase().trim();
  return textoUpper === 'VINCULACION' || 
         textoUpper === 'VINCULACIÓN' ||
         textoUpper === 'CATEGORIA' || 
         textoUpper === 'CATEGORÍA' ||
         textoUpper === 'DEDICACION' || 
         textoUpper === 'DEDICACIÓN' ||
         textoUpper === 'NIVEL ALCANZADO' ||
         (textoUpper === 'NIVEL' && textoUpper.length < 10) ||
         (textoUpper.includes('VINCULACION') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('CATEGORIA') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('DEDICACION') && textoUpper.length < 15 && !textoUpper.includes(' ')) ||
         (textoUpper.includes('NIVEL') && textoUpper.includes('ALCANZADO') && textoUpper.length < 20);
}

/**
 * Extrae información personal desde texto plano con formato CAMPO=valor
 */
function extraerCamposDesdeTextoPlano(html: string, informacionPersonal: InformacionPersonal): void {
  // Normalizar HTML - remover entidades y espacios extra
  const htmlNormalizado = html.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  
  // Buscar patrones como "VINCULACION=nombrado", "CATEGORIA=titular", etc.
  // Buscar también variaciones con espacios y diferentes formatos
  const patrones = [
    { 
      campo: 'VINCULACION', 
      regexes: [
        /VINCULACION\s*[=:]\s*([^\s,<>&"']+)/gi,
        /VINCULACI[OÓ]N\s*[=:]\s*([^\s,<>&"']+)/gi,
        /VINCULACION[^=]*[=:]\s*([^\s,<>&"']+)/gi,
      ]
    },
    { 
      campo: 'CATEGORIA', 
      regexes: [
        /CATEGORIA\s*[=:]\s*([^\s,<>&"']+)/gi,
        /CATEGOR[IÍ]A\s*[=:]\s*([^\s,<>&"']+)/gi,
        /CATEGORIA[^=]*[=:]\s*([^\s,<>&"']+)/gi,
      ]
    },
    { 
      campo: 'DEDICACION', 
      regexes: [
        /DEDICACION\s*[=:]\s*([^\s,<>&"']+)/gi,
        /DEDICACI[OÓ]N\s*[=:]\s*([^\s,<>&"']+)/gi,
        /DEDICACION[^=]*[=:]\s*([^\s,<>&"']+)/gi,
      ]
    },
    { 
      campo: 'NIVEL ALCANZADO', 
      regexes: [
        /NIVEL\s+ALCANZADO\s*[=:]\s*([^\s,<>&"']+)/gi,
        /NIVEL\s*ALCANZADO\s*[=:]\s*([^\s,<>&"']+)/gi,
        /NIVEL\s*ALCANZADO[^=]*[=:]\s*([^\s,<>&"']+)/gi,
      ]
    },
  ];

  for (const { campo, regexes } of patrones) {
    if (!informacionPersonal[campo]) {
      for (const regex of regexes) {
        const match = htmlNormalizado.match(regex);
        if (match && match[0]) {
          const partes = match[0].split(/[=:]/);
          if (partes.length >= 2) {
            const valor = partes.slice(1).join(':').trim();
            if (valor && valor.length > 0 && valor.length < 100 && !valor.includes('<')) {
              informacionPersonal[campo] = decodeEntities(valor);
              debugLog(`   ✓ ${campo} encontrado en texto plano: ${informacionPersonal[campo]}`);
              break;
            }
          }
        }
      }
    }
  }
}

/**
 * Extrae datos personales de la tabla según la estructura HTML real
 * Busca la tabla con estructura: fila 1 (headers), fila 2 (datos), fila 3 (headers), fila 4 (datos)
 */
function extraerDatosPersonalesDeHTML(html: string, informacionPersonal: InformacionPersonal): void {
  debugLog(`\n🔍 Buscando tabla de datos personales...`);
  
  // Buscar todas las tablas que puedan contener datos personales
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return;
  }
  
  // Buscar tabla que tenga la estructura de datos personales
  // Debe tener al menos 4 filas y contener headers como CEDULA, VINCULACION, etc.
  for (const tableHtml of tableMatches) {
    const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rowMatches || rowMatches.length < 4) continue;
    
    // Verificar si la primera fila tiene headers de datos personales
    const primeraFila = rowMatches[0];
    const primeraFilaTexto = extraerTextoDeCelda(primeraFila).toUpperCase();
    
    if (!primeraFilaTexto.includes('CEDULA') && !primeraFilaTexto.includes('APELLIDO')) {
      continue;
    }
    
    debugLog(`   ✅ Tabla de datos personales encontrada con ${rowMatches.length} filas`);
    
    // Extraer datos de la fila 2 (índice 1): CEDULA, APELLIDOS, NOMBRE, UNIDAD
    const fila2Celdas = rowMatches[1].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    if (fila2Celdas && fila2Celdas.length >= 5) {
      const cedula = extraerTextoDeCelda(fila2Celdas[0]);
      const apellido1 = extraerTextoDeCelda(fila2Celdas[1]);
      const apellido2 = extraerTextoDeCelda(fila2Celdas[2]);
      const nombre = extraerTextoDeCelda(fila2Celdas[3]);
      const unidadAcademica = extraerTextoDeCelda(fila2Celdas[4]);
      
      if (cedula) {
        informacionPersonal['CEDULA'] = cedula;
        informacionPersonal['1 APELLIDO'] = apellido1;
        informacionPersonal['2 APELLIDO'] = apellido2;
        informacionPersonal['NOMBRE'] = nombre;
        informacionPersonal['UNIDAD ACADEMICA'] = unidadAcademica;
        
        debugLog(`   ✓ Datos básicos: CEDULA=${cedula}, NOMBRE=${nombre}, APELLIDOS=${apellido1} ${apellido2}`);
      }
    }
    
    // Extraer datos de la fila 4 (índice 3): VINCULACION, CATEGORIA, DEDICACION, NIVEL, CENTRO COSTO
    if (rowMatches.length >= 4) {
      const fila4Celdas = rowMatches[3].match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (fila4Celdas && fila4Celdas.length >= 5) {
        const vinculacion = extraerTextoDeCelda(fila4Celdas[0]);
        const categoria = extraerTextoDeCelda(fila4Celdas[1]);
        const dedicacion = extraerTextoDeCelda(fila4Celdas[2]);
        const nivelAlcanzado = extraerTextoDeCelda(fila4Celdas[3]);
        const centroCosto = extraerTextoDeCelda(fila4Celdas[4]);
        
        if (vinculacion) informacionPersonal['VINCULACION'] = vinculacion;
        if (categoria) informacionPersonal['CATEGORIA'] = categoria;
        if (dedicacion) informacionPersonal['DEDICACION'] = dedicacion;
        if (nivelAlcanzado) informacionPersonal['NIVEL ALCANZADO'] = nivelAlcanzado;
        if (centroCosto) informacionPersonal['CENTRO COSTO'] = centroCosto;
        
        debugLog(`   ✓ Datos laborales: VINCULACION=${vinculacion}, CATEGORIA=${categoria}, DEDICACION=${dedicacion}, NIVEL=${nivelAlcanzado}`);
      }
    }
    
    // Si encontramos esta tabla, no necesitamos buscar más
    return;
  }
  
  debugLog(`   ⚠️ No se encontró tabla de datos personales con la estructura esperada`);
}

/**
 * Extrae actividades intelectuales de tablas anidadas según la estructura HTML real
 * Adaptado del enfoque de Puppeteer pero trabajando con HTML como string
 */
function extraerActividadesIntelectualesDeHTML(html: string): any[] {
  debugLog(`\n🔍 Buscando actividades intelectuales...`);
  
  const actividades: any[] = [];
  
  // Buscar todas las tablas
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return actividades;
  }
  
  // Buscar la tabla que contiene "ACTIVIDADES INTELECTUALES" o "ACTIVIDADES ARTISTICAS"
  // Y verificar que tenga la columna "APROBADO POR"
  let tablaContenedora: string | null = null;
  
  for (let i = 0; i < tableMatches.length; i++) {
    const tablaHtml = tableMatches[i];
    const texto = extraerTextoDeCelda(tablaHtml);
    const textoUpper = texto.toUpperCase();
    
    const tieneTitulo = textoUpper.includes('ACTIVIDADES INTELECTUALES') || 
                        textoUpper.includes('ACTIVIDADES ARTISTICAS') ||
                        textoUpper.includes('ARTÍSTICAS');
    
    if (!tieneTitulo) continue;
    
    // Verificar que tenga la columna "APROBADO POR"
    const tieneColumnas = textoUpper.includes('APROBADO POR');
    
    if (tieneColumnas) {
      tablaContenedora = tablaHtml;
      debugLog(`   ✅ Tabla de intelectuales encontrada (índice ${i + 1})`);
      break;
    }
  }
  
  if (!tablaContenedora) {
    debugLog(`   ❌ No se encontró tabla de ACTIVIDADES INTELECTUALES`);
    return actividades;
  }
  
  // Buscar tabla interna anidada
  let tablaInterna: string | null = null;
  const tablaAnidadaMatch = tablaContenedora.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/i);
  if (tablaAnidadaMatch && tablaAnidadaMatch[1]) {
    tablaInterna = tablaAnidadaMatch[1];
    debugLog(`   ✅ Tabla interna anidada encontrada`);
  } else {
    tablaInterna = tablaContenedora;
    debugLog(`   ℹ️ Usando tabla contenedora como tabla de datos`);
  }
  
  // Extraer filas
  const filas = tablaInterna.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!filas || filas.length < 2) {
    debugLog(`   ⚠️ No se encontraron suficientes filas`);
    return actividades;
  }
  
  // Encontrar fila de encabezados buscando "APROBADO POR"
  let indiceEncabezado = -1;
  for (let i = 0; i < Math.min(10, filas.length); i++) {
    const filaTexto = extraerTextoDeCelda(filas[i]);
    const filaTextoUpper = filaTexto.toUpperCase();
    
    if (filaTextoUpper.includes('APROBADO POR')) {
      indiceEncabezado = i;
      debugLog(`   ✅ Encabezado encontrado en fila ${i + 1}`);
      break;
    }
  }
  
  if (indiceEncabezado === -1) {
    debugLog(`   ❌ No se encontró encabezado con "APROBADO POR"`);
    return actividades;
  }
  
  // Determinar estructura de columnas del encabezado
  const filaEncabezado = filas[indiceEncabezado];
  const celdasEncabezado = filaEncabezado.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
  const nombresColumnas: string[] = [];
  
  if (celdasEncabezado) {
    nombresColumnas.push(...celdasEncabezado.map(c => extraerTextoDeCelda(c).trim()));
    debugLog(`   📋 Columnas detectadas: ${JSON.stringify(nombresColumnas)}`);
  }
  
  // Procesar filas de datos
  const filasConDatos = filas.slice(indiceEncabezado + 1);
  
  for (let idx = 0; idx < filasConDatos.length; idx++) {
    const fila = filasConDatos[idx];
    const celdas = fila.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    
    if (!celdas || celdas.length < 2) continue;
    
    const textos = celdas.map(c => extraerTextoDeCelda(c));
    
    // Mapear dinámicamente según las columnas encontradas
    const dato: Record<string, string> = {};
    
    textos.forEach((texto, idx) => {
      const nombreColumna = nombresColumnas[idx];
      const valor = texto.trim();
      
      if (nombreColumna) {
        // Normalizar nombre de columna para usar como key
        const key = nombreColumna
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[áàäâ]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöô]/g, 'o')
          .replace(/[úùüû]/g, 'u');
        
        dato[key] = valor;
      }
    });
    
    // Asegurar campos mínimos
    const actividad = {
      'APROBADO POR': dato.aprobado_por || dato.aprobadopor || 'No especificado',
      'TITULO': dato.titulo || dato.nombre || '',
      'TIPO': dato.tipo || '',
      'DESCRIPCION': dato.descripcion || dato.observaciones || '',
      ...dato // mantener todos los campos extras
    };
    
    // Filtrar filas completamente vacías
    if (Object.keys(actividad).length <= 1 || (!actividad['TITULO'] && !actividad['TIPO'])) {
      continue;
    }
    
    actividades.push(actividad);
    debugLog(`   ✓ Actividad intelectual extraída: "${actividad['TITULO'].substring(0, 50)}..." (APROBADO POR: ${actividad['APROBADO POR']})`);
  }
  
  debugLog(`   ✅ Total actividades intelectuales extraídas: ${actividades.length}`);
  return actividades;
}

/**
 * Detecta si hay selectores de período en el HTML
 */
function detectarSelectoresPeriodo(html: string): { tieneSelector: boolean; detalles: string } {
  // Buscar <select> que pueda ser selector de período
  const selectMatches = html.match(/<select[^>]*>[\s\S]*?<\/select>/gi);
  if (selectMatches) {
    for (const select of selectMatches) {
      const selectTexto = extraerTextoDeCelda(select);
      const selectUpper = selectTexto.toUpperCase();
      if (selectUpper.includes('PERIODO') || 
          selectUpper.includes('SEMESTRE') ||
          selectUpper.match(/\d{4}[-\s]?\d{1,2}/)) {
        debugLog(`   📅 Selector de período detectado en HTML`);
        return { tieneSelector: true, detalles: 'Select encontrado' };
      }
    }
  }
  
  // Buscar radio buttons de período
  if (html.match(/<input[^>]*type=["']radio["'][^>]*>/gi)) {
    const radioMatches = html.match(/<input[^>]*type=["']radio["'][^>]*>/gi);
    if (radioMatches && radioMatches.length > 0) {
      debugLog(`   📅 Radio buttons detectados (posible selector de período)`);
      return { tieneSelector: true, detalles: 'Radio buttons encontrados' };
    }
  }
  
  return { tieneSelector: false, detalles: 'No se encontraron selectores' };
}

/**
 * Extrae el período asociado a una tabla buscando en el contexto HTML cercano
 */
function extraerPeriodoDeContexto(html: string, tablaHtml: string, tablaIndex: number): string {
  // Buscar el índice de la tabla en el HTML completo
  const tablaPosicion = html.indexOf(tablaHtml);
  if (tablaPosicion === -1) return 'DESCONOCIDO';
  
  // Buscar en un rango de 2000 caracteres antes de la tabla
  const inicioBusqueda = Math.max(0, tablaPosicion - 2000);
  const contextoAnterior = html.substring(inicioBusqueda, tablaPosicion);
  
  // Buscar patrones de período: "2024-1", "2024 - 1", "semestre 1", "periodo 2024", etc.
  const patronesPeriodo = [
    /\d{4}[-\s]?\d{1,2}/g,  // 2024-1, 2024 1, 20241
    /semestre\s*\d+/gi,      // semestre 1, SEMESTRE 2
    /periodo\s*\d{4}/gi,     // periodo 2024
    /\d{4}\s*[-\s]\s*0?([12])/g, // 2024 - 1, 2024-01
  ];
  
  for (const patron of patronesPeriodo) {
    const matches = contextoAnterior.match(patron);
    if (matches && matches.length > 0) {
      // Tomar el último match (más cercano a la tabla)
      const periodo = matches[matches.length - 1].trim();
      debugLog(`     📅 Período detectado cerca de tabla ${tablaIndex + 1}: "${periodo}"`);
      return periodo;
    }
  }
  
  return 'DESCONOCIDO';
}

/**
 * Extrae actividades de investigación de tablas anidadas según la estructura HTML real
 * Adaptado del enfoque de Puppeteer pero trabajando con HTML como string
 * MEJORADO: Busca TODAS las tablas de investigación, no solo la primera
 */
function extraerActividadesInvestigacionDeHTML(html: string, idPeriod?: number): any[] {
  debugLog(`\n🔍 Buscando actividades de investigación${idPeriod ? ` para período ${idPeriod}` : ''}...`);
  
  const actividades: any[] = [];
  
  // Detectar si hay selectores de período en el HTML
  const infoSelectores = detectarSelectoresPeriodo(html);
  if (infoSelectores.tieneSelector) {
    debugLog(`   ℹ️ ${infoSelectores.detalles} - puede haber múltiples períodos`);
  }
  
  // Logging específico para períodos problemáticos
  if (idPeriod) {
    const periodosProblematicos = [/* 2023-2, 2024-1, 2024-2, 2025-1, 2025-2, 2026-1 y adelante */];
    // Nota: Los idPeriod son números, no strings como "2023-2"
    // Pero podemos verificar si es un período reciente
    debugLog(`   📅 Procesando período ID: ${idPeriod}`);
  }
  
  // Buscar todas las tablas
  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches) {
    debugLog(`   ⚠️ No se encontraron tablas`);
    return actividades;
  }
  
  debugLog(`   📊 Total de tablas encontradas: ${tableMatches.length}`);
  
  // Buscar tablas por contenido específico, no por índice
  // Verificar que contenga el título Y las columnas específicas
  const tablasInvestigacion: Array<{ tabla: string; indice: number; periodo: string }> = [];
  
  for (let i = 0; i < tableMatches.length; i++) {
    const tablaHtml = tableMatches[i];
    const texto = extraerTextoDeCelda(tablaHtml);
    const textoUpper = texto.toUpperCase();
    
    // Verificar que contenga el título
    const tieneTitulo = textoUpper.includes('ACTIVIDADES DE INVESTIGACION') || 
                        textoUpper.includes('ACTIVIDADES DE INVESTIGACIÓN');
    
    if (!tieneTitulo) continue;
    
    // Verificar que tenga las columnas específicas
    // Puede tener "CODIGO" o "APROBADO POR", y debe tener "NOMBRE DEL PROYECTO" o "NOMBRE DEL ANTEPROYECTO"
    const tieneColumnasCodigo = textoUpper.includes('CODIGO') && 
                                 (textoUpper.includes('NOMBRE DEL PROYECTO') || 
                                  textoUpper.includes('NOMBRE DEL ANTEPROYECTO')) &&
                                 textoUpper.includes('HORAS SEMESTRE');
    
    // O puede tener "APROBADO POR" en lugar de "CODIGO"
    const tieneColumnasAprobado = textoUpper.includes('APROBADO POR') && 
                                   (textoUpper.includes('NOMBRE DEL PROYECTO') || 
                                    textoUpper.includes('NOMBRE DEL ANTEPROYECTO') ||
                                    textoUpper.includes('ANTEPROYECTO') ||
                                    textoUpper.includes('PROPUESTA DE INVESTIGACION')) &&
                                   textoUpper.includes('HORAS SEMESTRE');
    
    if (tieneColumnasCodigo || tieneColumnasAprobado) {
      const periodo = extraerPeriodoDeContexto(html, tablaHtml, i);
      tablasInvestigacion.push({ tabla: tablaHtml, indice: i, periodo });
      debugLog(`   ✅ Tabla de investigación encontrada (índice ${i + 1}, período: ${periodo})`);
      debugLog(`      📋 Columnas detectadas: ${tieneColumnasCodigo ? 'CODIGO' : 'APROBADO POR'}, NOMBRE DEL PROYECTO/ANTEPROYECTO, HORAS SEMESTRE`);
    }
  }
  
  if (tablasInvestigacion.length === 0) {
    debugLog(`   ❌ No se encontró ninguna tabla de ACTIVIDADES DE INVESTIGACION`);
    return actividades;
  }
  
  debugLog(`   📊 Total de tablas de investigación encontradas: ${tablasInvestigacion.length}`);
  
  // Procesar CADA tabla de investigación encontrada
  for (let tablaIdx = 0; tablaIdx < tablasInvestigacion.length; tablaIdx++) {
    const { tabla: tablaContenedora, indice, periodo } = tablasInvestigacion[tablaIdx];
    debugLog(`\n   🔍 Procesando tabla ${tablaIdx + 1}/${tablasInvestigacion.length} (índice ${indice + 1}, período: ${periodo})...`);
  
    // Buscar tabla interna (puede estar anidada)
    // Estructura: tabla_contenedora > tbody > tr > td > tabla_interna
    let tablaInterna: string | null = null;
    
    // Buscar tabla anidada dentro de tbody > tr > td > table
    const tablaAnidadaMatch = tablaContenedora.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/i);
    if (tablaAnidadaMatch && tablaAnidadaMatch[1]) {
      tablaInterna = tablaAnidadaMatch[1];
      debugLog(`     ✅ Tabla interna anidada encontrada`);
    } else {
      // Si no hay tabla interna, la contenedora ES la tabla de datos
      tablaInterna = tablaContenedora;
      debugLog(`     ℹ️ Usando tabla contenedora como tabla de datos`);
    }
    
    // Extraer filas de la tabla interna
    const filas = tablaInterna.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!filas || filas.length < 2) {
      debugLog(`     ⚠️ No se encontraron suficientes filas en la tabla interna`);
      continue; // Continuar con la siguiente tabla
    }
    
    debugLog(`     📊 Total de filas en tabla interna: ${filas.length}`);
    
    // Encontrar la fila de encabezados buscando por contenido específico
    // Buscar fila que contenga "CODIGO" o "APROBADO POR" Y las otras columnas
    let indiceEncabezado = -1;
    
    for (let i = 0; i < Math.min(10, filas.length); i++) {
      const filaTexto = extraerTextoDeCelda(filas[i]);
      const filaTextoUpper = filaTexto.toUpperCase();
      
      // Verificar si tiene CODIGO (estructura nueva)
      const tieneCodigo = filaTextoUpper.includes('CODIGO');
      const tieneNombreProyecto = filaTextoUpper.includes('NOMBRE DEL PROYECTO') || 
                                  filaTextoUpper.includes('NOMBRE DEL ANTEPROYECTO');
      const tieneHoras = filaTextoUpper.includes('HORAS SEMESTRE');
      
      // Verificar si tiene APROBADO POR (estructura antigua)
      const tieneAprobadoPor = filaTextoUpper.includes('APROBADO POR');
      
      // Si tiene CODIGO + NOMBRE + HORAS, es el encabezado
      if (tieneCodigo && tieneNombreProyecto && tieneHoras) {
        indiceEncabezado = i;
        debugLog(`     ✅ Encabezado encontrado en fila ${i + 1} (con CODIGO)`);
        break;
      }
      
      // Si tiene APROBADO POR + NOMBRE + HORAS, también es encabezado
      if (tieneAprobadoPor && tieneNombreProyecto && tieneHoras) {
        indiceEncabezado = i;
        debugLog(`     ✅ Encabezado encontrado en fila ${i + 1} (con APROBADO POR)`);
        break;
      }
    }
    
    if (indiceEncabezado === -1) {
      debugLog(`     ❌ No se encontró fila de encabezados con las columnas esperadas`);
      debugLog(`     🔍 Revisando primeras 5 filas para debugging:`);
      for (let i = 0; i < Math.min(5, filas.length); i++) {
        const filaTexto = extraerTextoDeCelda(filas[i]);
        debugLog(`        Fila ${i + 1}: "${filaTexto.substring(0, 150)}..."`);
      }
      continue; // Continuar con la siguiente tabla
    }
    
    // Extraer filas de datos (después del encabezado)
    const filasConDatos = filas.slice(indiceEncabezado + 1);
    debugLog(`     📝 Filas con datos: ${filasConDatos.length}`);
    
    // Extraer nombres de columnas del encabezado para mapeo dinámico
    const filaEncabezado = filas[indiceEncabezado];
    const celdasEncabezado = filaEncabezado.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
    const nombresColumnas: string[] = [];
    
    if (celdasEncabezado) {
      nombresColumnas.push(...celdasEncabezado.map(c => extraerTextoDeCelda(c).trim()));
      debugLog(`     📋 Columnas detectadas: ${JSON.stringify(nombresColumnas)}`);
    }
    
    // Procesar cada fila de datos
    let actividadesEnEstaTabla = 0;
    for (let idx = 0; idx < filasConDatos.length; idx++) {
      const fila = filasConDatos[idx];
      const celdas = fila.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      
      if (!celdas || celdas.length < 2) {
        debugLog(`       ⚠️ Fila ${idx + 1}: menos de 2 celdas, omitiendo`);
        continue;
      }
      
      debugLog(`       🔍 Fila ${idx + 1}: ${celdas.length} celdas`);
      
      // Extraer texto de cada celda
      const textos = celdas.map(c => extraerTextoDeCelda(c));
      
      // Mapear dinámicamente según las columnas encontradas
      const actividad: Record<string, any> = {
        'PERIODO': periodo,
      };
      
      // Mapear cada celda a su columna correspondiente
      textos.forEach((texto, idx) => {
        const nombreColumna = nombresColumnas[idx] || '';
        if (nombreColumna) {
          // Normalizar nombre de columna
          const nombreNormalizado = nombreColumna.toUpperCase().trim();
          
          // Mapear a campos estándar
          if (nombreNormalizado.includes('CODIGO')) {
            actividad['CODIGO'] = texto.trim();
          } else if (nombreNormalizado.includes('APROBADO') && nombreNormalizado.includes('POR')) {
            actividad['APROBADO POR'] = texto.trim();
          } else if (nombreNormalizado.includes('NOMBRE') && 
                     (nombreNormalizado.includes('PROYECTO') || 
                      nombreNormalizado.includes('ANTEPROYECTO') ||
                      nombreNormalizado.includes('PROPUESTA'))) {
            actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = texto.trim();
          } else if (nombreNormalizado.includes('HORAS') && nombreNormalizado.includes('SEMESTRE')) {
            actividad['HORAS SEMESTRE'] = texto.trim();
          }
          
          // También guardar con el nombre original de la columna
          actividad[nombreColumna] = texto.trim();
        }
      });
      
      // Manejar casos especiales con colspan
      // Si hay 3 celdas y la primera tiene colspan, puede ser [colspan=2] [nombre] [horas]
      if (celdas.length === 3 && !actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
        // Verificar si la primera celda tiene colspan
        const primeraCelda = celdas[0];
        const tieneColspan = primeraCelda.match(/colspan/i);
        
        if (tieneColspan) {
          // Estructura: [colspan=2] [nombre] [horas]
          actividad['APROBADO POR'] = textos[0]?.trim() || '';
          actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || '';
          actividad['HORAS SEMESTRE'] = textos[2]?.trim() || '';
        } else {
          // Estructura estándar: [codigo/aprobado] [nombre] [horas]
          if (!actividad['CODIGO'] && !actividad['APROBADO POR']) {
            actividad['CODIGO'] = textos[0]?.trim() || '';
          }
          if (!actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
            actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || '';
          }
          if (!actividad['HORAS SEMESTRE']) {
            actividad['HORAS SEMESTRE'] = textos[2]?.trim() || '';
          }
        }
      }
      
      // Si hay 4 celdas, puede ser [col1] [col2] [nombre] [horas] o [codigo/aprobado] [nombre] [horas] [extra]
      if (celdas.length === 4 && !actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
        const primeraCelda = celdas[0];
        const tieneColspan = primeraCelda.match(/colspan/i);
        
        if (tieneColspan) {
          // [colspan=2] [nombre] [horas] [extra]
          actividad['APROBADO POR'] = `${textos[0]?.trim() || ''} ${textos[1]?.trim() || ''}`.trim();
          actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[2]?.trim() || '';
          actividad['HORAS SEMESTRE'] = textos[3]?.trim() || '';
        } else {
          // [codigo/aprobado] [nombre] [horas] [extra]
          if (!actividad['CODIGO'] && !actividad['APROBADO POR']) {
            actividad['CODIGO'] = textos[0]?.trim() || '';
          }
          if (!actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION']) {
            actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] = textos[1]?.trim() || textos[2]?.trim() || '';
          }
          if (!actividad['HORAS SEMESTRE']) {
            actividad['HORAS SEMESTRE'] = textos[2]?.trim() || textos[3]?.trim() || '';
          }
        }
      }
      
      const nombreProyecto = actividad['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || '';
      const horasSemestre = actividad['HORAS SEMESTRE'] || '';
      const codigo = actividad['CODIGO'] || '';
      const aprobadoPor = actividad['APROBADO POR'] || '';
      
      debugLog(`         -> codigo: "${codigo}", aprobadoPor: "${aprobadoPor}", proyecto: "${nombreProyecto?.substring(0, 50)}...", horas: "${horasSemestre}"`);
      
      // Filtrar filas que tienen al menos proyecto o horas
      const tieneContenido = nombreProyecto || horasSemestre;
      if (!tieneContenido) {
        debugLog(`         ⚠️ Fila filtrada (vacía)`);
        continue;
      }
      
      actividades.push(actividad);
      actividadesEnEstaTabla++;
    }
    
    debugLog(`     ✅ Actividades extraídas de esta tabla: ${actividadesEnEstaTabla}`);
  }
  
  debugLog(`\n   ✅ Total actividades extraídas de todas las tablas: ${actividades.length}`);
  
  // Logging adicional para debugging de períodos recientes
  if (actividades.length === 0) {
    debugLog(`\n   ⚠️ ADVERTENCIA: No se encontraron actividades de investigación`);
    debugLog(`   🔍 Información de debugging:`);
    debugLog(`      - Total tablas en HTML: ${tableMatches.length}`);
    debugLog(`      - Tablas de investigación encontradas: ${tablasInvestigacion.length}`);
    
    // Buscar cualquier mención de "investigación" en el HTML
    const mencionesInvestigacion = (html.match(/investigacion/gi) || []).length;
    debugLog(`      - Menciones de "investigación" en HTML: ${mencionesInvestigacion}`);
    
    // Buscar menciones de "APROBADO POR"
    const mencionesAprobado = (html.match(/aprobado por/gi) || []).length;
    debugLog(`      - Menciones de "APROBADO POR" en HTML: ${mencionesAprobado}`);
    
    // Buscar menciones de "ANTEPROYECTO"
    const mencionesAnteproyecto = (html.match(/anteproyecto/gi) || []).length;
    debugLog(`      - Menciones de "ANTEPROYECTO" en HTML: ${mencionesAnteproyecto}`);
    
    if (mencionesInvestigacion > 0 || mencionesAprobado > 0 || mencionesAnteproyecto > 0) {
      debugLog(`      ⚠️ Hay menciones de investigación en el HTML pero no se encontraron tablas válidas`);
      debugLog(`      💡 Posibles causas:`);
      debugLog(`         - La estructura HTML cambió para períodos recientes`);
      debugLog(`         - Las tablas están en una ubicación diferente`);
      debugLog(`         - Las tablas tienen un formato diferente`);
    }
  }
  
  return actividades;
}

/**
 * Procesa el HTML extraído y devuelve datos estructurados
 */
export function procesarHTML(html: string, idPeriod: number): DatosDocente[] {
  debugLog(`=== INICIANDO PROCESAMIENTO HTML PARA PERIODO ${idPeriod} ===`);

  const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches || tableMatches.length === 0) {
    debugLog('❌ No se encontraron tablas en el HTML');
    return [];
  }

  debugLog(`✅ Encontradas ${tableMatches.length} tablas en total`);

  const informacionPersonal: InformacionPersonal = {};
  
  // IMPORTANTE: Primero extraer datos personales usando la estructura HTML real
  extraerDatosPersonalesDeHTML(html, informacionPersonal);
  
  // IMPORTANTE: También buscar campos en texto plano como fallback (formato CAMPO=valor)
  extraerCamposDesdeTextoPlano(html, informacionPersonal);
  
  const actividadesDocencia: ActividadesDocencia = {
    pregrado: [],
    postgrado: [],
    direccionTesis: [],
  };
  
  // IMPORTANTE: Primero extraer actividades de investigación usando la estructura HTML real
  const actividadesInvestigacion = extraerActividadesInvestigacionDeHTML(html, idPeriod);
  
  // IMPORTANTE: Primero extraer actividades intelectuales usando la estructura HTML real
  const actividadesIntelectualesOArtisticas = extraerActividadesIntelectualesDeHTML(html);
  
  const actividadesExtension: any[] = [];
  const actividadesAdministrativas: any[] = [];
  const actividadesComplementarias: any[] = [];
  const docenteEnComision: any[] = [];

  let contadorTablas = 0;

  tableMatches.forEach((tableHtml) => {
    contadorTablas++;
    debugLog(`\n=== PROCESANDO TABLA ${contadorTablas}/${tableMatches.length} ===`);

    const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rowMatches || rowMatches.length < 1) {
      debugLog(`⚠️ Tabla ${contadorTablas} no tiene filas, omitiendo`);
      return;
    }

    // IMPORTANTE: Buscar headers en todas las filas, priorizando filas con fondo (bgcolor) que típicamente son headers
    let headers: string[] = [];
    let headerRowIndex = 0;
    
    // Primero, buscar una fila con bgcolor (típicamente headers)
    for (let i = 0; i < Math.min(5, rowMatches.length); i++) {
      const row = rowMatches[i];
      if (row.match(/bgcolor/i) || row.match(/background/i)) {
        const potentialHeaders = extractCells(row);
        // Verificar que tenga headers válidos (no vacíos y con contenido significativo)
        if (potentialHeaders.length > 0 && potentialHeaders.some(h => h.trim().length > 2)) {
          headers = potentialHeaders;
          headerRowIndex = i;
          debugLog(`📋 Headers encontrados en fila ${i} (con fondo):`, headers);
          break;
        }
      }
    }
    
    // Si no se encontró fila con fondo, buscar en las primeras filas por contenido que parezca headers
    if (headers.length === 0) {
      for (let i = 0; i < Math.min(3, rowMatches.length); i++) {
        const potentialHeaders = extractCells(rowMatches[i]);
        const headersNorm = potentialHeaders.map((h) => h.toUpperCase().trim());
        
        // Verificar si contiene palabras clave de headers comunes
        const tieneHeadersComunes = headersNorm.some(h => 
          h.includes('APROBADO') || 
          h.includes('NOMBRE') || 
          h.includes('PROYECTO') || 
          h.includes('HORAS') ||
          h.includes('CODIGO') ||
          h.includes('ANTEPROYECTO') ||
          h.includes('PROPUESTA') ||
          h.includes('INVESTIGACION')
        );
        
        if (tieneHeadersComunes && potentialHeaders.length > 0) {
          headers = potentialHeaders;
          headerRowIndex = i;
          debugLog(`📋 Headers encontrados en fila ${i} (por palabras clave):`, headers);
          break;
        }
      }
    }
    
    // Si aún no se encontró, usar la primera fila como fallback
    if (headers.length === 0) {
      headers = extractCells(rowMatches[0]);
      headerRowIndex = 0;
      debugLog(`📋 Headers encontrados en primera fila (fallback):`, headers);
    }
    
    // Normalizar headers (sin remover acentos para preservar nombres originales)
    const headersNorm = headers.map((h) => h.toUpperCase().trim());

    debugLog(`📋 Headers encontrados:`, headers);
    debugLog(`📋 Headers normalizados:`, headersNorm);

    // ESTRATEGIA 1: Tabla de información personal completa (puede incluir CEDULA, APELLIDOS y campos adicionales)
    const tieneCedula = headersNorm.some((h) =>
      h.includes('CEDULA') ||
      h.includes('DOCUMENTO') ||
      h === 'DOCENTES' ||
      h.includes('IDENTIFICACION')
    );
    const tieneApellido = headersNorm.some((h) =>
      h.includes('APELLIDO') ||
      h.includes('APELLIDOS') ||
      h.includes('NOMBRE')
    );

    if (tieneCedula && tieneApellido) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como INFORMACIÓN PERSONAL (con cédula y apellidos)`);

      if (rowMatches.length >= 2) {
        const values = extractCells(rowMatches[1]);
        debugLog(`📊 Headers completos:`, headers);
        debugLog(`📊 Valores encontrados (fila 1):`, values);
        debugLog(`📊 Mapeo header->valor:`);
        headers.forEach((h, idx) => {
          debugLog(`   "${h}" = "${values[idx] || ''}"`);
        });

        headers.forEach((header, i) => {
          const valor = values[i] || '';
          const headerNorm = header.toUpperCase().trim().replace(/\s+/g, ' ');

          // Cédula
          if (headerNorm.includes('CEDULA') || headerNorm === 'DOCENTES' || headerNorm.includes('DOCUMENTO')) {
            informacionPersonal['CEDULA'] = valor;
            debugLog(`   ✓ CEDULA = ${valor}`);
          }

          // Apellidos
          if (headerNorm.includes('1 APELLIDO') || headerNorm === 'APELLIDO1' || headerNorm.includes('PRIMER APELLIDO')) {
            informacionPersonal['1 APELLIDO'] = valor;
            debugLog(`   ✓ 1 APELLIDO = ${valor}`);
          }
          if (headerNorm.includes('2 APELLIDO') || headerNorm === 'APELLIDO2' || headerNorm.includes('SEGUNDO APELLIDO')) {
            informacionPersonal['2 APELLIDO'] = valor;
            debugLog(`   ✓ 2 APELLIDO = ${valor}`);
          }

          // Nombre
          if (headerNorm === 'NOMBRE' || (headerNorm.includes('NOMBRES') && !headerNorm.includes('COMPLETO'))) {
            informacionPersonal['NOMBRE'] = valor;
            debugLog(`   ✓ NOMBRE = ${valor}`);
          }

          // Unidad Académica
          if (headerNorm.includes('UNIDAD') && headerNorm.includes('ACADEMICA')) {
            informacionPersonal['UNIDAD ACADEMICA'] = valor;
            debugLog(`   ✓ UNIDAD ACADEMICA = ${valor}`);
          }

          // IMPORTANTE: Buscar VINCULACION, CATEGORIA, DEDICACION y NIVEL ALCANZADO
          // Hacer búsqueda más flexible - buscar si el header contiene estas palabras clave
          // Buscar VINCULACION
          if ((headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN')) && valor && valor.trim()) {
            const valorLimpio = valor.trim();
            // No descartar si el valor es corto y parece válido (no es otro header)
            if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
              informacionPersonal['VINCULACION'] = valorLimpio;
              debugLog(`   ✓ VINCULACION = ${valorLimpio} (header: ${header})`);
            }
          }
          
          // Buscar CATEGORIA
          if ((headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA')) && valor && valor.trim()) {
            const valorLimpio = valor.trim();
            if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
              informacionPersonal['CATEGORIA'] = valorLimpio;
              debugLog(`   ✓ CATEGORIA = ${valorLimpio} (header: ${header})`);
            }
          }
          
          // Buscar DEDICACION
          if ((headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN')) && valor && valor.trim()) {
            const valorLimpio = valor.trim();
            if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
              informacionPersonal['DEDICACION'] = valorLimpio;
              debugLog(`   ✓ DEDICACION = ${valorLimpio} (header: ${header})`);
            }
          }
          
          // Buscar NIVEL ALCANZADO
          if ((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) || 
              headerNorm === 'NIVEL ALCANZADO' ||
              (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA') && !headerNorm.includes('ACADEMICO'))) {
            if (valor && valor.trim()) {
              const valorLimpio = valor.trim();
              if (valorLimpio.length > 0 && valorLimpio.length < 50 && valorLimpio !== headerNorm) {
                informacionPersonal['NIVEL ALCANZADO'] = valorLimpio;
                debugLog(`   ✓ NIVEL ALCANZADO = ${valorLimpio} (header: ${header})`);
              }
            }
          }

          // IMPORTANTE: Guardar TODOS los headers y valores para búsqueda posterior
          // Esto permite buscar campos que no se detectaron en la primera pasada
          informacionPersonal[header] = valor;
          // También guardar con header normalizado para búsqueda flexible
          informacionPersonal[headerNorm] = valor;
        });
      }

      // Continuar procesando otras tablas en caso de que los campos vengan en tablas separadas
      debugLog(`🔄 Continuando procesamiento de otras tablas...`);
    }

    // ESTRATEGIA 2: Tabla separada con VINCULACION, CATEGORIA, DEDICACION, NIVEL ALCANZADO
    // Esta tabla NO tiene cédula ni apellidos, pero tiene estos campos específicos
    const tieneVinculacion = headersNorm.some((h) => h.includes('VINCULACION') || h.includes('VINCULACIÓN'));
    const tieneCategoria = headersNorm.some((h) => h.includes('CATEGORIA') || h.includes('CATEGORÍA'));
    const tieneDedicacion = headersNorm.some((h) => h.includes('DEDICACION') || h.includes('DEDICACIÓN'));
    const tieneNivel = headersNorm.some((h) =>
      (h.includes('NIVEL') && h.includes('ALCANZADO')) ||
      h === 'NIVEL' ||
      (h.includes('NIVEL') && !h.includes('ASIGNATURA'))
    );

    // Si tiene alguno de estos campos y NO tiene cédula, es probablemente la tabla de información adicional
    if ((tieneVinculacion || tieneCategoria || tieneDedicacion || tieneNivel) && !tieneCedula) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como INFORMACIÓN ADICIONAL (campos laborales sin cédula)`);
      debugLog(`   Campos detectados: VINC=${tieneVinculacion}, CAT=${tieneCategoria}, DED=${tieneDedicacion}, NIV=${tieneNivel}`);

      // Procesar esta tabla - puede tener formato de headers o filas con etiqueta:valor
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        const cells = extractCells(row);

        if (cells.length === 0 || cells.every(c => !c || c.trim() === '')) continue;

        debugLog(`   Fila ${ri}: ${cells.length} celdas`);

        // Si hay headers y las celdas coinciden, mapear directamente
        // IMPORTANTE: Los headers están en rowMatches[0], los valores en rowMatches[ri]
        if (headers.length > 0 && cells.length >= headers.length) {
          headers.forEach((header, i) => {
            const valor = cells[i] || '';
            if (!valor || valor.trim() === '') return;

            // Validar que el valor NO sea otro header conocido
            if (esHeaderConocido(valor)) {
              debugLog(`     ⚠️ Valor "${valor}" es un header, omitiendo`);
              return; // Saltar si es un header, no un valor
            }

            const headerNorm = header.toUpperCase().trim();

            if (headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN')) {
              informacionPersonal['VINCULACION'] = valor.trim();
              debugLog(`     ✓ VINCULACION = ${valor.trim()}`);
            }
            if (headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA')) {
              informacionPersonal['CATEGORIA'] = valor.trim();
              debugLog(`     ✓ CATEGORIA = ${valor.trim()}`);
            }
            if (headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN')) {
              informacionPersonal['DEDICACION'] = valor.trim();
              debugLog(`     ✓ DEDICACION = ${valor.trim()}`);
            }
            if ((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) ||
                (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA'))) {
              informacionPersonal['NIVEL ALCANZADO'] = valor.trim();
              debugLog(`     ✓ NIVEL ALCANZADO = ${valor.trim()}`);
            }
          });
        } else if (cells.length >= 2) {
          // Formato etiqueta:valor (primera celda es el campo, segunda es el valor)
          // O formato vertical donde cada fila tiene un campo y su valor
          const campo = cells[0]?.toUpperCase().trim() || '';
          const valor = cells[1]?.trim() || '';

          if (!campo || !valor) continue;

          debugLog(`     Procesando etiqueta:valor -> "${campo}" : "${valor}"`);

          // Validar que el valor NO sea otro header conocido
          if (esHeaderConocido(valor)) {
            debugLog(`     ⚠️ Valor "${valor}" es un header, omitiendo`);
            continue; // Saltar si el "valor" es en realidad otro header
          }

          if (campo.includes('VINCULACION') || campo.includes('VINCULACIÓN')) {
            informacionPersonal['VINCULACION'] = valor;
            debugLog(`     ✓ VINCULACION = ${valor}`);
          }
          if (campo.includes('CATEGORIA') || campo.includes('CATEGORÍA')) {
            informacionPersonal['CATEGORIA'] = valor;
            debugLog(`     ✓ CATEGORIA = ${valor}`);
          }
          if (campo.includes('DEDICACION') || campo.includes('DEDICACIÓN')) {
            informacionPersonal['DEDICACION'] = valor;
            debugLog(`     ✓ DEDICACION = ${valor}`);
          }
          if ((campo.includes('NIVEL') && campo.includes('ALCANZADO')) ||
              (campo === 'NIVEL' && !campo.includes('ASIGNATURA'))) {
            informacionPersonal['NIVEL ALCANZADO'] = valor;
            debugLog(`     ✓ NIVEL ALCANZADO = ${valor}`);
          }
        }
      }

      // Continuar procesando otras tablas en lugar de hacer return
      debugLog(`🔄 Continuando con otras tablas...`);
    }
    
    // Buscar en TODAS las filas de TODAS las tablas estos campos específicos
    // Esto es importante porque pueden estar en una tabla anidada o en filas sin headers
    // Mejorar: buscar más agresivamente en todas las tablas
    if (rowMatches.length > 1) {
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        const cells = extractCells(row);
        
        if (cells.length < 2) continue;
        
        // ESTRATEGIA A: Si los headers contienen estos campos, mapear directamente
        if (headers.length > 0 && cells.length >= headers.length) {
          headers.forEach((header, idx) => {
            const headerNorm = header.toUpperCase().trim();
            const valor = cells[idx]?.trim() || '';
            
            if (!valor || esHeaderConocido(valor)) return;
            
            // VINCULACION
            if ((headerNorm.includes('VINCULACION') || headerNorm.includes('VINCULACIÓN') ||
                 headerNorm === 'VINCULACION' || headerNorm === 'VINCULACIÓN') && 
                !informacionPersonal['VINCULACION']) {
              informacionPersonal['VINCULACION'] = valor;
              debugLog(`   ✓ VINCULACION encontrado en header: ${valor}`);
            }
            // CATEGORIA
            if ((headerNorm.includes('CATEGORIA') || headerNorm.includes('CATEGORÍA') ||
                 headerNorm === 'CATEGORIA' || headerNorm === 'CATEGORÍA') && 
                !informacionPersonal['CATEGORIA']) {
              informacionPersonal['CATEGORIA'] = valor;
              debugLog(`   ✓ CATEGORIA encontrado en header: ${valor}`);
            }
            // DEDICACION
            if ((headerNorm.includes('DEDICACION') || headerNorm.includes('DEDICACIÓN') ||
                 headerNorm === 'DEDICACION' || headerNorm === 'DEDICACIÓN') && 
                !informacionPersonal['DEDICACION']) {
              informacionPersonal['DEDICACION'] = valor;
              debugLog(`   ✓ DEDICACION encontrado en header: ${valor}`);
            }
            // NIVEL ALCANZADO
            if (((headerNorm.includes('NIVEL') && headerNorm.includes('ALCANZADO')) ||
                 headerNorm === 'NIVEL ALCANZADO' ||
                 (headerNorm === 'NIVEL' && !headerNorm.includes('ASIGNATURA') && !headerNorm.includes('ACADEMICO'))) && 
                !informacionPersonal['NIVEL ALCANZADO']) {
              informacionPersonal['NIVEL ALCANZADO'] = valor;
              debugLog(`   ✓ NIVEL ALCANZADO encontrado en header: ${valor}`);
            }
          });
        }
        
        // ESTRATEGIA B: Buscar patrones donde una celda tiene el nombre del campo y otra tiene el valor
        // Probar diferentes combinaciones de celdas (formato etiqueta:valor)
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i]?.toUpperCase().trim() || '';
          if (!cell || esHeaderConocido(cell)) continue;
          
          // Buscar VINCULACION
          if ((cell.includes('VINCULACION') || cell.includes('VINCULACIÓN')) && 
              !informacionPersonal['VINCULACION']) {
            // El valor podría estar en la siguiente celda
            if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
              informacionPersonal['VINCULACION'] = cells[i + 1].trim();
              debugLog(`   ✓ VINCULACION encontrado en formato etiqueta:valor: ${cells[i + 1].trim()}`);
            }
          }
          
          // Buscar CATEGORIA
          if ((cell.includes('CATEGORIA') || cell.includes('CATEGORÍA')) && 
              !informacionPersonal['CATEGORIA']) {
            if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
              informacionPersonal['CATEGORIA'] = cells[i + 1].trim();
              debugLog(`   ✓ CATEGORIA encontrado en formato etiqueta:valor: ${cells[i + 1].trim()}`);
            }
          }
          
          // Buscar DEDICACION
          if ((cell.includes('DEDICACION') || cell.includes('DEDICACIÓN')) && 
              !informacionPersonal['DEDICACION']) {
            if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
              informacionPersonal['DEDICACION'] = cells[i + 1].trim();
              debugLog(`   ✓ DEDICACION encontrado en formato etiqueta:valor: ${cells[i + 1].trim()}`);
            }
          }
          
          // Buscar NIVEL ALCANZADO
          if (((cell.includes('NIVEL') && cell.includes('ALCANZADO')) ||
               (cell === 'NIVEL' && !cell.includes('ASIGNATURA') && !cell.includes('ACADEMICO'))) && 
              !informacionPersonal['NIVEL ALCANZADO']) {
            if (i + 1 < cells.length && cells[i + 1] && cells[i + 1].trim() && !esHeaderConocido(cells[i + 1])) {
              informacionPersonal['NIVEL ALCANZADO'] = cells[i + 1].trim();
              debugLog(`   ✓ NIVEL ALCANZADO encontrado en formato etiqueta:valor: ${cells[i + 1].trim()}`);
            }
          }
        }
      }
    }

    // IMPORTANTE: Primero verificar si es tabla de tesis para evitar clasificar tesis como asignaturas
    // Tabla de dirección de tesis - verificar ANTES de asignaturas
    // IMPORTANTE: Excluir tablas que son claramente de investigación (ANTEPROYECTO, PROPUESTA DE INVESTIGACION)
    let esTablaTesis = false;
    
    // EXCLUSIÓN: Si tiene indicadores de investigación pero NO tiene indicadores de tesis, NO es tesis
    const tieneAnteproyectoHeader = headersNorm.some((h) => 
      h.includes('ANTEPROYECTO') || 
      h.includes('ANTE PROYECTO') ||
      h.includes('ANTE-PROYECTO')
    );
    const tienePropuestaInvestigacionHeader = headersNorm.some((h) =>
      (h.includes('PROPUESTA') && h.includes('INVESTIGACION')) ||
      h.includes('PROPUESTA DE INVESTIGACION')
    );
    const tieneIndicadoresInvestigacion = tieneAnteproyectoHeader || tienePropuestaInvestigacionHeader;
    
    const tieneIndicadoresTesis = 
      headersNorm.some((h) => h.includes('CODIGO') && h.includes('ESTUDIANTE')) ||
      headersNorm.some((h) => h.includes('ESTUDIANTE')) ||
      headersNorm.some((h) => h.includes('PLAN')) ||
      headersNorm.some((h) => h.includes('TITULO') && h.includes('TESIS')) ||
      (headersNorm.some((h) => h.includes('DIRECCION')) && headersNorm.some((h) => h.includes('TESIS')));
    
    // Si tiene indicadores de investigación PERO NO tiene indicadores de tesis, NO es tesis
    if (tieneIndicadoresInvestigacion && !tieneIndicadoresTesis) {
      debugLog(`   ⚠️ Tabla ${contadorTablas} tiene indicadores de investigación, excluyendo de detección de tesis`);
    } else {
      // Criterio 1: Tiene CODIGO ESTUDIANTE y algún campo relacionado con tesis
      if (headersNorm.some((h) => h.includes('CODIGO') && h.includes('ESTUDIANTE')) ||
          headersNorm.some((h) => h === 'CODIGO ESTUDIANTE' || h === 'COD ESTUDIANTE')) {
        esTablaTesis = true;
      }

      // Criterio 2: Tiene campos específicos de tesis (PLAN, TITULO, ESTUDIANTE)
      if (!esTablaTesis) {
        const tieneCodigoEst = headersNorm.some((h) => h.includes('ESTUDIANTE'));
        const tienePlan = headersNorm.some((h) => h.includes('PLAN') || h === 'COD PLAN');
        const tieneTitulo = headersNorm.some((h) => h.includes('TITULO') || h.includes('TESIS'));

        if (tieneCodigoEst && (tienePlan || tieneTitulo)) {
          esTablaTesis = true;
        }
      }

      // Criterio 3: Tiene "DIRECCION" y "TESIS" en algún header
      if (!esTablaTesis) {
        const tieneDireccion = headersNorm.some((h) => h.includes('DIRECCION') || h.includes('DIRECCIÓN'));
        const tieneTesis = headersNorm.some((h) => h.includes('TESIS'));

        if (tieneDireccion && tieneTesis) {
          esTablaTesis = true;
        }
      }
    }
    
    // NOTA: NO usar "APROBADO POR" + "ANTEPROYECTO" como criterio de tesis
    // Esas tablas son actividades de INVESTIGACION, no tesis
    // Las tablas de tesis deben tener CODIGO ESTUDIANTE, PLAN, TITULO/TESIS, o DIRECCION + TESIS
    
    // Tabla de asignaturas (pregrado/postgrado)
    // Detección mejorada: debe tener CODIGO y NOMBRE DE ASIGNATURA, pero NO ser tabla de tesis
    // También puede tener "TIPO" que es común en tablas de asignaturas
    const tieneCodigoAsignatura = headersNorm.some((h) => h === 'CODIGO' || (h.includes('CODIGO') && !h.includes('ESTUDIANTE')));
    const tieneNombreAsignatura = headersNorm.some((h) => h.includes('NOMBRE') && h.includes('ASIGNATURA'));
    const tieneTipoAsignatura = headersNorm.some((h) => h === 'TIPO' || h.includes('TIPO'));
    const tieneGrupo = headersNorm.some((h) => h === 'GRUPO' || h.includes('GRUPO'));
    const tieneHoras = headersNorm.some((h) => h.includes('HORAS') || h.includes('SEMESTRE'));
    const noEsTablaTesis = !esTablaTesis && !headersNorm.some((h) => h.includes('ESTUDIANTE')) &&
                           !headersNorm.some((h) => h.includes('TESIS'));

    // Tabla de asignaturas: debe tener código Y (nombre de asignatura O tipo O grupo)
    // Además debe tener horas para ser una tabla de actividades válida
    // Esto es más flexible para capturar tablas de postgrado que pueden tener estructura ligeramente diferente
    const esTablaAsignaturas = tieneCodigoAsignatura && 
                               (tieneNombreAsignatura || tieneTipoAsignatura || tieneGrupo) && 
                               noEsTablaTesis &&
                               tieneHoras; // Asegurar que tenga horas para ser una tabla de actividades válida
    
    if (esTablaAsignaturas) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ASIGNATURAS (pregrado/postgrado)`);
      debugLog(`   Headers: ${headers.join(', ')}`);
      debugLog(`   Criterios: tieneCodigo=${tieneCodigoAsignatura}, tieneNombre=${tieneNombreAsignatura}, tieneTipo=${tieneTipoAsignatura}, tieneGrupo=${tieneGrupo}, tieneHoras=${tieneHoras}, noEsTesis=${noEsTablaTesis}`);
    }

    if (esTablaAsignaturas) {
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        const cells = extractCells(row);

        // Saltar filas vacías o que sean solo separadores
        if (cells.every((c) => c === '' || c.trim() === '')) continue;

        // Validar que la fila tenga al menos código o nombre
        const tieneCodigo = cells.some((c, idx) => {
          const header = headers[idx] || '';
          return header.toUpperCase().includes('CODIGO') && c && c.trim() !== '';
        });
        const tieneNombre = cells.some((c, idx) => {
          const header = headers[idx] || '';
          return header.toUpperCase().includes('NOMBRE') && c && c.trim() !== '';
        });

        if (!tieneCodigo && !tieneNombre) continue;

        const obj: Record<string, string> = {};
        for (let ci = 0; ci < headers.length && ci < cells.length; ci++) {
          obj[headers[ci]] = cells[ci] || '';
        }

        const estructuraNormalizada = normalizarEstructuraAsignatura(obj, headers);

        // Validar que la actividad tenga información mínima antes de clasificar
        if (!estructuraNormalizada.CODIGO && !estructuraNormalizada['NOMBRE DE ASIGNATURA']) {
          debugLog(`     ⚠️ Actividad sin código ni nombre, omitiendo:`, estructuraNormalizada);
          continue;
        }

        // Log detallado de la actividad antes de clasificar
        debugLog(`     📋 Actividad encontrada:`, {
          CODIGO: estructuraNormalizada.CODIGO,
          'NOMBRE': estructuraNormalizada['NOMBRE DE ASIGNATURA'],
          TIPO: estructuraNormalizada.TIPO,
          GRUPO: estructuraNormalizada.GRUPO,
          'HORAS': estructuraNormalizada['HORAS SEMESTRE']
        });

        // Clasificar entre pregrado y postgrado usando la función mejorada
        const esPostgrado = esActividadPostgrado(estructuraNormalizada);

        debugLog(`     🎓 Clasificación: "${estructuraNormalizada['NOMBRE DE ASIGNATURA']}" (Código: ${estructuraNormalizada.CODIGO}, Tipo: ${estructuraNormalizada.TIPO}, Grupo: ${estructuraNormalizada.GRUPO}) → ${esPostgrado ? 'POSTGRADO ✓' : 'PREGRADO'}`);

        if (esPostgrado) {
          actividadesDocencia.postgrado.push(estructuraNormalizada);
          debugLog(`     ✅ Agregada a POSTGRADO (total: ${actividadesDocencia.postgrado.length})`);
        } else {
          actividadesDocencia.pregrado.push(estructuraNormalizada);
          debugLog(`     ✅ Agregada a PREGRADO (total: ${actividadesDocencia.pregrado.length})`);
        }
      }
      // Continuar procesando otras tablas en lugar de hacer return
      debugLog(`✅ Tabla ${contadorTablas} procesada como ASIGNATURAS. Continuando con otras tablas...`);
    }

    // Procesar tabla de tesis (ya detectada arriba)
    // IMPORTANTE: Solo procesar si NO tiene indicadores claros de investigación
    const tieneIndicadoresInvestigacionEnTesis = 
      headersNorm.some((h) => h.includes('ANTEPROYECTO') || h.includes('ANTE PROYECTO')) ||
      headersNorm.some((h) => (h.includes('PROPUESTA') && h.includes('INVESTIGACION')));
    
    if (esTablaTesis && !tieneIndicadoresInvestigacionEnTesis) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como DIRECCIÓN DE TESIS`);
      debugLog(`   Headers: ${headers.join(', ')}`);
      
      for (let ri2 = 1; ri2 < rowMatches.length; ri2++) {
        const row = rowMatches[ri2];
        const cells = extractCells(row);
        if (cells.every((c) => c === '' || c.trim() === '')) continue;

        const obj: Record<string, string> = {};
        for (let ci = 0; ci < headers.length && ci < cells.length; ci++) {
          obj[headers[ci]] = cells[ci] || '';
        }

        const estructuraNormalizada = normalizarEstructuraTesis(obj, headers);

        // Validar que la tesis tenga información mínima
        // Puede tener CODIGO ESTUDIANTE, TITULO DE LA TESIS, o NOMBRE DEL ANTEPROYECTO
        const tieneInformacionMinima = 
          estructuraNormalizada['CODIGO ESTUDIANTE'] || 
          estructuraNormalizada['TITULO DE LA TESIS'] ||
          estructuraNormalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'];
        
        if (tieneInformacionMinima) {
          actividadesDocencia.direccionTesis.push(estructuraNormalizada);
          debugLog(`   ✓ Agregada tesis: "${estructuraNormalizada['TITULO DE LA TESIS'] || estructuraNormalizada['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || 'Sin título'}" (${estructuraNormalizada['HORAS SEMESTRE'] || '0'} horas)`);
        } else {
          debugLog(`   ⚠️ Tesis sin información mínima, omitiendo: ${JSON.stringify(estructuraNormalizada)}`);
        }
      }
      debugLog(`   Total tesis en esta tabla: ${actividadesDocencia.direccionTesis.length}`);
      debugLog(`✅ Tabla ${contadorTablas} procesada como TESIS. Continuando con otras tablas...`);
    }

    // Otras actividades
    // NOTA: Eliminado el flag 'processed' para permitir que se procesen múltiples tipos de actividades

    // ACTIVIDADES INTELECTUALES
    // Solo procesar si no se encontraron actividades con la función especializada
    // Buscar tabla que contenga "ACTIVIDADES INTELECTUALES" o "ACTIVIDADES ARTISTICAS"
    const esTablaIntelectuales = tableHtml.includes('ACTIVIDADES INTELECTUALES') ||
                                  tableHtml.includes('ACTIVIDADES ARTISTICAS') ||
                                  (headersNorm.some((h) => h.includes('APROBADO')) &&
                                   headersNorm.includes('TIPO') &&
                                   headersNorm.includes('NOMBRE'));
    
    if (esTablaIntelectuales && actividadesIntelectualesOArtisticas.length === 0) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES INTELECTUALES`);
      
      // Buscar tabla interna anidada si existe
      let tablaAProcesar = tableHtml;
      const tablaAnidadaMatch = tableHtml.match(/<tbody[^>]*>[\s\S]*?<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(<table[^>]*>[\s\S]*?<\/table>)/i);
      if (tablaAnidadaMatch && tablaAnidadaMatch[1]) {
        tablaAProcesar = tablaAnidadaMatch[1];
        debugLog(`   ✅ Tabla interna anidada encontrada para intelectuales`);
        // Re-extraer filas de la tabla interna
        const rowMatchesInterna = tablaAProcesar.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
        if (rowMatchesInterna && rowMatchesInterna.length > 0) {
          // Re-extraer headers de la tabla interna
          const headersInterna = extractCells(rowMatchesInterna[0]);
          const headersNormInterna = headersInterna.map((h) => h.toUpperCase());
          
          // Buscar fila de encabezados
          let indiceEncabezado = 0;
          for (let i = 0; i < Math.min(3, rowMatchesInterna.length); i++) {
            const filaTexto = extraerTextoDeCelda(rowMatchesInterna[i]);
            if (filaTexto.toUpperCase().includes('APROBADO POR') || 
                filaTexto.toUpperCase().includes('TITULO') || 
                filaTexto.toUpperCase().includes('TIPO')) {
              indiceEncabezado = i;
              // Re-extraer headers de esta fila
              const headersDeEstaFila = extractCells(rowMatchesInterna[i]);
              if (headersDeEstaFila.length > 0) {
                headersInterna.length = 0;
                headersInterna.push(...headersDeEstaFila);
              }
              break;
            }
          }
          
          // Procesar filas de datos
          for (let ri = indiceEncabezado + 1; ri < rowMatchesInterna.length; ri++) {
            const row = rowMatchesInterna[ri];
            const cells = extractCells(row);
            if (cells.every((c) => c === '' || c.trim() === '')) continue;
            
            const obj: Record<string, any> = {};
            let aprobadoPor = '';
            let titulo = '';
            let tipo = '';
            let descripcion = '';
            
            // Mapear según número de celdas
            if (cells.length >= 4) {
              aprobadoPor = cells[0]?.trim() || '';
              titulo = cells[1]?.trim() || '';
              tipo = cells[2]?.trim() || '';
              descripcion = cells[3]?.trim() || '';
            } else if (cells.length === 3) {
              // Sin columna "aprobado por"
              aprobadoPor = 'No especificado';
              titulo = cells[0]?.trim() || '';
              tipo = cells[1]?.trim() || '';
              descripcion = cells[2]?.trim() || '';
            }
            
            // Guardar todos los campos
            obj['APROBADO POR'] = aprobadoPor;
            obj['TITULO'] = titulo;
            obj['TIPO'] = tipo;
            obj['DESCRIPCION'] = descripcion;
            
            // También guardar con headers originales si están disponibles
            headersInterna.forEach((header, ci) => {
              if (ci < cells.length) {
                obj[header] = cells[ci] || '';
              }
            });
            
            // Normalizar HORAS SEMESTRE si existe
            headersInterna.forEach((header, ci) => {
              const headerUpper = header.toUpperCase();
              if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
                  headerUpper === 'HORAS SEMESTRE' ||
                  (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL'))) {
                obj['HORAS SEMESTRE'] = cells[ci] || '';
              }
            });
            
            if (titulo || tipo) {
              actividadesIntelectualesOArtisticas.push(obj);
              debugLog(`   ✓ Actividad intelectual extraída: "${titulo.substring(0, 50)}..." (APROBADO POR: ${aprobadoPor})`);
            }
          }
        }
      } else {
        // Procesar tabla normal (sin anidar)
        for (let ri = 1; ri < rowMatches.length; ri++) {
          const row = rowMatches[ri];
          const cells = extractCells(row);
          if (cells.every((c) => c === '' || c.trim() === '')) continue;
          
          const obj: Record<string, any> = {};
          let aprobadoPor = '';
          
          headers.forEach((header, ci) => {
            const valor = cells[ci] || '';
            const headerUpper = header.toUpperCase();
            
            // Extraer APROBADO POR
            if (headerUpper.includes('APROBADO') && headerUpper.includes('POR')) {
              aprobadoPor = valor.trim();
              obj['APROBADO POR'] = valor.trim();
            }
            
            // Normalizar HORAS SEMESTRE
            if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
                headerUpper === 'HORAS SEMESTRE' ||
                (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
                headerUpper === 'HORAS') {
              obj['HORAS SEMESTRE'] = valor;
            }
            
            obj[header] = valor;
          });
          
          // Si no se encontró APROBADO POR en headers, buscar en primera celda
          if (!aprobadoPor && cells.length >= 4) {
            aprobadoPor = cells[0]?.trim() || '';
            obj['APROBADO POR'] = aprobadoPor || 'No especificado';
          }
          
          actividadesIntelectualesOArtisticas.push(obj);
        }
      }
    }

    // ACTIVIDADES DE INVESTIGACION (mejorada con más variaciones)
    // IMPORTANTE: Distinguir entre actividades intelectuales (tienen "APROBADO" + "TIPO") 
    // y actividades de investigación (tienen "APROBADO POR" + "ANTEPROYECTO" o "PROPUESTA DE INVESTIGACION")
    
    // Verificar indicadores específicos de investigación
    const tieneAnteproyecto = headersNorm.some((h) => 
      h.includes('ANTEPROYECTO') || 
      h.includes('ANTE PROYECTO') ||
      h.includes('ANTE-PROYECTO')
    );
    
    const tienePropuestaInvestigacion = headersNorm.some((h) =>
      (h.includes('PROPUESTA') && h.includes('INVESTIGACION')) ||
      h.includes('PROPUESTA DE INVESTIGACION') ||
      h.includes('PROPUESTA INVESTIGACION')
    );
    
    const tieneProyectoInvestigacion = headersNorm.some((h) =>
      (h.includes('PROYECTO') && h.includes('INVESTIGACION')) ||
      h.includes('PROYECTO DE INVESTIGACION') ||
      h.includes('PROYECTO INVESTIGACION')
    );
    
    // Si tiene "APROBADO POR" (no solo "APROBADO") junto con indicadores de investigación, es tabla de investigación
    const tieneAprobadoPor = headersNorm.some((h) => 
      (h.includes('APROBADO') && h.includes('POR')) ||
      h === 'APROBADO POR'
    );
    
    const tieneAprobadoSolo = headersNorm.some((h) => 
      h.includes('APROBADO') && !h.includes('POR')
    );
    
    // La tabla de investigación debe tener indicadores de investigación
    // Y puede tener "APROBADO POR" pero NO debe tener "TIPO" (que es de actividades intelectuales)
    const tieneTipo = headersNorm.includes('TIPO');
    
    const tieneCodigoProyecto = headersNorm.some((h) => h.includes('CODIGO') || h.includes('COD'));
    const tieneNombreProyecto = headersNorm.some((h) => 
      (h.includes('NOMBRE') && (h.includes('PROYECTO') || h.includes('ANTEPROYECTO') || h.includes('PROPUESTA'))) ||
      (h.includes('NOMBRE') && !h.includes('ASIGNATURA') && !h.includes('ESTUDIANTE'))
    );

    // Es tabla de investigación si:
    // 1. Tiene indicadores claros de investigación (ANTEPROYECTO, PROPUESTA DE INVESTIGACION, PROYECTO DE INVESTIGACION)
    // 2. Y NO es tabla de actividades intelectuales (que tiene "TIPO" y "APROBADO" sin "POR")
    // 3. Y NO es tabla de asignaturas, tesis, etc.
    const esTablaInvestigacion = (
      tieneAnteproyecto || 
      tienePropuestaInvestigacion || 
      tieneProyectoInvestigacion ||
      (tieneAprobadoPor && (tieneAnteproyecto || tienePropuestaInvestigacion || tieneNombreProyecto))
    ) &&
    !tieneTipo && // Actividades intelectuales tienen "TIPO"
    !headersNorm.some((h) => h.includes('TIPO DE COMISION')) &&
    !headersNorm.some((h) => h.includes('ASIGNATURA')) &&
    !headersNorm.some((h) => h.includes('ESTUDIANTE')) &&
    !headersNorm.some((h) => h.includes('TESIS')) &&
    !(tieneAprobadoSolo && tieneTipo); // Excluir actividades intelectuales que tienen "APROBADO" + "TIPO"

    // Solo procesar si no se encontraron actividades con la función especializada
    // o si esta tabla tiene una estructura diferente que no fue capturada
    if (esTablaInvestigacion && actividadesInvestigacion.length === 0) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES DE INVESTIGACION (procesamiento genérico)`);
      debugLog(`   Headers: ${headers.join(', ')}`);
      debugLog(`   Criterios: tieneAnteproyecto=${tieneAnteproyecto}, tienePropuesta=${tienePropuestaInvestigacion}, tieneProyecto=${tieneProyectoInvestigacion}, tieneAprobadoPor=${tieneAprobadoPor}`);
      
      // NUEVA ESTRATEGIA: Buscar tablas anidadas dentro de esta tabla
      const tablasAnidadas = tableHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
      if (tablasAnidadas && tablasAnidadas.length > 1) {
        debugLog(`   🔍 Detectadas ${tablasAnidadas.length} tablas anidadas, procesando cada una...`);
        
        tablasAnidadas.forEach((tablaAnidada, idxTabla) => {
          const filasAnidadas = tablaAnidada.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
          if (!filasAnidadas || filasAnidadas.length < 2) return;
          
          // Buscar fila de headers en la tabla anidada
          let headersAnidados: string[] = [];
          let headerRowIndexAnidado = 0;
          
          for (let i = 0; i < Math.min(3, filasAnidadas.length); i++) {
            const fila = filasAnidadas[i];
            if (fila.match(/bgcolor/i) || fila.match(/background/i)) {
              headersAnidados = extractCells(fila);
              headerRowIndexAnidado = i;
              debugLog(`     📋 Headers anidados encontrados en fila ${i}:`, headersAnidados);
              break;
            }
          }
          
          if (headersAnidados.length === 0) {
            headersAnidados = extractCells(filasAnidadas[0]);
            debugLog(`     📋 Headers anidados (primera fila):`, headersAnidados);
          }
          
          // Procesar filas de datos en la tabla anidada
          for (let ri = headerRowIndexAnidado + 1; ri < filasAnidadas.length; ri++) {
            const row = filasAnidadas[ri];
            const cells = extractCells(row);
            
            if (cells.every((c) => c === '' || c.trim() === '')) continue;
            
            const obj = extraerActividadInvestigacionDeFila(cells, headersAnidados, headers, row);
            if (obj && (obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || obj['HORAS SEMESTRE'])) {
              actividadesInvestigacion.push(obj);
              debugLog(`     ✓ Actividad de investigación extraída de tabla anidada ${idxTabla + 1}`);
            }
          }
        });
      }
      
      // ESTRATEGIA ORIGINAL: Procesar filas de la tabla principal
      // IMPORTANTE: Empezar desde headerRowIndex + 1 para saltar la fila de headers
      for (let ri = headerRowIndex + 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        const cells = extractCells(row);
        
        debugLog(`   🔍 Procesando fila ${ri}:`, cells);
        
        // Saltar filas completamente vacías
        if (cells.every((c) => c === '' || c.trim() === '')) {
          debugLog(`   ⚠️ Fila ${ri} vacía, omitiendo`);
          continue;
        }
        
        // Usar la función especializada para extraer la actividad (pasar el HTML de la fila)
        const obj = extraerActividadInvestigacionDeFila(cells, headers, headers, row);
        
        if (obj && (obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || obj['HORAS SEMESTRE'])) {
          actividadesInvestigacion.push(obj);
          debugLog(`   ✓ Agregada actividad de investigación: "${obj['NOMBRE DEL ANTEPROYECTO O PROPUESTA DE INVESTIGACION'] || 'Sin nombre'}" (${obj['HORAS SEMESTRE'] || '0'} horas)`);
        } else {
          debugLog(`   ⚠️ Fila ${ri} no contiene datos válidos de investigación, omitiendo`);
        }
      }
      debugLog(`   Total actividades de investigación en esta tabla: ${actividadesInvestigacion.length}`);
    }

    // ACTIVIDADES COMPLEMENTARIAS
    if (headersNorm.some((h) => h.includes('PARTICIPACION EN'))) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES COMPLEMENTARIAS`);
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        if (extractCells(row).every((c) => c === '')) continue;
        const obj: Record<string, any> = {};
        headers.forEach((header, ci) => {
          const valor = extractCells(row)[ci] || '';
          const headerUpper = header.toUpperCase();
          // Normalizar HORAS SEMESTRE
          if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
              headerUpper === 'HORAS SEMESTRE' ||
              (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
              headerUpper === 'HORAS') {
            obj['HORAS SEMESTRE'] = valor;
          }
          obj[header] = valor;
        });
        actividadesComplementarias.push(obj);
      }
    }

    // DOCENTE EN COMISION
    if (headersNorm.some((h) => h.includes('TIPO DE COMISION'))) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como DOCENTE EN COMISION`);
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        if (extractCells(row).every((c) => c === '')) continue;
        const obj: Record<string, any> = {};
        headers.forEach((header, ci) => {
          const valor = extractCells(row)[ci] || '';
          const headerUpper = header.toUpperCase();
          // Normalizar HORAS SEMESTRE
          if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
              headerUpper === 'HORAS SEMESTRE' ||
              (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
              headerUpper === 'HORAS') {
            obj['HORAS SEMESTRE'] = valor;
          }
          obj[header] = valor;
        });
        docenteEnComision.push(obj);
      }
    }

    // ACTIVIDADES ADMINISTRATIVAS
    if (
      headersNorm.includes('CARGO') &&
      headersNorm.includes('DESCRIPCION DEL CARGO')
    ) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES ADMINISTRATIVAS`);
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        if (extractCells(row).every((c) => c === '')) continue;
        const obj: Record<string, any> = {};
        headers.forEach((header, ci) => {
          const valor = extractCells(row)[ci] || '';
          const headerUpper = header.toUpperCase();
          // Normalizar HORAS SEMESTRE
          if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
              headerUpper === 'HORAS SEMESTRE' ||
              (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
              headerUpper === 'HORAS') {
            obj['HORAS SEMESTRE'] = valor;
          }
          obj[header] = valor;
        });
        actividadesAdministrativas.push(obj);
      }
    }

    // ACTIVIDADES DE EXTENSION
    if (
      headersNorm.includes('TIPO') &&
      headersNorm.includes('NOMBRE') &&
      (headersNorm.some((h) => h.includes('HORAS')) || headersNorm.some((h) => h.includes('SEMESTRE'))) &&
      !headersNorm.some((h) => h.includes('APROBADO'))
    ) {
      debugLog(`✅ Tabla ${contadorTablas} detectada como ACTIVIDADES DE EXTENSION`);
      for (let ri = 1; ri < rowMatches.length; ri++) {
        const row = rowMatches[ri];
        if (extractCells(row).every((c) => c === '')) continue;
        const obj: Record<string, any> = {};
        headers.forEach((header, ci) => {
          const valor = extractCells(row)[ci] || '';
          const headerUpper = header.toUpperCase();
          // Normalizar HORAS SEMESTRE
          if ((headerUpper.includes('HORAS') && headerUpper.includes('SEMESTRE')) ||
              headerUpper === 'HORAS SEMESTRE' ||
              (headerUpper.includes('HORAS') && !headerUpper.includes('TOTAL')) ||
              headerUpper === 'HORAS') {
            obj['HORAS SEMESTRE'] = valor;
          }
          obj[header] = valor;
        });
        actividadesExtension.push(obj);
      }
    }
  });

  // BÚSQUEDA FINAL EXHAUSTIVA: Buscar campos faltantes en todos los valores guardados
  // Esto captura casos donde los headers pueden tener nombres ligeramente diferentes
  if (!informacionPersonal['VINCULACION'] || !informacionPersonal['CATEGORIA'] || 
      !informacionPersonal['DEDICACION'] || !informacionPersonal['NIVEL ALCANZADO']) {
    debugLog(`\n🔍 Búsqueda exhaustiva de campos faltantes...`);
    
    // Buscar en todos los valores guardados en informacionPersonal
    for (const [key, value] of Object.entries(informacionPersonal)) {
      if (!value || typeof value !== 'string') continue;
      
      const keyUpper = key.toUpperCase().trim();
      const valueUpper = value.toUpperCase().trim();
      
      // Buscar VINCULACION
      if (!informacionPersonal['VINCULACION'] && 
          (keyUpper.includes('VINCULACION') || keyUpper.includes('VINCULACIÓN'))) {
        const valorLimpio = value.trim();
        if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
            !valorLimpio.toUpperCase().includes('VINCULACION')) {
          informacionPersonal['VINCULACION'] = valorLimpio;
          debugLog(`   ✓ VINCULACION encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
        }
      }
      
      // Buscar CATEGORIA
      if (!informacionPersonal['CATEGORIA'] && 
          (keyUpper.includes('CATEGORIA') || keyUpper.includes('CATEGORÍA'))) {
        const valorLimpio = value.trim();
        if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
            !valorLimpio.toUpperCase().includes('CATEGORIA')) {
          informacionPersonal['CATEGORIA'] = valorLimpio;
          debugLog(`   ✓ CATEGORIA encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
        }
      }
      
      // Buscar DEDICACION
      if (!informacionPersonal['DEDICACION'] && 
          (keyUpper.includes('DEDICACION') || keyUpper.includes('DEDICACIÓN'))) {
        const valorLimpio = value.trim();
        if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
            !valorLimpio.toUpperCase().includes('DEDICACION')) {
          informacionPersonal['DEDICACION'] = valorLimpio;
          debugLog(`   ✓ DEDICACION encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
        }
      }
      
      // Buscar NIVEL ALCANZADO
      if (!informacionPersonal['NIVEL ALCANZADO'] && 
          (keyUpper.includes('NIVEL') && keyUpper.includes('ALCANZADO'))) {
        const valorLimpio = value.trim();
        if (valorLimpio.length > 0 && valorLimpio.length < 50 && 
            !valorLimpio.toUpperCase().includes('NIVEL')) {
          informacionPersonal['NIVEL ALCANZADO'] = valorLimpio;
          debugLog(`   ✓ NIVEL ALCANZADO encontrado en búsqueda exhaustiva: "${key}" = "${valorLimpio}"`);
        }
      }
    }
  }

  // Resumen final de datos extraídos
  debugLog(`\n=== RESUMEN FINAL PERIODO ${idPeriod} ===`);
  debugLog(`📋 INFORMACIÓN PERSONAL:`);
  debugLog(`   CEDULA: ${informacionPersonal['CEDULA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   NOMBRE: ${informacionPersonal['NOMBRE'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   1 APELLIDO: ${informacionPersonal['1 APELLIDO'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   2 APELLIDO: ${informacionPersonal['2 APELLIDO'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   UNIDAD ACADEMICA: ${informacionPersonal['UNIDAD ACADEMICA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   VINCULACION: ${informacionPersonal['VINCULACION'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   CATEGORIA: ${informacionPersonal['CATEGORIA'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   DEDICACION: ${informacionPersonal['DEDICACION'] || '❌ NO ENCONTRADO'}`);
  debugLog(`   NIVEL ALCANZADO: ${informacionPersonal['NIVEL ALCANZADO'] || '❌ NO ENCONTRADO'}`);

  debugLog(`\n📚 ACTIVIDADES DOCENCIA:`);
  debugLog(`   Pregrado: ${actividadesDocencia.pregrado.length} actividades`);
  if (actividadesDocencia.pregrado.length > 0) {
    actividadesDocencia.pregrado.forEach((act, idx) => {
      debugLog(`     [${idx + 1}] ${act.CODIGO} - ${act['NOMBRE DE ASIGNATURA']} (${act['HORAS SEMESTRE']} horas)`);
    });
  }
  debugLog(`   Postgrado: ${actividadesDocencia.postgrado.length} actividades`);
  if (actividadesDocencia.postgrado.length > 0) {
    actividadesDocencia.postgrado.forEach((act, idx) => {
      debugLog(`     [${idx + 1}] ${act.CODIGO} - ${act['NOMBRE DE ASIGNATURA']} (${act['HORAS SEMESTRE']} horas)`);
    });
  } else {
    debugLog(`     ⚠️ No se encontraron actividades de postgrado. Revisar clasificación.`);
  }
  debugLog(`   Dirección Tesis: ${actividadesDocencia.direccionTesis.length} actividades`);

  debugLog(`\n🔬 OTRAS ACTIVIDADES:`);
  debugLog(`   Investigación: ${actividadesInvestigacion.length}`);
  debugLog(`   Extensión: ${actividadesExtension.length}`);
  debugLog(`   Intelectuales/Artísticas: ${actividadesIntelectualesOArtisticas.length}`);
  debugLog(`   Administrativas: ${actividadesAdministrativas.length}`);
  debugLog(`   Complementarias: ${actividadesComplementarias.length}`);
  debugLog(`   Docente en Comisión: ${docenteEnComision.length}`);
  debugLog(`\n=== FIN PROCESAMIENTO PERIODO ${idPeriod} ===\n`);

  return [
    {
      periodo: idPeriod,
      informacionPersonal,
      actividadesDocencia,
      actividadesInvestigacion,
      actividadesExtension,
      actividadesIntelectualesOArtisticas,
      actividadesAdministrativas,
      actividadesComplementarias,
      docenteEnComision,
    },
  ];
}


