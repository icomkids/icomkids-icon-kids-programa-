import build from 'next/dist/build/index.js';
try { await build.default(process.cwd(),false,false,false,false,false,false,1); } catch(error) { console.error(error.stack); process.exitCode=1; }
