import { useState } from 'react';
import { Icon } from '../components/Icon';
import {
  checklist,
  devinRequest,
  isStarter,
  MAX_PROMPT,
  promptProblems,
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
          <p className="eyebrow">ANYONE CAN BUILD A TOOL</p>
          <h1>New tool</h1>
          <p>
            Describe what your team needs in your own words. Devin builds it on the shared Workbench
            and opens a pull request for review.
          </p>
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
              <ul className="new-tool-todo" aria-live="polite">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
