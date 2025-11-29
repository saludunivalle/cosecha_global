
function addHeadings(sheetValues, headings) {
  return sheetValues.map(row => {
    const sheetValuesAsObject = {};

    headings.forEach((heading, column) => {
      sheetValuesAsObject[heading] = row[column];
    });

    return sheetValuesAsObject;
  });
}

function sheetValuesToObject(values, headers) {
  const headings = headers || values[0];
  let sheetValues = null;
  if (values) sheetValues = headers ? values : values.slice(1);
  return addHeadings(sheetValues, headings.map(camelCase));
}

function normalizeString(value) {
  return String(value || '')
    .trim()
    .replace(/ +/g, '')
    .toLowerCase();
}

function camelCase(string) {
  return String(string)
    .toLowerCase()
    .replace(/\s(.)/g, a => a.toUpperCase())
    .replace(/\s/g, '');
}
