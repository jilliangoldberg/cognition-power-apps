import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewTool } from './NewTool';

describe('New tool page', () => {
  it('previews the example and copies a ready request', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<NewTool />);
    const preview = screen.getByRole('region', { name: 'Preview' });
    expect(within(preview).getByRole('heading', { name: 'Expense claims' })).toBeInTheDocument();
    expect(within(preview).getByText('Reimbursed')).toBeInTheDocument();
    expect(within(preview).getByText('Mark reimbursed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Copy request/ }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('npm run new-tool -- expense-claims "Expense claims"'),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    expect(screen.getByRole('link', { name: /Open Devin/ })).toHaveAttribute(
      'href',
      'https://app.devin.ai',
    );
  });

  it('updates the preview as you type and withholds the request until it is valid', async () => {
    const user = userEvent.setup();
    render(<NewTool />);
    const name = screen.getByLabelText(/Tool name/);
    await user.clear(name);
    await user.type(name, 'Laptop requests');
    expect(screen.getByRole('heading', { name: 'Laptop requests' })).toBeInTheDocument();
    expect(screen.getByText(/#laptop-requests/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('button', { name: /Copy request/ })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('List at least one action.');
    await user.click(screen.getByRole('button', { name: 'Use example' }));
    expect(screen.getByRole('button', { name: /Copy request/ })).toBeInTheDocument();
  });

  it('falls back to manual copy when the clipboard is unavailable', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(<NewTool />);
    await user.click(screen.getByRole('button', { name: /Copy request/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Could not copy automatically');
  });
});
