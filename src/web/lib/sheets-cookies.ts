/**
 * Obtiene cookies de autenticación desde Google Sheets
 * Similar a getCookiesFromSheet() en searchState.gs
 */

const SHEET_ID = process.env.GOOGLE_SHEETS_PRINCIPAL_ID || '1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg';

export interface Cookies {
  PHPSESSID?: string;
  asigacad?: string;
  timestamp?: Date;
}

/**
 * Obtiene las cookies más recientes desde Google Sheets (opcional)
 * Las cookies ya no son requeridas para el web scraping
 * Requiere configuración de Google Sheets API
 */
export async function getCookiesFromSheet(): Promise<Cookies> {
  try {
    // Primero intentar desde variables de entorno (más rápido)
    const envCookies = {
      PHPSESSID: process.env.UNIVALLE_PHPSESSID,
      asigacad: process.env.UNIVALLE_ASIGACAD,
    };

    // Si hay cookies en env, retornarlas (aunque ya no son requeridas)
    if (envCookies.PHPSESSID || envCookies.asigacad) {
      return envCookies;
    }

    // Si no hay en env, intentar desde Google Sheets
    // Esto requiere que googleapis esté configurado
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      
      // Intentar hoja "Cookies" primero
      let sheetName = 'Cookies';
      let response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${sheetName}!A2:C2`,
      });

      // Si no existe, intentar "Siac Cookies"
      if (!response.data.values || response.data.values.length === 0) {
        sheetName = 'Siac Cookies';
        response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${sheetName}!A2:C2`,
        });
      }

      if (!response.data.values || response.data.values.length === 0) {
        throw new Error('Fila de cookies vacía');
      }

      const [timestamp, phpsessidRaw, asigacadRaw] = response.data.values[0];
      const phpsessid = (phpsessidRaw || '').toString().trim();
      const asigacad = (asigacadRaw || '').toString().trim();

      if (!phpsessid && !asigacad) {
        throw new Error('No hay credenciales válidas (faltan ambos: PHPSESSID y asigacad)');
      }

      return {
        PHPSESSID: phpsessid || undefined,
        asigacad: asigacad || undefined,
        timestamp: timestamp ? new Date(timestamp) : undefined,
      };
    }

    // Si no hay configuración de Google Sheets, retornar vacío (está bien, ya no son requeridas)
    return {};
  } catch (error) {
    // No es crítico si falla - las cookies ya no son requeridas
    // Solo loguear si hay un error inesperado
    if (process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Cookies no disponibles (no es un problema - ya no son requeridas)');
    }
    // Retornar cookies de env como fallback (si existen)
    return {
      PHPSESSID: process.env.UNIVALLE_PHPSESSID,
      asigacad: process.env.UNIVALLE_ASIGACAD,
    };
  }
}

