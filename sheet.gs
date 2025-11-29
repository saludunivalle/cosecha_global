
// Conf Global
const SHEET = SpreadsheetApp.openByUrl(
    'https://docs.google.com/spreadsheets/d/1OwsIy5CXdsJ_2qzWCsxXi7v0cWT7L99KrGWZBOHA3_o/edit',
);

const init = () => {
  Logger.log("Iniciamos")
      var sheet = SpreadsheetApp.getActive().insertSheet();
    sheet.setName("Prueba");
}

const getDataSheet = (nameSheet = 'configuracion') => {
  let response = null
  try {
    const data = SHEET.getSheetByName(nameSheet)
    const range =  data.getDataRange();
    const values = range.getValues();
    response = sheetValuesToObject(values)
  } catch (e) {
    Logger.log(e)
  }
  return response
}

const getDataSheetPeerName = ({ url, nameSheet }) => {
  let response = []
  try {
      const SHEET = SpreadsheetApp.openByUrl(url);
      const data = SHEET.getSheetByName(nameSheet)
      const range =  data.getDataRange();
      const values = range.getValues();
      const dataNorm = normalizeData({
        data: sheetValuesToObject(values),
        nameSheet: nameSheet
      })

      const newName = "Normalizado"
      let newSheet = SHEET.getSheetByName(newName);
      if (!newSheet) {
        newSheet = SHEET.insertSheet(newName);
      } else {
        newSheet.clear();
      }

      const numRows = dataNorm.length;
      const numCols = dataNorm[0].length;
      
      if (newSheet.getMaxColumns() < numCols) {
        newSheet.insertColumnsAfter(newSheet.getMaxColumns(), numCols - newSheet.getMaxColumns());
      }
      if (newSheet.getMaxRows() < numRows) {
        newSheet.insertRowsAfter(newSheet.getMaxRows(), numRows - newSheet.getMaxRows());
      }

      newSheet.getRange(1, 1, numRows, numCols).setValues(dataNorm)
     
      response = sheetValuesToObject(dataNorm)
  } catch (e) {
    Logger.log(e)
  }
  return response
}

/***
 * Normalize data
 */
const normalizeData = ({ data, nameSheet }) => {
  let response = []
  response.push(headsNormalize)
  try {
    data.map((element) => {
      response.push([
        String(element?.doc_cc),
        '',
        getNameSchool(String(element?.dep_nombre)),
        getNameDepartment(String(element?.dep_nombre)),
        `${activityNames[nameSheet]}`,
        `${element[nameSheet]? element[nameSheet] : getCategoryNameData(element,nameSheet)}`,
        namesActivityFile(element)[nameSheet],
        getHoursByFile(element)[nameSheet],
        '',
        `${element?.per_ano}-${element?.per_semestre}`,
        element?.doc_porcentaje,
        element?.cla_nombre
      ])
    })
  } catch(e) {
    Logger.log(e)
  }
  return response
}

const getCategoryNameData = (element,nameSheet) => {
  if (element?.[categoryName?.[nameSheet]] === undefined) {
      return categoryName[nameSheet]
  }
  return element?.[categoryName?.[nameSheet]]
}

const getNameSchool = (nameSchool) => {
  const regex = /(ODONTOLOGIA|BACTERIOLOGIA|BACTERIOLOGIA Y LABORAT CLINICO|ENFERMERIA|MEDICINA|SALUD PUBLICA|REHABILITACION HUMANA|CIENCIAS BASICAS)/i;
  let response = nameSchool.match(regex)
  return response ? response[1] : "";
}

const getNameDepartment = (nameDep) => {
  const regex = /DEPARTAMENTO DE/i
  let response = nameDep.match(regex)
  return response ? nameDep.slice(response[0].length + 1, nameDep.length) : "Escuela";
}


const namesActivityFile = (element) => {
  return {
      'z_01_SALUD_PREGRADO': `${element?.doc_codigo} - ${element?.mat_nombre}`,
      'z_02_SALUD_POSGRADO': `${element?.doc_codigo} - ${element?.mat_nombre}`,
      'z_03_SALUD_TESIS': `${element?.doc_codigoe} - ${element?.doc_nombre}`,
      'z_04_SALUD_INV_PROYECTOS': `${element?.inv_codigo} - ${element?.proy_nombre}`,
      'z_05_SALUD_INV_ANTEPROYECTOS': `${element?.ant_nombre}`,
      'z_06_SALUD_EXTENSION': `${element?.act_extension_ext_nombre}`,
      'z_07_SALUD_EXTENSION_BONIFICADA': `${element?.ext_codigo} - ${element?.mat_nombre}`,
      'z_08_SALUD_INTELECTUAL': `${element?.int_nombre}`,
      'z_09_SALUD_ADMINISTRATIVOS': `${element?.adm_nombre}`,
      'z_10_SALUD_COMPLEMENTARIAS': `${element?.act_complementaria_com_nombre}`,
      'z_11_SALUD_OTRAS': `${element?.comi_descripcion}`,
  }
}

const getHoursByFile = (element) => {
  return {
    'z_01_SALUD_PREGRADO': Number(parseFloat(element?.doc_horas ?? 0).toFixed(1)),
    'z_02_SALUD_POSGRADO': Number(parseFloat(element?.doc_horas ?? 0).toFixed(1)),
    'z_03_SALUD_TESIS': Number(parseFloat(element?.doc_horas ?? 0).toFixed(1)),
    'z_04_SALUD_INV_PROYECTOS': Number(parseFloat(element?.inv_horas ?? 0).toFixed(1)),
    'z_05_SALUD_INV_ANTEPROYECTOS': Number(parseFloat(element?.ant_horas ?? 0).toFixed(1)),
    'z_06_SALUD_EXTENSION': Number(parseFloat(element?.ext_horas ?? 0).toFixed(1)),
    'z_07_SALUD_EXTENSION_BONIFICADA': Number(parseFloat(element?.ext_horas ?? 0).toFixed(1)),
    'z_08_SALUD_INTELECTUAL': Number(parseFloat(element?.int_horas ?? 0).toFixed(1)),
    'z_09_SALUD_ADMINISTRATIVOS': Number(parseFloat(element?.adm_horas ?? 0).toFixed(1)),
    'z_10_SALUD_COMPLEMENTARIAS': Number(parseFloat(element?.com_horas ?? 0).toFixed(1)),
    'z_11_SALUD_OTRAS': Number(parseFloat(element?.comi_horas ?? 0).toFixed(1)),
  };
}


