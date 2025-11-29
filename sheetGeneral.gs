// Conf Global
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg/edit?gid=1570515424#gid=1570515424"
const HEAD = [['Cedula','Nombre Profesor', 'Escuela', 'Departamento', 'Tipo de Actividad',	'Categoría',	'Nombre de actividad',	'Número de horas',	'id',	'Período',	'Porcentaje horas',	'Detalle actividad',	'Actividad',	'Vinculación',	'Dedicación',	'Nivel',	'Cargo', 'departamento']]

const SPREADSHEET = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");

/**
 * Get Object of sheet
 */
const getSheetUrl = ({ url }) => {
  return SpreadsheetApp.openByUrl(
    `${url}`,
  );
}

const getListSheetNames = () => {
  let response = []
  try {
        const data = getSheetUrl({ url: SHEET_URL }).getSheets();
        data.map(sheet => {
          response.push(String(sheet.getName()).trim().toLocaleLowerCase())
        });
  } catch (e) {
    Logger.log(e)
  }
  Logger.log(response)
  return response
}

const cleanSheet = (nameSheet) => {
  let response = null;
  try {
    const spreadsheet = SpreadsheetApp.openByUrl(SHEET_URL);
    const sheet = spreadsheet.getSheetByName(nameSheet);

    if (sheet) {
      spreadsheet.deleteSheet(sheet);
      response = `La hoja "${nameSheet}" ha sido limpiada correctamente.`;
    }
  } catch (e) {
    Logger.log('Error al limpiar la hoja: ' + e.message);
    response = `Error: ${e.message}`;
  }

  Logger.log(response);
  return response;
}

const teacherNoFound = (nameSheet = '2025-1 21ene') => {
  let response = null;

  try {
    if (typeof nameSheet !== 'string') return response;
    
    const dataSheet = getDataSheetGeneral({ url: SHEET_URL, sheetName: nameSheet });

    const listTeacherNoFound = dataSheet.reduce((acc, item) => {
      const nombre = item?.cedula;
      if (nombre && !acc.includes(nombre)) {
        acc.push(nombre);
      }
      return acc;
    }, []);

    Logger.log(listTeacherNoFound)
    if (listTeacherNoFound.length === 0) {
      console.log("No hay profesores no encontrados.");
      return 0;
    }

    const formattedSheet = listTeacherNoFound.map(item => [item]);

    let newName = `Docentes ${nameSheet}`;
    const SHEET = SpreadsheetApp.openByUrl(SHEET_URL);
    let newSheet = SHEET.getSheetByName(newName);

    if (!newSheet) {
      newSheet = SHEET.insertSheet(newName);
    } else {
      newSheet.clear();
    }

    // Insertar encabezado
    newSheet.getRange(1, 1).setValue("Docentes");

    // Insertar valores en la hoja
    newSheet.getRange(2, 1, formattedSheet.length, 1).setValues(formattedSheet);

    console.log(`Profesores no encontrados agregados en la hoja "${newName}"`);
    return listTeacherNoFound.length;
  } catch (e) {
    console.log("Error:", e);
  }

  return response;
};


/*** 
 * Return all data of sheet
*/
const getDataSheetGeneral = ({ url, sheetName }) => {
  let response = null
  try {
        const data = getSheetUrl({ url: url }).getSheetByName(sheetName)
        const range =  data.getDataRange();
        const values = range.getValues();
        response = sheetValuesToObject(values)
  } catch (e) {
    Logger.log(e)
  }
   return response
}

/**
 * Return Data Docents
 */
const getDataDocents = () => {
  let response = null
  try {
       response = getDataSheetGeneral({ url: SHEET_URL, sheetName: 'Docentes2024-1'})
  } catch (e) {
    Logger.log(e)
  }
  return response
}

/**
 * 
*/
const normalizeDataDocument = ({ dataDocents, dataSheet, nameSheetGeneral, nameSheetToSave}) => {
  try {
       // Generate New Sheet in case of no exists
       const sheet = generateSheetDocument({ nameSheet: nameSheetToSave === null? nameSheetGeneral : nameSheetToSave});
       const dataToSave = normalizeGeneralData({
          dataDocents: dataDocents,
          dataNorm: dataSheet
       })
       Logger.log(sheet)
       insertValuesInSheet(sheet, dataToSave)
  } catch (e) {
    Logger.log(e)
  }
}

