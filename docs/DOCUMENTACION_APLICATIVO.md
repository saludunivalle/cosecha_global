# Documentación del Aplicativo de Gestión de Asignaciones Académicas

## Descripción General del Aplicativo

Este aplicativo es un sistema de gestión de asignaciones académicas desarrollado en Google Apps Script para la Universidad del Valle. Su propósito principal es:

1. **Extraer datos de docentes** desde el portal web de Univalle (proxse26.univalle.edu.co)
2. **Procesar y normalizar** información de asignaciones académicas por períodos
3. **Consultar y visualizar** actividades de docentes (pregrado, postgrado, investigación, extensión, etc.)
4. **Gestionar períodos académicos** y consolidar datos
5. **Generar reportes** y consolidaciones de asignaciones

El sistema utiliza Google Sheets como base de datos y proporciona interfaces HTML para la interacción con los usuarios.

---

## Arquitectura del Sistema

### Componentes Principales:

1. **Extracción de Datos Web**: Conecta con el portal de Univalle para obtener información de docentes
2. **Sistema de Fallback**: Utiliza Google Sheets como respaldo cuando falla la extracción web
3. **Procesamiento de Datos**: Normaliza y estructura la información de asignaciones
4. **Interfaces de Usuario**: Múltiples interfaces HTML para diferentes funcionalidades
5. **Gestión de Períodos**: Maneja períodos académicos y sus asignaciones

---

## Descripción Detallada de Archivos

### Archivos de Lógica Principal

#### 1. `searchState.gs` (1,561 líneas)
**Propósito**: Archivo principal de extracción y procesamiento de datos de docentes.

**Funcionalidades principales**:
- **Extracción Web**: `extraerDatosDocenteUnivalle()` - Extrae datos desde el portal de Univalle usando cookies de autenticación
- **Sistema de Fallback Optimizado**: `buscarDocenteOptimizado()` - Busca datos en Google Sheets cuando falla la extracción web
- **Procesamiento Automático**: `procesarDatosAutomaticamente()` - Procesa múltiples docentes y períodos automáticamente
- **Gestión de Períodos**: `getUltimosNPeriodosDesdePortal()` - Obtiene los últimos N períodos disponibles desde el portal
- **Cache Optimizado**: Sistema de cache para mejorar rendimiento (30 minutos de duración)
- **Procesamiento HTML**: `procesarHTML()` - Parsea y estructura datos desde HTML del portal
- **Clasificación de Actividades**: Clasifica automáticamente entre pregrado/postgrado/tesis
- **Guardado en Sheets**: `guardarResultadosEnSheet()` - Guarda resultados organizados por período

**Tipos de actividades procesadas**:
- Docencia (Pregrado, Postgrado, Dirección de Tesis)
- Investigación
- Extensión
- Actividades Intelectuales o Artísticas
- Actividades Administrativas
- Actividades Complementarias
- Docente en Comisión

**Características especiales**:
- Sistema de autenticación con cookies (PHPSESSID y asigacad)
- Manejo de errores robusto con fallback automático
- Cache de metadatos y datos de docentes
- Triggers automáticos (diario y cada 8 horas)

---

#### 2. `procesarAsignacionesAcademicas.gs` (519 líneas)
**Propósito**: Procesa y normaliza asignaciones académicas completas por período.

**Funcionalidades principales**:
- **Procesamiento de Período Completo**: `procesarPeriodoCompleto()` - Procesa un período completo de asignaciones
- **Obtención de Hoja Limpia**: `obtenerHojaLimpia()` - Crea o limpia hojas de períodos con encabezados estandarizados
- **Listado de Docentes**: `obtenerListadoDocentes()` - Lee cédulas desde hojas de docentes por período
- **Procesamiento por Docente**: `procesarDocenteAA()` - Procesa todas las actividades de un docente
- **Normalización de Datos**: `construirFilaAsignacion()` - Crea filas normalizadas con formato estándar
- **Inserción Masiva**: `insertarFilasEnHoja()` - Inserta múltiples filas de manera eficiente

