# Instrucciones - Aplicativo Web de Asignaciones Académicas

## Descripción General

El aplicativo web de **Asignaciones Académicas** es una aplicación que permite consultar y visualizar las actividades académicas de docentes de la Universidad del Valle mediante la introducción de su número de cédula.

### Funcionalidad Principal

La aplicación permite:
- **Buscar docentes por cédula**: El usuario introduce un número de cédula y el sistema consulta automáticamente los últimos 8 períodos académicos
- **Visualizar información completa**: Muestra información personal del docente y todas sus actividades académicas organizadas por período o por tipo de actividad
- **Extracción automática de datos**: Obtiene información directamente desde el portal de Univalle sin necesidad de autenticación previa

---

## Arquitectura del Sistema

### Componente Principal: `findDocentByPhone.html`

Este es el componente central de la aplicación web. Proporciona una interfaz de usuario completa para:

1. **Entrada de datos**: Campo de texto para ingresar la cédula del docente
2. **Procesamiento**: Consulta automática de múltiples períodos académicos
3. **Visualización**: Presentación organizada de toda la información del docente

### Flujo de Funcionamiento

```
Usuario ingresa cédula
    ↓
Sistema carga períodos disponibles desde portal
    ↓
Para cada período (últimos 8):
    ↓
    Extrae datos desde portal Univalle
    ↓
    Procesa y estructura información
    ↓
Consolida datos por categoría
    ↓
Renderiza información en interfaz
    ↓
Usuario puede alternar entre vistas:
    - Por Período
    - Por Actividad
```

---

## Extracción de Datos desde el Portal

### URL Base del Portal

**Endpoint principal**: `https://proxse26.univalle.edu.co/asignacion/vin_docente.php3`

**Endpoint de datos**: `https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3`

### Método de Extracción

#### 1. Obtención de Períodos Disponibles

El sistema consulta la página `vin_docente.php3` para obtener la lista de períodos académicos disponibles.

**Proceso**:
- Realiza una petición GET al endpoint
- Parsea el HTML para extraer las opciones del selector de períodos
- Extrae el `value` (ID numérico) y el texto visible de cada opción
- Normaliza el formato a `YYYY-N` (ejemplo: `2026-1`, `2025-2`)
- Ordena los períodos de más reciente a más antiguo
- Retorna los últimos N períodos (por defecto 8)

**Formato de respuesta**:
```javascript
[
  { idPeriod: 49, year: 2026, term: 1, label: '2026-1' },
  { idPeriod: 48, year: 2025, term: 2, label: '2025-2' },
  { idPeriod: 47, year: 2025, term: 1, label: '2025-1' },
  // ... más períodos
]
```

#### 2. Extracción de Datos del Docente

Para cada período, el sistema consulta:
```
https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3?cedula={CEDULA}&periodo={ID_PERIODO}
```

**Parámetros**:
- `cedula`: Número de cédula del docente (ejemplo: `1112966620`)
- `periodo`: ID numérico del período (ejemplo: `48`)

**Proceso de extracción**:
1. Realiza petición GET con los parámetros
2. Recibe HTML con tablas estructuradas
3. Parsea el HTML para extraer:
   - **Información personal**: Cédula, nombres, apellidos, escuela, departamento, categoría, vinculación, dedicación, nivel, cargo
   - **Actividades de docencia**:
     - Pregrado
     - Postgrado
     - Dirección de tesis
   - **Otras actividades**:
     - Investigación
     - Extensión
     - Intelectuales o artísticas
     - Administrativas
     - Complementarias
     - Docente en comisión

### Autenticación

**Estado actual**: El portal funciona **sin necesidad de cookies de autenticación**.

> **Nota histórica**: Anteriormente el sistema requería cookies `PHPSESSID` y `asigacad` para autenticarse. Actualmente estas cookies no son necesarias, pero el código mantiene compatibilidad con el sistema de fallback que las utiliza.

**Implementación actual**:
- Las peticiones se realizan sin headers de autenticación
- El portal responde directamente con los datos solicitados
- No se requiere sesión previa ni tokens

---

## Estructura de Datos Extraídos

### Información Personal del Docente

