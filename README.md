# Sistema de Gestión de Asignaciones Académicas

Sistema para la gestión y consulta de asignaciones académicas de docentes de la Universidad del Valle.

## 🎯 Funcionalidades

### 1. Aplicativo Web
- Búsqueda de docentes por cédula
- Visualización de asignaciones académicas
- Consulta de múltiples períodos académicos
- Vistas organizadas por período o por actividad

### 2. Sistema de Cosecha
- Extracción automática de datos desde Google Sheets
- Procesamiento y normalización de información
- Consolidación de datos por período
- Generación de reportes

## 📁 Estructura del Proyecto

```
cosecha_global/
├── src/
│   ├── web/              # Aplicativo web (Next.js/React)
│   ├── harvest/          # Sistema de cosecha de datos
│   ├── shared/           # Código compartido
│   └── api/              # API Backend
├── docs/                 # Documentación
├── scripts/              # Scripts de utilidad
├── public/               # Archivos estáticos
└── legacy/               # Código legacy de Apps Script
```

Ver [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) para más detalles.

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+ 
- npm o yarn

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example.txt .env
# Editar .env con tus credenciales
# Ver docs/CONFIGURACION_GOOGLE_SHEETS.md para configurar Google Sheets API

# Ejecutar en desarrollo
npm run dev
```

### Desarrollo

```bash
# Aplicativo web
npm run dev

# Sistema de cosecha (si se ejecuta independientemente)
npm run harvest
```

## 📚 Documentación

- [Documentación Completa](./docs/DOCUMENTACION_APLICATIVO.md)
- [Instrucciones del Aplicativo Web](./docs/Intrucciones_AsignacionesAcademicas.md)
- [Configuración de Google Sheets API](./docs/CONFIGURACION_GOOGLE_SHEETS.md)
- [Configuración de Cookies](./docs/CONFIGURACION_COOKIES.md)
- [Estructura del Proyecto](./ESTRUCTURA_PROYECTO.md)

## 🔧 Configuración

- Ver `env.example.txt` para las variables de entorno necesarias
- Ver [Configuración de Google Sheets API](./docs/CONFIGURACION_GOOGLE_SHEETS.md) para configurar la cuenta de servicio

## 📝 Notas

- ✅ **El aplicativo web funciona sin necesidad de autenticación con cookies** - El portal Univalle permite acceso público
- ✅ **Migración completada**: `findDocentByPhone.html` y `searchState.gs` migrados a Next.js/React
- ✅ **Web scraping funcional**: Extracción directa de datos desde el portal
- El sistema de cosecha requiere configuración de Google Sheets API
- Los archivos legacy se mantienen en `legacy/` como referencia

## 🆕 Cambios Recientes (Enero 2025)

### Migración a Next.js/React
- ✅ Migrado `findDocentByPhone.html` → Componentes React en `src/web/components/`
- ✅ Migrado `searchState.gs` → Servicios TypeScript en `src/web/lib/`
- ✅ API Routes creadas en `app/api/` para períodos y docentes
- ✅ Web scraping funcional sin requerir cookies de autenticación
- ✅ Parser HTML mejorado con mejor detección de errores
- ✅ Procesamiento en paralelo de múltiples períodos

### Funcionalidades Implementadas
- Búsqueda de docentes por cédula
- Visualización por período y por actividad
- Extracción de datos desde portal Univalle
- Procesamiento de múltiples períodos en paralelo
- Interfaz responsive con Bootstrap

## 📄 Licencia

ISC