**Estructura de datos procesada**:
- Información personal del docente (cédula, nombre, escuela, departamento)
- Actividades de docencia (pregrado, postgrado, tesis)
- Actividades de investigación
- Actividades de extensión
- Actividades intelectuales
- Actividades administrativas
- Actividades complementarias
- Docente en comisión

**Encabezados estándar**:
```
Cedula, Nombre Profesor, Escuela, Departamento, Tipo de Actividad, 
Categoría, Nombre de actividad, Número de horas, id, Período, 
Porcentaje horas, Detalle actividad, Actividad, Vinculación, 
Dedicación, Nivel, Cargo
```

---

#### 3. `code.gs` (424 líneas)
**Propósito**: Lógica principal de la aplicación web y gestión de asignaciones.

**Funcionalidades principales**:
- **Punto de Entrada Web**: `doGet()` - Crea la interfaz HTML principal
- **Verificación de Permisos**: `verificarPermiso()` - Valida acceso basado en correo electrónico
- **Gestión de Usuarios**: `getUsuarioYEscuela()` - Obtiene información del usuario activo
- **Gestión de Períodos**: `getPeriodoActivo()`, `getPeriodos()` - Maneja períodos académicos
- **CRUD de Asignaciones**:
  - `enviarDatos()` - Crea nuevas asignaciones
  - `obtenerDatosAsignaciones2024()` - Lee asignaciones filtradas
  - `editarAsignacion()` - Actualiza asignaciones existentes
  - `eliminarAsignacion()` - Elimina asignaciones
- **Filtrado de Datos**: `filtrarAsignacionesPorPeriodoProfesorYActividad()` - Filtra por múltiples criterios
- **Gestión de Profesores**: `getProfesores()` - Obtiene lista de profesores según permisos

**Características de seguridad**:
- Validación de permisos por correo electrónico
- Restricción de acceso por escuela/departamento
- Validación de datos antes de guardar

---

#### 4. `main.gs`
**Propósito**: Funciones principales de procesamiento y normalización de datos.

**Funcionalidades principales**:
- **Conversión de Archivos**: `convertXmlsFiles()` - Convierte archivos .xlsx a Google Sheets
- **Normalización de Datos**: `listFolderDrive()` - Procesa carpetas de Drive y normaliza datos
- **Generación de Hojas**: `generateSheetGeneral()` - Genera hojas consolidadas
- **Opciones de Archivos**: `getFilesOptions()` - Lista archivos disponibles en Drive

**Tipos de archivos soportados**:
- Archivos Excel (.xlsx) que se convierten a Google Sheets
- Hojas de Google Sheets existentes
- Estructura de carpetas en Google Drive

---

#### 5. `menu.gs` (51 líneas)
**Propósito**: Define el menú de la aplicación en Google Sheets.

**Funcionalidades**:
- **Menú Principal**: `onOpen()` - Crea menú "Automatizacion" con opciones:
  - Asignaciones Academicas
  - Encontrar Docentes
  - Actualizar datos
  - Agregar un nuevo periodo a General
  - Encontrar Docente (búsqueda avanzada)
- **Apertura de Modales**: Funciones para abrir diferentes interfaces HTML

**Opciones del menú**:
1. `modalOptionsPrint()` - Muestra opciones de asignaciones
2. `modalOptionsPrintDocents()` - Muestra opciones de docentes
3. `mergueModalOptionsPrint()` - Actualización de datos
4. `mergueModalOptionsPrintGeneral()` - Agregar período a General
5. `findMergueModalDocent()` - Búsqueda avanzada de docentes

---

#### 6. `generalReports.gs` (47 líneas)
**Propósito**: Procesamiento de opciones generales y consolidación de datos.

**Funcionalidades principales**:
- **Procesamiento de Opciones**: `processOptionGeneral()` - Procesa selección de hojas y consolida datos
- **Inserción de Valores**: `insertValues()` - Inserta datos en hojas de manera eficiente

