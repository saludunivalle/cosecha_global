function processOptionGeneral(option, name) {
  try {
    const optionName = String(name).trim().toLocaleLowerCase();
    Logger.log('Opción seleccionada: ' + optionName);

    const data = getSheetUrl({ url: SHEET_URL }).getSheetByName(optionName);
    const sheet = getSheetUrl({ url: SHEET_URL }).getSheetByName('General');

    // Verificamos que no se esté utilizando la misma hoja
    if (data.getName() === sheet.getName()) {
      Logger.log('La hoja de origen y destino son iguales. Abortando.');
      return;
    }

    // Obtiene el rango de datos y filtra para omitir la cabecera (índice 0)
    const range = data.getDataRange();
    const values = range.getValues().filter((item, index) => index > 0);
    Logger.log(values);

    // Inserta los valores en la hoja General, agregando filas si es necesario
    insertValues(sheet, values);

    return 'exito';
  } catch (error) {
    Logger.log('Error en processOptionGeneral: ' + error.message);
  }
}

function insertValues(newSheet, values) {
  // Obtiene la última fila con datos en la hoja destino
  const lastRow = newSheet.getLastRow();
  // Define la fila de inicio para los nuevos datos
  const startRow = lastRow + 1;

  // Verifica si existen suficientes filas; si no, se agregan las faltantes
  if (startRow + values.length - 1 > newSheet.getMaxRows()) {
    const extraRowsNeeded = (startRow + values.length - 1) - newSheet.getMaxRows();
    newSheet.insertRowsAfter(newSheet.getMaxRows(), extraRowsNeeded);
  }

  // Inserta los valores en la hoja, fila por fila
  values.forEach((rowValues, index) => {
    const rowIndex = startRow + index;
    newSheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  });
}
