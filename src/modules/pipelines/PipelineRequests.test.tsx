import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import App from '../../App';
import { STORAGE_KEY } from '../../core/storage';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '#pipelines');
});

it('submits a pipeline request from the form, shows it in the list and saves it', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Submit a request' }));
  const dialog = screen.getByRole('dialog', { name: 'Request a data pipeline' });
  const form = within(dialog);
  await user.type(form.getByLabelText('Pipeline name'), 'Partner payouts mart');
  await user.type(form.getByLabelText('Your name'), 'Ada Park');
  await user.type(form.getByLabelText(/^Source/), 'Payouts ledger export');
  await user.type(form.getByLabelText(/^Destination/), 'Warehouse: finance.payouts');
  await user.click(form.getByRole('button', { name: 'Submit a request' }));
  expect(form.getByRole('alert')).toHaveTextContent('Choose a refresh schedule.');

  await user.selectOptions(form.getByLabelText('Refresh schedule'), 'Daily');
  const due = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await user.type(form.getByLabelText('Needed by'), due);
  await user.click(form.getByRole('button', { name: 'Submit a request' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('DPR-108 submitted');
  const row = within(screen.getByRole('table')).getByText('Partner payouts mart').closest('tr')!;
  expect(row).toHaveTextContent('Submitted');
  expect(row).toHaveTextContent('Unassigned');
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.records.pipelines[0]).toMatchObject({
    id: 'DPR-108',
    fields: { requester: 'Ada Park', schedule: 'Daily', neededBy: due },
  });
  expect(saved.activity[0]).toMatchObject({ recordId: 'DPR-108', action: 'Submitted' });
});
