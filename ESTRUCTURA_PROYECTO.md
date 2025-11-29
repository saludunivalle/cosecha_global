# Estructura del Proyecto - Sistema de Gestión de Asignaciones Académicas

## Descripción General

Este proyecto está dividido en dos funcionalidades principales:

1. **Aplicativo Web**: Búsqueda y visualización de asignaciones académicas de docentes
2. **Sistema de Cosecha**: Extracción, procesamiento y consolidación de datos desde múltiples fuentes (Google Sheets)

---

## Estructura de Carpetas Propuesta

```
cosecha_global/
│
├── README.md                          # Documentación principal del proyecto
├── package.json                       # Dependencias del proyecto
├── .env.example                       # Variables de entorno de ejemplo
├── .gitignore                         # Archivos a ignorar en Git
│
├── docs/                              # Documentación del proyecto
│   ├── DOCUMENTACION_APLICATIVO.md    # Documentación técnica completa
│   ├── Intrucciones_AsignacionesAcademicas.md  # Instrucciones del aplicativo web
│   └── ESTRUCTURA_PROYECTO.md        # Este archivo
│
├── src/                               # Código fuente principal
│   │
│   ├── web/                           # Aplicativo Web (Búsqueda de Docentes)
│   │   ├── app/                       # Aplicación principal (Next.js/React)
│   │   │   ├── layout.tsx            # Layout principal
│   │   │   ├── page.tsx              # Página de búsqueda
│   │   │   └── api/                  # API Routes (Next.js)
│   │   │       ├── periodos/         # GET /api/periodos
│   │   │       └── docente/          # GET /api/docente/[cedula]
│   │   │
│   │   ├── components/               # Componentes React
│   │   │   ├── SearchForm.tsx        # Formulario de búsqueda
│   │   │   ├── PersonalInfo.tsx      # Tarjeta de información personal
│   │   │   ├── ActivitiesView.tsx    # Vista de actividades
│   │   │   ├── PeriodView.tsx        # Vista por período
│   │   │   ├── ActivityView.tsx      # Vista por actividad
│   │   │   └── ActivityTable.tsx     # Tabla de actividades
│   │   │
│   │   ├── lib/                      # Utilidades y helpers
│   │   │   ├── univalle-api.ts       # Cliente API del portal Univalle
│   │   │   ├── data-processor.ts     # Procesamiento de datos
│   │   │   ├── html-parser.ts        # Parser de HTML
│   │   │   └── types.ts              # Tipos TypeScript
│   │   │
│   │   ├── styles/                   # Estilos
│   │   │   ├── globals.css           # Estilos globales
│   │   │   └── components.css        # Estilos de componentes
│   │   │
│   │   └── hooks/                     # Custom React Hooks
│   │       ├── useDocente.ts         # Hook para búsqueda de docente
│   │       └── usePeriodos.ts        # Hook para períodos
│   │
│   ├── harvest/                       # Sistema de Cosecha de Datos
│   │   ├── services/                  # Servicios de extracción
│   │   │   ├── univalle-extractor.ts # Extractor del portal Univalle
│   │   │   ├── sheets-reader.ts      # Lector de Google Sheets
│   │   │   └── data-normalizer.ts    # Normalizador de datos
│   │   │
│   │   ├── processors/                # Procesadores de datos
│   │   │   ├── periodo-processor.ts  # Procesador de períodos
│   │   │   ├── docente-processor.ts  # Procesador de docentes
│   │   │   └── actividad-processor.ts # Procesador de actividades
│   │   │
│   │   ├── consolidators/             # Consolidadores
│   │   │   ├── general-consolidator.ts # Consolidador de hoja General
│   │   │   └── periodo-consolidator.ts # Consolidador por período
│   │   │
│   │   ├── sheets/                    # Integración con Google Sheets
│   │   │   ├── sheets-client.ts       # Cliente de Google Sheets API
│   │   │   ├── sheets-reader.ts       # Lector de hojas
│   │   │   └── sheets-writer.ts       # Escritor de hojas
│   │   │
│   │   ├── config/                    # Configuración
│   │   │   ├── sheets-config.ts       # IDs y configuración de Sheets
│   │   │   ├── constants.ts           # Constantes del sistema
│   │   │   └── mappings.ts            # Mapeos de datos
│   │   │
│   │   └── jobs/                      # Jobs/Tareas programadas
│   │       ├── daily-harvest.ts      # Cosecha diaria
│   │       └── period-processor.ts   # Procesador de períodos
│   │
│   ├── shared/                        # Código compartido entre módulos
│   │   ├── types/                     # Tipos TypeScript compartidos
│   │   │   ├── docente.types.ts       # Tipos de docente
│   │   │   ├── actividad.types.ts     # Tipos de actividad
│   │   │   └── periodo.types.ts       # Tipos de período
│   │   │
│   │   ├── utils/                     # Utilidades compartidas
│   │   │   ├── date-utils.ts          # Utilidades de fechas
│   │   │   ├── string-utils.ts        # Utilidades de strings
│   │   │   └── validation.ts          # Validaciones
│   │   │
│   │   └── constants/                 # Constantes compartidas
│   │       ├── activity-types.ts      # Tipos de actividades
│   │       └── school-mappings.ts     # Mapeos de escuelas/departamentos
│   │
│   └── api/                           # API Backend (si se usa servidor separado)
│       ├── routes/                    # Rutas de API
│       │   ├── periodos.ts           # Rutas de períodos
│       │   ├── docente.ts            # Rutas de docente
│       │   └── harvest.ts            # Rutas de cosecha
│       │
│       ├── middleware/                # Middleware
│       │   ├── auth.ts               # Autenticación
│       │   └── error-handler.ts      # Manejo de errores
│       │
│       └── services/                  # Servicios del API
│           ├── univalle-service.ts   # Servicio de Univalle
│           └── sheets-service.ts     # Servicio de Sheets
│
├── scripts/                           # Scripts de utilidad
│   ├── migrate-data.ts               # Script de migración de datos
│   ├── setup-env.ts                  # Script de configuración
│   └── test-connection.ts            # Script de prueba de conexión
│
├── tests/                             # Tests
│   ├── unit/                          # Tests unitarios
│   │   ├── web/                      # Tests del aplicativo web
│   │   └── harvest/                  # Tests del sistema de cosecha
│   │
│   ├── integration/                   # Tests de integración
│   │   ├── api/                      # Tests de API
│   │   └── sheets/                   # Tests de Google Sheets
│   │
│   └── e2e/                          # Tests end-to-end
│       └── web-flow.spec.ts          # Flujo completo del web
│
├── public/                            # Archivos estáticos
│   ├── images/                       # Imágenes
│   └── icons/                        # Iconos
│
├── config/                            # Archivos de configuración
│   ├── vercel.json                   # Configuración de Vercel
│   ├── tsconfig.json                 # Configuración de TypeScript
│   └── next.config.js                # Configuración de Next.js
│
└── legacy/                            # Código legacy de Apps Script (referencia)
    ├── searchState.gs                # Extracción de datos
    ├── procesarAsignacionesAcademicas.gs  # Procesamiento
    ├── findDocentByPhone.html        # Interfaz web original
    └── ...                           # Otros archivos .gs y .html
```

