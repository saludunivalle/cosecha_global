/**
 * Cliente API para interactuar con el portal Univalle
 * Basado en la lógica de searchState.gs
 */

import { procesarHTML } from './html-parser';
import type { DatosDocente, Periodo } from '@/shared/types/docente.types';
import { getCookiesFromSheet } from './sheets-cookies';

const UNIVALLE_PORTAL_URL =
  process.env.UNIVALLE_PORTAL_URL || 'https://proxse26.univalle.edu.co/asignacion';

/**
 * Construye headers de autenticación basado en cookies
 */
function buildAuthHeaders(cookies: { PHPSESSID?: string; asigacad?: string }): Record<string, string> {
  const headers: Record<string, string> = {};
  const cookieParts: string[] = [];

  if (cookies.asigacad) {
    cookieParts.push(`asigacad=${encodeURIComponent(cookies.asigacad)}`);
  }
  if (cookies.PHPSESSID) {
    cookieParts.push(`PHPSESSID=${encodeURIComponent(cookies.PHPSESSID)}`);
  }

  if (cookieParts.length > 0) {
    headers['Cookie'] = cookieParts.join('; ');
  }

  return headers;
}

/**
 * Extrae datos de un docente desde el portal Univalle
 */
export async function extraerDatosDocenteUnivalle(
  cedula: string,
  idPeriod: number
): Promise<DatosDocente[]> {
  try {
    // Obtener cookies desde Sheets o variables de entorno (opcional)
    const cookies = await getCookiesFromSheet();

    const url = `${UNIVALLE_PORTAL_URL}/vin_inicio_impresion.php3?cedula=${cedula}&periodo=${idPeriod}`;
    const headers = buildAuthHeaders(cookies);

    console.log(`📡 Consultando: ${url}`);
    if (cookies.PHPSESSID || cookies.asigacad) {
      console.log(`🔐 Cookies configuradas: PHPSESSID=${cookies.PHPSESSID ? '✓' : '✗'}, asigacad=${cookies.asigacad ? '✓' : '✗'}`);
    } else {
      console.log(`🔓 Acceso sin autenticación (cookies no requeridas)`);
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store', // No cachear en Next.js
    });

    console.log(`📊 Respuesta HTTP: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorMessages: Record<number, string> = {
        401: 'No autorizado - cookies expiradas o inválidas',
        403: 'Acceso prohibido - verificar permisos',
        404: 'Página no encontrada - posible cambio en el servidor',
        500: 'Error interno del servidor',
        502: 'Bad Gateway - servidor no disponible',
        503: 'Servicio no disponible',
        504: 'Gateway timeout - servidor demasiado lento',
      };

      const errorMsg = errorMessages[response.status] || `Error HTTP ${response.status}`;
      console.error(`❌ Error HTTP: ${errorMsg}`);
      throw new Error(`${errorMsg} (código: ${response.status})`);
    }

    // Leer como texto con codificación ISO-8859-1
    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    let html = decoder.decode(arrayBuffer);

    console.log(`📄 HTML recibido: ${html.length} caracteres`);

    if (!html || html.length < 100) {
      console.error(`❌ HTML muy corto: ${html.substring(0, 200)}`);
      throw new Error('Respuesta vacía o muy corta del servidor');
    }

    // IMPORTANTE: Manejar framesets - extraer el contenido del frame si es necesario
    if (html.includes('<frameset') || html.includes('<frame')) {
      console.log(`⚠️ Detectado frameset en HTML. Extrayendo contenido del frame...`);
      
      // Buscar el src del frame mainFrame_ que contiene los datos
      const frameMatch = html.match(/name=["']mainFrame_["'][^>]*src=["']([^"']+)["']/i);
      if (frameMatch && frameMatch[1]) {
        const frameSrc = frameMatch[1];
        console.log(`📡 Frame detectado con src: ${frameSrc}`);
        
        // Si el src es relativo, construir la URL completa
        let frameUrl = frameSrc;
        if (!frameSrc.startsWith('http')) {
          frameUrl = `${UNIVALLE_PORTAL_URL}/${frameSrc.replace(/^\//, '')}`;
        }
        
        console.log(`📡 Obteniendo contenido del frame: ${frameUrl}`);
        
        // Hacer una nueva petición al frame
        const frameResponse = await fetch(frameUrl, {
          method: 'GET',
          headers: {
            ...headers,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Connection': 'keep-alive',
            'Referer': url,
          },
          cache: 'no-store',
        });
        
        if (frameResponse.ok) {
          const frameArrayBuffer = await frameResponse.arrayBuffer();
          html = decoder.decode(frameArrayBuffer);
          console.log(`✅ Contenido del frame obtenido: ${html.length} caracteres`);
        } else {
          console.warn(`⚠️ No se pudo obtener contenido del frame, usando HTML original`);
        }
      } else {
        console.warn(`⚠️ Frameset detectado pero no se encontró frame mainFrame_, usando HTML original`);
      }
    }

    // Verificar si es una página de error (solo errores explícitos)
    // No verificamos "IDENTIFICACION DEL PROFESOR" porque también aparece en resultados válidos
    if (html.includes('<title>Error</title>') || html.match(/<h1[^>]*>Error/i)) {
      console.error(`❌ Página de error detectada`);
      throw new Error('El servidor devolvió una página de error');
    }

    // Procesar HTML directamente - el procesador determinará si hay datos válidos
    console.log(`🔄 Procesando HTML...`);
    const resultado = procesarHTML(html, idPeriod);

    if (!resultado || resultado.length === 0) {
      console.error(`❌ No se extrajeron datos del HTML`);
      // Verificar si es realmente una página de login (formulario sin datos procesados)
      const tieneFormulario = html.includes('<form') && html.includes('PERIODO ACADEMICO');
      const tieneTablas = html.match(/<table[^>]*>/gi)?.length || 0;
      
      if (tieneFormulario && tieneTablas < 2) {
        throw new Error('Página de login detectada - no se encontraron datos del docente');
      }
      
      throw new Error('El procesamiento HTML no devolvió datos válidos');
    }

    console.log(`✅ Datos extraídos exitosamente`);
    return resultado;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error al extraer datos del docente: ${errorMessage}`);
  }
}

/**
 * Obtiene los últimos N períodos disponibles desde el portal
 */
export async function getUltimosNPeriodosDesdePortal(n: number = 8): Promise<Periodo[]> {
  try {
    // Obtener cookies (opcional - ya no son requeridas)
    const cookies = await getCookiesFromSheet();
    const url = `${UNIVALLE_PORTAL_URL}/vin_docente.php3`;
    const headers = buildAuthHeaders(cookies);

    console.log(`📡 Consultando períodos: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...headers,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al obtener periodos`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    const html = decoder.decode(arrayBuffer);

    // Regex para cada option: value + texto interno
    const optionRegex = /<option[^>]*value=["']?(\d+)["']?[^>]*>([\s\S]*?)<\/option>/gi;
    // Regex para encontrar dentro del texto algo tipo "2026-1", "2026 - 01", etc.
    const labelRegex = /(\d{4})\s*[-\s]\s*0?([12])\b/;

    const items: Periodo[] = [];
    let match: RegExpExecArray | null;

    while ((match = optionRegex.exec(html)) !== null) {
      const idPeriod = Number(match[1]);
      // Texto visible del option (limpiando tags internos por si acaso)
      const rawLabel = match[2].replace(/<[^>]+>/g, '').trim();

      const m = labelRegex.exec(rawLabel);
      if (!m) {
        // No es un período tipo "AAAA-1" o "AAAA-2", lo ignoramos
        continue;
      }

      const year = Number(m[1]);
      const term = Number(m[2]); // 1 o 2 (ya sin el 0 delante)

      if (!year || !term) continue;

      items.push({
        idPeriod,
        year,
        term,
        label: `${year}-${term}`, // normalizamos a "2026-1", "2025-2", etc.
      });
    }

    if (items.length === 0) {
      // IMPORTANTE: No usar fallbacks hardcodeados para evitar discrepancias
      // Si no se pueden obtener periodos desde el portal, lanzar error
      console.error('❌ No se encontraron períodos en el portal');
      throw new Error('No se pudieron obtener períodos desde el portal. Por favor, verifique la conexión.');
    }

    // Ordenar por año desc, luego término desc (más reciente primero)
    items.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.term - a.term; // 2 > 1
    });

    // Eliminar duplicados por idPeriod
    const seen = new Set<number>();
    const unique = items.filter((item) => {
      if (seen.has(item.idPeriod)) return false;
      seen.add(item.idPeriod);
      return true;
    });

    // IMPORTANTE: Asegurar que el primer elemento es el periodo más reciente
    const periodosOrdenados = unique.slice(0, n);
    if (periodosOrdenados.length > 0) {
      const ultimoPeriodo = periodosOrdenados[0];
      console.log(`📅 Último periodo disponible desde portal: ${ultimoPeriodo.label} (id=${ultimoPeriodo.idPeriod})`);
    }

    return periodosOrdenados;
  } catch (error) {
    // IMPORTANTE: No usar fallbacks hardcodeados para evitar discrepancias
    // Los periodos DEBEN obtenerse desde el portal al momento del scraping
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error obteniendo períodos desde el portal:', errorMessage);
    throw new Error(`Error al obtener períodos desde el portal: ${errorMessage}. No se pueden usar periodos cacheados para evitar discrepancias.`);
  }
}

