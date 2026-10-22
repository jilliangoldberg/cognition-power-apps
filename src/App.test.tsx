import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY } from './core/storage';
import { createFixtures } from './core/fixtures';
import { viewsKey } from './core/views';
import { RecordDrawer } from './components/RecordDrawer';
import { kyc } from './modules/kyc';

// These tests assert the curated demo data of the original three tools, so a newly added tool
// must not change them.
vi.mock('./modules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./modules')>();
  const original = actual.modules.filter((m) => ['kyc', 'refunds', 'flags'].includes(m.id));
  return {
    ...actual,
    modules: original,
    getModule: (id: string) => original.find((m) => m.id === id)!,
  };
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', window.location.pathname);
});

describe('task-first local workspace and references (jsdom)', () => {
  it('returns an evidence-assessed local case to assigned work', async () => {
    const user = userEvent.setup();
    const data = createFixtures();
    data.records.kyc[0].fields.evidenceReviewed = false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.history.replaceState(null, '', '#overview?work=waiting');
    render(<App />);
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: /KYC-1042/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Approve case' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Assess fictional evidence' }));
    await user.type(within(dialog).getByRole('textbox'), 'Assess the consistent fictional sample.');
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm assess fictional evidence' }),
    );
    expect(within(dialog).getByRole('button', { name: 'Approve case' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await screen.findByRole('heading', { name: /Waiting or blocked/ });
    expect(
      within(screen.getByRole('table')).queryByRole('link', { name: /KYC-1042/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^Ready for you/ }));
    expect(
      within(screen.getByRole('table')).getByRole('link', { name: /KYC-1042/ }),
    ).toBeInTheDocument();
  });
  it('opens an encoded saved record ID without confusing it with a custom page or path', () => {
    const data = createFixtures();
    const id = 'case / # ? % & + ü';
    data.records.kyc[0].id = id;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.history.replaceState(null, '', `#kyc/${encodeURIComponent(id)}`);
    render(<App />);
    expect(screen.getByRole('dialog')).toHaveTextContent(id);
    expect(screen.getByRole('dialog')).toHaveTextContent('Olivia Chen');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('updates the assigned work list after a local decision, without treating it as a provider outcome', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('table')).getByRole('link', { name: /KYC-1042/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve case' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Review this synthetic example only.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approve case' }));
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await screen.findByRole('heading', { name: 'My work', level: 1 });
    expect(screen.getByRole('heading', { name: 'Ready for you 2' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('table')).queryByRole('link', { name: /KYC-1042/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('recorded in local demo');
  });
  it('drills every local count through to the exact cross-tool list, without an approvals queue', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My work', level: 1 })).toBeInTheDocument();
    const views = screen.getByRole('navigation', { name: 'Work views' });
    for (const [name, count] of [
      ['Ready for you', 3],
      ['Unassigned', 5],
      ['Waiting or blocked', 11],
    ] as const) {
      const link = within(views).getByRole('link', {
        name: new RegExp(`^${name} ${count} `),
      });
      await user.click(link);
      expect(link).toHaveAttribute('aria-current', 'page');
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(count + 1);
    }
    expect(screen.getByRole('table')).toHaveTextContent('KYC review');
    expect(screen.getByRole('table')).toHaveTextContent('Refunds');
    expect(screen.getByRole('table')).not.toHaveTextContent('Feature flags');
    expect(screen.getByRole('table')).toHaveTextContent('Multiple requests share this payment');
  });
  it('starts the oldest item that is ready for you from the page heading', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Start next item' }));
    expect(window.location.hash).toContain('#kyc/KYC-1042');
    expect(within(screen.getByRole('dialog')).getByText('Olivia Chen')).toBeInTheDocument();
  });
  it('opens the oldest assigned item by keyboard and returns focus to its stable local reference', async () => {
    const user = userEvent.setup();
    render(<App />);
    const link = within(screen.getByRole('table')).getAllByRole('link')[0];
    expect(link).toHaveTextContent('Olivia Chen');
    const reference = link.getAttribute('href');
    expect(reference).toContain('#kyc/KYC-1042');
    link.focus();
    await user.keyboard('{Enter}');
    expect(window.location.hash).toBe(reference);
    expect(within(screen.getByRole('dialog')).getByText('Olivia Chen')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close dialog' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'My work', level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('link')[0]).toHaveFocus();
  });
  it('reloads a copied record link and returns to the same lead work view without mutating anything', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#overview?work=waiting');
    const app = render(<App />);
    const link = within(screen.getByRole('table')).getByRole('link', { name: /REF-0199/ });
    const reference = link.getAttribute('href')!;
    await user.click(link);
    expect(window.location.hash).toBe(reference);
    app.unmount();
    window.history.replaceState(null, '', reference);
    render(<App />);
    expect(screen.getByRole('dialog')).toHaveTextContent('REF-0199');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toEqual([]);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close dialog' }),
    );
    expect(window.location.hash).toBe('#overview?work=waiting');
    expect(screen.getByRole('heading', { name: /Waiting or blocked 11/ })).toBeInTheDocument();
  });
  it('preserves all queue filters, sorting and matching rows when a record opens, reloads and closes', async () => {
    const user = userEvent.setup();
    const data = createFixtures();
    data.records.kyc[0].openedAt = new Date(Date.now() - 72 * 3_600_000).toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.history.replaceState(null, '', '#kyc');
    const app = render(<App />);
    await user.type(screen.getByRole('searchbox'), 'Olivia');
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Needs review');
    await user.selectOptions(screen.getByLabelText('Filter by owner'), 'You');
    await user.selectOptions(screen.getByLabelText('Sort records'), 'opened');
    await user.click(screen.getByLabelText('Open 48h+ (not an SLA)'));
    const queueHash = window.location.hash;
    const link = screen.getByRole('link', { name: 'Record reference KYC-1042' });
    await user.click(link);
    expect(window.location.hash).toBe(link.getAttribute('href'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const recordHash = window.location.hash;
    app.unmount();
    window.history.replaceState(null, '', recordHash);
    render(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close dialog' }),
    );
    expect(window.location.hash).toBe(queueHash);
    expect(screen.getByRole('searchbox')).toHaveValue('Olivia');
    expect(screen.getByLabelText('Filter by status')).toHaveValue('Needs review');
    expect(screen.getByLabelText('Filter by owner')).toHaveValue('You');
    expect(screen.getByLabelText('Sort records')).toHaveValue('opened');
    expect(screen.getByLabelText('Open 48h+ (not an SLA)')).toBeChecked();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    await user.click(
      screen.getByRole('button', { name: '1 matching local records · current filters' }),
    );
    expect(screen.getByRole('region', { name: 'KYC review queue' })).toHaveFocus();
    expect(window.location.hash).toBe(queueHash);
    await user.click(screen.getByRole('button', { name: 'All 14 local records · clear filters' }));
    expect(screen.getAllByRole('row')).toHaveLength(15);
  });
  it('uses actual back/forward events for drawer and page history without adding a history entry per keystroke', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#overview');
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    await user.click(within(nav).getByRole('link', { name: 'KYC review' }));
    await user.type(screen.getByRole('searchbox'), 'Olivia');
    const queueHash = window.location.hash;
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    const recordHash = window.location.hash;
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.hash).toBe(queueHash);
    expect(screen.getByRole('searchbox')).toHaveValue('Olivia');
    act(() => window.history.back());
    await screen.findByRole('heading', { name: 'My work', level: 1 });
    act(() => window.history.forward());
    await screen.findByRole('heading', { name: 'KYC review queue', level: 1 });
    expect(window.location.hash).toBe(queueHash);
    act(() => window.history.forward());
    await screen.findByRole('dialog');
    expect(window.location.hash).toBe(recordHash);
  });
  it('remembers each tool queue during the visit when navigating through My work or other tools', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#kyc');
    render(<App />);
    await user.type(screen.getByRole('searchbox'), 'Olivia');
    await user.selectOptions(screen.getByLabelText('Sort records'), 'name');
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    await user.click(within(nav).getByRole('link', { name: 'Refunds' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await user.click(within(nav).getByRole('link', { name: 'My work' }));
    await user.click(within(nav).getByRole('link', { name: 'KYC review' }));
    expect(screen.getByRole('searchbox')).toHaveValue('Olivia');
    expect(screen.getByLabelText('Sort records')).toHaveValue('name');
  });
  it.each(['#kyc/deleted-record', '#kyc/%E0%A4%A', '#missing/KYC-1042', '#shared-kyc'])(
    'does not open an invalid, deleted, unknown-tool or removed-page link: %s',
    (hash) => {
      window.history.replaceState(null, '', hash);
      render(<App />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /not found|Invalid record link|Unknown workspace link/,
      );
    },
  );
  it('returns safely from a missing record to the filtered local queue', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '#kyc/deleted?search=Olivia&sort=name');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Return to queue' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#kyc?search=Olivia&sort=name');
    expect(screen.getByRole('searchbox')).toHaveValue('Olivia');
  });
  it('searches the secondary directory and opens Investigation as a custom page, not a queue record', async () => {
    const user = userEvent.setup();
    render(<App />);
    const directory = screen.getByRole('region', { name: 'Tool directory' });
    expect(within(directory).getByRole('button', { name: 'Vendor approvals' })).toBeInTheDocument();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search tool directory' }),
      'Investigation',
    );
    expect(
      within(directory).queryByRole('button', { name: 'Vendor approvals' }),
    ).not.toBeInTheDocument();
    await user.click(within(directory).getByRole('button', { name: 'Investigation' }));
    expect(window.location.hash).toBe('#investigation');
    expect(
      screen.getByRole('heading', { name: 'Transaction investigation', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)!).records)).toEqual([
      'kyc',
      'refunds',
      'flags',
    ]);
  });
  it('keeps work references and filters usable with unavailable local storage without pretending to persist', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(/storage|saved/i);
    await user.click(within(screen.getByRole('table')).getAllByRole('link')[0]);
    expect(window.location.hash).toContain('#kyc/');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close dialog' }),
    );
    await screen.findByRole('heading', { name: 'My work', level: 1 });
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('workspace components (jsdom)', () => {
  it('skips to the current page content without changing the active tool', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    await user.click(screen.getByRole('link', { name: 'Skip to content' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#kyc');
    expect(screen.getByRole('heading', { name: 'KYC review queue', level: 1 })).toBeInTheDocument();
  });
  it('renders all tools through the shared navigation and handles unknown URLs', async () => {
    const user = userEvent.setup();
    window.location.hash = '#missing';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My work', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown workspace link');
    const nav = screen.getByRole('navigation', { name: 'Workspace' });
    for (const [label, title] of [
      ['KYC review', 'KYC review queue'],
      ['Refunds', 'Refunds dashboard'],
      ['Feature flags', 'Feature flags'],
    ]) {
      await user.click(within(nav).getByRole('link', { name: new RegExp(label) }));
      expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
    }
  });
  it('searches and filters a queue and clears an empty state', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    await user.type(screen.getByRole('searchbox'), 'Olivia');
    expect(screen.getByRole('button', { name: 'Open Olivia Chen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open James Wilson' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'Approved');
    expect(screen.getByText('No matching cases')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Open James Wilson' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Sort records'), 'name');
    expect(
      within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'Open Amelia Brown' }),
    ).toBeInTheDocument();
  });
  it('requires a reason, applies a KYC decision, and persists across remounts', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const view = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Approve case' }));
    const confirm = within(dialog).getByRole('button', { name: 'Confirm approve case' });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Synthetic evidence checked.',
    );
    await user.click(confirm);
    expect(within(dialog).getByText('Approved', { selector: '.badge' })).toBeInTheDocument();
    expect(
      within(dialog).getByText('Synthetic evidence checked.', { selector: '.record-activity p' }),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toHaveLength(1);
    view.unmount();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    expect(
      within(screen.getByRole('dialog')).getByText('Approved', { selector: '.badge' }),
    ).toBeInTheDocument();
  });
  it('supports refund simulation and flag changes through the same components', async () => {
    const user = userEvent.setup();
    window.location.hash = '#refunds';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/No payment provider is connected/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Approve for simulation' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Approve this fictional request for simulation.',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Confirm approve for simulation' }),
    );
    expect(
      within(dialog).getByText('Approved for simulation', { selector: '.badge' }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Simulate refund' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Try the simulated refund flow.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm simulate refund' }));
    expect(within(dialog).getByText('Simulated', { selector: '.badge' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await user.click(
      within(screen.getByRole('navigation')).getByRole('link', { name: /Feature flags/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Open Payment confirmation preview' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Enable flag' }));
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Enable the local staging preview.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm enable flag' }));
    expect(within(dialog).getByText('Enabled', { selector: '.badge' })).toBeInTheDocument();
  });
  it('resets only after confirmation and preserves unrelated browser storage', async () => {
    const user = userEvent.setup();
    localStorage.setItem('unrelated-app', 'leave alone');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    let dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep exploring' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reset demo data' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toEqual([]);
    expect(localStorage.getItem('unrelated-app')).toBe('leave alone');
  });
  it('preserves malformed storage until explicitly reset', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, 'bad json');
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('without overwriting');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('bad json');
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Reset demo' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset demo data' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(2);
  });
  it('shows an honest warning when persistence is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes will last only until this page is reloaded',
    );
  });
  it('supports the search keyboard shortcut without intercepting text input', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByRole('searchbox')).toHaveFocus();
    await user.type(screen.getByRole('searchbox'), '/');
    expect(screen.getByRole('searchbox')).toHaveValue('/');
  });
  it('reassigns a case, adds a local note, filters by its new owner, and restores both after reload', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const app = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    let dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reassign owner' }));
    expect(within(dialog).getByRole('button', { name: 'Confirm reassign owner' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText('New owner'), 'Jamie Brooks');
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Hand over the fictional resubmission.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm reassign owner' }));
    expect(within(dialog).getByText('Owner: Jamie Brooks')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add note' }));
    await user.type(
      within(dialog).getByLabelText(/^Note/),
      'Fictional evidence arrived.\nReview the missing date.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm add note' }));
    expect(within(dialog).getByText(/Fictional evidence arrived/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await user.selectOptions(screen.getByLabelText('Filter by owner'), 'Jamie Brooks');
    expect(screen.getByRole('button', { name: 'Open Olivia Chen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open James Wilson' })).not.toBeInTheDocument();
    app.unmount();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Owner: Jamie Brooks')).toBeInTheDocument();
    expect(within(dialog).getByText(/Fictional evidence arrived/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Version 3/)).toBeInTheDocument();
  });
  it('requests information, treats waiting as open, and returns to review without losing request context', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Request information' }));
    expect(within(dialog).getByText(/No message is sent/)).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Please supply dated evidence.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm request information' }));
    expect(
      within(dialog).getByText('Waiting for information', { selector: '.badge' }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Approve case' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Return to review' }));
    expect(within(dialog).getByLabelText(/Decision reason/)).toHaveValue('');
    await user.type(
      within(dialog).getByLabelText(/Decision reason/),
      'Dated evidence received in this local demo.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Confirm return to review' }));
    expect(within(dialog).getByRole('button', { name: 'Approve case' })).toBeInTheDocument();
    expect(
      within(dialog).getByText('Please supply dated evidence.', { selector: '.record-activity p' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Dated evidence received in this local demo.', {
        selector: '.record-activity p',
      }),
    ).toBeInTheDocument();
  });
  it('saves and deletes named local views, restores filters after remount, and keeps tools isolated', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const app = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Unassigned' }));
    await user.selectOptions(screen.getByLabelText('Sort records'), 'opened');
    await user.type(screen.getByLabelText('View name'), 'Unassigned oldest');
    await user.click(screen.getByRole('button', { name: 'Save view locally' }));
    await user.click(screen.getByRole('button', { name: 'My records' }));
    expect(screen.getByLabelText('Filter by owner')).toHaveValue('You');
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: /Refunds/ }));
    expect(screen.queryByRole('button', { name: 'Unassigned oldest' })).not.toBeInTheDocument();
    app.unmount();
    window.location.hash = '#kyc';
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Unassigned oldest' }));
    expect(screen.getByLabelText('Filter by owner')).toHaveValue('Unassigned');
    expect(screen.getByLabelText('Sort records')).toHaveValue('opened');
    expect(screen.queryByRole('button', { name: 'Open Olivia Chen' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('View name'), 'unassigned oldest');
    await user.click(screen.getByRole('button', { name: 'Save view locally' }));
    expect(screen.getByRole('alert')).toHaveTextContent('unique view name');
    await user.click(screen.getByRole('button', { name: 'Delete view Unassigned oldest' }));
    expect(JSON.parse(localStorage.getItem(viewsKey('kyc'))!)).toEqual([]);
  });
  it('shows read-only refund examples honestly and blocks simulation of a shared payment', async () => {
    const user = userEvent.setup();
    window.location.hash = '#refunds';
    render(<App />);
    await user.click(within(screen.getByText('REF-0195').closest('tr')!).getByRole('button'));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Read-only scenario/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Simulate refund' }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Add note' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    await user.click(within(screen.getByText('REF-0199').closest('tr')!).getByRole('button'));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Approve for simulation' })).toBeDisabled();
    expect(within(dialog).getByText(/Multiple requests share this payment/)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Decision reason/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).activity).toHaveLength(0);
  });
  it('preserves invalid view storage until explicitly cleared', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    localStorage.setItem(viewsKey('kyc'), 'bad views');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Save view locally' })).toBeDisabled();
    expect(localStorage.getItem(viewsKey('kyc'))).toBe('bad views');
    await user.click(screen.getByRole('button', { name: 'Clear saved views' }));
    expect(localStorage.getItem(viewsKey('kyc'))).toBe('[]');
    expect(screen.getByRole('button', { name: 'Save view locally' })).toBeEnabled();
  });
  it('resets assignments, notes and workflow changes while retaining saved views and unrelated data', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const data = createFixtures();
    data.records.kyc[0].owner = 'Jamie Brooks';
    data.records.kyc[0].status = 'Waiting for information';
    data.activity = [
      {
        id: 'note-to-clear',
        kind: 'note',
        moduleId: 'kyc',
        recordId: 'KYC-1042',
        recordName: 'Olivia Chen',
        action: 'Note added',
        reason: 'Fictional context to clear.',
        before: 'Waiting for information',
        after: 'Waiting for information',
        at: new Date().toISOString(),
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(viewsKey('kyc'), '[]');
    localStorage.setItem('unrelated', 'keep');
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset demo data' }),
    );
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.records.kyc[0]).toMatchObject({
      status: 'Needs review',
      owner: 'You',
      version: 1,
    });
    expect(saved.activity).toEqual([]);
    expect(localStorage.getItem(viewsKey('kyc'))).toBe('[]');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
  it('migrates older saved work without adding fixture rows or inventing an opening date', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    const data = createFixtures();
    data.records.kyc = data.records.kyc.slice(0, 8);
    delete data.records.kyc[0].openedAt;
    data.records.kyc[0].owner = 'Saved demo owner';
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, schemaVersion: 1 }));
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent('Saved work preserved');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).records.kyc).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: 'Open Olivia Chen' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Owner: Saved demo owner')).toBeInTheDocument();
    expect(within(dialog).getByText('Not recorded in older demo data')).toBeInTheDocument();
  });
  it('warns when a local view cannot be persisted without losing the in-memory definition', async () => {
    const user = userEvent.setup();
    window.location.hash = '#kyc';
    render(<App />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await user.type(screen.getByLabelText('View name'), 'Session-only view');
    await user.click(screen.getByRole('button', { name: 'Save view locally' }));
    expect(screen.getByRole('alert')).toHaveTextContent('this visit only');
    expect(screen.getByRole('button', { name: 'Session-only view' })).toBeInTheDocument();
    expect(localStorage.getItem(viewsKey('kyc'))).toBeNull();
  });
  it('keeps a form bound to the version opened and preserves its text on stale rejection', async () => {
    const user = userEvent.setup();
    const record = createFixtures().records.kyc[0];
    const onAction = vi.fn(() => 'This record changed. Close it and open the latest version.');
    const props = { module: kyc, record, activity: [], onAction, onClose: vi.fn() };
    const drawer = render(<RecordDrawer {...props} />);
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(screen.getByLabelText(/^Note/), 'Preserve this local note draft.');
    drawer.rerender(<RecordDrawer {...props} record={{ ...record, version: 2 }} />);
    await user.click(screen.getByRole('button', { name: 'Confirm add note' }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'note', expectedVersion: 1 }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('record changed');
    expect(screen.getByLabelText(/^Note/)).toHaveValue('Preserve this local note draft.');
  });
});

describe('demo sign-in notice', () => {
  it('explains that the demo has no sign-in instead of pretending to authenticate', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const dialog = screen.getByRole('dialog', { name: "Sign-in isn't part of this demo" });
    expect(within(dialog).getByText(/This prototype has no sign-in/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