```javascript
{
  CEDULA: "1112966620",
  NOMBRES: "Juan",
  "1 APELLIDO": "Pérez",
  "2 APELLIDO": "García",
  ESCUELA: "Medicina",
  DEPARTAMENTO: "Medicina Interna",
  CATEGORIA: "Asociado",
  VINCULACION: "Tiempo Completo",
  DEDICACION: "40 horas",
  "NIVEL ALCANZADO": "Doctorado",
  CARGO: "Profesor"
}
```

### Actividades de Docencia

#### Pregrado y Postgrado
```javascript
{
  CODIGO: "1234",
  GRUPO: "01",
  TIPO: "Teoría",
  "NOMBRE DE ASIGNATURA": "Anatomía Humana",
  CRED: "3",
  PORC: "100%",
  FREC: "Semanal",
  INTEN: "3 horas",
  "HORAS SEMESTRE": "48"
}
```

#### Dirección de Tesis
```javascript
{
  "CODIGO ESTUDIANTE": "123456",
  "COD PLAN": "MA001",
  "TITULO DE LA TESIS": "Investigación sobre...",
  "HORAS SEMESTRE": "32"
}
```

### Otras Actividades

Cada tipo de actividad tiene su propia estructura de campos, pero todas incluyen:
- `HORAS SEMESTRE`: Número de horas asignadas
- Campos específicos según el tipo de actividad

---

## Procesamiento de Datos

### Normalización

El sistema normaliza los datos extraídos para:

1. **Estandarizar nombres de campos**: Convierte variaciones a nombres estándar
2. **Clasificar actividades**: Distingue automáticamente entre pregrado y postgrado
3. **Estructurar información**: Organiza datos en objetos JavaScript consistentes

### Clasificación Automática Pregrado/Postgrado

El sistema utiliza múltiples criterios para clasificar:

1. **Palabras clave explícitas**:
   - Postgrado: "MAESTRIA", "MAESTRÍA", "DOCTORADO", "ESPECIALIZA", "POSTGRADO"
   - Pregrado: "LICENCIATURA", "INGENIERIA", "BACHILLERATO"

2. **Códigos de asignatura**:
   - Códigos 7xxx, 8xxx, 9xxx → Postgrado
   - Códigos 1xxx-6xxx → Pregrado

3. **Análisis de nombre**: Busca palabras clave en el nombre de la asignatura

### Consolidación por Categoría

Los datos se consolidan en dos estructuras:

#### Por Período
```javascript
{
  periodo: 48,
  data: [{
    informacionPersonal: {...},
    actividadesDocencia: {...},
    actividadesInvestigacion: [...],
    // ... otras actividades
  }]
}
```

#### Por Categoría (para vista alternativa)
```javascript
{
  pregrado: {
    48: [...],  // Actividades del período 48
    47: [...],  // Actividades del período 47
    // ...
  },
  postgrado: {...},
  direccionTesis: {...},
  // ... otras categorías
}
```

---

## Interfaz de Usuario

### Componentes Principales

1. **Campo de búsqueda**: Input para ingresar cédula
2. **Tarjeta de información personal**: Muestra datos básicos del docente
3. **Switch de vista**: Alterna entre "Por Período" y "Por Actividad"
4. **Tablas de actividades**: Muestran información detallada organizada

### Vistas Disponibles

#### Vista por Período
- Organiza información por período académico
- Cada período muestra todas sus actividades agrupadas por tipo
- Muestra total de horas por período

#### Vista por Actividad
- Organiza información por tipo de actividad
- Cada tipo muestra actividades de todos los períodos
- Muestra total histórico de horas por actividad

### Características de la Interfaz

- **Diseño responsive**: Adaptable a diferentes tamaños de pantalla
- **Acordeones colapsables**: Permite expandir/contraer secciones
- **Cálculo automático de totales**: Suma horas por período, categoría y actividad
- **Badges informativos**: Muestran totales de manera visual
- **Animaciones suaves**: Mejora la experiencia de usuario

---

## Endpoints y Funciones Backend

### Funciones Principales (Google Apps Script)

#### `getUltimosPeriodos(n)`
Obtiene los últimos N períodos desde el portal.

**Parámetros**:
- `n`: Número de períodos a obtener (por defecto 8)