**Flujo de trabajo**:
1. Selecciona una hoja de origen (por nombre)
2. Obtiene todos los datos (excluyendo encabezados)
3. Inserta los datos en la hoja "General"
4. Agrega filas automáticamente si es necesario

---

#### 7. `optionsDocents.gs` (33 líneas)
**Propósito**: Gestión de opciones relacionadas con docentes.

**Funcionalidades principales**:
- **Listado de Hojas de Docentes**: `getAllSheetNames()` - Obtiene todas las hojas que contienen "docentes" en el nombre
- **Listado de Hojas No-Docentes**: `getAllSheetNoDocents()` - Obtiene hojas que NO contienen "docentes"
- **Procesamiento de Opciones**: `processOptionDocente()` - Procesa la selección de una hoja de docentes

**Uso**: Utilizado por las interfaces modales para mostrar opciones disponibles al usuario.

---

### Archivos de Constantes y Configuración

#### 8. `const.gs` (156 líneas)
**Propósito**: Define constantes, mapeos y configuraciones del sistema.

**Contenido principal**:
- **Archivos Disponibles**: `avalaibleFiles` - Lista de nombres de archivos/hojas válidos
- **Archivos XML**: `avalaibleFilesXml` - Lista de archivos Excel válidos
- **Mapeo de Actividades**: `activityNames` - Mapea códigos de archivos a nombres de actividades
- **Mapeo de Categorías**: `categoryName` - Define qué columna usar para categoría en cada tipo
- **Encabezados Normalizados**: `headsNormalize` - Estructura estándar de columnas
- **Encabezados General**: `headGeneralSheet` - Encabezados para hoja General
- **Mapeo de Escuelas**: `namesSchool` - Normaliza nombres de escuelas
- **Mapeo de Departamentos**: `namesDepartament` - Normaliza nombres de departamentos
- **Mapeo Escuela-Departamento**: `namesOfSchool` - Relaciona departamentos con escuelas

**Ejemplos de mapeos**:
- `z_01_SALUD_PREGRADO` → "Pregrado"
- `z_02_SALUD_POSGRADO` → "Posgrado"
- `z_03_SALUD_TESIS` → "Tesis"
- `BACTERIOLOGIA` → "Bacteriología y Lab. Clínico"

---

### Archivos de Interfaz HTML

#### 9. `findDocentByPhone.html` (2,162 líneas)
**Propósito**: Interfaz principal de búsqueda y visualización de docentes.

**Funcionalidades**:
- **Búsqueda por Cédula**: Campo de entrada para buscar docente por cédula
- **Visualización de Información Personal**: Muestra datos del docente (nombre, cédula, escuela, vinculación, categoría, etc.)
- **Visualización de Actividades**: Muestra todas las actividades del docente organizadas por:
  - Período (vista por período)
  - Actividad (vista por tipo de actividad)
- **Vista Dual**: Toggle para cambiar entre vista por período y vista por actividad
- **Carga de Múltiples Períodos**: Consulta automáticamente los últimos 8 períodos
- **Tablas Interactivas**: Tablas con acordeones colapsables para organizar información
- **Cálculo de Totales**: Muestra totales de horas por período, categoría y actividad

**Características de UI**:
- Diseño responsive con Bootstrap
- Colores institucionales (rojo Univalle)
- Animaciones y transiciones suaves
- Badges para totales de horas
- Tablas con encabezados fijos

**Estructura de datos mostrada**:
- Información personal del docente
- Actividades de docencia (pregrado, postgrado, tesis)
- Actividades de investigación
- Actividades de extensión
- Actividades intelectuales
- Actividades administrativas
- Actividades complementarias
- Docente en comisión

---

#### 10. `MergueGeneral.html` (169 líneas)
**Propósito**: Interfaz para agregar un nuevo período a la hoja General.

