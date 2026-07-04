const fs = require('node:fs');

/** Jest transform: import .txt prompt templates as string modules. */
module.exports = {
  process(_sourceText, sourcePath) {
    const text = fs.readFileSync(sourcePath, 'utf8');
    return { code: `module.exports = ${JSON.stringify(text)};` };
  },
};
