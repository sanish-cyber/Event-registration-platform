import React from 'react';

export default function WQIGauge({ score, level }) {
  const displayScore = score != null ? Math.round(score * 10) / 10 : '--';
  const fillWidth = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const levelClass = level || 'good';

  return (
    <div className={`card wqi-card ${levelClass}`}>
      <div className="card-header">
        <span className="card-title">Water Quality Index</span>
        <span className="card-icon">🏆</span>
      </div>
      <div className={`wqi-score ${levelClass}`}>{displayScore}</div>
      <div className={`wqi-label`} style={{
        color: levelClass === 'good' ? 'var(--wqi-good)' :
               levelClass === 'warning' ? 'var(--wqi-warning)' : 'var(--wqi-critical)'
      }}>
        {levelClass === 'good' ? '● Excellent Quality' :
         levelClass === 'warning' ? '● Degraded Quality' : '● Critical — Action Required'}
      </div>
      <div className="wqi-bar">
        <div
          className={`wqi-bar-fill ${levelClass}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
    </div>
  );
}