**Funcionalidades**:
- **Carga de Opciones**: Muestra lista de hojas disponibles (excluyendo "Docentes")
- **Selección de Hoja**: Botones para seleccionar qué hoja agregar a General
- **Procesamiento**: Llama a `processOptionGeneral()` para consolidar datos
- **Feedback Visual**: Muestra mensaje de éxito/error al completar

**Flujo**:
1. Carga lista de hojas (no docentes)
2. Usuario selecciona una hoja
3. Se procesa y agrega a General
4. Muestra confirmación

---

#### 11. `MergueModalOptions.html` (198 líneas)
**Propósito**: Interfaz para actualizar datos de docentes.

**Funcionalidades**:
- **Selección en Dos Pasos**:
  1. Primero selecciona hoja de docentes
  2. Luego selecciona hoja destino (no docentes)
- **Actualización de Datos**: Llama a `updateDataTeachers()` para actualizar información
- **Interfaz Anidada**: Muestra opciones secundarias después de la primera selección

**Flujo**:
1. Carga hojas de docentes
2. Usuario selecciona hoja de docentes
3. Carga hojas destino (no docentes)
4. Usuario selecciona hoja destino
5. Se actualizan los datos

---

#### 12. `docentModalOptions.html` (171 líneas)
**Propósito**: Interfaz para procesar asignaciones académicas de docentes.

**Funcionalidades**:
- **Listado de Hojas de Docentes**: Muestra todas las hojas que contienen "docentes"
- **Procesamiento**: Llama a `processOptionDocente()` para crear asignaciones académicas
- **Feedback**: Muestra mensaje de éxito/error

**Uso**: Permite seleccionar una hoja de docentes y procesar sus asignaciones académicas automáticamente.

---

### Archivos Adicionales (Referenciados pero no leídos completamente)

#### 13. `sheet.gs`
**Propósito**: Funciones de utilidad para trabajar con Google Sheets.

#### 14. `sheetGeneral.gs`
**Propósito**: Funciones específicas para la hoja General.

#### 15. `utils.gs`
**Propósito**: Funciones de utilidad generales.

#### 16. `drive.gs`
**Propósito**: Funciones para trabajar con Google Drive.

#### 17. `fetch.gs`
**Propósito**: Funciones para realizar peticiones HTTP.

#### 18. `modalOptions.html`
**Propósito**: Interfaz modal para opciones de asignaciones.

#### 19. `formulatio.html`
**Propósito**: Formulario para entrada de datos.

---

## Flujos de Trabajo Principales

### 1. Extracción y Procesamiento de Datos de Docentes

```
1. Usuario ejecuta procesamiento automático o manual
2. Sistema obtiene cookies de autenticación desde Google Sheets
3. Para cada docente y período:
   a. Intenta extraer datos desde portal web de Univalle
   b. Si falla, usa sistema de fallback desde Google Sheets
   c. Procesa y normaliza los datos
   d. Clasifica actividades (pregrado/postgrado/tesis)
4. Guarda resultados en hojas organizadas por período
5. Crea/actualiza hoja de resumen general
```

### 2. Búsqueda y Visualización de Docentes

```
1. Usuario abre interfaz "Encontrar Docente"
2. Ingresa cédula del docente
3. Sistema consulta datos para los últimos 8 períodos
4. Muestra información personal del docente
5. Organiza actividades según vista seleccionada:
   - Por período: Agrupa todo por período académico
   - Por actividad: Agrupa por tipo de actividad
6. Calcula y muestra totales de horas
```

### 3. Procesamiento de Período Completo

```
1. Usuario ejecuta procesamiento de período
2. Sistema obtiene lista de docentes desde hoja "Docentes YYYY-N"
3. Para cada docente:
   a. Extrae datos desde portal o fallback
   b. Procesa todas las actividades
   c. Normaliza a formato estándar
4. Crea/limpia hoja del período
5. Inserta todas las filas normalizadas
6. Retorna resumen de procesamiento
```

### 4. Consolidación de Datos en General

