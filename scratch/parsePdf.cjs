const fs = require('fs');
const { PDFParse } = require('pdf-parse');

const dataBuffer = fs.readFileSync('scratch/1_SEM_result.pdf');
const pdfParser = new PDFParse();

pdfParser.parse(dataBuffer).then(function(data) {
  fs.writeFileSync('scratch/1_SEM_result.txt', JSON.stringify(data, null, 2));
  console.log('PDF text parsed successfully!');
}).catch(err => {
  console.error('Failed to parse PDF:', err);
});
