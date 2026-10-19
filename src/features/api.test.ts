import { describe, expect, it, vi } from 'vitest';
import { api, HttpError } from './api';

describe('API failure integrity', () => {
  it.each(['not JSON', 'null', '{"error":123}'])(
    'retains unauthorized status for malformed error body %s',
    async (body) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 401 }));
      const request = api('/session');
      await expect(request).rejects.toMatchObject({ status: 401 });
      await expect(request).rejects.toBeInstanceOf(HttpError);
    },
  );
  it('does not imply success for an unreadable successful response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid JSON'));
    await expect(api('/kyc')).rejects.toThrow('No success is implied');
  });
});