```
1. Usuario selecciona "Agregar período a General"
2. Sistema muestra hojas disponibles (no docentes)
3. Usuario selecciona una hoja
4. Sistema lee todos los datos (sin encabezados)
5. Inserta datos en hoja "General"
6. Agrega filas automáticamente si es necesario
```

---

## Estructura de Datos

### Información Personal del Docente
```javascript
{
  CEDULA: "1112966620",
  NOMBRES: "Juan",
  PRIMER APELLIDO: "Pérez",
  SEGUNDO APELLIDO: "García",
  ESCUELA: "Medicina",
  DEPARTAMENTO: "Medicina Interna",
  CATEGORIA: "Asociado",
  VINCULACION: "Tiempo Completo",
  DEDICACION: "40 horas",
  NIVEL: "Doctorado",
  CARGO: "Profesor"
}
```

### Actividades de Docencia
```javascript
{
  pregrado: [
    {
      CODIGO: "1234",
      GRUPO: "01",
      TIPO: "Teoría",
      NOMBRE DE ASIGNATURA: "Anatomía",
      CRED: "3",
      PORC: "100%",
      FREC: "Semanal",
      INTEN: "3 horas",
      HORAS SEMESTRE: "48"
    }
  ],
  postgrado: [...],
  direccionTesis: [
    {
      CODIGO ESTUDIANTE: "123456",
      COD PLAN: "MA001",
      TITULO DE LA TESIS: "Investigación sobre...",
      HORAS SEMESTRE: "32"
    }
  ]
}
```

### Otras Actividades
- Investigación: Proyectos y anteproyectos
- Extensión: Actividades de extensión universitaria
- Intelectuales: Publicaciones, patentes, etc.
- Administrativas: Cargos administrativos
- Complementarias: Participaciones en eventos
- Comisión: Docente en comisión

---

## Configuración y Dependencias

### IDs de Google Sheets
- `SHEET_DOCENTES_ID`: "1mvCj-5ELwLW14-BwPhw06vneFsKb_dPDI4JuSyQeFZA"
- `SHEET_PRINCIPAL_ID`: "1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg"

### URLs del Portal
- Portal de Univalle: `https://proxse26.univalle.edu.co/asignacion/`
- Endpoint de datos: `vin_inicio_impresion.php3`
- Endpoint de períodos: `vin_docente.php3`

### Autenticación
- Cookies requeridas: `PHPSESSID` y `asigacad`
- Almacenamiento: Hoja "Cookies" o "Siac Cookies" en Google Sheets
- Formato: Timestamp, PHPSESSID, asigacad

### Triggers Automáticos
- Diario: `triggerDiarioAutomatico()`
- Cada 8 horas: `triggerCada8Horas()`

---

## Migración a Next.js/React (✅ COMPLETADA - Enero 2025)

### Estado de la Migración

**✅ COMPLETADO**: El módulo web ha sido migrado exitosamente de Google Apps Script a Next.js/React.

### Cambios Implementados:

1. **✅ Reemplazo de Google Apps Script APIs**:
   - `SpreadsheetApp` → Google Sheets API v4 (opcional, para cookies)
   - `UrlFetchApp` → `fetch` nativo de Node.js
   - `HtmlService` → Next.js/React con componentes modulares
   - `Logger` → `console.log` con mejor logging estructurado

2. **✅ Autenticación**:
   - **Cookies ya NO son requeridas** - El portal Univalle permite acceso público
   - Sistema de cookies opcional implementado en `src/web/lib/sheets-cookies.ts`
   - Soporte para obtener cookies desde Google Sheets o variables de entorno

3. **✅ Almacenamiento**:
   - No requiere almacenamiento - datos obtenidos directamente del portal
   - Google Sheets solo se usa opcionalmente para cookies
   - Estructura de datos mantenida (mismos tipos y formatos)

