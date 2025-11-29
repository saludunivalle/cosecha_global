function onInstall() {
  onOpen(); 
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Automatizacion')
    .addItem('Asignaciones Academicas', 'modalOptionsPrint')
    .addItem('Encontrar Docentes', 'modalOptionsPrintDocents')
    .addItem('Actualizar datos','mergueModalOptionsPrint')
    .addItem('Agregar un nuevo periodo a General','mergueModalOptionsPrintGeneral')
    .addItem('--- Encontrar Docente ---','findMergueModalDocent')
    .addToUi();
}

//function openM

function modalOptionsPrint() {
  const html = HtmlService.createHtmlOutputFromFile('ModalOptions')
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Elige una opción');
}

function modalOptionsPrintDocents() {
  const html = HtmlService.createHtmlOutputFromFile('DocentsModalOptions')
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Elige una opción');
}

function mergueModalOptionsPrint() {
  const html = HtmlService.createHtmlOutputFromFile('MergueModalOptions')
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Elige una opción');
}

function mergueModalOptionsPrintGeneral() {
  const html = HtmlService.createHtmlOutputFromFile('MergueGeneral')
    .setWidth(500)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Elige una opción');
}

function findMergueModalDocent() {
  const html = HtmlService.createHtmlOutputFromFile('FindDocentByPhone')
    .setWidth(900)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Elige una opción');
}