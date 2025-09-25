#!/usr/bin/env node
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.MCP_PROXY_PORT || 8787);
const TARGET = process.env.MCP_PROXY_TARGET || 'http://127.0.0.1:3000';

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

async function forwardRequest(body, headers = {}) {
  const targetUrl = new URL('/api/mcp', TARGET);
  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers['x-mcp-token'] ? { 'x-mcp-token': headers['x-mcp-token'] } : {}),
    },
    body
  });

  const responseText = await upstream.text();
  return {
    status: upstream.status,
    headers: Object.fromEntries(upstream.headers.entries()),
    body: responseText
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, status: 'MCP proxy ready' });
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/mcp')) {
      const body = await readBody(req);
      const result = await forwardRequest(body, req.headers);
      const contentType = result.headers['content-type'] || 'application/json';
      res.writeHead(result.status, { 'Content-Type': contentType });
      res.end(result.body);
      return;
    }

    sendJson(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    console.error('[dev-mcp-proxy] forward failed', error);
    sendJson(res, 502, { ok: false, error: 'proxy_failure', message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`[dev-mcp-proxy] listening on http://127.0.0.1:${PORT}`);
  console.log(`[dev-mcp-proxy] forwarding to ${TARGET}`);
});