4. **✅ Interfaces HTML**:
   - `findDocentByPhone.html` → Componentes React en `src/web/components/`
   - Funcionalidad y diseño mantenidos
   - Llamadas adaptadas a API Routes de Next.js

5. **✅ Funciones Serverless**:
   - Funciones convertidas a API Routes en `app/api/`
   - Endpoints: `/api/periodos` y `/api/docente/[cedula]`
   - Procesamiento en paralelo implementado

6. **✅ Web Scraping**:
   - Extracción directa desde portal Univalle
   - Parser HTML robusto en `src/web/lib/html-parser.ts`
   - Sin requerir autenticación (acceso público)

7. **✅ Procesamiento**:
   - Procesamiento en paralelo de múltiples períodos
   - Manejo de errores mejorado
   - TypeScript para type safety

### Archivos Migrados

| Apps Script Original | Nuevo Módulo Next.js | Estado |
|---------------------|---------------------|--------|
| `findDocentByPhone.html` | `app/page.tsx` + `src/web/components/` | ✅ Completado |
| `searchState.gs` → `extraerDatosDocenteUnivalle()` | `src/web/lib/univalle-api.ts` | ✅ Completado |
| `searchState.gs` → `procesarHTML()` | `src/web/lib/html-parser.ts` | ✅ Completado |
| `searchState.gs` → `getUltimosPeriodos()` | `app/api/periodos/route.ts` | ✅ Completado |
| `searchState.gs` → `getCookiesFromSheet()` | `src/web/lib/sheets-cookies.ts` | ✅ Completado (opcional) |

### Mejoras Implementadas

- ⚡ **Rendimiento**: Procesamiento en paralelo de períodos
- 🔒 **Type Safety**: TypeScript en todo el código
- 📦 **Modularidad**: Componentes React reutilizables
- 🎨 **Organización**: Estructura clara y mantenible
- 🚀 **Escalabilidad**: Fácil de extender y mejorar
- 🔓 **Sin Autenticación**: No requiere cookies (acceso público)

### Próximos Pasos (Opcional)

1. **Sistema de Cache**:
   - Implementar Redis o similar para cachear respuestas
   - Reducir llamadas al portal
   - Mejorar tiempos de respuesta

2. **Procesamiento Asíncrono**:
   - Usar colas (Bull, RabbitMQ) para procesamiento masivo
   - Implementar webhooks para notificaciones
   - Background jobs para actualizaciones automáticas

3. **Mejoras de UI**:
   - Agregar filtros avanzados
   - Exportar datos a Excel/PDF
   - Gráficos y visualizaciones

---

## Notas Finales

- El sistema está diseñado para manejar grandes volúmenes de datos
- El sistema de fallback asegura disponibilidad incluso si el portal falla
- Las interfaces están optimizadas para uso en dispositivos móviles
- El código incluye extenso logging para debugging
- Se recomienda mantener la estructura modular al migrar

---

---

## Estado Actual del Proyecto (Enero 2025)

### ✅ Migración Completada

El módulo web ha sido migrado exitosamente a Next.js/React:
- **Frontend**: React/Next.js con componentes modulares
- **Backend**: API Routes de Next.js
- **Web Scraping**: Funcional sin requerir autenticación
- **Parser HTML**: Migrado y mejorado
- **Interfaz**: Mantiene diseño original con mejor organización

### 📍 Ubicación del Código Migrado

- **Frontend**: `app/page.tsx`, `src/web/components/`
- **Backend**: `app/api/`, `src/web/lib/`
- **Estilos**: `app/styles/globals.css`
- **Tipos**: `src/shared/types/`

### 🔧 Configuración Actual

- **Sin cookies requeridas**: El portal permite acceso público
- **Variables de entorno opcionales**: Solo para cookies adicionales
- **Procesamiento en paralelo**: Múltiples períodos consultados simultáneamente

---

**Última actualización**: Enero 2025  
**Versión**: 2.0 (Migración a Next.js completada)  
**Autor**: Sistema de Gestión de Asignaciones Académicas - Universidad del Valle

