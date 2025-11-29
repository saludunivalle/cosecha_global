
/**
 * Drive Functions
 */
const getSheetsFolder = (idFolder) => {
  let response = null
  try {
    const folder = DriveApp.getFolderById(idFolder)
    const files = folder.getFiles()
    Logger.log(files)
    response = files
  } catch (e) {
    Logger.log(e)
  }
  return response
}

/**
 * Drive Functions
 */
const getSubFolders = (idFolder) => {
  let response = null
  try {
    const folder = DriveApp.getFolderById(idFolder)
    const files = folder.getFolders()
    Logger.log(files)
    response = files
  } catch (e) {
    Logger.log(e)
  }
  return response
}