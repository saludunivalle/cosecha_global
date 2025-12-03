function extraerDatosDeTabla(cedula = "1112966620", idPeriod, phpSession,asigacad) {
  var url = `https://proxse26.univalle.edu.co/asignacion/vin_inicio_impresion.php3?cedula=${cedula}&periodo=${idPeriod}`;
  var cookies = `PHPSESSID=${phpSession}; asigacad=${asigacad}; _ga_HJ5WTZNCZS=GS1.1.1734332858.1.1.1734333088.59.0.0`

  var options = {
    method: "get",
    headers: {
      "Cookie": cookies
    }
    // Puedes agregar muteHttpExceptions: true si deseas ignorar errores del servidor
  };

  var response = UrlFetchApp.fetch(url, options);
  
  // Forzar la decodificación a ISO-8859-1
  // Forzamos la decodificación a ISO-8859-1 especificándolo en getContentText
  var html = response.getContentText("ISO-8859-1");
  
  // Busca todas las tablas en el HTML
  var tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
  if (!tableMatches || tableMatches.length < 3) {
    Logger.log("No se encontró la tercera tabla.");
    return;
  }

  // Selecciona la tercera tabla (índice 2)
  var tableHtml = tableMatches[2];

  // Extrae las filas (<tr>) de la tabla
  var rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!rowMatches || rowMatches.length < 4) {
    Logger.log("Estructura de tabla inesperada.");
    return;
  }
  
  var headerRow1 = rowMatches[0];
  var valueRow1  = rowMatches[1];
  var headerRow2 = rowMatches[2];
  var valueRow2  = rowMatches[3];

  // Función para extraer el contenido de cada celda y decodificar entidades HTML
  function extractCells(rowHtml) {
    var cellMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cellMatches) return [];

    return cellMatches.map(function(cellHtml) {
      // Quita las etiquetas <td> y cualquier otra etiqueta HTML interna
      cellHtml = cellHtml.replace(/<\/?td[^>]*>/gi, '');
      cellHtml = cellHtml.replace(/<[^>]+>/g, '');
      // Quita saltos de línea y espacios en exceso
      cellHtml = cellHtml.replace(/\s*\n\s*/g, ' ').trim();
      // Decodifica entidades HTML, por ejemplo: &aacute; -> á
      cellHtml = decodeEntities(cellHtml);
      return cellHtml;
    });
  }

  // Función para decodificar entidades HTML comunes
  function decodeEntities(text) {
    var entities = {
      '&aacute;': 'á',
      '&Aacute;': 'Á',
      '&eacute;': 'é',
      '&Eacute;': 'É',
      '&iacute;': 'í',
      '&Iacute;': 'Í',
      '&oacute;': 'ó',
      '&Oacute;': 'Ó',
      '&uacute;': 'ú',
      '&Uacute;': 'Ú',
      '&ntilde;': 'ñ',
      '&Ntilde;': 'Ñ',
      '&amp;': '&',
      '&quot;': '"',
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' '
      // Agrega más entidades según sea necesario
    };

    return text.replace(/&[a-zA-Z]+;/g, function(match) {
      return entities[match] || match;
    });
  }

  // Extraer encabezados y valores de cada par de filas
  var headers1 = extractCells(headerRow1);
  var values1  = extractCells(valueRow1);
  var headers2 = extractCells(headerRow2);
  var values2  = extractCells(valueRow2);

  // Si deseas renombrar encabezados, ajusta la función renameHeader
  function renameHeader(header) {
    // Ejemplo: if (header === "NIVEL ALCANZADO") return "NIVEL ACADEMICO";
    return header;
  }

  // Construir el objeto resultante combinando los pares de encabezados y valores
  var result = {};
  
  headers1.forEach(function(header, i) {
    var cleanHeader = renameHeader(header);
    result[cleanHeader] = values1[i] || "";
  });
  
  headers2.forEach(function(header, i) {
    var cleanHeader = renameHeader(header);
    result[cleanHeader] = values2[i] || "";
  });

  // Aplica removeAccents a cada valor del objeto
  for (var key in result) {
    result[key] = removeAccents(result[key]);
  }

  Logger.log(result);
  return result;
}

