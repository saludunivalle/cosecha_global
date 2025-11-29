var periodoActivoGlobal = null;

function verificarPermiso() {
    var userEmail = Session.getActiveUser().getEmail().toLowerCase();
    Logger.log("Correo del usuario activo: " + userEmail);

    var escuelasSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Escuelas");
    Logger.log("Acceso a la hoja de cálculo exitoso");

    var data = escuelasSheet.getDataRange().getValues();
    Logger.log("Datos obtenidos de la hoja: " + JSON.stringify(data));

    for (var i = 1; i < data.length; i++) {
        var correos = data[i][2].split(",");
        Logger.log("Correos en la fila " + i + ": " + correos);

        for (var j = 0; j < correos.length; j++) {
            var correoActual = correos[j].trim().toLowerCase();
            Logger.log("Comparando correo: " + correoActual);

            if (correoActual === userEmail) {
                Logger.log("Correo encontrado, el usuario tiene permiso");
                return true; 
            }
        }
    }

    Logger.log("Correo no encontrado, el usuario no tiene permiso");
    return false; 
}

function getPeriodos() {
  var periodoSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Periodo");
  var data = periodoSheet.getDataRange().getValues();
  var periodos = [];

  for (var i = 1; i < data.length; i++) {
    periodos.push(data[i][0]); 
  }

  return periodos;
}

// Nueva función para obtener el nombre a partir del correo
function extraerNombreDelCorreo(correo) {
  var partes = correo.split('@')[0].split('.');
  var nombre = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase();
  var apellido = partes[1] ? partes[1].charAt(0).toUpperCase() + partes[1].slice(1).toLowerCase() : '';
  return nombre + ' ' + apellido;
}

// Función para obtener el usuario y la escuela
function getUsuarioYEscuela() {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase();
  Logger.log("Usuario activo: " + userEmail);  // Log para verificar el correo

  var escuelasSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Escuelas");
  var data = escuelasSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var correos = data[i][2].split(",");
    for (var j = 0; j < correos.length; j++) {
      if (correos[j].trim().toLowerCase() === userEmail) {
        // Si encuentra el correo, devuelve el nombre y la escuela
        return {
          usuario: extraerNombreDelCorreo(userEmail), // Extrae el nombre del correo
          escuela: data[i][0] // La escuela está en la columna 1
        };
      }
    }
  }

  // Si no encuentra el correo, muestra un mensaje genérico o por defecto
  return { usuario: "Usuario no encontrado", escuela: "Escuela no encontrada" };
}


function doGet(e) {
  // if (!verificarPermiso()) {
  //   var output = "<script>alert('No tiene permiso para acceder a este formulario');</script>";
  //   return ContentService.createTextOutput(output);
  // }

  // if (!periodoActivoGlobal) {
  //   getPeriodoActivo();
  // }

  // var usuarioYEscuela = getUsuarioYEscuela();

  var template = HtmlService.createTemplateFromFile("FindDocentByPhone");
  // template.periodoActivo = periodoActivoGlobal;
  // template.getPeriodos = getPeriodos;
  // template.usuario = usuarioYEscuela.usuario;
  // template.escuela = usuarioYEscuela.escuela;

  // // Carga masiva de todos los datos
  // var allData = obtenerTodosLosDatos();  // Obtén todos los datos aquí
  // template.asignaciones = JSON.stringify(allData);  // Pasa los datos al frontend como JSON

  var htmlOutput = template.evaluate()
                           .setTitle("FindDocentByPhone")
                           .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  return htmlOutput;
}

function obtenerTodosLosDatos() {
  var ss = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");
  var sheet = ss.getSheetByName("Asignaciones2024");
  var data = sheet.getDataRange().getValues();

  var asignaciones = [];

  for (var i = 1; i < data.length; i++) {
    var asignacion = {
      cedula: data[i][0],
      nombreProfesor: data[i][1],
      escuela: data[i][2],
      departamento: data[i][3],
      tipoActividad: data[i][4],
      categoria: data[i][5],
      nombreActividad: data[i][6],
      numeroHoras: data[i][7],
      id: data[i][8],
      periodo: data[i][9]  // Asegúrate de incluir el periodo si es necesario
    };
    asignaciones.push(asignacion);
  }

  return asignaciones;
}


function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}


function getProfesores() {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase(); 
  Logger.log("Correo electrónico del usuario: " + userEmail);
  var escuelasSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Escuelas");

  var data = escuelasSheet.getDataRange().getValues();
  var escuelasUsuario = []; 
  var profesores = [];

  for (var i = 1; i < data.length; i++) {
    var correos = data[i][2].split(",");
    
    for (var j = 0; j < correos.length; j++) {
      if (correos[j].trim().toLowerCase() === userEmail) { 
        var escuela = data[i][0];
        var departamento = data[i][1];
        escuelasUsuario.push({ escuela: escuela, departamento: departamento }); // Agregar la escuela y departamento a la lista
        Logger.log("Escuela del usuario: " + escuela);
        Logger.log("Departamento del usuario: " + departamento);
        break;
      }
    }
  }
  
  var docentesSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Docentes");

  escuelasUsuario.forEach(function(escuelaUsuario) {
    var escuela = escuelaUsuario.escuela;
    //var departamento = escuelaUsuario.departamento;

    var docentesData = docentesSheet.getDataRange().getValues();
  
    for (var k = 1; k < docentesData.length; k++) {
      if (typeof docentesData[k][3] === 'string' && docentesData[k][3].toLowerCase() === escuela.toLowerCase()) { 
        profesores.push({
          nombre: docentesData[k][2],
          cedula: docentesData[k][1],
          escuela: docentesData[k][3],
          departamento: docentesData[k][4],
          //departamento: departamento // Usar el departamento del usuario
        }); 
      }
    }
  });

  Logger.log("Profesores obtenidos: " + JSON.stringify(profesores));
  return { profesores: profesores, escuelasUsuario: escuelasUsuario };
}

