# Módulo Web - Aplicativo de Búsqueda de Docentes

Este módulo contiene el aplicativo web para búsqueda y visualización de asignaciones académicas, migrado desde Google Apps Script a Next.js/React.

## Componentes

- **Frontend**: Interfaz React/Next.js con componentes modulares
- **API Routes**: Endpoints para consultar el portal Univalle
- **Procesamiento**: Normalización de datos para visualización
- **Web Scraping**: Extracción directa de datos desde el portal Univalle

## Características

- ✅ Consulta directa al portal Univalle (web scraping)
- ✅ No requiere Google Sheets para funcionar
- ✅ Funciona de forma independiente
- ✅ Visualización por período o por actividad
- ✅ **No requiere cookies de autenticación** (acceso público al portal)
- ✅ Procesamiento de múltiples períodos en paralelo
- ✅ Interfaz responsive con Bootstrap

## Estructura

- `app/` - Aplicación Next.js (páginas y API routes)
  - `page.tsx` - Página principal de búsqueda
  - `layout.tsx` - Layout con metadata y estilos
  - `api/` - API Routes
    - `periodos/route.ts` - GET `/api/periodos?n=8` - Obtiene períodos académicos
    - `docente/[cedula]/route.ts` - GET `/api/docente/[cedula]` - Obtiene datos del docente
- `components/` - Componentes React reutilizables
  - `SearchForm.tsx` - Formulario de búsqueda por cédula
  - `PersonalInfo.tsx` - Tarjeta de información personal del docente
  - `ActivitiesView.tsx` - Componente principal que coordina las vistas
  - `PeriodView.tsx` - Vista de actividades organizadas por período
  - `ActivityView.tsx` - Vista de actividades organizadas por tipo
  - `ActivityTable.tsx` - Tabla de actividades con totales
  - `ViewToggle.tsx` - Toggle para cambiar entre vistas
- `lib/` - Utilidades y helpers
  - `univalle-api.ts` - Cliente API para el portal Univalle
  - `html-parser.ts` - Parser de HTML del portal (extrae datos de tablas)
  - `data-processor.ts` - Utilidades para procesar y consolidar datos
  - `sheets-cookies.ts` - Obtención opcional de cookies desde Google Sheets
- `styles/` - Estilos CSS
  - `globals.css` - Estilos globales (basados en el diseño original)

## Funcionalidades Implementadas

### 1. Búsqueda de Docentes
- Búsqueda por cédula del docente
- Consulta automática de los últimos 8 períodos académicos
- Procesamiento en paralelo para mejor rendimiento
- Manejo de errores por período (si un período falla, los demás continúan)

### 2. Visualización de Datos
- **Vista por Período**: Organiza actividades por período académico
  - Cada período es un acordeón colapsable
  - Muestra total de horas por período
  - Subcategorías por tipo de actividad
- **Vista por Actividad**: Organiza actividades por tipo
  - Agrupa todas las actividades del mismo tipo
  - Muestra total histórico por actividad
  - Subcategorías por período dentro de cada actividad

### 3. Tipos de Actividades Soportadas
- **Docencia**:
  - Pregrado
  - Postgrado
  - Dirección de Tesis
- **Investigación**: Proyectos de investigación
- **Extensión**: Actividades de extensión universitaria
- **Intelectuales o Artísticas**: Publicaciones, patentes, etc.
- **Administrativas**: Cargos administrativos
- **Complementarias**: Participaciones en eventos
- **Comisión**: Docente en comisión

### 4. Web Scraping
- Extracción directa desde `https://proxse26.univalle.edu.co/asignacion/`
- **No requiere autenticación** (el portal permite acceso público)
- Parser HTML robusto que extrae datos de múltiples tablas
- Detección automática de tipos de actividades
- Normalización de estructuras de datos

## API Endpoints

### GET `/api/periodos?n=8`
Obtiene los últimos N períodos académicos disponibles.

**Respuesta:**
```json
{
  "periodos": [
    {
      "idPeriod": 50,
      "year": 2026,
      "term": 1,
      "label": "2026-1"
    },
    ...
  ]
}
```

### GET `/api/docente/[cedula]?periodo=X`
Obtiene datos de un docente. Si se especifica `periodo`, devuelve solo ese período. Si no, devuelve los últimos 8 períodos.

**Respuesta:**
```json
{
  "resultados": [
    {
      "periodo": 50,
      "data": [
        {
          "periodo": 50,
          "informacionPersonal": {...},
          "actividadesDocencia": {...},
          "actividadesInvestigacion": [...],
          ...
        }
      ],
      "error": null
    },
    ...
  ]
}
```

## Configuración

### Variables de Entorno (Opcionales)

Las cookies ya **NO son requeridas**. El portal permite acceso público.

```env
# Portal Univalle
UNIVALLE_PORTAL_URL=https://proxse26.univalle.edu.co/asignacion

# Cookies (OPCIONAL - ya no son requeridas)
UNIVALLE_PHPSESSID=
UNIVALLE_ASIGACAD=
```

### Dependencias

- `next`: Framework React
- `react`: Biblioteca UI
- `axios`: Cliente HTTP (opcional, se usa fetch nativo)
- `cheerio`: Parser HTML (opcional, se usa regex nativo)

## Migración desde Apps Script

Este módulo es la migración de `findDocentByPhone.html` y `searchState.gs` a Next.js/React.

### Cambios Principales

1. **Frontend**: HTML vanilla → React/Next.js con componentes modulares
2. **Backend**: Google Apps Script → Next.js API Routes
3. **Web Scraping**: `UrlFetchApp` → `fetch` nativo de Node.js
4. **Autenticación**: Cookies opcionales (ya no requeridas)
5. **Procesamiento**: Mismo parser HTML, adaptado a TypeScript

### Funcionalidades Mantenidas

- ✅ Misma lógica de extracción de datos
- ✅ Mismo parser HTML
- ✅ Misma estructura de datos
- ✅ Mismas vistas (por período y por actividad)
- ✅ Mismo diseño visual (Bootstrap)

### Mejoras

- ⚡ Procesamiento en paralelo de períodos
- 🔒 TypeScript para type safety
- 📦 Componentes modulares y reutilizables
- 🎨 Mejor organización del código
- 🚀 Mejor rendimiento con Next.js

## Uso

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

Acceder a `http://localhost:3000` y buscar un docente por cédula.

## Notas Técnicas

- El web scraping funciona sin cookies (acceso público al portal)
- El parser HTML maneja múltiples estructuras de tablas
- Los datos se procesan en el servidor (API Routes)
- El frontend es completamente client-side (React)
- Los estilos replican el diseño original del HTML

