import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import App from '../../App';
import { STORAGE_KEY } from '../../core/storage';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '#pipelines');
});

it('submits a pipeline request from the form and lists it for triage', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Submit a request' }));
  const dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Submit a request' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Pipeline name is required.');

  await user.type(within(dialog).getByLabelText('Pipeline name'), 'Trial conversion events');
  await user.type(within(dialog).getByLabelText('Your name'), 'Nadia Hassan');
  await user.type(within(dialog).getByLabelText('Source'), 'Product events stream');
  await user.type(within(dialog).getByLabelText('Destination'), 'Analytics warehouse · ds.trials');
  await user.selectOptions(within(dialog).getByLabelText('Refresh schedule'), 'Hourly');
  const neededBy = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  await user.type(within(dialog).getByLabelText('Needed by'), neededBy);
  await user.type(within(dialog).getByLabelText('What is it for?'), 'Trial dashboard.');
  await user.click(within(dialog).getByRole('button', { name: 'Submit a request' }));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const row = screen.getByRole('button', { name: 'Open Trial conversion events' }).closest('tr')!;
  expect(within(row).getByText('Submitted')).toBeInTheDocument();
  expect(within(row).getByText('Unassigned')).toBeInTheDocument();
  expect(within(row).getByText('DPR-108')).toBeInTheDocument();
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(saved.records.pipelines[0]).toMatchObject({ id: 'DPR-108', status: 'Submitted' });
  expect(saved.records.pipelines[0].fields).toMatchObject({ schedule: 'Hourly', neededBy });
});
