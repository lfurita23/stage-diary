const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleObject = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/calendar.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText, { exports: moduleObject.exports, TextEncoder });
module.exports = moduleObject.exports;
