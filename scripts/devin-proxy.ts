import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import {
  devinRequest,
  promptProblems,
  SEND_PATH,
  toolKinds,
  type ToolKind,
} from '../src/features/toolRequest';

// Dev-server-only bridge to the Devin API (https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions).
// The key stays in this Node process; the browser only ever sees { enabled, maxAcu } and the session link.
const API = 'https://api.devin.ai/v3/organizations';
export const COOLDOWN_MS = 60_000;
export const MAX_PER_RUN = 5;
const DEFAULT_ACU = 10;
const MAX_BODY = 16_000;

export interface DevinEnv {
  apiKey?: string;
  orgId?: string;
  maxAcu?: string;
}

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const fail = (status: number, error: string): Reply => ({ status, body: { error } });

export function createSender(env: DevinEnv, fetchImpl: typeof fetch = fetch, now = Date.now) {
  const enabled = Boolean(env.apiKey?.trim()) && /^org-[\w-]+$/.test(env.orgId ?? '');
  const acu = Number(env.maxAcu);
  const maxAcu = Number.isInteger(acu) && acu > 0 && acu <= 100 ? acu : DEFAULT_ACU;
  let sent = 0;
  let last = -Infinity;

  async function send(input: unknown): Promise<Reply> {
    if (!enabled) return fail(503, 'Sending to Devin is not set up on this server.');
    const { prompt, kind } = (input && typeof input === 'object' ? input : {}) as {
      prompt?: unknown;
      kind?: unknown;
    };
    if (typeof prompt !== 'string') return fail(400, 'Send a prompt.');
    const problems = promptProblems(prompt);
    if (problems.length) return fail(400, problems.join(' '));
    const toolKind = toolKinds.some((item) => item.id === kind) ? (kind as ToolKind) : null;
    if (sent >= MAX_PER_RUN)
      return fail(
        429,
        `This server has already started ${MAX_PER_RUN} sessions. Restart npm run dev to send more.`,
      );
    if (now() - last < COOLDOWN_MS)
      return fail(429, 'Wait a minute before sending another request.');
    // Reserve the slot before awaiting so a double click cannot start two sessions.
    sent += 1;
    const previous = last;
    last = now();
    const release = (reply: Reply) => {
      sent -= 1;
      last = previous;
      return reply;
    };
    let response: Response;
    try {
      response = await fetchImpl(`${API}/${env.orgId}/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.apiKey!.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: devinRequest(prompt, toolKind),
          title: 'Workbench: new tool request',
          tags: ['workbench-new-tool'],
          max_acu_limit: maxAcu,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return release(
        fail(502, 'Could not reach the Devin API. Check your connection and try again.'),
      );
    }
    if (!response.ok) {
      const hint =
        response.status === 401 || response.status === 403
          ? ' Check DEVIN_API_KEY and DEVIN_ORG_ID.'
          : '';
      return release(fail(502, `The Devin API returned ${response.status}.${hint}`));
    }
    const data = (await response.json().catch(() => null)) as {
      url?: unknown;
      session_id?: unknown;
    } | null;
    if (typeof data?.url !== 'string' || !data.url.startsWith('https://app.devin.ai/'))
      return fail(
        502,
        'The Devin API did not return a session link. Check app.devin.ai for the session.',
      );
    return { status: 200, body: { url: data.url, sessionId: data.session_id } };
  }

  return { enabled, maxAcu, send };
}

export function isSameOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function reply(res: ServerResponse, { status, body }: Reply) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > MAX_BODY) return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function devinProxy(env: DevinEnv): Plugin {
  return {
    name: 'workbench-devin-proxy',
    configureServer(server) {
      const sender = createSender(env);
      server.middlewares.use(SEND_PATH, (req, res) => {
        if (req.method === 'GET')
          return reply(res, {
            status: 200,
            body: { enabled: sender.enabled, maxAcu: sender.maxAcu },
          });
        if (req.method !== 'POST') return reply(res, fail(405, 'Use POST.'));
        if (!isSameOrigin(req.headers.origin, req.headers.host))
          return reply(res, fail(403, 'Requests must come from the Workbench page.'));
        void readJson(req).then(async (body) =>
          reply(res, body === null ? fail(400, 'Send a JSON body.') : await sender.send(body)),
        );
      });
    },
  };
}
