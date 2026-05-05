import React from 'react';

export default function AlertPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="card alerts-card">
        <div className="card-header">
          <span className="card-title">Alerts & Events</span>
          <span className="card-icon">🔔</span>
        </div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No alerts — all systems operating normally ✓
        </div>
      </div>
    );
  }

  return (
    <div className="card alerts-card">
      <div className="card-header">
        <span className="card-title">Alerts & Events ({alerts.length})</span>
        <span className="card-icon">🔔</span>
      </div>
      <ul className="alert-list">
        {alerts.map((alert, i) => (
          <li key={i} className={`alert-item ${alert.level}`}>
            <span className="alert-icon">
              {alert.level === 'critical' ? '🔴' : '🟡'}
            </span>
            <div className="alert-content">
              <div className="alert-message">{alert.message}</div>
              <div className="alert-meta">
                <span>Node: {alert.nodeId}</span>
                <span>{alert.wqi != null ? `WQI: ${alert.wqi}` : ''}</span>
                <span>{alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
