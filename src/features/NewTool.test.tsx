import { render, screen } from '@testing-library/react';
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
});
