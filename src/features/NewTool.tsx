import { useState } from 'react';
import { Badge } from '../components/Badge';
import { Icon } from '../components/Icon';
import {
  devinRequest,
  emptySpec,
  exampleSpec,
  lines,
  parseAction,
  specProblems,
  statusTone,
  toolId,
  type ToolSpec,
} from './toolRequest';

const boxes: { key: keyof ToolSpec; label: string; hint: string; rows?: number }[] = [
  { key: 'title', label: 'Tool name', hint: 'Shown in the sidebar, for example "Expense claims".' },
  { key: 'purpose', label: 'Who uses it, and for what', hint: 'One or two sentences.', rows: 2 },
  { key: 'recordNoun', label: 'One record is a…', hint: 'For example "claim" or "request".' },
  { key: 'fields', label: 'Fields', hint: 'One per line. The first is the table column.', rows: 4 },
  {
    key: 'statuses',
    label: 'Statuses',
    hint: 'One per line. New records start in the first.',
    rows: 4,
  },
  {
    key: 'actions',
    label: 'Actions',
    hint: 'One per line: "Approve: Submitted -> Approved".',
    rows: 3,
  },
  {
    key: 'rules',
    label: 'Rules (optional)',
    hint: 'Anything an action should check first.',
    rows: 2,
  },
];

export function NewTool() {
  const [spec, setSpec] = useState<ToolSpec>(exampleSpec);
  const [copied, setCopied] = useState('');
  const problems = specProblems(spec);
  const ready = problems.length === 0;
  const request = ready ? devinRequest(spec) : '';
  const statuses = lines(spec.statuses);
  const fields = lines(spec.fields);
  const actions = lines(spec.actions)
    .map(parseAction)
    .filter((action) => action !== null);
  const noun = spec.recordNoun.trim() || 'record';
  const update = (key: keyof ToolSpec, value: string) => {
    setSpec((current) => ({ ...current, [key]: value }));
    setCopied('');
  };

  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      setCopied('Copied. Paste it into a new Devin session.');
    } catch {
      setCopied('Could not copy automatically. Select the text below and copy it.');
    }
  }

  return (
    <div className="custom-page new-tool-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILD A TOOL WITH DEVIN</p>
          <h1>New tool</h1>
          <p>Describe the workflow. Devin builds it on the shared shell and opens a PR.</p>
        </div>
      </div>
      <div className="vendor-notice">
        <strong>How this works</strong>
        <p>
          This page writes a request for Devin. Devin generates the tool with{' '}
          <code>npm run new-tool</code>, fills in your fields, statuses and actions, and opens a
          pull request that must pass the tool contract tests. After the PR is merged, the tool
          appears in the sidebar. Nothing is built until then.
        </p>
      </div>
      <div className="new-tool-layout">
        <form className="vendor-form new-tool-form" onSubmit={(event) => event.preventDefault()}>
          <div className="action-buttons">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSpec(exampleSpec)}
            >
              Use example
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setSpec(emptySpec)}
            >
              Clear
            </button>
          </div>
          {boxes.map(({ key, label, hint, rows }) => (
            <label key={key}>
              {label}
              {rows ? (
                <textarea
                  rows={rows}
                  maxLength={800}
                  value={spec[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              ) : (
                <input
                  maxLength={key === 'title' ? 40 : 80}
                  value={spec[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              )}
              <span className="subtle">{hint}</span>
            </label>
          ))}
        </form>
        <div className="new-tool-output">
          <section className="panel new-tool-preview" aria-label="Preview">
            <div className="panel-heading">
              <div className="title-line">
                <h2>{spec.title.trim() || 'Untitled tool'}</h2>
                <Badge label="Preview" tone="purple" dot={false} />
              </div>
              <span className="subtle panel-hint">
                {toolId(spec.title) ? `#${toolId(spec.title)}` : ''} · not built yet
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{noun[0].toUpperCase() + noun.slice(1)}</th>
                    <th>{fields[0] ?? 'Field'}</th>
                    <th>Status</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {(statuses.length ? statuses : ['Status']).slice(0, 4).map((status, index) => (
                    <tr key={`${status}-${index}`}>
                      <td>
                        Example {noun} {index + 1}
                      </td>
                      <td className="subtle">Sample value</td>
                      <td>
                        <Badge label={status} tone={statusTone(index)} />
                      </td>
                      <td>{index % 2 ? 'Alex Morgan' : 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {actions.length > 0 && (
              <div className="new-tool-actions">
                <span className="subtle">Record actions</span>
                {actions.map((action) => (
                  <span className="new-tool-action" key={action.label}>
                    {action.label}
                    <small>
                      {action.from} → {action.to}
                    </small>
                  </span>
                ))}
              </div>
            )}
            <p className="subtle new-tool-shell-note">
              Every tool also gets search, filters, saved views, assignment, notes, reasoned
              confirmations and history from the shared shell.
            </p>
          </section>
          <section className="panel new-tool-request" aria-label="Request for Devin">
            <div className="panel-heading">
              <h2>Request for Devin</h2>
            </div>
            {ready ? (
              <>
                <pre tabIndex={0}>{request}</pre>
                <div className="action-buttons">
                  <button type="button" className="button button-primary" onClick={copy}>
                    <Icon name="check" size={16} /> Copy request
                  </button>
                  <a
                    className="button button-secondary"
                    href="https://app.devin.ai"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Devin <Icon name="arrow" size={16} />
                  </a>
                </div>
                {copied && (
                  <p className="subtle" role="status">
                    {copied}
                  </p>
                )}
              </>
            ) : (
              <div className="form-error" role="alert">
                <p>Fix these to get a request:</p>
                <ul>
                  {problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
