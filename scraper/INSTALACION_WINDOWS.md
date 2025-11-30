# Guía de Instalación en Windows

Esta guía está específicamente diseñada para usuarios de Windows usando PowerShell.

## Activar Entorno Virtual en Windows

### PowerShell (Recomendado)

```powershell
# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
.\venv\Scripts\Activate.ps1
```

**Nota**: Si recibes un error de ejecución de scripts, ejecuta primero:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Command Prompt (CMD)

```cmd
# Crear entorno virtual (si no existe)
python -m venv venv

# Activar entorno virtual
venv\Scripts\activate.bat
```

### Git Bash

Si estás usando Git Bash en Windows, puedes usar el comando de Linux:
```bash
source venv/bin/activate
```

## Instalación Completa en Windows

### Paso 1: Verificar Python

```powershell
python --version
```

Debe ser Python 3.8 o superior. Si no está instalado, descárgalo de [python.org](https://www.python.org/downloads/).

### Paso 2: Navegar al Directorio del Proyecto

```powershell
cd C:\Marcela\MONITORIA\cosecha_global\scraper
```

### Paso 3: Crear Entorno Virtual

```powershell
python -m venv venv
```

### Paso 4: Activar Entorno Virtual

```powershell
# En PowerShell
.\venv\Scripts\Activate.ps1

# O en CMD
venv\Scripts\activate.bat
```

Verás `(venv)` al inicio de tu línea de comandos cuando esté activado.

### Paso 5: Actualizar pip

```powershell
python -m pip install --upgrade pip
```

### Paso 6: Instalar Dependencias

```powershell
pip install -r requirements.txt
```

### Paso 7: Configurar Variables de Entorno

Copia el archivo de ejemplo:

```powershell
Copy-Item env.example .env
```

O en CMD:
```cmd
copy env.example .env
```

Edita `.env` con un editor de texto (Notepad, VS Code, etc.) y configura tus valores.

### Paso 8: Colocar Credenciales de Google

1. Coloca el archivo `credentials.json` en la carpeta `scraper/`
2. O configura la ruta completa en `.env`:
   ```env
   GOOGLE_SHEETS_CREDENTIALS_PATH=C:\ruta\completa\a\credentials.json
   ```

## Verificar Instalación

```powershell
python -c "from scraper.services.sheets_service import SheetsService; s = SheetsService(); print('Conectado a:', s.spreadsheet.title)"
```

## Ejecutar el Scraper

Con el entorno virtual activado:

```powershell
python main.py --modo completo --source-worksheet "2025-2" --current-period "2026-1"
```

## Problemas Comunes en Windows

### Error: "Execution Policy"

Si ves este error al activar el entorno virtual:
```
.ps1 cannot be loaded because running scripts is disabled on this system.
```

**Solución:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Luego vuelve a intentar activar el entorno virtual.

### Error: "python no se reconoce"

**Solución:**

1. Verifica que Python está instalado:
   ```powershell
   py --version
   ```
2. Usa `py` en lugar de `python`:
   ```powershell
   py -m venv venv
   py -m pip install -r requirements.txt
   ```

### Rutas con Espacios

Si tu ruta tiene espacios, usa comillas:

```powershell
cd "C:\Marcela\MONITORIA\cosecha_global\scraper"
```

### Variables de Entorno en PowerShell

Para establecer variables de entorno temporalmente en PowerShell:

```powershell
$env:GOOGLE_SHEETS_CREDENTIALS_PATH = "C:\ruta\a\credentials.json"
$env:GOOGLE_SHEETS_SPREADSHEET_ID = "tu_id_aqui"
```

Para hacerlo permanente, edita las variables de entorno del sistema o usa el archivo `.env`.

## Comandos Rápidos

```powershell
# Crear y activar entorno virtual
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar scraper
python main.py --modo completo

# Desactivar entorno virtual (cuando termines)
deactivate
```

## Usar VS Code en Windows

Si usas Visual Studio Code:

1. Abre la carpeta `scraper` en VS Code
2. Abre una terminal integrada (`` Ctrl+` ``)
3. El terminal usará PowerShell por defecto
4. Activa el entorno virtual como se muestra arriba
5. Selecciona el intérprete de Python del entorno virtual:
   - `` Ctrl+Shift+P ``
   - Escribe "Python: Select Interpreter"
   - Selecciona `.\venv\Scripts\python.exe`

## Notas Adicionales

- En Windows, las barras son hacia atrás (`\`) en lugar de hacia adelante (`/`)
- PowerShell distingue entre mayúsculas y minúsculas en algunos casos
- Los paths largos pueden causar problemas; considera usar paths cortos si es posible
- Siempre activa el entorno virtual antes de ejecutar el scraper

