import { Icon } from './Icon';

export function About() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROTOTYPE / V0.2</p>
          <h1>A foundation, not a framework.</h1>
          <p>A small starting point for engineers building internal tools with Devin.</p>
        </div>
      </div>
      <div className="about-grid">
        <section className="panel about-panel">
          <span className="app-icon app-icon-purple">
            <Icon name="box" size={24} />
          </span>
          <h2>Shared by every tool</h2>
          <ul className="check-list">
            <li>Workspace shell and navigation</li>
            <li>Searchable, filterable, sortable tables</li>
            <li>Record details and reason-required actions</li>
            <li>Local persistence and activity history</li>
            <li>Local assignment, notes, and saved queue views</li>
          </ul>
        </section>
        <section className="panel about-panel">
          <span className="app-icon app-icon-blue">
            <Icon name="code" size={24} />
          </span>
          <h2>Owned by each module</h2>
          <ul className="check-list">
            <li>Columns, fields, and summary metrics</li>
            <li>Statuses and allowed transitions</li>
            <li>Action labels and domain-specific checks</li>
            <li>Synthetic fixtures and regression tests</li>
            <li>Demo owner choices and open-work definitions</li>
          </ul>
        </section>
      </div>
      <section className="panel about-panel boundaries">
        <h2>What this prototype does not do</h2>
        <p>
          The 14 KYC cases, 10 refund requests, and 7 staging flags are curated,
          business-model-neutral screen samples, not client volumes or policies. USD is a display
          limitation, not an assumption about the client. Age since opening is not a service-level
          target.
        </p>
        <p>
          This is intentionally a browser-only product sketch. It has no authentication, server-side
          authorization, backend, real integrations, approval workflow, durable jobs, or
          tamper-resistant audit trail. All names and records are fictional. Refunds are simulated;
          flags do not affect any running product.
        </p>
        <p>
          Local storage is for one demo browser, not a shared source of truth. Tabs and other users
          are not synchronized. Do not enter real customer data, documents, payment information, or
          credentials.
        </p>
      </section>
      <section className="next-step">
        <span className="app-icon app-icon-green">
          <Icon name="arrow" size={23} />
        </span>
        <div>
          <h2>Next: prove reuse beyond queues</h2>
          <p>
            Validate the workflows and try a fourth, materially different synthetic tool before
            growing the framework. Add a backend, identity, server-enforced policy, and persistent
            events before any operational pilot or sandbox write integration.
          </p>
        </div>
      </section>
    </>
  );
}
