import { Icon } from './Icon';

export function About() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PROTOTYPE / V0.3</p>
          <h1>A foundation, not a framework.</h1>
          <p>A small starting point for engineers building internal tools with Devin.</p>
        </div>
      </div>
      <div className="about-grid">
        <section className="panel about-panel">
          <span className="app-icon app-icon-purple">
            <Icon name="box" size={24} />
          </span>
          <h2>Small, explicit reuse boundaries</h2>
          <ul className="check-list">
            <li>Workspace shell and navigation</li>
            <li>Queue tables and drawers where they fit</li>
            <li>Custom page registry for non-queue screens</li>
            <li>Local demo state kept separate from shared server data</li>
            <li>Async saves and account-scoped local view preferences</li>
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
          The original three tools remain browser-local. Investigation is a read-only synthetic
          custom screen, not a provider. There is no sign-in, server, tenant isolation, approval
          engine, durable external execution, or tamper-resistant audit trail. Refunds remain
          simulated; flags do not affect a running product.
        </p>
        <p>
          Vendor onboarding extends the same workspace to Finance, Security, Legal, and requesting
          departments. It has its own browser-local request model, conditional reviews, revision
          resets, and decision history. Any demo user can simulate every reviewer; these are not
          server-authorized approvals. No vendor provisioning, contract signing, or spend execution
          is implemented. Its synthetic policy is illustrative, not a client’s procurement policy.
        </p>
        <p>
          Local storage is not shared between users or devices. Do not enter real customer data or
          production credentials.
        </p>
      </section>
      <section className="next-step">
        <span className="app-icon app-icon-green">
          <Icon name="arrow" size={23} />
        </span>
        <div>
          <h2>Land with a useful workflow. Expand through demonstrated reuse.</h2>
          <p>
            Vendor reviews illustrate expansion beyond financial operations—not a capability
            exclusive to Workbench; Power Apps also supports cross-department workflows. Review
            extension effort, multi-user controls, regressions, and operating costs to establish
            value. This is engineer-extensible software, not a no-code designer or evidence of a
            full Power Apps replacement, production readiness, or $250K in savings.
          </p>
        </div>
      </section>
    </>
  );
}
