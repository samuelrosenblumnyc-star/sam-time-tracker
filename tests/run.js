// Runs every test file in this folder against a local copy of the app.
//   node tests/run.js            (all tests)
//   node tests/run.js undo       (only files whose name contains "undo")
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const root = path.join(__dirname, '..'), types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
server.listen(0, async () => {
  const url = `http://localhost:${server.address().port}/index.html`, only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter(f => /^\d+-.*\.js$/.test(f) && (!only || f.includes(only))).sort();
  let bad = 0;
  for (const f of files) {
    // asynchronous on purpose: a synchronous child process would freeze this web server while the test loads the page
    const out = await new Promise(resolve => { let o = ''; const c = spawn('node', [path.join(__dirname, f), url]); c.stdout.on('data', d => o += d); c.stderr.on('data', d => o += d); c.on('close', code => resolve({ code, o })); });
    const fail = out.code !== 0;
    console.log(`${fail ? 'FAIL' : 'ok  '}  ${f}`);
    if (fail) { bad++; console.log(out.o.split('\n').filter(l => /FAIL|Error|\u2717/.test(l)).slice(0, 12).join('\n')); }
  }
  console.log(bad ? `\n${bad} of ${files.length} test files failed` : `\nAll ${files.length} test files passed`);
  server.close(); process.exit(bad ? 1 : 0);
});