function generateSheetDocument({ nameSheet }) {
  let sheet = null;
  try {
    Logger.log(SPREADSHEET)
    Logger.log("***********************************")
    // 1) Reusar la instancia
    sheet = SPREADSHEET.getSheetByName(nameSheet);
    Logger.log(nameSheet)
    Logger.log(sheet)
    // 2) Si no existe, crearla e insertar encabezados
    if (!sheet) {
      sheet = SPREADSHEET.insertSheet(nameSheet);
      insertValuesInSheet(sheet, HEAD);
    }
    
  } catch (e) {
    // En caso de timeout u otro error, loguear y opcionalmente reintentar
    Logger.log("Error accediendo a la hoja:", e);
    // Ejemplo de reintento sencillo:
    Utilities.sleep(2000);  // espera 2 s
    try {
      sheet = SPREADSHEET.getSheetByName(nameSheet) 
           || SPREADSHEET.insertSheet(nameSheet);
      if (sheet.getLastRow() === 0) {
        insertValuesInSheet(sheet, HEAD);
      }
    } catch (e2) {
      Logger.log("Reintento fallido:", e2);
    }
  }
  return sheet;
}

const normalizeGeneralData = ({dataDocents, dataNorm}) => {
  let response = []
  try {
      dataNorm.map((docent) => {
        //  const findDocent = dataDocents.find((item) => String(item?.docIdentificacion) === String(docent.cedula))

        // let nombreCompleto = findDocent?.nombreCompleto;

        response.push([
            String(docent?.cedula),
            String(''),
            String(getNameSchoolByDep({ dataSchool: docent})),
            String(getNameByDep({ dataDep: docent})),
            String(docent?.tipoDeActividad),
            String(docent?.categoria),
            String(docent?.nombreDeActividad),
            parseFloat(docent?.["númeroDeHoras"]),
            '',
            String(docent?.periodo),
            String(docent?.porcentajeHoras ?? ''),
            String(docent?.detalleActividad ?? ''),
            String(getNameActivity({dataDep: docent})),
            String(''),
            String(''),
            String(''),
            String(''),
        ])
      })
  } catch (e) {
    Logger.log(e)
  }
  return response
}

const getNameSchoolByDep = ({ dataSchool }) => {
  let response = "N/A"

  if (dataSchool?.escuela !== '') {
    response = namesSchool[dataSchool?.escuela]
  }

  if (dataSchool?.escuela?.length <= 0) {
    const nameDep = namesDepartament[dataSchool?.departamento]
    response = namesOfSchool[nameDep]
  }

  return response
}

const getNameByDep = ({ dataDep }) => {
  let response = "Escuela"

  if (dataDep?.departamento !== '') {
    response = namesDepartament[dataDep?.departamento]
  }

  if (response === undefined) {
    Logger.log(dataDep)
    response = 'Escuela'
  }

  return response
}

const getNameActivity = ({ dataDep }) => {
  let response = 'N/A'

  if (dataDep?.tipoDeActividad == "Docencia") {
    response = dataDep?.categoria
  }
  else if (dataDep?.tipoDeActividad !== '') {
    response = dataDep?.tipoDeActividad
  }

  return response
}

function insertValuesInSheet(newSheet, values) {
    // Obtiene la última fila con datos
    const lastRow = newSheet.getLastRow();

    // Calcula la fila de inicio para insertar nuevos valores
    let startRow = lastRow + 1;

    // Verifica si hay suficientes filas disponibles
    if (startRow + values.length > newSheet.getMaxRows()) {
        // Agrega filas adicionales para acomodar los nuevos datos
        const extraRowsNeeded = (startRow + values.length) - newSheet.getMaxRows();
        newSheet.insertRowsAfter(newSheet.getMaxRows(), extraRowsNeeded);
    }

    // Inserta los valores en la hoja
    values.forEach((rowValues, index) => {
        const rowIndex = startRow + index;
        newSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    });

    Logger.log("Inserto")
}
