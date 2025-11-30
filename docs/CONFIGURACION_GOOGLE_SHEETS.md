# Configuración de Google Sheets API

Esta guía te ayudará a configurar una cuenta de servicio de Google para interactuar con Google Sheets.

## 📋 Requisitos Previos

- Cuenta de Google con acceso a los Google Sheets que deseas usar
- Acceso a [Google Cloud Console](https://console.cloud.google.com/)

## 🔧 Pasos para Configurar la Cuenta de Servicio

### 1. Crear un Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **ID del proyecto** (lo necesitarás más adelante)

### 2. Habilitar Google Sheets API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Sheets API"
3. Haz clic en **Enable** para habilitarla

### 3. Crear una Cuenta de Servicio

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **Service Account**
3. Completa el formulario:
   - **Service account name**: Un nombre descriptivo (ej: `cosecha-global-service`)
   - **Service account ID**: Se genera automáticamente
   - **Description**: Descripción opcional (ej: "Cuenta de servicio para cosecha de datos")
4. Haz clic en **Create and Continue**
5. En **Grant this service account access to project**, puedes saltar este paso por ahora
6. Haz clic en **Done**

### 4. Generar la Clave JSON

1. En la lista de cuentas de servicio, encuentra la que acabas de crear
2. Haz clic en el email de la cuenta de servicio
3. Ve a la pestaña **Keys**
4. Haz clic en **Add Key** > **Create new key**
5. Selecciona **JSON** como tipo de clave
6. Haz clic en **Create**
7. Se descargará automáticamente un archivo JSON con las credenciales

### 5. Compartir los Google Sheets con la Cuenta de Servicio

**⚠️ IMPORTANTE**: La cuenta de servicio necesita acceso a los Google Sheets.

1. Abre el archivo JSON descargado
2. Copia el valor del campo `client_email` (ej: `cosecha-global-service@tu-proyecto.iam.gserviceaccount.com`)
3. Para cada Google Sheet que necesites acceder:
   - Abre el Google Sheet
   - Haz clic en **Share** (Compartir)
   - Pega el email de la cuenta de servicio
   - Asigna el rol **Editor** o **Viewer** según necesites
   - Haz clic en **Send**

**Google Sheets que necesitas compartir:**
- **Hoja Principal**: `1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg`
- **Hoja de Docentes**: `1mvCj-5ELwLW14-BwPhw06vneFsKb_dPDI4JuSyQeFZA`

### 6. Configurar el Archivo .env

1. Copia el archivo `env.example.txt` a `.env` en la raíz del proyecto:
   ```bash
   cp env.example.txt .env
   ```

2. Coloca el archivo JSON de credenciales en la raíz del proyecto:
   ```
   cosecha_global/
   ├── .env
   ├── credentials.json  ← Aquí va tu archivo JSON
   ├── package.json
   └── ...
   ```

3. Edita el archivo `.env` y configura la ruta:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
   ```

   O si prefieres usar una ruta absoluta:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=/ruta/completa/a/credentials.json
   ```

## ✅ Verificación

Para verificar que la configuración funciona:

1. Asegúrate de que el archivo `.env` esté en la raíz del proyecto
2. Verifica que `credentials.json` esté en la ubicación especificada
3. Verifica que la cuenta de servicio tenga acceso a los Google Sheets
4. Ejecuta el proyecto:
   ```bash
   npm run dev
   ```

## 🔒 Seguridad

**IMPORTANTE**: 
- ✅ El archivo `.env` ya está en `.gitignore` (no se subirá a Git)
- ✅ El archivo `credentials.json` también está en `.gitignore`
- ❌ **NUNCA** subas estos archivos al repositorio
- ❌ **NUNCA** compartas las credenciales públicamente

## 📝 Estructura del Archivo .env

Tu archivo `.env` debería verse así:

```env
# Portal Univalle
UNIVALLE_PORTAL_URL=https://proxse26.univalle.edu.co/asignacion

# Credenciales de autenticación para el portal Univalle (OPCIONAL)
UNIVALLE_PHPSESSID=
UNIVALLE_ASIGACAD=

# Google Sheets (para sistema de cosecha)
GOOGLE_SHEETS_PRINCIPAL_ID=1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg
GOOGLE_SHEETS_DOCENTES_ID=1mvCj-5ELwLW14-BwPhw06vneFsKb_dPDI4JuSyQeFZA

# Google API (para cosecha y lectura de cookies desde Sheets)
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Cache (opcional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=1800

# Vercel (deployment)
VERCEL_URL=https://tu-app.vercel.app
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🚀 Para Producción (Vercel)

Si vas a desplegar en Vercel:

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** > **Environment Variables**
3. Agrega todas las variables de entorno del `.env`
4. Para `GOOGLE_APPLICATION_CREDENTIALS`, tienes dos opciones:
   
   **Opción A: Usar el contenido del JSON como variable**
   - Copia todo el contenido del archivo `credentials.json`
   - Crea una variable `GOOGLE_APPLICATION_CREDENTIALS` con el contenido JSON completo
   - En el código, necesitarás parsear esta variable como JSON
   
   **Opción B: Usar Google Secret Manager (Recomendado)**
   - Sube el archivo JSON a Google Secret Manager
   - Configura Vercel para acceder al secreto

## 🆘 Solución de Problemas

### Error: "Could not load the default credentials"

- Verifica que la ruta en `GOOGLE_APPLICATION_CREDENTIALS` sea correcta
- Verifica que el archivo JSON exista en esa ubicación
- Verifica que el archivo JSON tenga el formato correcto

### Error: "The caller does not have permission"

- Verifica que la cuenta de servicio tenga acceso a los Google Sheets
- Verifica que el email de la cuenta de servicio esté compartido con los Sheets

### Error: "API has not been used"

- Verifica que Google Sheets API esté habilitada en Google Cloud Console
- Espera unos minutos después de habilitarla

## 📚 Recursos Adicionales

- [Documentación de Google Sheets API](https://developers.google.com/sheets/api)
- [Guía de Cuentas de Servicio](https://cloud.google.com/iam/docs/service-accounts)
- [Configuración de Credenciales](https://cloud.google.com/docs/authentication/getting-started)

