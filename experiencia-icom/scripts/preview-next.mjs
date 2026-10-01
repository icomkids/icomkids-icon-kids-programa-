import {startServer} from 'next/dist/server/lib/start-server.js';
await startServer({dir:process.cwd(),isDev:true,hostname:'127.0.0.1',port:3000,allowRetry:false});
