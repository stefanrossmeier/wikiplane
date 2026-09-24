import { createServer } from 'node:http';

const port = Number(process.env.WIKIPLANE_HEALTH_PORT ?? '8020');
const dependencies = [
  process.env.MODEL_GATEWAY_HEALTH ?? 'http://model-gateway:8000/health',
  process.env.MARKITDOWN_HEALTH ?? 'http://markitdown:8010/health',
];

createServer(async (_request, response) => {
  const results = await Promise.all(
    dependencies.map(async (url) => {
      try {
        const result = await fetch(url, { signal: AbortSignal.timeout(2500) });
        return { url, ok: result.ok };
      } catch (error) {
        return { url, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }),
  );
  const ok = results.every((item) => item.ok);
  response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', service: 'wikiplane', dependencies: results }));
}).listen(port, '0.0.0.0');
