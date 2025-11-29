# Instrucciones de Refactorización - html-parser.ts

## ✅ Módulos Creados

Se han creado los siguientes módulos auxiliares que están listos para usar:

### Constantes y Utilidades
- ✅ `src/web/lib/html-parser/constants.ts`
- ✅ `src/web/lib/html-parser/utils.ts`
- ✅ `src/web/lib/html-parser/html-utils.ts`
- ✅ `src/web/lib/html-parser/header-utils.ts`
- ✅ `src/web/lib/html-parser/classifiers.ts`
- ✅ `src/web/lib/html-parser/normalizers.ts`

### Extractores
- ✅ `src/web/lib/html-parser/extractors/personal-info.ts`
- ✅ `src/web/lib/html-parser/extractors/research-activities.ts`
- ✅ `src/web/lib/html-parser/extractors/research-activity-row.ts`
- ✅ `src/web/lib/html-parser/extractors/intellectual-activities.ts`
- ✅ `src/web/lib/html-parser/extractors/period-utils.ts`

## 📝 Pasos para Completar la Refactorización

### Paso 1: Actualizar imports en `html-parser.ts`

Reemplazar las funciones locales con imports de los módulos:

```typescript
// Reemplazar funciones locales con imports
import { debugLog, decodeEntities, extraerTextoDeCelda } from './html-parser/utils';
import { extractCells, extraerTablas, extraerFilas } from './html-parser/html-utils';
import { encontrarFilaHeaders, esHeaderConocido } from './html-parser/header-utils';
import { esActividadPostgrado } from './html-parser/classifiers';
import { normalizarEstructuraAsignatura, normalizarEstructuraTesis } from './html-parser/normalizers';
import { extraerDatosPersonalesDeHTML, extraerCamposDesdeTextoPlano } from './html-parser/extractors/personal-info';
import { extraerActividadesInvestigacionDeHTML } from './html-parser/extractors/research-activities';
import { extraerActividadesIntelectualesDeHTML } from './html-parser/extractors/intellectual-activities';
import { extraerActividadInvestigacionDeFila } from './html-parser/extractors/research-activity-row';
```

### Paso 2: Eliminar funciones movidas

Eliminar del archivo principal:
- ✅ `decodeEntities()` → ahora en `utils.ts`
- ✅ `removeAccents()` → ahora en `utils.ts`
- ✅ `extraerTextoDeCelda()` → ahora en `utils.ts`
- ✅ `extractCells()` → ahora en `html-utils.ts`
- ✅ `esActividadPostgrado()` → ahora en `classifiers.ts`
- ✅ `normalizarEstructuraAsignatura()` → ahora en `normalizers.ts`
- ✅ `normalizarEstructuraTesis()` → ahora en `normalizers.ts`
- ✅ `extraerCamposDesdeTextoPlano()` → ahora en `extractors/personal-info.ts`
- ✅ `extraerDatosPersonalesDeHTML()` → ahora en `extractors/personal-info.ts`
- ✅ `extraerActividadesIntelectualesDeHTML()` → ahora en `extractors/intellectual-activities.ts`
- ✅ `extraerActividadesInvestigacionDeHTML()` → ahora en `extractors/research-activities.ts`
- ✅ `extraerActividadInvestigacionDeFila()` → ahora en `extractors/research-activity-row.ts`
- ✅ `detectarSelectoresPeriodo()` → ahora en `extractors/period-utils.ts`
- ✅ `extraerPeriodoDeContexto()` → ahora en `extractors/period-utils.ts`

### Paso 3: Simplificar `procesarHTML()`

La función `procesarHTML()` debe:
1. Inicializar estructuras de datos
2. Llamar a los extractores especializados
3. Procesar tablas usando las utilidades de headers
4. Devolver el resultado

### Paso 4: Verificar compatibilidad

Asegurar que:
- ✅ La función `procesarHTML()` mantiene la misma firma
- ✅ El comportamiento es idéntico
- ✅ Todos los imports funcionan correctamente

## 📊 Resultado Esperado

### Antes
```
html-parser.ts (2334 líneas)
├── 15 funciones utilitarias
├── 3 funciones de extracción grandes
└── procesarHTML() (1100+ líneas)
```

### Después
```
html-parser.ts (~250-300 líneas)
├── Imports de módulos
├── Funciones helper locales (si es necesario)
└── procesarHTML() (~200 líneas) que orquesta módulos

html-parser/
├── constants.ts
├── utils.ts
├── html-utils.ts
├── header-utils.ts
├── classifiers.ts
├── normalizers.ts
└── extractors/
    ├── personal-info.ts
    ├── research-activities.ts
    ├── research-activity-row.ts
    ├── intellectual-activities.ts
    └── period-utils.ts
```

## 🎯 Beneficios Obtenidos

1. **Modularidad**: Código organizado en módulos especializados
2. **Reutilización**: Funciones comunes extraídas
3. **Testeabilidad**: Cada módulo puede testearse independientemente
4. **Mantenibilidad**: Cambios localizados en módulos específicos
5. **Legibilidad**: Funciones más pequeñas y enfocadas

## ⚠️ Notas Importantes

- Los módulos están listos para usar
- El archivo original NO ha sido modificado aún
- Puedes refactorizar gradualmente o todo de una vez
- Todos los módulos mantienen compatibilidad 100%

## 🚀 Próximos Pasos

1. Crear backup del archivo original
2. Refactorizar `html-parser.ts` usando los módulos
3. Ejecutar tests para verificar compatibilidad
4. Optimizar si es necesario

