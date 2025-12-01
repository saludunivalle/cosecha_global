# Solución al Límite de 45 Minutos por Job

## Fecha: 2025-12-01

## 🔴 Problema

GitHub Actions tiene un **límite de 45 minutos por job** en ciertos planes o configuraciones. El scraper no puede completar todos los períodos en un solo job debido a este límite.

---

## ✅ Solución Implementada

### Estrategia: Múltiples Cron Jobs (uno por período)

En lugar de un solo job de 14 horas procesando 9 períodos, ahora tenemos **9 cron jobs separados**, cada uno programado en un horario específico.

---

## ⏰ Horarios de Ejecución

| # | Período | Hora Colombia | Hora UTC | Cron Expression |
|---|---------|---------------|----------|-----------------|
| 1 | 2026-1  | 2:00 AM      | 7:00 AM  | `0 7 * * *`    |
| 2 | 2025-2  | 2:45 AM      | 7:45 AM  | `45 7 * * *`   |
| 3 | 2025-1  | 3:30 AM      | 8:30 AM  | `30 8 * * *`   |
| 4 | 2024-2  | 4:15 AM      | 9:15 AM  | `15 9 * * *`   |
| 5 | 2024-1  | 5:00 AM      | 10:00 AM | `0 10 * * *`   |
| 6 | 2023-2  | 5:45 AM      | 10:45 AM | `45 10 * * *`  |
| 7 | 2023-1  | 6:30 AM      | 11:30 AM | `30 11 * * *`  |
| 8 | 2022-2  | 7:15 AM      | 12:15 PM | `15 12 * * *`  |
| 9 | 2022-1  | 8:00 AM      | 1:00 PM  | `0 13 * * *`   |

**Separación entre períodos:** 45 minutos (suficiente para completar + margen)

---

## 🎯 Ventajas de Esta Estrategia

### 1. **Cumple con el Límite de 45 Minutos** ✅
- Cada job procesa solo un período
- Duración típica: 20-35 minutos por período
- Margen de seguridad: 10-25 minutos

### 2. **Ejecuciones Independientes** ✅
- Si un período falla, no afecta a los demás
- Logs separados por período
- Fácil identificar qué período tuvo problemas

### 3. **Mejor Visibilidad** ✅
- Cada período aparece como un run separado en GitHub Actions
- Historial claro de éxitos/fallos por período
- Artifacts de logs individuales

### 4. **Tolerancia a Fallos** ✅
- Un período fallido no cancela los siguientes
- Puedes re-ejecutar solo el período que falló
- No pierdes el trabajo de otros períodos

---

## 🔍 Cómo Funciona

### Ejecución Automática (Cron)

```yaml
schedule:
  - cron: '0 7 * * *'   # 2:00 AM COT - Período 2026-1
  - cron: '45 7 * * *'  # 2:45 AM COT - Período 2025-2
  # ... etc
```

Cada cron ejecuta el mismo job, pero:
1. Detecta la hora UTC actual
2. Determina qué período corresponde a esa hora
3. Procesa solo ese período

### Lógica de Determinación de Período

```bash
HOUR=$(date -u +%H)
case "$HOUR" in
  7)  PERIOD="2026-1" ;;
  8)  PERIOD="2025-2" ;;
  9)  PERIOD="2024-2" ;;
  # ...
esac
```

---

## 📊 Timeline de Ejecución Diaria

```
2:00 AM COT │ Job 1 starts: 2026-1
            ├──────────────────────────► (20-35 min)
            │
2:45 AM COT │ Job 2 starts: 2025-2
            ├──────────────────────────► (20-35 min)
            │
3:30 AM COT │ Job 3 starts: 2025-1
            ├──────────────────────────► (20-35 min)
            │
4:15 AM COT │ Job 4 starts: 2024-2
            ├──────────────────────────► (20-35 min)
            │
5:00 AM COT │ Job 5 starts: 2024-1
            ├──────────────────────────► (20-35 min)
            │
5:45 AM COT │ Job 6 starts: 2023-2
            ├──────────────────────────► (20-35 min)
            │
6:30 AM COT │ Job 7 starts: 2023-1
            ├──────────────────────────► (20-35 min)
            │
7:15 AM COT │ Job 8 starts: 2022-2
            ├──────────────────────────► (20-35 min)
            │
8:00 AM COT │ Job 9 starts: 2022-1
            └──────────────────────────► (20-35 min)
            
8:30-9:00 AM │ Todos completados ✅
```

---

## 🎮 Ejecución Manual

### Procesar un Período Específico

1. Ve a: **Actions** → **Ejecutar Scraper Univalle** → **Run workflow**
2. Selecciona:
   - **target_period**: El período que quieres procesar (ej: `2026-1`)
   - **source_worksheet**: Hoja fuente (default: `2025-2`)
   - **source_column**: Columna de cédulas (default: `D`)
   - **delay_cedulas**: Delay entre cédulas (default: `0.5`)

3. Click **Run workflow**

**Resultado:** Procesa solo ese período, sin depender del horario.

---

## 📝 Logs y Monitoring

### Ver Ejecuciones

Cada período aparece como un run separado:

