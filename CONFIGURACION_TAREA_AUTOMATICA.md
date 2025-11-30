# Configuración de Tarea Automática - Scraper Univalle

## Fecha: 2025-11-30

## 📋 Resumen

La tarea automática de GitHub Actions ahora está configurada para:
- ✅ Ejecutarse **todos los días a las 2:00 AM hora Colombia**
- ✅ Procesar **9 períodos secuencialmente** (del más reciente al más antiguo)
- ✅ Esperar **40 minutos entre cada período**
- ✅ Tiempo total estimado: **~10-12 horas**

---

## ⏰ Horario de Ejecución

### Inicio automático: 2:00 AM Colombia (7:00 AM UTC)

```yaml
schedule:
  - cron: '0 7 * * *'  # 2:00 AM hora Colombia = 7:00 AM UTC
```

---

## 📅 Períodos Procesados (en orden)

| # | Período | Hora Inicio (aprox.) | Hora Fin (aprox.) |
|---|---------|----------------------|-------------------|
| 1 | 2026-1  | 2:00 AM             | 2:30-3:00 AM      |
| 2 | 2025-2  | 2:40 AM             | 3:10-3:40 AM      |
| 3 | 2025-1  | 3:20 AM             | 3:50-4:20 AM      |
| 4 | 2024-2  | 4:00 AM             | 4:30-5:00 AM      |
| 5 | 2024-1  | 4:40 AM             | 5:10-5:40 AM      |
| 6 | 2023-2  | 5:20 AM             | 5:50-6:20 AM      |
| 7 | 2023-1  | 6:00 AM             | 6:30-7:00 AM      |
| 8 | 2022-2  | 6:40 AM             | 7:10-7:40 AM      |
| 9 | 2022-1  | 7:20 AM             | 7:50-8:20 AM      |

**Finalización estimada:** 8:00-9:00 AM hora Colombia

---

## 🔄 Flujo de Ejecución

```
2:00 AM → Inicia período 2026-1
          ↓ (30-60 min de procesamiento)
          ↓
          ⏳ Espera 40 minutos
          ↓
2:40 AM → Inicia período 2025-2
          ↓ (30-60 min de procesamiento)
          ↓
          ⏳ Espera 40 minutos
          ↓
3:20 AM → Inicia período 2025-1
          ...
          (continúa hasta 2022-1)
```

---

## 🎯 Características Principales

### 1. Ejecución Secuencial (NO Paralela)
- Los períodos se procesan uno después del otro
- Si un período falla, continúa con el siguiente
- Al final muestra resumen de éxitos y fallos

### 2. Delay Inteligente
- 40 minutos de espera entre períodos
- Muestra progreso cada 10 minutos
- Indica hora estimada del próximo período

### 3. Manejo de Errores Robusto
- Si un período falla, NO detiene toda la ejecución
- Registra qué períodos fallaron
- Continúa procesando los períodos restantes
- Al final muestra resumen completo

### 4. Logs Detallados
- Hora de inicio y fin de cada período
- Número de cédulas procesadas
- Errores encontrados
- Resumen final con estadísticas

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
timeout-minutes: 840  # 14 horas máximo
```

**Cálculo del timeout:**
- 9 períodos × 60 minutos (promedio) = 540 minutos
- 8 delays × 40 minutos = 320 minutos
- **Total:** 860 minutos (~14.3 horas)
- **Configurado:** 840 minutos (14 horas) con margen

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

### Ejemplo de output

```
==========================================================================
🚀 PERÍODO 1/9: 2026-1
==========================================================================
   Hora inicio: 2025-11-30 07:00:15 UTC
   Hoja fuente: 2025-2
   Columna: D

✓ 38872843: 17 actividades extraídas
✓ 12345678: 12 actividades extraídas
...

✅ Período 2026-1 completado exitosamente
   Hora fin: 2025-11-30 07:35:42 UTC

⏳ Esperando 40 minutos antes del siguiente período (2025-2)...
   Próximo inicio estimado: 2025-11-30 08:15:42 UTC
   ... 30 minutos restantes
   ... 20 minutos restantes
   ... 10 minutos restantes
✓ Delay completado, iniciando siguiente período
```

---

## 📈 Resumen Final

Al completar todos los períodos, verás un resumen como:

```
==========================================================================
📊 RESUMEN FINAL
==========================================================================
   Total períodos procesados: 9
   Exitosos: 8
   Fallidos: 1

   Períodos con errores:
     - 2023-2

   Hora finalización: 2025-11-30 14:25:33 UTC
==========================================================================
```

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