---

## Descripción de Módulos

### 1. Módulo Web (`src/web/`)

**Propósito**: Aplicativo web para búsqueda y visualización de docentes.

**Componentes principales**:
- **Frontend**: Interfaz React/Next.js para búsqueda y visualización
- **API Routes**: Endpoints para obtener datos del portal Univalle
- **Procesamiento**: Normalización y estructuración de datos para visualización

**Dependencias**:
- Framework web (Next.js/React)
- Cliente HTTP (fetch/axios)
- Parser HTML (cheerio/jsdom)

**No depende de**: Google Sheets (obtiene datos directamente del portal)

---

### 2. Módulo de Cosecha (`src/harvest/`)

**Propósito**: Sistema de extracción, procesamiento y consolidación de datos.

**Componentes principales**:
- **Extractores**: Obtienen datos desde múltiples fuentes
- **Procesadores**: Normalizan y estructuran datos
- **Consolidadores**: Agrupan datos en hojas de Google Sheets
- **Jobs**: Tareas programadas para procesamiento automático

**Dependencias**:
- Google Sheets API
- Múltiples hojas de Google Sheets como fuente de datos
- Sistema de triggers/jobs para automatización

**Depende de**:
- Google Sheets para lectura y escritura
- Configuración de múltiples IDs de hojas
- Sistema de autenticación de Google

---

### 3. Módulo Compartido (`src/shared/`)

**Propósito**: Código compartido entre los módulos web y cosecha.

**Contenido**:
- Tipos TypeScript comunes
- Utilidades compartidas
- Constantes y mapeos

