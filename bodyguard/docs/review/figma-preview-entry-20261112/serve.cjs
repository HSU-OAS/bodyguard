const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.argv[2]);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.mp4':'video/mp4','.wasm':'application/wasm','.glb':'model/gltf-binary','.md':'text/plain; charset=utf-8'};
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/bodyguard/')) {res.writeHead(302,{Location:'/bodyguard/'});return res.end();}
  const file = path.resolve(root, decodeURIComponent(url.pathname.slice('/bodyguard/'.length)) || 'index.html');
  if (!file.startsWith(root + '/')) {res.writeHead(403);return res.end();}
  fs.readFile(file, (error, bytes) => {
    res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(error?'not found':bytes);
  });
}).listen(0,'127.0.0.1',function(){console.log(`http://127.0.0.1:${this.address().port}/bodyguard/`);});