**Retorna**: Array de objetos `{idPeriod, year, term, label}`

#### `extraerDatosDocenteUnivalle(cedula, idPeriod)`
Extrae datos completos de un docente para un período específico.

**Parámetros**:
- `cedula`: Número de cédula del docente
- `idPeriod`: ID numérico del período

**Retorna**: Array con objeto estructurado:
```javascript
[{
  periodo: idPeriod,
  informacionPersonal: {...},
  actividadesDocencia: {
    pregrado: [...],
    postgrado: [...],
    direccionTesis: [...]
  },
  actividadesInvestigacion: [...],
  actividadesExtension: [...],
  actividadesIntelectualesOArtisticas: [...],
  actividadesAdministrativas: [...],
  actividadesComplementarias: [...],
  docenteEnComision: [...]
}]
```

### Flujo de Llamadas desde el Frontend

```javascript
// 1. Cargar períodos al iniciar
getUltimosPeriodos(8)
  → Retorna: [{idPeriod: 49, label: '2026-1'}, ...]

// 2. Para cada período, extraer datos
PERIODOS.forEach(periodo => {
  extraerDatosDocenteUnivalle(cedula, periodo)
    → Retorna: [{...datos completos...}]
})

// 3. Consolidar y renderizar
consolidarDatosPorCategoria(results)
  → Organiza datos para visualización
```

---

## Manejo de Errores

### Errores Comunes

1. **Cédula no encontrada**: El portal no retorna datos para la cédula
2. **Período sin datos**: El docente no tiene actividades en ese período
3. **Error de conexión**: No se puede conectar al portal
4. **HTML malformado**: El portal retorna HTML inesperado

### Estrategia de Fallback

El sistema implementa un fallback que:
- Si falla la extracción web, intenta obtener datos desde Google Sheets
- Mantiene cache de datos para mejorar rendimiento
- Muestra mensajes de error claros al usuario

---

## Consideraciones Técnicas

### Codificación de Caracteres

- El portal utiliza codificación **ISO-8859-1**
- Es importante especificar esta codificación al leer la respuesta
- Los caracteres especiales (ñ, acentos) se manejan correctamente

### Parsing de HTML

El sistema utiliza:
- Expresiones regulares para extraer datos de tablas HTML
- Normalización de entidades HTML (á, é, í, ó, ú, ñ)
- Limpieza de espacios y caracteres especiales

### Rendimiento

- **Consultas paralelas**: Se consultan múltiples períodos simultáneamente
- **Cache de períodos**: Los períodos se cargan una vez al inicio
- **Renderizado optimizado**: Solo se renderiza lo visible

---

## Migración a JavaScript/Vercel

### Cambios Necesarios

1. **Reemplazo de Google Apps Script**:
   - `google.script.run` → API REST endpoints
   - `UrlFetchApp.fetch` → `fetch` o `axios`
   - `HtmlService` → Framework web (React/Next.js)

2. **Estructura de API**:
   ```
   GET /api/periodos          → Obtener períodos disponibles
   GET /api/docente/:cedula   → Obtener datos del docente
   ```

3. **Autenticación**:
   - Actualmente no requiere autenticación
   - Mantener compatibilidad por si cambia en el futuro

4. **Almacenamiento**:
   - Considerar cache en Redis o similar
   - Mantener fallback a base de datos si es necesario

---

## Próximos Pasos de Desarrollo

1. **Eliminar dependencia de cookies**: Simplificar código de autenticación
2. **Mejorar manejo de errores**: Mensajes más descriptivos
3. **Optimizar rendimiento**: Implementar cache más agresivo
4. **Añadir filtros**: Permitir filtrar por tipo de actividad o período específico
5. **Exportar datos**: Permitir exportar información a Excel/PDF

---

## Referencias

- **Portal de Univalle**: https://proxse26.univalle.edu.co/asignacion/
- **Endpoint de períodos**: `vin_docente.php3`
- **Endpoint de datos**: `vin_inicio_impresion.php3`
- **Formato de períodos**: `YYYY-N` (ejemplo: `2026-1`, `2025-2`)

---

**Última actualización**: Enero 2025  
**Versión**: 1.0  
**Estado**: Funcional sin autenticación

