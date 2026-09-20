// Export the actual generated script, not the surrounding TypeScript template.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/utils/gasScriptTemplate.ts', 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const code = context.exports.getGoogleAppsScriptCode();
new vm.Script(code);
fs.writeFileSync(process.argv[2], code, 'utf8');
