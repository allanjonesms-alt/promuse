import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/import React, {/g, "import { firebaseApiFetch } from './lib/api';\nimport React, {");

// Replace fetch('/api/...') with firebaseApiFetch('/api/...')
// Be careful with new line or spacing
content = content.replace(/await fetch\('\/api\//g, "await firebaseApiFetch('/api/");
content = content.replace(/await fetch\(\`\/api\//g, "await firebaseApiFetch(`/api/");

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Rewritten App.tsx');