function enviarDatos(cedula, nombreProfesor, escuela, departamento, tipoActividad, categoria, nombreActividad, numeroHoras) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Asignaciones2024");

  var userEmail = Session.getActiveUser().getEmail();
  var escuelasSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Escuelas");
  var data = escuelasSheet.getDataRange().getValues();
  var permitido = false;

  for (var i = 1; i < data.length; i++) {
    var correos = data[i][2].split(",");
    
    for (var j = 0; j < correos.length; j++) {
      if (correos[j].trim() === userEmail) {
        permitido = true;
        break;
      }
    }
    
    if (permitido) {
      break;
    }
  }
  
  if (!permitido) {
    console.warn("No tiene permiso para enviar los datos.");
    return false;
  }

  // Obtener el nuevo ID automáticamente
  var lastRow = sheet.getLastRow();
  var lastID = sheet.getRange(lastRow, 9).getValue();  // Supongo que la columna 9 contiene los IDs
  var nuevoID = lastID ? lastID + 1 : 1;  // Si no hay IDs previos, empieza con 1

  if (!periodoActivoGlobal) {
    getPeriodoActivo();
  }

  sheet.appendRow([cedula, nombreProfesor, escuela, departamento, tipoActividad, categoria, nombreActividad, numeroHoras, nuevoID,periodoActivoGlobal]);
  
  return true;
}

function obtenerDatosAsignaciones2024(profesorSeleccionado, tipoActividadHoja, periodoSeleccionado) {
    var ss = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");
    var sheet = ss.getSheetByName("Asignaciones2024");
    var data = sheet.getDataRange().getValues();
    var asignaciones = [];

    Logger.log("Profesor seleccionado: " + profesorSeleccionado);
    Logger.log("Tipo de actividad hoja: " + tipoActividadHoja);
    Logger.log("Periodo seleccionado: " + periodoSeleccionado);

    // Filtrar las asignaciones por periodo, profesor y tipo de actividad
    for (var i = 1; i < data.length; i++) {
        var periodoAsignacion = data[i][9] ? data[i][9].trim().toLowerCase() : "";  // El periodo está en la columna 9
        var profesorAsignacion = data[i][1] ? data[i][1].trim().toLowerCase() : ""; // El profesor está en la columna 1
        var tipoActividadAsignacion = data[i][4] ? data[i][4].trim().toLowerCase() : ""; // El tipo de actividad está en la columna 4

        Logger.log("Periodo asignación: " + periodoAsignacion + " - Profesor asignación: " + profesorAsignacion + " - Tipo de actividad asignación: " + tipoActividadAsignacion);

        // Compara el periodo, profesor y tipo de actividad con los parámetros recibidos
        if (periodoAsignacion === periodoSeleccionado.trim().toLowerCase() &&
            profesorAsignacion === profesorSeleccionado.trim().toLowerCase() &&
            (tipoActividadHoja === tipoActividadAsignacion || 
             (Array.isArray(tipoActividadHoja) && tipoActividadHoja.includes(tipoActividadAsignacion)))) {
            
            Logger.log("Asignación coincidente encontrada");
            
            // Si coincide, agrega la asignación a la lista
            asignaciones.push({
                cedula: data[i][0],
                nombreProfesor: data[i][1],
                escuela: data[i][2],
                departamento: data[i][3],
                tipoActividad: data[i][4],
                categoria: data[i][5],
                nombreActividad: data[i][6],
                numeroHoras: data[i][7],
                id: data[i][8]
            });
        }
    }

    Logger.log("Asignaciones encontradas: " + asignaciones.length);
    return asignaciones; // Retorna las asignaciones filtradas
}


// Obtener periodo 
function getPeriodoActivo() {
    var periodoSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Periodo");
    var data = periodoSheet.getDataRange().getValues();

    for (var i = 1; i < data.length; i++) {
        var nombre = data[i][0];
        var activo = data[i][1];

        if (activo === "x") {
            periodoActivoGlobal = nombre;
            Logger.log("Periodo activo encontrado: " + periodoActivoGlobal); 
            break; 
        }
    }

    return periodoActivoGlobal;
}

