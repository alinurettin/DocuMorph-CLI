// DocuMorph-CLI v2.0.0 - Production HTTP Server & SSE Gateway
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { DocumentTransformer } = require('./engine');

const transformer = new DocumentTransformer();
const PORT = parseInt(process.env.PORT, 10) || 6007;
const publicDir = path.join(__dirname, '..', 'public');
const startTime = Date.now();

function requestHandler(req, res) {
  const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = reqUrl.pathname;

  // CORS Headers
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // SSE Live Stream Endpoint
  if (req.method === 'GET' && pathname === '/api/events/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('retry: 3000\n\n');

    const initData = JSON.stringify({
      type: 'INIT',
      metrics: transformer.metrics(),
      timestamp: Date.now()
    });
    res.write(`event: init\ndata: ${initData}\n\n`);

    transformer.subscribe(res);
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const jsonRes = (statusCode, data) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(data));
    };

    // 1. Health API
    if (pathname === '/api/health') {
      return jsonRes(200, {
        status: 'UP',
        service: 'DocuMorph-CLI',
        version: '2.0.0',
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      });
    }

    // 2. Stats & Telemetry API
    if (pathname === '/api/stats') {
      return jsonRes(200, {
        success: true,
        service: 'DocuMorph-CLI',
        version: '2.0.0',
        metrics: transformer.metrics()
      });
    }

    // 3. Markdown Transformation API
    if (req.method === 'POST' && pathname === '/api/transform/markdown') {
      try {
        const data = JSON.parse(body || '{}');
        const md = data.markdown !== undefined ? String(data.markdown) : '';
        const result = transformer.markdownToHtml(md);
        return jsonRes(200, { success: true, html: result.html, ast: result.ast });
      } catch (err) {
        return jsonRes(400, { success: false, error: err.message });
      }
    }

    // 4. CSV Transformation API
    if (req.method === 'POST' && pathname === '/api/transform/csv') {
      try {
        const data = JSON.parse(body || '{}');
        const csv = data.csv || '';
        const mode = data.mode || 'json'; // 'json' or 'markdown'

        if (mode === 'markdown') {
          const table = transformer.csvToMarkdownTable(csv);
          return jsonRes(200, { success: true, table });
        } else {
          const json = transformer.csvToJson(csv);
          return jsonRes(200, { success: true, json });
        }
      } catch (err) {
        return jsonRes(400, { success: false, error: err.message });
      }
    }

    // 5. YAML <-> JSON Transformation API
    if (req.method === 'POST' && pathname === '/api/transform/yaml') {
      try {
        const data = JSON.parse(body || '{}');
        const action = data.action || 'toYaml'; // 'toYaml' or 'toJson'

        if (action === 'toYaml') {
          const yaml = transformer.jsonToYaml(data.data || {});
          return jsonRes(200, { success: true, yaml });
        } else {
          const json = transformer.yamlToJson(String(data.yaml || ''));
          return jsonRes(200, { success: true, json });
        }
      } catch (err) {
        return jsonRes(400, { success: false, error: err.message });
      }
    }

    // 6. Document Diff API
    if (req.method === 'POST' && pathname === '/api/diff') {
      try {
        const data = JSON.parse(body || '{}');
        const textA = String(data.textA || '');
        const textB = String(data.textB || '');
        const diffResult = transformer.diffDocuments(textA, textB);
        return jsonRes(200, { success: true, diff: diffResult });
      } catch (err) {
        return jsonRes(400, { success: false, error: err.message });
      }
    }

    // 7. Readability & Metrics API
    if (req.method === 'POST' && pathname === '/api/metrics') {
      try {
        const data = JSON.parse(body || '{}');
        const text = String(data.text || '');
        const metrics = transformer.computeMetrics(text);
        return jsonRes(200, { success: true, metrics });
      } catch (err) {
        return jsonRes(400, { success: false, error: err.message });
      }
    }

    // 8. Static Web UI Files
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      return res.end(fs.readFileSync(filePath));
    }

    jsonRes(404, { error: 'Endpoint not found' });
  });
}

function startServer(portToUse = PORT, callback) {
  const server = http.createServer(requestHandler);
  server.listen(portToUse, callback);
  return server;
}

if (require.main === module) {
  startServer(PORT, () => {
    console.log(`⚡ DocuMorph-CLI v2.0.0 live at http://localhost:${PORT}`);
  });
}

module.exports = { startServer, transformer };
