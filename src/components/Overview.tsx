import { modules } from '../modules';
import type { DemoState, Page } from '../core/types';
import { countStatus, dateTime, money } from '../core/format';
import { openKyc } from '../modules/kyc';
import { Icon } from './Icon';
import { Badge } from './Badge';
import { customPages } from '../features/pages';

export function Overview({ data, navigate }: { data: DemoState; navigate: (page: Page) => void }) {
  const metrics = [
    {
      label: 'Open sample cases',
      value: String(data.records.kyc.filter((r) => openKyc(r.status)).length),
      hint: 'Includes waiting and escalated cases',
    },
    {
      label: 'Requested refund value',
      value: money(
        data.records.refunds
          .filter((r) => r.status === 'Requested')
          .reduce((sum, r) => sum + Number(r.fields.amountCents), 0),
      ),
      hint: 'Sample USD · not provider-pending funds',
    },
    {
      label: 'Enabled flags',
      value: `${countStatus(data.records.flags, 'Enabled')} / ${data.records.flags.length}`,
      hint: 'Local staging configuration',
    },
    {
      label: 'Workspace pages',
      value: String(modules.length + customPages.length),
      hint: 'Original tools + extension experiences',
    },
  ];
  return (
    <>
      <div className="page-heading overview-heading">
        <div>
          <p className="eyebrow">YOUR OPERATIONS WORKSPACE</p>
          <h1>A little less busywork.</h1>
          <p>Your internal tools, together in one simple workspace.</p>
        </div>
        <button className="button button-primary" onClick={() => navigate('kyc')}>
          Open review queue <Icon name="arrow" size={16} />
        </button>
      </div>
      <div className="metrics">
        {metrics.map((metric) => (
          <div className="metric" key={metric.label}>
            <span className="metric-label">{metric.label}</span>
            <strong>{metric.value}</strong>
            <span className="metric-hint">{metric.hint}</span>
          </div>
        ))}
      </div>
      <section className="tools-section">
        <div className="section-heading">
          <h2>
            Explore workspace{' '}
            <span className="count-pill">{modules.length + customPages.length}</span>
          </h2>
          <span className="subtle">One workspace. Shared building blocks.</span>
        </div>
        <div className="tool-cards">
          {modules.map((module) => (
            <button className="tool-card" key={module.id} onClick={() => navigate(module.id)}>
              <div className="tool-card-top">
                <span className={`app-icon app-icon-${module.color}`}>
                  <Icon name={module.icon} size={23} />
                </span>
                <Icon name="arrow" size={18} />
              </div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <div className="tool-card-footer">
                <span>
                  {data.records[module.id].length} sample {module.recordLabel}
                </span>
                <Badge label="Local demo" dot={false} />
              </div>
            </button>
          ))}
          {customPages.map((page) => (
            <button className="tool-card" key={page.id} onClick={() => navigate(page.id)}>
              <div className="tool-card-top">
                <span className={`app-icon app-icon-${page.color}`}>
                  <Icon name={page.icon} size={23} />
                </span>
                <Icon name="arrow" size={18} />
              </div>
              <h3>{page.title}</h3>
              <p>{page.description}</p>
              <div className="tool-card-footer">
                <span>Custom-page extension</span>
                <Badge label={page.scope} dot={false} />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading">
          <h2>Recent activity</h2>
          <button className="text-button" onClick={() => navigate('activity')}>
            View all <Icon name="arrow" size={14} />
          </button>
        </div>
        {data.activity.length === 0 ? (
          <div className="welcome-empty">
            <span className="empty-icon">
              <Icon name="activity" size={24} />
            </span>
            <div>
              <h3>A clean slate, ready to explore.</h3>
              <p>
                Review a case, simulate a refund, or change a flag. Your activity will show up here.
              </p>
            </div>
            <button className="button button-secondary" onClick={() => navigate('kyc')}>
              Start with a case <Icon name="arrow" size={15} />
            </button>
          </div>
        ) : (
          <div className="recent-list">
            {data.activity.slice(0, 4).map((event) => (
              <div key={event.id}>
                <span className="activity-dot">
                  <Icon name="check" size={12} />
                </span>
                <p>
                  <strong>{event.action}</strong>
                  <span>
                    {event.recordName}
                    {event.kind !== 'note' && ` · ${event.before} → ${event.after}`}
                  </span>
                </p>
                <time dateTime={event.at}>{dateTime(event.at)}</time>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="foundation-strip">
        <div className="foundation-icon">
          <Icon name="box" size={23} />
        </div>
        <div>
          <strong>From financial operations to company-wide workflows.</strong>
          <p>
            Original queues, an investigation timeline, and departmental vendor reviews. Shared
            building blocks; distinct domain rules. Shared KYC is a separate collaboration slice.
          </p>
        </div>
        <button className="text-button" onClick={() => navigate('about')}>
          About this prototype <Icon name="arrow" size={15} />
        </button>
      </div>
    </>
  );
}
