import React from 'react';

export default function MotorControl({ motorStatus, motorMode, onCommand }) {
  const isOn = motorStatus === 'ON';

  return (
    <div className="card motor-card">
      <div className="card-header">
        <span className="card-title">Motor Control</span>
        <span className="card-icon">⚙️</span>
      </div>
      <div className="motor-status-display">
        {isOn ? '🟢' : '🔴'}
      </div>
      <div className="sensor-value" style={{ textAlign: 'center', fontSize: '28px' }}>
        {motorStatus || 'OFF'}
      </div>
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <span className={`sensor-status ${motorMode === 'AUTO' ? 'normal' : 'warning'}`}>
          Mode: {motorMode || 'AUTO'}
        </span>
      </div>
      <div className="motor-buttons">
        <button
          className={`motor-btn on ${motorStatus === 'ON' && motorMode === 'MANUAL' ? 'active-mode' : ''}`}
          onClick={() => onCommand('ON')}
        >
          ▶ ON
        </button>
        <button
          className={`motor-btn off ${motorStatus === 'OFF' && motorMode === 'MANUAL' ? 'active-mode' : ''}`}
          onClick={() => onCommand('OFF')}
        >
          ■ OFF
        </button>
        <button
          className={`motor-btn auto ${motorMode === 'AUTO' ? 'active-mode' : ''}`}
          onClick={() => onCommand('AUTO')}
        >
          ↻ AUTO
        </button>
      </div>
    </div>
  );
}
