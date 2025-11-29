# Configuración de Cookies para el Portal Univalle

**⚠️ ACTUALIZACIÓN**: Las cookies ya **NO son requeridas** para el web scraping. El portal ahora permite acceso sin autenticación.

Las cookies son **opcionales** y solo se usarán si están disponibles. El aplicativo funcionará perfectamente sin ellas.

## Opción 1: Variables de Entorno (Recomendado para desarrollo)

Agrega las siguientes variables a tu archivo `.env`:

```env
UNIVALLE_PHPSESSID=tu_phpsessid_aqui
UNIVALLE_ASIGACAD=tu_asigacad_aqui
```

### Cómo obtener las cookies:

1. Abre el portal de Univalle en tu navegador:
   - https://proxse26.univalle.edu.co/asignacion/vin_docente.php3

2. Inicia sesión con tus credenciales

3. Abre las herramientas de desarrollador (F12)

4. Ve a la pestaña "Application" o "Almacenamiento"

5. En "Cookies", busca las cookies del dominio `proxse26.univalle.edu.co`

6. Copia los valores de:
   - `PHPSESSID`
   - `asigacad`

7. Pega estos valores en tu archivo `.env`

**Nota**: Estas cookies expiran después de un tiempo (generalmente 8-24 horas), así que necesitarás actualizarlas periódicamente.

## Opción 2: Google Sheets (Recomendado para producción)

El sistema puede obtener las cookies automáticamente desde Google Sheets, igual que el código original de Apps Script.

### Configuración:

1. Asegúrate de tener una hoja llamada "Cookies" o "Siac Cookies" en tu Google Sheet principal

2. La hoja debe tener el siguiente formato:
   ```
   | Timestamp | PHPSESSID | asigacad |
   |-----------|-----------|----------|
   | 2025-01-15| abc123... | xyz789...|
   ```

3. Configura las credenciales de Google Sheets API:
   ```env
   GOOGLE_SHEETS_PRINCIPAL_ID=1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg
   GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
   ```

4. El sistema intentará obtener las cookies desde Google Sheets primero, y si falla, usará las variables de entorno.

## Verificación

Para verificar que las cookies están funcionando:

1. Ejecuta `npm run dev`

2. Intenta buscar un docente

3. Revisa la consola del servidor para ver los logs:
   - `📡 Consultando: ...` - Muestra la URL consultada
   - `🔐 Cookies configuradas: ...` - Muestra si las cookies están presentes
   - `📊 Respuesta HTTP: ...` - Muestra el código de respuesta
   - `📄 HTML recibido: ...` - Muestra el tamaño del HTML recibido

Si ves errores como:
- `No se encontraron credenciales válidas` → Las cookies no están configuradas
- `No autenticado` → Las cookies están expiradas o son inválidas
- `Error HTTP 401/403` → Las cookies no tienen permisos

## Actualización Automática

Para producción, considera implementar un sistema que actualice las cookies automáticamente desde Google Sheets, similar a como lo hace el código original de Apps Script.

