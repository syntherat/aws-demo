import React, { useEffect, useState } from 'react';

const QUEUE_STEPS = [
  { key: 'payment',    label: 'Payment Queue',    delayMs: 1400 },
  { key: 'shipping',   label: 'Shipping Queue',   delayMs: 2200 },
  { key: 'analytics',  label: 'Analytics Queue',  delayMs: 1600 },
];

export default function App() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState({}); // { payment: 'idle'|'loading'|'done', ... }

  async function placeOrder(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    setError(null);
    setStatuses({}); // reset

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
      setEmail('');

      // kick off simulated queue progress
      runSimulatedQueues();
    } catch (err) {
      setError(err.message || 'Failed to place order');
    } finally {
      setBusy(false);
    }
  }

  function runSimulatedQueues() {
    // start all as loading
    const initial = Object.fromEntries(QUEUE_STEPS.map(q => [q.key, 'loading']));
    setStatuses(initial);

    // complete each after its delay
    QUEUE_STEPS.forEach(({ key, delayMs }) => {
      setTimeout(() => {
        setStatuses(prev => ({ ...prev, [key]: 'done' }));
      }, delayMs);
    });
  }

  return (
    <div style={styles.page}>
      <main style={styles.card}>
        <h1 style={styles.heading}>AWS SNS → SQS → SES Demo</h1>
        <p style={styles.subtext}>Place a simulated order. Watch Payment, Shipping, and Analytics queues “process”.</p>

        <form onSubmit={placeOrder} style={styles.form}>
          <input
            required
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <button disabled={busy} style={styles.button}>
            {busy ? 'Placing…' : 'Place Order'}
          </button>
        </form>

        {result && (
          <section style={{ marginTop: 16 }}>
            <div style={styles.successBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h2 style={styles.successHeader}>Order Placed</h2>
                <span style={styles.timestamp}>{new Date().toLocaleString()}</span>
              </div>
              <p><b>Order ID:</b> {result.orderId}</p>
              <p style={{ marginBottom: 0 }}>
                <b>Published to:</b> <code style={styles.code}>{result.publishedTo}</code>
              </p>
            </div>

            {/* Status Lanes */}
            <div style={styles.lanes}>
              {QUEUE_STEPS.map(({ key, label }) => (
                <StatusCard
                  key={key}
                  label={label}
                  state={statuses[key] ?? 'idle'}
                  note={
                    key === 'shipping'
                      ? 'Worker polls SQS; SES sends confirmation email'
                      : key === 'payment'
                        ? 'Mock payment validation (simulated)'
                        : 'Event logged for BI dashboards (simulated)'
                  }
                />
              ))}
            </div>

            {/* Architecture recap */}
            <ol style={styles.steps}>
              <li><strong>API</strong> publishes <code style={styles.code}>OrderPlaced</code> to SNS</li>
              <li><strong>SNS</strong> fans out to <code style={styles.code}>PaymentQueue</code>, <code style={styles.code}>ShippingQueue</code>, <code style={styles.code}>AnalyticsQueue</code></li>
              <li><strong>Worker</strong> (shipping) polls SQS and sends email via <code style={styles.code}>SES</code></li>
            </ol>
          </section>
        )}

        {error && (
          <div style={styles.errorBox}>
            ❌ <span>{error}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusCard({ label, state, note }) {
  const isLoading = state === 'loading';
  const isDone = state === 'done';
  const isIdle = state === 'idle';

  return (
    <div style={styles.statusCard}>
      <div style={styles.statusHeader}>
        <span style={styles.statusTitle}>{label}</span>
        <span style={styles.badge(isIdle ? 'idle' : isLoading ? 'loading' : 'done')}>
          {isIdle ? 'idle' : isLoading ? 'processing…' : 'processed'}
        </span>
      </div>

      <div style={styles.statusRow}>
        {isLoading && <Spinner />}
        {isDone && <Checkmark />}
        {isIdle && <Dot />}
        <span style={styles.statusNote}>{note}</span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={styles.spinner} aria-label="loading" />
  );
}

function Checkmark() {
  return (
    <span style={styles.check} aria-label="done">✔</span>
  );
}

function Dot() {
  return (
    <span style={styles.dot} aria-hidden="true" />
  );
}

const styles = {
  page: {
    backgroundColor: '#f9fafb',
    minHeight: '100vh',
    padding: '40px 16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 680,
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
  },
  heading: {
    fontSize: '1.5rem',
    marginBottom: 6,
    fontWeight: 600,
    color: '#111827',
  },
  subtext: {
    fontSize: '0.96rem',
    color: '#6b7280',
    marginBottom: 22,
  },
  form: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    minWidth: 260,
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '12px 18px',
    backgroundColor: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 500,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  successBox: {
    backgroundColor: '#f9fefb',
    border: '1px solid #10b981',
    borderRadius: 10,
    padding: '14px 16px',
    color: '#064e3b',
    marginTop: 12,
  },
  successHeader: {
    margin: 0,
    fontSize: '1.02rem',
    fontWeight: 600,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #ef4444',
    padding: '12px 14px',
    borderRadius: 8,
    color: '#991b1b',
    marginTop: 12,
    fontSize: '0.95rem',
  },
  lanes: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
    marginTop: 16,
  },
  statusCard: {
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '12px 14px',
    backgroundColor: '#fff',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusTitle: {
    fontWeight: 600,
    color: '#111827',
  },
  badge: (variant) => ({
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid ' + (variant === 'done' ? '#10b981' : variant === 'loading' ? '#d1d5db' : '#e5e7eb'),
    color: variant === 'done' ? '#065f46' : '#374151',
    background: variant === 'done' ? '#ecfdf5' : '#f9fafb',
  }),
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#374151',
    fontSize: '0.95rem',
  },
  statusNote: {
    lineHeight: 1.5,
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid #e5e7eb',
    borderTopColor: '#111827',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.9s linear infinite',
  },
  check: {
    display: 'inline-block',
    fontSize: 14,
    color: '#065f46',
    border: '1px solid #10b981',
    borderRadius: 6,
    padding: '2px 6px',
    background: '#ecfdf5',
  },
  dot: {
    width: 8,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: '50%',
    display: 'inline-block',
  },
  steps: {
    marginTop: 18,
    paddingLeft: 20,
    fontSize: '0.95rem',
    color: '#374151',
    lineHeight: 1.6,
  },
  code: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '1px 6px',
  },
  timestamp: {
    fontSize: '0.8rem',
    color: '#6b7280',
  },
};

/* Minimal keyframes injection */
const styleTag = document.createElement('style');
styleTag.innerHTML = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(styleTag);
