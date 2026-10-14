const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{'Allow':'GET, HEAD'});response.end();return;}
  let pathname;
  try {pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch{response.writeHead(400);response.end('Bad request');return;}
  if(pathname==='/' || pathname==='/mobile' || pathname==='/mobile/')pathname='/index.html';
  else if(pathname.startsWith('/mobile/'))pathname=pathname.slice('/mobile'.length);
  const file=path.resolve(root,'.'+pathname), relative=path.relative(root,file);
  if(relative.startsWith('..') || path.isAbsolute(relative) || !['index.html','styles.css','theme.css','ui.css','motion.css','motion.js','day-transfer.js','theme.js','course-schedule.js','timetable.js','date-picker.js','course-import.js','app.js','sw.js','manifest.webmanifest'].includes(relative) && !relative.startsWith('assets'+path.sep)){response.writeHead(404);response.end('Not found');return;}
  fs.readFile(file,(error,content)=>{if(error){response.writeHead(404);response.end('Not found');return;}response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});response.end(request.method==='HEAD' ? undefined : content);});
}).listen(port,'0.0.0.0',()=>console.log(`课间已启动：http://localhost:${port}\n手机连接同一 Wi-Fi 后访问 http://电脑局域网IP:${port}\n安装与离线功能需要 HTTPS 或 localhost。`));
