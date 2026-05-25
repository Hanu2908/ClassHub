import fs from 'fs';
import pdf from 'pdf-parse';

const dataBuffer = fs.readFileSync('scratch/1_SEM_result.pdf');

pdf(dataBuffer).then(function(data) {
  fs.writeFileSync('scratch/1_SEM_result.txt', data.text);
  console.log('PDF text extracted successfully to scratch/1_SEM_result.txt!');
  console.log('Total characters extracted:', data.text.length);
}).catch(err => {
  console.error('Failed to parse PDF:', err);
});
