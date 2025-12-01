# Solución a Timeouts en Ejecución del Scraper

## Fecha: 2025-11-30

## 🔴 Problema Identificado

El scraper se detenía después de ~45 minutos de ejecución, incluso cuando había más cédulas por procesar.

### Causas Identificadas

1. **Timeout del Step**: GitHub Actions tiene timeout por defecto de 360 minutos (6 horas) para el job completo, pero cada step puede tener su propio timeout
2. **Idle Timeout**: Si no hay output durante mucho tiempo, GitHub Actions puede detener el proceso
3. **Timeouts de Request**: Los timeouts de HTTP eran muy cortos (30 segundos)
4. **Timeouts de Google Sheets**: Timeout de 60 segundos era insuficiente para operaciones grandes

---

## ✅ Soluciones Implementadas

### 1. Timeout del Step Aumentado

```yaml
- name: Run scraper for all periods
  timeout-minutes: 180  # 3 horas por período
```

**Beneficio**: Cada período individual puede ejecutarse hasta 3 horas sin ser interrumpido.

---

### 2. Keep-Alive en Background

```bash
# Iniciar keep-alive en background
(
  while true; do
    sleep 300  # 5 minutos
    echo "   [Keep-Alive] Procesando... ($(date '+%H:%M:%S'))"
  done
) &
KEEPALIVE_PID=$!

# Ejecutar scraper
python main.py ...

# Detener keep-alive al finalizar
kill $KEEPALIVE_PID 2>/dev/null || true
```

**Beneficio**: 
- Imprime mensaje cada 5 minutos
- Evita que GitHub Actions piense que el proceso está inactivo
- Se detiene automáticamente cuando termina el período

---

### 3. Timeout del Comando Python

```bash
timeout 7200 python main.py ...  # 2 horas máximo
```

**Beneficio**: 
- Límite de seguridad de 2 horas por período
- Si el scraper se cuelga, se detiene y continúa con el siguiente período
- No afecta toda la ejecución

---

### 4. Timeouts de HTTP Aumentados

#### Requests a Univalle

```yaml
REQUEST_TIMEOUT: 60 segundos      # Antes: 30s
REQUEST_MAX_RETRIES: 5            # Antes: 3
REQUEST_RETRY_DELAY: 3 segundos   # Antes: 2s
```

#### Google Sheets API

```yaml
SHEETS_READ_TIMEOUT: 120 segundos  # Antes: 60s
SHEETS_MAX_RETRIES: 5              # Antes: 3
SHEETS_RETRY_DELAY: 10 segundos    # Antes: 5s
SHEETS_BATCH_SIZE: 100             # Lotes más pequeños
```

**Beneficio**:
- Permite que requests lentas completen
- Más reintentos ante fallos temporales
- Mejor manejo de redes lentas o sobrecargadas

---

### 5. Progreso Visible Durante Delays

```bash
# Mostrar progreso cada 5 minutos
for min in {1..40}; do
  sleep 60
  if [ $((min % 5)) -eq 0 ]; then
    echo "   ... $((40 - min)) minutos restantes hasta siguiente período"
  fi
done
```

**Beneficio**:
- Output visible cada 5 minutos
- Evita idle timeout durante los delays de 40 minutos
- Permite monitorear que el proceso sigue activo

---

## 📊 Jerarquía de Timeouts

```
Job Timeout: 14 horas (840 min)
   └─> Step Timeout: 3 horas (180 min) por período
         └─> Command Timeout: 2 horas (120 min) por período
               └─> Request Timeout: 60 segundos por request HTTP
               └─> Sheets Timeout: 120 segundos por operación Sheets
```

---

## 🔍 Tiempos Estimados por Período

### Escenario Conservador (muchas cédulas)
```
Lectura de cédulas:          ~2-5 minutos
Scraping (948 cédulas):      ~60-90 minutos
  - 1 segundo por cédula     = ~16 minutos
  - Delays entre requests    = ~20-30 minutos
  - Procesamiento y escritura = ~30-40 minutos
Delay hasta siguiente:       40 minutos

Total por período:           ~100-135 minutos
```

### Escenario Optimista (pocas cédulas)
```
Total por período:           ~30-45 minutos
```

---

## ⚙️ Configuración Avanzada

### Aumentar Timeout de un Período Específico

Si necesitas más de 3 horas para un período (poco probable), edita:

```yaml
timeout-minutes: 240  # 4 horas
```

### Ajustar Keep-Alive Frequency

Si quieres más/menos mensajes de keep-alive:

```bash
# Más frecuente (cada 2 minutos)
sleep 120

# Menos frecuente (cada 10 minutos)
sleep 600
```

### Ajustar Timeout del Comando

```bash
# Aumentar a 3 horas
timeout 10800 python main.py ...

# Sin timeout (no recomendado)
python main.py ...
```

---

## 🚨 Señales de Problemas

