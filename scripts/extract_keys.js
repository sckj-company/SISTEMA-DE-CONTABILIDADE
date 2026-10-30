const fs = require('fs');
const path = require('path');

function extractCallsWithDefaults(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const res = {};
  const regex = /\bt\(\s*['"]([^'"]+)['"](?:\s*,\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`))?/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const def = match[2] || match[3] || match[4] || '';
    if (!res[key]) {
      res[key] = def;
    }
  }
  return res;
}

const lanc = extractCallsWithDefaults('frontend/src/components/contabilidade/LancamentosView.jsx');
const docs = extractCallsWithDefaults('frontend/src/pages/Documentos.jsx');
const fact = extractCallsWithDefaults('frontend/src/pages/Facturas.jsx');

console.log('Lancamentos keys count:', Object.keys(lanc).length);
console.log('Documentos keys count:', Object.keys(docs).length);
console.log('Facturas keys count:', Object.keys(fact).length);

fs.writeFileSync('scripts/extracted_operational.json', JSON.stringify({ lanc, docs, fact }, null, 2));
console.log('Saved to scripts/extracted_operational.json');