**Beneficios**:
- Evita duplicación de código
- Mantiene consistencia de tipos
- Facilita mantenimiento

---

## Separación de Responsabilidades

### Aplicativo Web
- ✅ Consulta directa al portal Univalle
- ✅ No requiere Google Sheets
- ✅ Funciona de forma independiente
- ✅ Puede desplegarse como aplicación standalone

### Sistema de Cosecha
- ✅ Lee desde múltiples Google Sheets
- ✅ Procesa y normaliza datos
- ✅ Escribe en hojas de consolidación
- ✅ Puede ejecutarse como jobs/tareas programadas
- ✅ Puede integrarse con el web como fuente de datos alternativa (fallback)

---

## Flujo de Datos

### Flujo del Aplicativo Web

```
Usuario → Frontend → API Route → Portal Univalle
                              ↓
                         Procesamiento
                              ↓
                         Visualización
```

### Flujo del Sistema de Cosecha

```
Google Sheets → Extractor → Procesador → Normalizador
                                          ↓
                                    Consolidador
                                          ↓
                                    Google Sheets (General)
```

### Integración (Opcional)

```
Aplicativo Web → API → [Portal Univalle] (primario)
                      ↓ (fallback)
                 [Sistema de Cosecha] → Google Sheets
```

---

## Configuración de Entorno

### Variables de Entorno Necesarias

```env
# Portal Univalle
UNIVALLE_PORTAL_URL=https://proxse26.univalle.edu.co/asignacion

# Google Sheets (para cosecha)
GOOGLE_SHEETS_PRINCIPAL_ID=1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg
GOOGLE_SHEETS_DOCENTES_ID=1mvCj-5ELwLW14-BwPhw06vneFsKb_dPDI4JuSyQeFZA

# Google API (para cosecha)
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Cache (opcional)
REDIS_URL=redis://localhost:6379
CACHE_TTL=1800

# Vercel (deployment)
VERCEL_URL=https://tu-app.vercel.app
```

---

## Estructura de Archivos de Configuración

### `package.json`
```json
{
  "name": "cosecha-global",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "harvest": "ts-node src/harvest/jobs/daily-harvest.ts",
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "axios": "^1.6.0",
    "cheerio": "^1.0.0",
    "googleapis": "^126.0.0"
  }
}
```

### `vercel.json`
```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "functions": {
    "src/harvest/jobs/*.ts": {
      "maxDuration": 300
    }
  }
}
```

---

## Buenas Prácticas Implementadas

### 1. Separación de Concerns
- ✅ Web y Cosecha completamente separados
- ✅ Código compartido en módulo dedicado
- ✅ Configuración centralizada

### 2. Escalabilidad
- ✅ Estructura modular fácil de extender
- ✅ Jobs independientes para tareas pesadas
- ✅ Cache para mejorar rendimiento

### 3. Mantenibilidad
- ✅ Tipos TypeScript para type safety
- ✅ Tests organizados por módulo
- ✅ Documentación clara

### 4. Deployment
- ✅ Web puede desplegarse independientemente
- ✅ Cosecha puede ejecutarse como servicio separado
- ✅ Configuración flexible para diferentes entornos

---

## Migración desde Apps Script

### Archivos Legacy

Los archivos originales de Google Apps Script se mantienen en `legacy/` como referencia:

- `searchState.gs` → `src/harvest/services/univalle-extractor.ts`
- `procesarAsignacionesAcademicas.gs` → `src/harvest/processors/periodo-processor.ts`
- `findDocentByPhone.html` → `src/web/app/page.tsx` + componentes
- `code.gs` → `src/web/app/api/` routes

### Mapeo de Funcionalidades

| Apps Script | Nuevo Módulo | Ubicación |
|------------|--------------|-----------|
| `extraerDatosDocenteUnivalle()` | `univalle-extractor.ts` | `src/harvest/services/` |
| `procesarPeriodoCompleto()` | `periodo-processor.ts` | `src/harvest/processors/` |
| `findDocentByPhone.html` | Componentes React | `src/web/components/` |
| `getUltimosPeriodos()` | API Route | `src/web/app/api/periodos/` |

---

## Próximos Pasos

1. ✅ Crear estructura de carpetas
2. ⏳ Migrar código del aplicativo web
3. ⏳ Migrar código del sistema de cosecha
4. ⏳ Configurar Google Sheets API
5. ⏳ Implementar tests
6. ⏳ Configurar deployment en Vercel

---

**Última actualización**: Enero 2025  
**Versión**: 1.0