// Función para remover acentos utilizando Unicode normalization y, de ser necesario, un mapeo manual
function removeAccents(str) {
  try {
    let normalized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Si se detecta el caracter de reemplazo (�), se recurre al mapeo manual
    if (normalized.indexOf("�") !== -1) {
      throw new Error("Caracteres no convertidos correctamente");
    }
    return normalized;
  } catch (error) {
    const accentMap = {
      'á': 'a', 'Á': 'A',
      'é': 'e', 'É': 'E',
      'í': 'i', 'Í': 'I',
      'ó': 'o', 'Ó': 'O',
      'ú': 'u', 'Ú': 'U',
      'ñ': 'n', 'Ñ': 'N'
    };
    return str.split('').map(char => accentMap[char] || char).join('');
  }
}

// Función para remover acentos utilizando Unicode normalization y, de ser necesario, un mapeo manual
function removeAccents(str) {
  try {
    let normalized = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Si se detecta el caracter de reemplazo, se recurre al mapeo manual
    if (normalized.indexOf("�") !== -1) {
      throw new Error("Caracteres no convertidos correctamente");
    }
    return normalized;
  } catch (error) {
    const accentMap = {
      'á': 'a', 'Á': 'A',
      'é': 'e', 'É': 'E',
      'í': 'i', 'Í': 'I',
      'ó': 'o', 'Ó': 'O',
      'ú': 'u', 'Ú': 'U',
      'ñ': 'n', 'Ñ': 'N'
    };
    return str.split('').map(char => accentMap[char] || char).join('');
  }
}

function returnIdPeriod(period) {
  const baseId = 48;
  const baseYear = 2025;
  
  // Se asume que el formato del período es "YYYY-X" donde X es 1 o 2.
  const parts = period.split("-");
  if (parts.length !== 2) {
    throw new Error("Formato de período incorrecto. Debe ser 'YYYY-X'");
  }
  
  const year = parseInt(parts[0], 10);
  const semester = parseInt(parts[1], 10);
  
  if (isNaN(year) || isNaN(semester)) {
    throw new Error("Año o semestre no son válidos.");
  }
  
  // Calcular el ID
  const id = baseId + ((year - baseYear) * 2) + (semester - 1);
  return id;
}

function teacherNoFoundOption(sheetName) {
  let response = null;
  try {

    const periodoRegex = /^Docentes\s+(\d{4})-(\d)/;
    const periodoMatch = sheetName.trim().match(periodoRegex);

    if (!periodoMatch) {
          SpreadsheetApp.getUi().alert(`El Nombre de la hoja no cumple con el formato de Docente 2025-1`);
          return;
    }

    const phpSession = Browser.inputBox("Ingrese el PHPSESSID:");
    const asigacad = Browser.inputBox("Ingrese el asigacad:");

    if (!phpSession || !asigacad) {
      console.log("No se ingresó phpSession.");
      return null;
    }


    // Abre la hoja "AUX"
    const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    // Fila 1: escribir los nombres de los campos (encabezados) a partir de la columna B
    sheet.getRange(1, 2).setValue("NOMBRE");
    sheet.getRange(1, 3).setValue("1 APELLIDO");
    sheet.getRange(1, 4).setValue("2 APELLIDO");
    sheet.getRange(1, 5).setValue("CATEGORIA");
    sheet.getRange(1, 6).setValue("VINCULACION");
    sheet.getRange(1, 7).setValue("DEDICACION");
    sheet.getRange(1, 8).setValue("nivelAlcanzado");
    sheet.getRange(1, 9).setValue("UNIDAD ACADEMICA");
    sheet.getRange(1, 10).setValue("CENTRO COSTO");
    sheet.getRange(1, 11).setValue("Nombre Completo");

    // Determina la última fila con datos en la columna A (asumiendo que la fila 1 es encabezado)
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log("No hay cédulas en la primera columna a partir de la fila 2.");
      return 0;
    }

    // Obtiene las cédulas de la columna A, desde la fila 2 hasta la última fila
    const cedulasRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const cedulasValues = cedulasRange.getValues(); // Array de arrays, cada uno con una cédula

    // Itera sobre cada cédula y obtiene los datos
    cedulasValues.forEach((row, index) => {
      let cedula = row[0];
      let datos = extraerDatosDeTabla(cedula,`${periodoMatch[1]}-${periodoMatch[2]}`,phpSession,asigacad);
      
      // Solo si la función devolvió datos
      if (datos) {
        Logger.log(datos)
        // Extraemos cada campo que nos interesa, usando las llaves que vienen de la tabla
        // Ajusta las llaves según lo que retorne tu tabla (datos["..."])
        let nombre           = removeAccents(datos["NOMBRE"] || "");
        let primerApellido   = removeAccents(datos["1 APELLIDO"] || "");
        let segundoApellido  = removeAccents(datos["2 APELLIDO"] || "");
        let categoria        = removeAccents(datos["CATEGORIA"] || "SIN CARGO");
        let vinculacion      = removeAccents(datos["VINCULACION"] || "");
        let dedicacion       = removeAccents(datos["DEDICACION"] || "");
        let nivelAcademico   = removeAccents(datos["NIVEL ALCANZADO"] || "");
        let unidadAcademica  = removeAccents(datos["UNIDAD ACADEMICA"] || "");
        let centroCosto      = removeAccents(datos["CENTRO COSTO"] || "");
        let fullName         = removeAccents(`${nombre} ${primerApellido} ${segundoApellido}`);

        // Escribimos cada campo en la fila correspondiente (index+2)
        // Comenzamos en la columna 2 (B) para el nombre
        let targetRow = index + 2;
        sheet.getRange(targetRow, 2).setValue(nombre);
        sheet.getRange(targetRow, 3).setValue(primerApellido);
        sheet.getRange(targetRow, 4).setValue(segundoApellido);
        sheet.getRange(targetRow, 5).setValue(categoria);
        sheet.getRange(targetRow, 6).setValue(vinculacion);
        sheet.getRange(targetRow, 7).setValue(dedicacion);
        sheet.getRange(targetRow, 8).setValue(nivelAcademico);
        sheet.getRange(targetRow, 9).setValue(unidadAcademica);
        sheet.getRange(targetRow, 10).setValue(centroCosto);
        sheet.getRange(targetRow, 11).setValue(fullName);
      }
    });
    
    console.log("Se han agregado los datos en las columnas para cada cédula encontrada.");
    response = cedulasValues.length;
  } catch (e) {
    console.log(e);
  }
  return response;
}

