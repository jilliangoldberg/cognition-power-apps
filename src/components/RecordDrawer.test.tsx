import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordDrawer } from './RecordDrawer';
import { createFixtures } from '../core/fixtures';
import { executeAction, type MutationRequest } from '../core/actions';
import { kyc } from '../modules/kyc';
import { flags } from '../modules/flags';
import { refunds } from '../modules/refunds';

function KycStory() {
  const [data, setData] = useState(createFixtures);
  return (
    <RecordDrawer
      module={kyc}
      record={data.records.kyc[1]}
      activity={data.activity.filter((event) => event.recordId === 'KYC-1041')}
      onClose={() => undefined}
      onAction={(request: MutationRequest) => {
        try {
          setData(executeAction(data, request));
          return null;
        } catch (error) {
          return (error as Error).message;
        }
      }}
    />
  );
}

describe('narrow workflow drawer components (jsdom, not browser validation)', () => {
  it('shows KYC gaps and eligibility before reason entry, then completes the explicit local story', async () => {
    const user = userEvent.setup();
    render(<KycStory />);
    expect(screen.getByText('Missing dated fictional address evidence')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve case' })).toBeDisabled();
    expect(screen.getByText(/Assess the fictional evidence before approving/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    async function confirm(label: string, reason: string) {
      await user.click(screen.getByRole('button', { name: label }));
      await user.type(screen.getByRole('textbox'), reason);
      await user.click(screen.getByRole('button', { name: `Confirm ${label.toLowerCase()}` }));
    }
    await confirm('Request information', 'Need a dated fictional address document.');
    expect(screen.getByText('Unsent · no customer messaging integration')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reassign owner' }));
    await user.selectOptions(screen.getByLabelText('New owner'), 'Jamie Brooks');
    await user.type(screen.getByRole('textbox'), 'Jamie will assess the fictional replacement.');
    await user.click(screen.getByRole('button', { name: 'Confirm reassign owner' }));
    expect(screen.getByText('Owner: Jamie Brooks')).toBeInTheDocument();
    await confirm('Record fictional response', 'Fictional replacement includes the missing date.');
    expect(screen.getByText('Waiting for information', { selector: '.badge' })).toBeInTheDocument();
    await confirm('Return to review', 'Ready for a separate evidence assessment.');
    expect(screen.getByRole('button', { name: 'Approve case' })).toBeDisabled();
    await confirm(
      'Assess fictional evidence',
      'The fictional replacement resolves the dated-evidence gap.',
    );
    expect(screen.getByRole('button', { name: 'Approve case' })).toBeEnabled();
    await confirm('Approve case', 'Approve after reviewing the fictional replacement.');
    expect(screen.getByText('Approved', { selector: '.badge' })).toBeInTheDocument();
    expect(
      screen.getByText('Approve after reviewing the fictional replacement.', {
        selector: '.record-activity p',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Unsent · no customer messaging integration')).toBeInTheDocument();
  });

  it('retains cancelled assignment context and warns before close, Escape or backdrop discard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <RecordDrawer
        module={kyc}
        record={createFixtures().records.kyc[0]}
        activity={[]}
        onClose={onClose}
        onAction={() => null}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Reassign owner' }));
    await user.selectOptions(screen.getByLabelText('New owner'), 'Jamie Brooks');
    await user.type(screen.getByRole('textbox'), 'Preserve the handoff draft.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('status')).toHaveTextContent('Draft retained');
    await user.click(screen.getByRole('button', { name: 'Reassign owner' }));
    expect(screen.getByLabelText('New owner')).toHaveValue('Jamie Brooks');
    expect(screen.getByRole('textbox')).toHaveValue('Preserve the handoff draft.');
    for (const close of [
      () => user.click(screen.getByRole('button', { name: 'Close dialog' })),
      () => fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })),
      () => fireEvent.click(screen.getByRole('dialog')),
    ]) {
      await close();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Keep your unsaved draft?');
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.getByRole('textbox')).toHaveValue('Preserve the handoff draft.');
    }
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.click(screen.getByRole('button', { name: 'Discard drafts and close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('retains an action draft even when its action becomes unavailable', async () => {
    const user = userEvent.setup();
    const record = createFixtures().records.kyc[0];
    const onAction = vi.fn();
    const props = { module: kyc, record, activity: [], onClose: vi.fn(), onAction };
    const drawer = render(<RecordDrawer {...props} />);
    await user.click(screen.getByRole('button', { name: 'Approve case' }));
    await user.type(screen.getByRole('textbox'), 'Read this draft even if the case changes.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    drawer.rerender(
      <RecordDrawer {...props} record={{ ...record, status: 'Escalated', version: 2 }} />,
    );
    await user.click(screen.getByRole('button', { name: 'Resume approve case draft' }));
    expect(screen.getByRole('textbox')).toHaveValue('Read this draft even if the case changes.');
    expect(screen.getByRole('button', { name: 'Confirm approve case' })).toBeDisabled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('retains reason and the original version after a rejected save until explicit version selection', async () => {
    const user = userEvent.setup();
    const record = createFixtures().records.kyc[0];
    const onAction = vi.fn(() => 'This record changed. Your draft is retained.');
    const props = { module: kyc, record, activity: [], onClose: vi.fn(), onAction };
    const drawer = render(<RecordDrawer {...props} />);
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByRole('textbox'), 'Draft stays bound to the original version.');
    drawer.rerender(<RecordDrawer {...props} record={{ ...record, version: 2 }} />);
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ expectedVersion: 1 }));
    expect(screen.getByRole('textbox')).toHaveValue('Draft stays bound to the original version.');
    await user.click(screen.getByRole('button', { name: 'Use refreshed version 2' }));
    expect(onAction).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        expectedVersion: 2,
        reason: 'Draft stays bound to the original version.',
      }),
    );
  });

  it('blocks duplicate submit and close while saving and retains reason on transport failure', async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    const onAction = vi.fn(
      () =>
        new Promise<string | null>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const onClose = vi.fn();
    render(
      <RecordDrawer
        module={kyc}
        record={createFixtures().records.kyc[0]}
        activity={[]}
        onClose={onClose}
        onAction={onAction}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByRole('textbox'), 'Keep the same input after a lost response.');
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Saving…' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      reject(new Error('Transport unavailable'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Your input is retained');
    expect(screen.getByRole('textbox')).toHaveValue('Keep the same input after a lost response.');
  });

  it('shows refund capacity exceptions and flag diffs before requesting a reason', () => {
    const props = { activity: [], onClose: vi.fn(), onAction: () => null };
    const drawer = render(
      <RecordDrawer {...props} module={refunds} record={createFixtures().records.refunds[5]} />,
    );
    expect(screen.getByRole('button', { name: 'Approve for simulation' })).toBeDisabled();
    expect(screen.getByText(/Multiple requests share this payment/)).toBeInTheDocument();
    expect(screen.getByText(/REF-0195 · Failed example · 8450 cents/)).toBeInTheDocument();
    expect(screen.getByText(/remaining 49990 cents/)).toBeInTheDocument();
    drawer.unmount();
    render(<RecordDrawer {...props} module={flags} record={createFixtures().records.flags[1]} />);
    expect(screen.getByText(/Proposed local diff: desired Disabled → Enabled/)).toBeInTheDocument();
    expect(screen.getByText('Not connected · not published to any service')).toBeInTheDocument();
    expect(
      screen.getByText('Unknown · no product consumes this configuration'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('never exposes unsupported local evidence actions or request fields in Shared KYC', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn(() => null);
    render(
      <RecordDrawer
        module={kyc}
        record={createFixtures().records.kyc[1]}
        activity={[]}
        onClose={vi.fn()}
        onAction={onAction}
        persistence="shared"
      />,
    );
    expect(screen.queryByLabelText('Local workflow context')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Assess fictional evidence' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve case' }));
    await user.type(screen.getByRole('textbox'), 'Original shared reason-only decision contract.');
    await user.click(screen.getByRole('button', { name: 'Confirm approve case' }));
    expect(onAction).toHaveBeenCalledWith({
      moduleId: 'kyc',
      recordId: 'KYC-1041',
      actionId: 'approve',
      expectedVersion: 1,
      reason: 'Original shared reason-only decision contract.',
    });
    expect(within(screen.getByRole('dialog')).queryByText(/Unsent/)).not.toBeInTheDocument();
  });
});