function filtrarAsignacionesPorPeriodoProfesorYActividad(periodo, profesor, tipoActividad) {
  if (!periodo || !profesor || !tipoActividad) {
    console.log("Parámetros no definidos correctamente - Periodo: " + periodo + ", Profesor: " + profesor + ", Tipo de Actividad: " + tipoActividad);
    return [];  
  }

  var ss = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");
  var sheet = ss.getSheetByName("Asignaciones2024");
  var data = sheet.getDataRange().getValues();
  var asignaciones = [];

  // Verifica los valores que estás comparando
  console.log("Periodo recibido: " + periodo);
  console.log("Profesor recibido: " + profesor);
  console.log("Tipo de actividad recibido: " + tipoActividad);

  for (var i = 1; i < data.length; i++) {
    var periodoAsignacion = data[i][9] ? data[i][9].trim().toLowerCase() : "";
    var profesorAsignacion = data[i][1] ? data[i][1].trim().toLowerCase() : "";
    var tipoActividadAsignacion = data[i][4] ? data[i][4].trim().toLowerCase() : "";

    // Log para revisar cada fila que se está comparando
    console.log("Comparando Fila " + i + " - Periodo: " + periodoAsignacion + ", Profesor: " + profesorAsignacion + ", Tipo Actividad: " + tipoActividadAsignacion);

    if (periodoAsignacion === periodo.trim().toLowerCase() && 
        profesorAsignacion === profesor.trim().toLowerCase() && 
        tipoActividadAsignacion === tipoActividad.trim().toLowerCase()) {
      
      var asignacion = {
        cedula: data[i][0],
        nombreProfesor: data[i][1],
        escuela: data[i][2],
        departamento: data[i][3],
        tipoActividad: data[i][4],
        categoria: data[i][5],
        nombreActividad: data[i][6],
        numeroHoras: data[i][7],
        id: data[i][8],
      };
      
      console.log("Asignación añadida: " + JSON.stringify(asignacion));  // Log para verificar las asignaciones añadidas
      asignaciones.push(asignacion);
    }
  }

  console.log("Asignaciones filtradas: " + JSON.stringify(asignaciones));  // Verifica el resultado final
  return asignaciones;
}


function getUrlUsuarioActivo() {
  var userEmail = Session.getActiveUser().getEmail().toLowerCase();
  var escuelasSheet = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg").getSheetByName("Escuelas");
  var data = escuelasSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var correos = data[i][2].split(",");
    for (var j = 0; j < correos.length; j++) {
      if (correos[j].trim().toLowerCase() === userEmail) {
        return data[i][3]; // URL está en la columna 4 (índice 3)
      }
    }
  }

  return null; // Si no se encuentra la URL
}

function eliminarAsignacion(id) {
  var ss = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");
  var sheet = ss.getSheetByName("Asignaciones2024");
  var data = sheet.getDataRange().getValues();

  // Log para verificar el ID que llega a la función
  Logger.log("ID recibido para eliminar: " + id);

  // Buscar la fila que tiene el ID correcto
  for (var i = 1; i < data.length; i++) {
    if (data[i][8] == id) {  // Asegúrate de que la columna 8 contiene el ID
      Logger.log("Fila encontrada para eliminar en la fila: " + (i + 1));
      
      // Eliminar la fila
      sheet.deleteRow(i + 1);  // Recuerda que las filas comienzan en 1
      return true;  // Devuelve true si se eliminó con éxito
    }
  }
  
  Logger.log("No se encontró la asignación para eliminar con el ID: " + id);
  return false;  // Devuelve false si no se encontró la asignación
}


// Función para editar asignaciones en la hoja de cálculo
function editarAsignacion(id, nombreActividad, numeroHoras, periodo) {
  var ss = SpreadsheetApp.openById("1VPqOgVDhT41p6kyuEqXxuwqYi1zbEi5P1ulG5E9Zzgg");
  var sheet = ss.getSheetByName("Asignaciones2024");
  var data = sheet.getDataRange().getValues();

  // Convertir el ID a número para asegurarnos de que la comparación sea precisa
  var idNumerico = parseInt(id, 10);

  // Log para verificar los valores que llegan a la función
  Logger.log("ID recibido: " + idNumerico);
  Logger.log("Nombre de actividad recibido: " + nombreActividad);
  Logger.log("Número de horas recibido: " + numeroHoras);
  Logger.log("Periodo recibido: " + periodo);

  // Buscar la fila que tiene el ID y el periodo correcto
  for (var i = 1; i < data.length; i++) {
    var idFila = parseInt(data[i][8], 10); // Convertimos también el ID en la hoja a número
    var periodoFila = data[i][9].trim();  // Asegurarse de que no haya espacios extra

    if (idFila === idNumerico && periodoFila === periodo) {
      Logger.log("Fila encontrada en la fila: " + (i + 1));

      // Actualizar los valores en las celdas correspondientes
      sheet.getRange(i + 1, 7).setValue(nombreActividad);  // Nombre de la actividad
      sheet.getRange(i + 1, 8).setValue(numeroHoras);      // Número de horas
      Logger.log("Cambios guardados en la fila " + (i + 1));

      return true;
    }
  }

  Logger.log("No se encontró la asignación con el ID: " + id + " y el periodo: " + periodo);
  return false;
}