function updateDataTeachers(sheetNameDoc,sheetNameUpdate) {
  let response = null;
  try {
        Logger.log(sheetNameDoc)
        Logger.log(sheetNameUpdate)

        const ss = SpreadsheetApp.openByUrl(SHEET_URL);
        const sheet = ss.getSheetByName(sheetNameUpdate);
        const dataSheet = getDataSheetGeneral({ 
          url: SHEET_URL, 
          sheetName: sheetNameUpdate
        });

        const dataSheetAux = getDataSheetGeneral({ 
          url: SHEET_URL, 
          sheetName: sheetNameDoc
        });

        dataSheet.forEach((item) => {
              const dataAux = dataSheetAux.find((auxData) => String(auxData?.docentes) === String(item?.cedula));
              Logger.log(dataAux)
              if (dataAux) {
                item.nombreProfesor = dataAux?.['nombreCompleto'];
                item['vinculación'] = dataAux?.vinculacion;
                item['dedicación'] = dataAux?.dedicacion;
                item.nivel = dataAux?.nivelalcanzado || 'N/A';
                item.cargo = dataAux?.['categoria'];
                item['departamento'] = dataAux?.['unidadAcademica'] || 'N/A';

                Logger.log(`Actualizado en memoria: ${JSON.stringify(item)}`);

                // 5) Ahora, actualizamos la fila correspondiente en la hoja
                //    Hallamos el índice del item en el array dataSheet
                const idx = dataSheet.indexOf(item); 
                //    Cada posición en el array corresponde a la fila "idx + 2" (por los encabezados)
                const row = idx + 2;

                // 6) Seteamos cada columna que haya cambiado
                //    Ajusta los números de columna según tu orden real
                sheet.getRange(row, 2).setValue(item.nombreProfesor);    // Col B
                sheet.getRange(row, 14).setValue(item['vinculación']);    // Col C
                sheet.getRange(row, 15).setValue(item['dedicación']);     // Col D
                sheet.getRange(row, 16).setValue(item.nivel);             // Col E
                sheet.getRange(row, 17).setValue(item.cargo);             // Col F
                sheet.getRange(row, 18).setValue(item.departamento);             // Col 
              }
         });

          response = 'Datos actualizados correctamente';
  } catch (e) {
    console.log(e)
  }
  return response
}
