// conf global
const regex = /(?<=folders\/)[^? \n\r\t]*/;

const getFilesOptions = () => {
  let data = []
  try {
      // const
      const driveUrl = 'https://drive.google.com/drive/folders/1a_ftPl-M4z4JNLe5tjL2zyvieuU_xhbe?usp=sharing'
      const idFolder = driveUrl.match(regex)[0]
      const listFolder = getSubFolders(idFolder)
    while (listFolder.hasNext()) {
        const file = listFolder.next();
        Logger.log(file.getName())
        data.push({
          name: file.getName(),
          value: file.getUrl()
        })
    }
    Logger.log(data)
  } catch(e) {
    console.log(e)
  }
  return data
}

/***
 * Normalize Data
*/
const listFolderDrive = (driveUrl,nameSheetParam, nameSheetToSave=null) => {
  let response = false
  try {
    // const
    //const driveUrl = String(getDataSheet()[0].drive)
    const idFolder = driveUrl.match(regex)[0]
    const listFolder = getSheetsFolder(idFolder)

    while (listFolder.hasNext()) {
      const file = listFolder.next();
      console.log(file.getName())
      if (avalaibleFiles.includes(file.getName())) {
          const nameFolder = file.getName()
         
          const dataNormalizte = getDataSheetPeerName({
            url: file.getUrl(),
            nameSheet: nameFolder
          })

          // add data to general sheet
          generateSheetGeneral({
            normData: dataNormalizte,
            nameSheet: String(nameSheetParam),
            nameSheetToSave: nameSheetToSave
          })
      }
    }
    response = true;
  } catch(e) {
    Logger.log(e)
  }
  return response
}

/***
 * Normalize Data
*/
const convertXmlsFiles = (driveUrl) => {
  let response = false;
  let avaibleFilesRepeat = []
  let filesList = []
  try {
        const idFolder = driveUrl.match(regex)[0];
        const listFolder = getSheetsFolder(idFolder);

        while (listFolder.hasNext()) {
          const file = listFolder.next();
          avaibleFilesRepeat.push(file.getName())

          filesList.push({
            file: file,
          })
        }

        filesList.map( (item) => {
          const file = item.file

          if (avalaibleFilesXml.includes(file.getName())) {
            const fileName = file.getName();

            //let convertedSheet;
            if (fileName.endsWith('.xlsx') && !avaibleFilesRepeat.includes(fileName.slice(0,fileName.length - 5))) {
                // Convertir el archivo .xlsx a Google Sheets
                const fileId = file.getId();
                const resource = {
                    title: file.getName().replace('.xlsx', ''),
                    mimeType: MimeType.GOOGLE_SHEETS,
                };
                Drive.Files.copy(resource, fileId);  // Copia el archivo y lo convierte a Google Sheets

                Logger.log(`Archivo .xlsx convertido exitosamente: ${fileName}`);

                SpreadsheetApp.getUi().alert(`Conversión Exitosa de ${fileName}`);
              }
          }
        })
    response = true;
  } catch (e) {
    Logger.log(e);
  }
  return response;
}

/**
 * Generate Sheet Global
 */
const generateSheetGeneral = ({ normData, nameSheet, nameSheetToSave=null}) => {
  try {
       const dataDocents = []
       normalizeDataDocument({
         dataDocents: dataDocents,
         dataSheet: normData,
         nameSheetGeneral: nameSheet,
         nameSheetToSave: nameSheetToSave
       })
  } catch (e) {
    Logger.log(e)
  }
}

/**
 * Convierte un archivo Excel a Google Sheet.
 * @param {GoogleAppsScript.Drive.File} file - Archivo Excel a convertir.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null} - Hoja de cálculo creada o null si falla.
 */
const convertExcelToGoogleSheet = (file) => {
  try {
    const folder = DriveApp.getFolderById(file.getParents().next().getId());
    const copiedFile = file.makeCopy(file.getName().replace('.xlsx', ''), folder);
    return copiedFile;
  } catch (e) {
    Logger.log(`Error al convertir Excel a Google Sheet: ${e.message}`);
    return null;
  }
};

/**
 * Convierte un archivo XML a Google Sheet.
 * @param {GoogleAppsScript.Drive.File} file - Archivo XML a convertir.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} - Hoja de cálculo creada.
 */
const convertXmlToGoogleSheet = (file) => {
  try {
    const xmlContent = file.getBlob().getDataAsString();
    const document = XmlService.parse(xmlContent);
    const root = document.getRootElement();
    const data = parseXmlToArray(root);

    const spreadsheet = SpreadsheetApp.create(file.getName().replace('.xml', ''));
    const sheet = spreadsheet.getActiveSheet();
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

    return spreadsheet;
  } catch (e) {
    Logger.log(`Error al convertir XML a Google Sheet: ${e.message}`);
    return null;
  }
};

/**
 * Convierte un elemento XML en una matriz de datos.
 * @param {GoogleAppsScript.XML_Service.Element} root - Elemento raíz del XML.
 * @returns {Array<Array<string>>} - Matriz de datos extraídos del XML.
 */
const parseXmlToArray = (root) => {
  const data = [];
  const children = root.getChildren();
  children.forEach((child) => {
    const row = [];
    child.getChildren().forEach((subChild) => {
      row.push(subChild.getText());
    });
    data.push(row);
  });

  return data;
};