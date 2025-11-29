const getAllSheetNames = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  return sheets
    .map(sheet => sheet.getName())
    .filter(name => /\bdocentes?\b/i.test(name))
    .map(name => ({ name: name, value: name }));

};

const getAllSheetNoDocents = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  return sheets
    .map(sheet => sheet.getName())
    .filter(name => !(/\bdocentes?\b/i.test(name)))
    .map(name => ({ name: name, value: name }));

};

function processOptionDocente(option,name) {
  try {
        const optionName = String(option).trim()
        const response = teacherNoFoundOption(optionName)
        const message = !response? 'Ha ocurrido un error' : 'Se ha creado la Asignación academica con exito'

        return message
  } catch (e) {
    return `Ha ocurrido un error ${e}`
  }
}