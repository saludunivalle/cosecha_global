# Módulo de Cosecha - Sistema de Extracción y Procesamiento

Este módulo contiene el sistema de cosecha de datos desde múltiples fuentes (Google Sheets).

## Componentes

- **Extractores**: Obtienen datos desde Google Sheets
- **Procesadores**: Normalizan y estructuran datos
- **Consolidadores**: Agrupan datos en hojas de consolidación
- **Jobs**: Tareas programadas para procesamiento automático

## Características

- ✅ Lee desde múltiples Google Sheets
- ✅ Procesa y normaliza datos
- ✅ Escribe en hojas de consolidación
- ✅ Puede ejecutarse como jobs/tareas programadas

## Estructura

- `services/` - Servicios de extracción
- `processors/` - Procesadores de datos
- `consolidators/` - Consolidadores
- `sheets/` - Integración con Google Sheets API
- `config/` - Configuración y constantes
- `jobs/` - Tareas programadas

## Dependencias

Requiere configuración de Google Sheets API y credenciales.

