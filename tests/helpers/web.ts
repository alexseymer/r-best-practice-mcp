import { RPracticesWebServer, WebServerOptions } from '../../src/web-server';

export interface TestServer {
  base: string;
  server: RPracticesWebServer;
  stop: () => Promise<void>;
}

/** Start the real web server on an ephemeral port with the given environment. */
export async function startTestServer(
  env: NodeJS.ProcessEnv = {},
  options: Omit<WebServerOptions, 'env'> = {}
): Promise<TestServer> {
  const server = new RPracticesWebServer(0, { ...options, env });
  await server.start();
  const port = server.listeningPort();
  if (!port) throw new Error('server did not report a port');
  return { base: `http://127.0.0.1:${port}`, server, stop: () => server.stop() };
}

export interface JsonResponse {
  status: number;
  body: any;
  headers: Headers;
}

export async function postJson(
  base: string,
  route: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<JsonResponse> {
  const res = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body: parsed, headers: res.headers };
}