### El scraper sigue deteniéndose después de 3 horas

**Causa probable**: El step timeout (180 min) está siendo alcanzado.

**Solución**: 
```yaml
timeout-minutes: 300  # Aumentar a 5 horas
```

### No hay output durante mucho tiempo

**Causa probable**: El keep-alive no está funcionando o el script está colgado.

**Verificación**:
1. Busca mensajes `[Keep-Alive]` en los logs cada 5 minutos
2. Si no aparecen, el keep-alive murió prematuramente

**Solución**: Verificar que el script de keep-alive esté correcto.

### Muchos timeouts de requests HTTP

**Causa probable**: El servidor Univalle está lento o sobrecargado.

**Solución temporal**:
```yaml
REQUEST_TIMEOUT: 90  # Aumentar a 90 segundos
```

### Timeouts de Google Sheets API

**Causa probable**: Operaciones muy grandes o red lenta.

**Solución**:
```yaml
SHEETS_READ_TIMEOUT: 180      # 3 minutos
SHEETS_BATCH_SIZE: 50         # Lotes más pequeños
```

---

## 📝 Logs a Monitorear

### Output Normal

```
🚀 PERÍODO 1/9: 2026-1
   Hora inicio: 2025-11-30 07:00:15 UTC
   Hoja fuente: 2025-2
   Columna: D

✓ 38872843: 17 actividades extraídas
   [Keep-Alive] Procesando... (07:05:15)
✓ 12345678: 12 actividades extraídas
   [Keep-Alive] Procesando... (07:10:15)
...
✅ Período 2026-1 completado exitosamente en 45 minutos
```

### Output con Problemas

```
✓ 38872843: 17 actividades extraídas
   [Keep-Alive] Procesando... (07:05:15)
❌ Error al procesar cédula 12345678: ReadTimeout
   [Keep-Alive] Procesando... (07:10:15)
⚠️ Reintentando cédula 12345678 (intento 2/5)...
✓ 12345678: 12 actividades extraídas
```

---

## 🔧 Troubleshooting

### El keep-alive no aparece

```bash
# Verificar que el proceso está corriendo
ps aux | grep "sleep 300"

# Ver logs del keep-alive
grep "Keep-Alive" scraper.log
```

### El timeout del comando se alcanza

```bash
# Ver cuánto tiempo tardó cada período
grep "completado exitosamente en" scraper.log
```

**Ejemplo de output**:
```
✅ Período 2026-1 completado exitosamente en 45 minutos
✅ Período 2025-2 completado exitosamente en 52 minutos
✅ Período 2025-1 completado exitosamente en 38 minutos
```

---

## 📈 Mejoras Futuras

### 1. Rate Limiting Inteligente

Ajustar delays automáticamente basado en la tasa de errores:
- Si muchos timeouts → aumentar delay entre requests
- Si todo OK → reducir delay para ir más rápido

### 2. Checkpoint/Resume

Guardar progreso periódicamente:
- Si el proceso se detiene, reanudar desde la última cédula procesada
- No rehacer trabajo ya completado

### 3. Procesamiento Distribuido

Dividir períodos en múltiples jobs paralelos:
- Job 1: 2026-1, 2025-2, 2025-1
- Job 2: 2024-2, 2024-1, 2023-2
- Job 3: 2023-1, 2022-2, 2022-1

---

## ✅ Checklist de Verificación

Después de implementar estos cambios:

- [x] Step timeout aumentado a 180 minutos
- [x] Keep-alive implementado (cada 5 minutos)
- [x] Command timeout de 2 horas por período
- [x] REQUEST_TIMEOUT aumentado a 60 segundos
- [x] SHEETS_READ_TIMEOUT aumentado a 120 segundos
- [x] Más reintentos configurados (5 en lugar de 3)
- [x] Progreso visible durante delays (cada 5 minutos)
- [x] Job timeout total de 14 horas

---

## 🎯 Resultado Esperado

Con estos cambios, el scraper debería:

✅ **Procesar cada período por 2+ horas sin detenerse**
✅ **Mostrar progreso visible cada 5 minutos**
✅ **Manejar timeouts temporales con reintentos**
✅ **Completar todos los 9 períodos en ~8-12 horas**
✅ **No ser interrumpido por idle timeouts**

---

## 📞 Soporte

Si el problema persiste después de estos cambios:

1. **Revisar logs** completos de la ejecución
2. **Verificar** mensajes de `[Keep-Alive]` cada 5 minutos
3. **Buscar** mensajes de timeout específicos
4. **Contactar** al administrador con los logs

---

## 📄 Referencias

- [GitHub Actions Timeout](https://docs.github.com/en/actions/learn-github-actions/usage-limits-billing-and-administration#usage-limits)
- [Timeout Command](https://man7.org/linux/man-pages/man1/timeout.1.html)
- [Python Requests Timeout](https://requests.readthedocs.io/en/latest/user/advanced/#timeouts)

