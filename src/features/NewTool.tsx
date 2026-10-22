import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import {
  checklist,
  devinRequest,
  isStarter,
  MAX_PROMPT,
  promptProblems,
  SEND_PATH,
  toolKinds,
  type ToolKind,
} from './toolRequest';

const steps = [
  'Devin reads your request and decides how to build it.',
  'It builds the tool on the shared Workbench shell, with sample data and tests.',
  'It opens a pull request that must pass every check.',
  'After the PR is reviewed and merged, the tool appears in the sidebar.',
];

export function NewTool() {
  const [kind, setKind] = useState<ToolKind | null>(null);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState('');
  const problems = promptProblems(prompt);
  const request = problems.length ? '' : devinRequest(prompt, kind);
  const [devin, setDevin] = useState<{ enabled: boolean; maxAcu: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(SEND_PATH)
      .then((response) => response.json())
      .then((data: { enabled?: unknown; maxAcu?: unknown }) => {
        if (alive) setDevin({ enabled: data.enabled === true, maxAcu: Number(data.maxAcu) || 10 });
      })
      .catch(() => alive && setDevin({ enabled: false, maxAcu: 10 }));
    return () => {
      alive = false;
    };
  }, []);

  async function send() {
    setSending(true);
    setSendError('');
    try {
      const response = await fetch(SEND_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, kind }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (response.ok && typeof data.url === 'string') setSessionUrl(data.url);
      else
        setSendError(
          typeof data.error === 'string' ? data.error : 'Could not start a Devin session.',
        );
    } catch {
      setSendError('Could not reach the dev server. Is npm run dev still running?');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  }

  function pick(next: (typeof toolKinds)[number]) {
    setKind(next.id);
    setCopied('');
    if (!prompt.trim() || isStarter(prompt)) setPrompt(next.starter);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      setCopied('Copied. Paste it into a new Devin session.');
    } catch {
      setCopied('Could not copy automatically. Select the text above and copy it.');
    }
  }

  return (
    <div className="custom-page new-tool-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILD A TOOL WITH DEVIN</p>
          <h1>New tool</h1>
          <p>Describe the tool in your own words. Devin builds it and opens a pull request.</p>
        </div>
      </div>
      <div className="new-tool-layout">
        <section className="panel new-tool-compose" aria-label="Describe your tool">
          <p className="new-tool-label" id="new-tool-kind">
            What kind of tool? <span className="subtle">Optional. Fills in a starter.</span>
          </p>
          <div className="view-presets" role="group" aria-labelledby="new-tool-kind">
            {toolKinds.map((item) => (
              <button
                key={item.id}
                type="button"
                className="button button-secondary"
                aria-pressed={kind === item.id}
                onClick={() => pick(item)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="new-tool-label" htmlFor="new-tool-prompt">
            Describe the tool you want
          </label>
          <textarea
            id="new-tool-prompt"
            rows={8}
            maxLength={MAX_PROMPT + 200}
            value={prompt}
            placeholder="For example: A page where Support can look up a customer by email and see their open refunds and KYC status together."
            onChange={(event) => {
              setPrompt(event.target.value);
              setCopied('');
            }}
          />
          <div className="new-tool-checklist">
            <p className="subtle">Good requests mention</p>
            <ul>
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
        <div className="new-tool-output">
          <section className="panel new-tool-steps" aria-label="What happens next">
            <div className="panel-heading">
              <h2>What happens next</h2>
            </div>
            <ol>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="subtle">Nothing is built until you send the request.</p>
          </section>
          <section className="panel new-tool-request" aria-label="Request for Devin">
            <div className="panel-heading">
              <h2>Request for Devin</h2>
            </div>
            {request ? (
              <>
                <pre tabIndex={0}>{request}</pre>
                <div className="action-buttons">
                  {devin?.enabled && (
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={sending}
                      onClick={() => setConfirming(true)}
                    >
                      Send to Devin <Icon name="arrow" size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`button ${devin?.enabled ? 'button-secondary' : 'button-primary'}`}
                    onClick={copy}
                  >
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
                {devin && !devin.enabled && (
                  <p className="subtle new-tool-hint">
                    To send straight from this page, put DEVIN_API_KEY and DEVIN_ORG_ID in a .env
                    file and restart npm run dev (see docs/new-tool.md).
                  </p>
                )}
              </>
            ) : (
              <ul className="new-tool-todo" aria-live="polite">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {sendError && (
              <p className="form-error new-tool-hint" role="alert">
                {sendError}
              </p>
            )}
          </section>
          {sessionUrl && (
            <section className="vendor-notice" aria-label="Devin session">
              <strong>Devin is building your tool.</strong>
              <p>It will open a pull request when it is done.</p>
              <a
                className="button button-primary new-tool-session-link"
                href={sessionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open the Devin session <Icon name="arrow" size={16} />
              </a>
            </section>
          )}
        </div>
      </div>
      {confirming && (
        <Dialog
          title="Start a Devin session?"
          subtitle="USES DEVIN CREDITS"
          onClose={() => !sending && setConfirming(false)}
        >
          <div className="vendor-form">
            <p>
              This starts a real Devin session in your organization with the request on this page.
              It can use up to {devin?.maxAcu ?? 10} ACUs and will open a pull request on the
              repository.
            </p>
            <div className="action-buttons">
              <button
                type="button"
                className="button button-secondary"
                disabled={sending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={sending}
                onClick={send}
              >
                {sending ? 'Starting…' : 'Start session'}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
