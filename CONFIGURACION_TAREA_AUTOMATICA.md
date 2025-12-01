# Configuración de Tarea Automática - Scraper Univalle

## Fecha: 2025-12-01 (Actualizado)

## 📋 Resumen

La tarea automática de GitHub Actions ahora está configurada para:
- ✅ Ejecutarse **9 veces al día** (un cron job por período)
- ✅ Cada período se procesa **independientemente** (jobs separados)
- ✅ Separación de **45 minutos** entre períodos
- ✅ Cada job tiene **límite de 40 minutos** (bajo el límite de 45 min de GitHub)
- ✅ Tiempo total estimado: **~6-7 horas** (desde 2:00 AM hasta ~9:00 AM)

---

## ⏰ Horario de Ejecución

### Inicio automático: 2:00 AM Colombia (7:00 AM UTC)

```yaml
schedule:
  - cron: '0 7 * * *'  # 2:00 AM hora Colombia = 7:00 AM UTC
```

---

## 📅 Períodos Procesados (Jobs Separados)

| # | Período | Hora Inicio (COT) | Hora UTC | Cron | Duración Estimada |
|---|---------|-------------------|----------|------|-------------------|
| 1 | 2026-1  | 2:00 AM          | 7:00 AM  | `0 7 * * *`   | 20-35 min |
| 2 | 2025-2  | 2:45 AM          | 7:45 AM  | `45 7 * * *`  | 20-35 min |
| 3 | 2025-1  | 3:30 AM          | 8:30 AM  | `30 8 * * *`  | 20-35 min |
| 4 | 2024-2  | 4:15 AM          | 9:15 AM  | `15 9 * * *`  | 20-35 min |
| 5 | 2024-1  | 5:00 AM          | 10:00 AM | `0 10 * * *`  | 20-35 min |
| 6 | 2023-2  | 5:45 AM          | 10:45 AM | `45 10 * * *` | 20-35 min |
| 7 | 2023-1  | 6:30 AM          | 11:30 AM | `30 11 * * *` | 20-35 min |
| 8 | 2022-2  | 7:15 AM          | 12:15 PM | `15 12 * * *` | 20-35 min |
| 9 | 2022-1  | 8:00 AM          | 1:00 PM  | `0 13 * * *`  | 20-35 min |

**Separación entre períodos:** 45 minutos  
**Finalización estimada:** 8:30-9:00 AM hora Colombia

---

## 🔄 Flujo de Ejecución

**Estrategia: Jobs Independientes (no secuenciales)**

```
2:00 AM → Job 1: Período 2026-1 ───► (20-35 min) ───► ✅
2:45 AM → Job 2: Período 2025-2 ───► (20-35 min) ───► ✅
3:30 AM → Job 3: Período 2025-1 ───► (20-35 min) ───► ✅
4:15 AM → Job 4: Período 2024-2 ───► (20-35 min) ───► ✅
5:00 AM → Job 5: Período 2024-1 ───► (20-35 min) ───► ✅
5:45 AM → Job 6: Período 2023-2 ───► (20-35 min) ───► ✅
6:30 AM → Job 7: Período 2023-1 ───► (20-35 min) ───► ✅
7:15 AM → Job 8: Período 2022-2 ───► (20-35 min) ───► ✅
8:00 AM → Job 9: Período 2022-1 ───► (20-35 min) ───► ✅

Cada job es INDEPENDIENTE:
- Si un job falla, los demás NO se ven afectados
- Cada job aparece como un "run" separado en GitHub Actions
- Los logs se guardan por separado
```

---

## 🎯 Características Principales

### 1. Jobs Independientes (NO Secuenciales)
- Cada período es un job separado con su propio cron
- Si un job falla, NO afecta a los demás
- Cada job bajo el límite de 45 minutos de GitHub Actions
- ✅ **SOLUCIÓN al problema de timeout de 45 minutos**

### 2. Separación Automática de 45 Minutos
- Jobs programados con cron separados
- No usa delays artificiales (sleep)
- Cada período se ejecuta a su hora programada
- GitHub Actions maneja la programación

### 3. Manejo de Errores Robusto
- Si un período falla, los demás siguen ejecutándose
- Logs separados por período (artifacts)
- Fácil identificar qué período falló
- Re-ejecutar solo el período problemático

### 4. Logs Separados por Período
- Cada período genera su propio artifact
- Fácil búsqueda de errores específicos
- Retención de 7 días
- Nombre formato: `scraper-logs-PERIODO-RUN`

### 5. Ejecución Manual Flexible
- Procesar cualquier período individual
- Sin depender del horario automático
- Ideal para re-procesar o testing

---

## 🖥️ Ejecución Manual

### Desde GitHub Actions UI

Si quieres ejecutar **un solo período** manualmente:

1. Ve a: **Actions** → **Ejecutar Scraper Univalle** → **Run workflow**
2. Especifica parámetros:
   - **target_period**: Período a procesar (ej: `2026-1`)
   - **source_worksheet**: Hoja fuente (default: `2025-2`)
   - **source_column**: Columna de cédulas (default: `D`)
   - **delay_cedulas**: Segundos entre cédulas (default: `0.5`)

