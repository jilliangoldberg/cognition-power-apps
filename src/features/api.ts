export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    signal: AbortSignal.timeout(15_000),
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-Workbench-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => {
    if (!response.ok) throw new HttpError(response.status, 'Request failed.');
    throw new Error('Invalid API response. No success is implied.');
  });
  if (!response.ok)
    throw new HttpError(
      response.status,
      typeof data?.error === 'string' ? data.error : 'Request failed.',
    );
  return data as T;
}