```
Ejecutar Scraper Univalle #123 - Período 2026-1 ✅
Ejecutar Scraper Univalle #124 - Período 2025-2 ✅
Ejecutar Scraper Univalle #125 - Período 2025-1 ❌
Ejecutar Scraper Univalle #126 - Período 2024-2 ✅
...
```

### Artifacts de Logs

Si un período falla, se guarda automáticamente:
- **Nombre:** `scraper-logs-2025-1-125`
- **Contenido:** `scraper.log` completo
- **Retención:** 7 días

---

## ⚙️ Configuración

### Cambiar Horarios

Para modificar los horarios de ejecución:

```yaml
schedule:
  # Cambiar de 2:00 AM a 1:00 AM
  - cron: '0 6 * * *'  # 1:00 AM COT = 6:00 AM UTC
  
  # Cambiar separación de 45 min a 30 min
  - cron: '30 6 * * *'  # 1:30 AM COT
```

### Agregar/Remover Períodos

**Para agregar un nuevo período (ej: 2026-2):**

1. Agregar cron job:
```yaml
schedule:
  - cron: '0 7 * * *'   # 2:00 AM COT - Período 2026-2
  - cron: '45 7 * * *'  # 2:45 AM COT - Período 2026-1
  # ...
```

2. Actualizar lógica de determinación:
```bash
case "$HOUR" in
  7)  
    if [ "$MINUTE" -lt 45 ]; then
      PERIOD="2026-2"
    else
      PERIOD="2026-1"
    fi
    ;;
  # ...
esac
```

**Para remover un período:**
- Simplemente elimina su cron job del schedule

---

## 🔧 Timeouts Configurados

```yaml
jobs:
  scrape:
    timeout-minutes: 40  # Job completo
    steps:
      - name: Run scraper
        timeout-minutes: 38  # Step del scraper (deja 2 min para cleanup)
```

**Jerarquía:**
```
Job: 40 minutos (límite seguro bajo el límite de 45 min)
  └─> Step: 38 minutos (deja 2 min para cleanup)
       └─> Python command: sin timeout explícito
            ├─> REQUEST_TIMEOUT: 60 segundos
            └─> SHEETS_READ_TIMEOUT: 120 segundos
```

---

## ⚠️ Troubleshooting

### Un período específico sigue fallando

**Posibles causas:**
1. Ese período tiene muchas más cédulas
2. El servidor Univalle está lento en ese horario
3. Problemas de red

**Solución:**
1. Re-ejecutar manualmente ese período
2. Verificar logs del artifact
3. Si persiste, aumentar timeout:
```yaml
timeout-minutes: 60  # Solo para ese período si es necesario
```

### Múltiples períodos fallan al mismo tiempo

**Causa probable:** Problema con Google Sheets API o credenciales

**Verificar:**
```bash
# En los logs, buscar:
"Error al conectar con Google Sheets"
"Timeout al leer cédulas"
```

**Solución:**
1. Verificar que los secrets estén correctamente configurados
2. Verificar cuota de Google API
3. Revisar permisos de la cuenta de servicio

### Los jobs no se ejecutan a la hora esperada

**Causa:** GitHub Actions puede tener delays de 3-10 minutos en cron jobs

**Esperado:**
- Programado: 2:00 AM
- Ejecución real: 2:00-2:10 AM

Esto es normal y no afecta el funcionamiento.

---

## 📊 Comparación: Antes vs Ahora

### Antes (Un Solo Job)

```
❌ Job único de 14 horas
❌ Superaba límite de 45 minutos
❌ Se cancelaba a los 45 minutos
❌ Perdía todo el trabajo
❌ Difícil identificar qué falló
```

### Ahora (Jobs Separados)

```
✅ 9 jobs de ~30 minutos cada uno
✅ Cada job bajo el límite de 45 minutos
✅ Ejecuciones independientes
✅ Si uno falla, los demás continúan
✅ Logs separados por período
✅ Fácil re-ejecutar período específico
```

---

## 📈 Métricas Esperadas

### Por Período

- **Duración promedio:** 25-35 minutos
- **Cédulas procesadas:** ~950 (varía según hoja fuente)
- **Actividades extraídas:** ~15,000-20,000
- **Tasa de éxito:** >95%

### Diaria (Todos los Períodos)

- **Tiempo total:** 6-7 horas (incluyendo separación)
- **Períodos procesados:** 9
- **Total cédulas:** ~950 × 9 = ~8,550
- **Total actividades:** ~135,000-180,000

---

## 🎯 Resultado Final

Con esta nueva estrategia:

✅ **NO más timeouts** a los 45 minutos
✅ **Cada período se completa** en 20-35 minutos
✅ **Ejecuciones independientes** con separación de 45 minutos
✅ **Mejor visibilidad** y logs separados
✅ **Fácil mantenimiento** y debugging
✅ **Tolerante a fallos** - un período fallido no afecta a los demás

---

## 📞 Soporte

Si necesitas:
- Cambiar horarios de ejecución
- Agregar/remover períodos
- Ajustar timeouts
- Configurar notificaciones

Revisa la sección de [Configuración](#configuración) arriba o contacta al administrador del repositorio.

---

## 📚 Referencias

- [GitHub Actions - Cron Schedule](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [GitHub Actions - Usage Limits](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration)
- [Crontab Guru](https://crontab.guru/) - Para construir expresiones cron