### Comportamiento en Modo Manual

En modo manual:
- ✅ Procesa **SOLO el período especificado**
- ✅ **NO espera** 40 minutos (ejecución inmediata)
- ✅ Ideal para probar o re-procesar un período específico

---

## 📊 Timeout y Límites

```yaml
jobs:
  scrape:
    timeout-minutes: 40  # Límite de 40 minutos por job
    steps:
      - name: Run scraper
        timeout-minutes: 38  # 38 min para scraper, 2 min para cleanup
```

**Por qué 40 minutos:**
- GitHub Actions tiene un límite de 45 minutos por job (en ciertos planes)
- Configuramos 40 minutos para tener margen de seguridad
- Duración típica por período: 20-35 minutos
- Margen de seguridad: 5-20 minutos

**Ventaja:** Cada período completa en <40 min, cumpliendo con el límite de 45 min de GitHub

---

## 📝 Variables de Entorno

### Configuración de Google Sheets (mejorada)

```yaml
SHEETS_READ_TIMEOUT: 60 segundos    # Timeout por request
SHEETS_MAX_RETRIES: 3               # Reintentos en caso de timeout
SHEETS_RETRY_DELAY: 5 segundos      # Delay entre reintentos
```

### Configuración de Scraper

```yaml
REQUEST_TIMEOUT: 30 segundos
REQUEST_MAX_RETRIES: 3
REQUEST_RETRY_DELAY: 2 segundos
```

---

## 🔍 Monitoreo

### Ver progreso en tiempo real

1. Ve a: **Actions** → última ejecución
2. Click en el job `scrape`
3. Expande el step **Run scraper for all periods**
4. Verás output en tiempo real con:
   - Período actual siendo procesado
   - Número de cédulas procesadas
   - Tiempo restante hasta siguiente período
   - Errores si los hay

### Ejemplo de output (un job individual)

```
==========================================================================
🚀 PROCESANDO PERÍODO: 2026-1
==========================================================================
   Hora inicio: 2025-12-01 07:00:15 UTC
   Hoja fuente: 2025-2
   Columna: D

✓ 38872843: 17 actividades extraídas
   [Keep-Alive] Procesando... (07:05:15)
✓ 12345678: 12 actividades extraídas
   [Keep-Alive] Procesando... (07:10:15)
...

✅ Período 2026-1 completado exitosamente en 28 minutos
   Hora fin: 2025-12-01 07:28:42 UTC
```

**Nota:** Ya NO hay mensajes de "Esperando 40 minutos" porque cada período es un job separado.

---

## 📈 Visualización de Resultados

En la página de **Actions**, verás múltiples runs, uno por cada período:

```
Ejecutar Scraper Univalle #123 (2026-1) ✅ - 28 min
Ejecutar Scraper Univalle #124 (2025-2) ✅ - 31 min
Ejecutar Scraper Univalle #125 (2025-1) ❌ - 15 min (falló)
Ejecutar Scraper Univalle #126 (2024-2) ✅ - 29 min
Ejecutar Scraper Univalle #127 (2024-1) ✅ - 27 min
Ejecutar Scraper Univalle #128 (2023-2) ✅ - 32 min
Ejecutar Scraper Univalle #129 (2023-1) ✅ - 26 min
Ejecutar Scraper Univalle #130 (2022-2) ✅ - 30 min
Ejecutar Scraper Univalle #131 (2022-1) ✅ - 28 min
```

**Ventaja:** Fácil identificar qué período específico falló sin revisar un log enorme.

---

## 🛠️ Modificar Períodos a Procesar

Si necesitas cambiar los períodos procesados, edita el archivo:

**`.github/workflows/scraper.yml`** línea ~202:

```yaml
PERIODS=("2026-1" "2025-2" "2025-1" "2024-2" "2024-1" "2023-2" "2023-1" "2022-2" "2022-1")
```

### Para agregar un período nuevo:

```yaml
# Agregar 2026-2 al inicio
PERIODS=("2026-2" "2026-1" "2025-2" ...)
```

### Para remover un período:

```yaml
# Remover 2022-1
PERIODS=("2026-1" "2025-2" "2025-1" "2024-2" "2024-1" "2023-2" "2023-1" "2022-2")
```

---

## 🔧 Modificar Delay entre Períodos

Para cambiar el delay de 40 minutos, edita línea ~262:

```bash
# Cambiar de 40 a 30 minutos
for min in {1..30}; do
  sleep 60
  if [ $((min % 10)) -eq 0 ]; then
    echo "   ... $((30 - min)) minutos restantes"
  fi
done
```

---

## ⚠️ Importante

1. **No interrumpas** la ejecución manual mientras esté en un delay
2. **Revisa los logs** si algún período falla
3. **Las credenciales** se limpian automáticamente al finalizar
4. **Los logs** se guardan como artifacts por 7 días en caso de error

---

## 📞 Soporte

Si necesitas:
- Cambiar horario de ejecución
- Modificar períodos procesados
- Ajustar delays
- Agregar notificaciones

Consulta la documentación de GitHub Actions o contacta al administrador del repositorio.

