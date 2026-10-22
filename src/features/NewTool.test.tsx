import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewTool } from './NewTool';

const prompt = 'A search page where Support look up a customer by email and see open refunds.';

describe('New tool page', () => {
  it('starts empty, explains the next steps and withholds the request', () => {
    render(<NewTool />);
    expect(screen.getByRole('region', { name: 'What happens next' })).toHaveTextContent(
      'After the PR is reviewed and merged',
    );
    expect(screen.getByText('Describe the tool you want.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy request/ })).not.toBeInTheDocument();
  });

  it('fills a starter from a chip, swaps untouched starters, and never overwrites typed text', async () => {
    const user = userEvent.setup();
    render(<NewTool />);
    const box = screen.getByLabelText('Describe the tool you want');
    await user.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((box as HTMLTextAreaElement).value).toContain('A dashboard for [who]');
    expect(screen.getByText(/Replace the bracketed parts/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Intake form' }));
    expect((box as HTMLTextAreaElement).value).toContain('A form where [who]');
    await user.clear(box);
    await user.type(box, prompt);
    await user.click(screen.getByRole('button', { name: 'Approval queue' }));
    expect(box).toHaveValue(prompt);
    expect(screen.getByRole('button', { name: 'Approval queue' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('copies the wrapped request and links to Devin', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<NewTool />);
    await user.click(screen.getByRole('button', { name: 'Lookup / search' }));
    await user.clear(screen.getByLabelText('Describe the tool you want'));
    await user.type(screen.getByLabelText('Describe the tool you want'), prompt);
    await user.click(screen.getByRole('button', { name: /Copy request/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(prompt));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('(lookup / search)'));
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    expect(screen.getByRole('link', { name: /Open Devin/ })).toHaveAttribute(
      'href',
      'https://app.devin.ai',
    );
  });

  it('falls back to manual copy when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(<NewTool />);
    await user.type(screen.getByLabelText('Describe the tool you want'), prompt);
    await user.click(screen.getByRole('button', { name: /Copy request/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy automatically');
  });

  it('starts a Devin session only after confirmation when the dev server has a key', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ url: 'https://app.devin.ai/sessions/abc' }))
        : new Response(JSON.stringify({ enabled: true, maxAcu: 7 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<NewTool />);
    await user.type(screen.getByLabelText('Describe the tool you want'), prompt);
    await user.click(await screen.findByRole('button', { name: /Send to Devin/ }));
    const dialog = screen.getByRole('dialog', { name: 'Start a Devin session?' });
    expect(dialog).toHaveTextContent('up to 7 ACUs');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(within(dialog).getByRole('button', { name: 'Start session' }));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/devin/session',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ prompt, kind: null });
    expect(await screen.findByRole('link', { name: 'Open the Devin session' })).toHaveAttribute(
      'href',
      'https://app.devin.ai/sessions/abc',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows the server error and leaves no session link', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? new Response(
              JSON.stringify({ error: 'Wait a minute before sending another request.' }),
              {
                status: 429,
              },
            )
          : new Response(JSON.stringify({ enabled: true, maxAcu: 10 })),
      ),
    );
    render(<NewTool />);
    await user.type(screen.getByLabelText('Describe the tool you want'), prompt);
    await user.click(await screen.findByRole('button', { name: /Send to Devin/ }));
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wait a minute');
    expect(screen.queryByRole('link', { name: 'Open the Devin session' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('explains how to enable sending when the server has no key', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ enabled: false }))),
    );
    render(<NewTool />);
    await user.type(screen.getByLabelText('Describe the tool you want'), prompt);
    expect(
      await screen.findByText(/put DEVIN_API_KEY and DEVIN_ORG_ID in a .env/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send to Devin/ })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
