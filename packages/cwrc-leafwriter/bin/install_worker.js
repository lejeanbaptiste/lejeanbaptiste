//run this file after install the package
//eg,
// node node_modules/@cwrc/leaf-writer/bin/install_worker.js [web-root-folder]

//? OR
// * maybe webworker should be loaded async on demand in the browser when leaf-writer loads.


const fs = require('fs');
const path = require('path');
const src = path.join('node_modules', '@cwrc/leafwriter-validator', 'dist', 'leafwriter-validator.worker.js');
const dst = path.join(process.argv[2], 'leafwriter-validator.worker.js');

try {
  fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL);
  console.log('file is copied');
} catch (error) {
  console.log(error);
}
