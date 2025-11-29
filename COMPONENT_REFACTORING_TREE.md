# Árbol de Componentes - PeriodView Refactorizado

## Estructura de Componentes

```
PeriodView (Principal - 18 líneas)
└── PeriodCardList
    └── PeriodCard (repetido por período)
        ├── ActividadesPorPeriodo
        │   ├── CategorySection (para cada categoría)
        │   │   ├── SubCategorySection (para pregrado/postgrado/tesis)
        │   │   │   └── ActivityTable
        │   │   └── ActivityTable (para otras categorías)
        │   └── EmptyState
        └── ErrorState
```

## Jerarquía de Componentes

### 1. PeriodView (Principal)
**Archivo**: `src/web/components/PeriodView.tsx`
**Líneas**: ~18
**Responsabilidad**: Orquestación principal
**Props**:
- `resultados: ResultadoBusqueda[]`
- `periodosNombres: Record<number, string>`

### 2. PeriodCardList
**Archivo**: `src/web/components/period-view/components/PeriodCardList.tsx`
**Líneas**: ~50
**Responsabilidad**: Mapear resultados a tarjetas de período
**Props**:
- `resultados: ResultadoBusqueda[]`
- `periodosNombres: Record<number, string>`

### 3. PeriodCard
**Archivo**: `src/web/components/period-view/components/PeriodCard.tsx`
**Líneas**: ~60
**Responsabilidad**: Tarjeta individual de período con colapso
**Props**:
- `periodo: number`
- `periodoLabel: string`
- `datos?: DatosDocente`
- `error?: string`
**Hooks usados**:
- `useCollapsibleState()`
- `usePeriodHours()`

### 4. ActividadesPorPeriodo
**Archivo**: `src/web/components/period-view/components/ActividadesPorPeriodo.tsx`
**Líneas**: ~120
**Responsabilidad**: Mostrar todas las categorías de actividades
**Props**:
- `datos: DatosDocente`
**Hooks usados**:
- `useCollapsibleState()` (múltiples instancias)

### 5. CategorySection
**Archivo**: `src/web/components/period-view/components/CategorySection.tsx`
**Líneas**: ~25
**Responsabilidad**: Sección colapsable genérica
**Props**:
- `titulo: string`
- `collapsed: boolean`
- `onToggle: () => void`
- `children: React.ReactNode`
**Optimización**: `React.memo`

### 6. SubCategorySection
**Archivo**: `src/web/components/period-view/components/SubCategorySection.tsx`
**Líneas**: ~45
**Responsabilidad**: Subcategoría con cálculo de horas
**Props**:
- `titulo: string`
- `actividades: any[]`
- `tipoActividad: string`
**Hooks usados**:
- `useCollapsibleState()`
**Utils usados**:
- `calcularTotalHoras()`
- `formatearHoras()`
**Optimización**: `React.memo`

## Hooks Personalizados

### 1. useCollapsibleState
**Archivo**: `src/web/components/period-view/hooks/useCollapsibleState.ts`
**Líneas**: ~30
**Responsabilidad**: Manejo de estado colapsable
**Retorna**:
```typescript
{
  collapsed: boolean;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  setCollapsed: (value: boolean) => void;
}
```

### 2. usePeriodHours
**Archivo**: `src/web/components/period-view/hooks/usePeriodHours.ts`
**Líneas**: ~50
**Responsabilidad**: Calcular horas totales de un período
**Parámetros**:
- `datos?: DatosDocente`
**Retorna**: `number`
**Optimización**: `useMemo` para evitar recálculos

## Utilidades

### 1. hours-calculator.ts
**Archivo**: `src/web/components/period-view/utils/hours-calculator.ts`
**Funciones**:
- `calcularTotalHoras(actividades: any[]): number`
- `formatearHoras(horas: number): string`

### 2. activity-helpers.ts
**Archivo**: `src/web/components/period-view/utils/activity-helpers.ts`
**Funciones**:
- `tieneDocencia(datos?: DatosDocente): boolean`
- `tieneAlgunaActividad(datos?: DatosDocente): boolean`

## Props Flow

```
PeriodView
  └─> resultados: ResultadoBusqueda[]
      └─> periodosNombres: Record<number, string>
          └─> PeriodCardList
              └─> PeriodCard (por cada resultado)
                  ├─> periodo: number
                  ├─> periodoLabel: string
                  ├─> datos?: DatosDocente
                  └─> error?: string
                      └─> ActividadesPorPeriodo
                          └─> datos: DatosDocente
                              └─> CategorySection / SubCategorySection
                                  └─> ActivityTable
```

## Optimizaciones Aplicadas

1. **React.memo**: Todos los componentes principales memorizados
2. **useMemo**: Cálculos costosos memorizados
3. **Hooks personalizados**: Lógica de estado reutilizable
4. **Componentes pequeños**: Cada componente < 150 líneas
5. **Separación de concerns**: Lógica separada de presentación

## Métricas de Mejora

### Antes
- **Líneas totales**: 331 en un archivo
- **Componentes**: 4 funciones anidadas
- **Estado**: 7+ useState dispersos
- **Cálculos**: Repetidos en cada render

### Después
- **Archivo principal**: ~18 líneas
- **Sub-componentes**: 6 componentes separados
- **Hooks**: 2 hooks reutilizables
- **Utils**: 2 módulos de utilidades
- **Optimización**: React.memo y useMemo aplicados

## Compatibilidad

✅ **100% Compatible**: 
- Props del componente padre mantenidas
- Comportamiento visual idéntico
- Eventos y callbacks preservados

