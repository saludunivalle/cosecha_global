function processOption(option,name) {
  try {
        const optionName = String(name).trim().toLocaleLowerCase()
        const regex = /as[ií]gnaci[oó]n\s+(.+)/i;
        const match = optionName.match(regex);
        Logger.log('Opción seleccionada: ' +  match[1]);

        if (match && match[1]) {

          const listNames = getListSheetNames()
          if (listNames.includes(match[1])) {
                const ui = SpreadsheetApp.getUi();
                const response = ui.alert(
                  'Confirmación',
                  `La hoja "${optionName}" ya existe. ¿Está seguro de que desea renovar la información?`,
                  ui.ButtonSet.YES_NO
                );

                if (response === ui.Button.YES)
                     cleanSheet(`${match[1]}`)

                if (response === ui.Button.NO) 
                      return 'Accion cancelada con exito!!'
          }

          const response = convertXmlsFiles(option)
          const message = !response? 'Ha ocurrido un error' : 'Se ha creado la Asignación academica con exito'

          if (match[1] !== null) {
            SpreadsheetApp.getUi().alert(`Se ha iniciado proceso de creacion de la Asignación`);
            const nameSheet = `${match[1]}`
            listFolderDrive(option,nameSheet)

            const filesDrive = getFilesOptions()
            const newPeriod = getNewPeriod(match[1])
            const driveUrlPrevPeriod = filesDrive.find((item) => String(item.name).trim() === String(`Asignación ${newPeriod}`))
            Logger.log(driveUrlPrevPeriod)
            if (driveUrlPrevPeriod == null)
                SpreadsheetApp.getUi().alert(`No se ha encontrado, periodo vigente`);

            if (driveUrlPrevPeriod?.value !== '') {
                convertXmlsFiles(driveUrlPrevPeriod.value)
                listFolderDrive(driveUrlPrevPeriod.value,nameSheet)
            }
            teacherNoFound(nameSheet)
          }
          return message
        }
  } catch (e) {
    return `Ha ocurrido un error ${e}`
  }

}

function getNewPeriod(currentPeriod) {
  let response = null
  const periodo = currentPeriod.trim();
  const periodoRegex = /^(\d{4})-(\d)/; 
  const periodoMatch = periodo.match(periodoRegex);

  if (periodoMatch) {
    const year = parseInt(periodoMatch[1], 10);
    const term = parseInt(periodoMatch[2], 10);

    let newYear, newTerm;
    if (term === 2) {
      newYear = year;
      newTerm = 1;
    } else if (term === 1) {
      newYear = year - 1;
      newTerm = 2;
    }

    response = `${newYear}-${newTerm}`;
    Logger.log('Nuevo período: ' + response);
  }

  return response
}