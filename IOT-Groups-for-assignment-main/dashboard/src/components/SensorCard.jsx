import React from 'react';

const SENSOR_CONFIG = {
  ph: { label: 'pH Level', icon: '🧪', unit: 'pH', color: '#8b5cf6' },
  ec: { label: 'Electrical Conductivity', icon: '⚡', unit: 'mS/cm', color: '#06b6d4' },
  gas: { label: 'Gas (MQ2)', icon: '💨', unit: 'ppm', color: '#f59e0b' },
  waterTemp: { label: 'Water Temperature', icon: '🌊', unit: '°C', color: '#3b82f6' },
  humidity: { label: 'Humidity', icon: '💧', unit: '%', color: '#10b981' },
  airTemp: { label: 'Air Temperature', icon: '🌡️', unit: '°C', color: '#ef4444' },
};

function getStatus(type, value) {
  if (value == null) return 'normal';
  switch (type) {
    case 'ph': return (value < 5 || value > 9.5) ? 'critical' : (value < 6.5 || value > 8.5) ? 'warning' : 'normal';
    case 'ec': return value > 3 ? 'critical' : value > 1.5 ? 'warning' : 'normal';
    case 'gas': return value > 1000 ? 'critical' : value > 500 ? 'warning' : 'normal';
    case 'waterTemp': return (value < 10 || value > 40) ? 'critical' : (value < 20 || value > 30) ? 'warning' : 'normal';
    case 'humidity': return (value < 20 || value > 90) ? 'critical' : (value < 30 || value > 70) ? 'warning' : 'normal';
    case 'airTemp': return (value < 0 || value > 50) ? 'critical' : (value < 10 || value > 40) ? 'warning' : 'normal';
    default: return 'normal';
  }
}

export default function SensorCard({ type, value }) {
  const config = SENSOR_CONFIG[type] || { label: type, icon: '📊', unit: '', color: '#888' };
  const status = getStatus(type, value);
  const displayValue = value != null ? (type === 'ph' ? value.toFixed(2) : value.toFixed(1)) : '--';

  return (
    <div className="card" style={{ borderTop: `2px solid ${config.color}` }}>
      <div className="card-header">
        <span className="card-title">{config.label}</span>
        <span className="card-icon">{config.icon}</span>
      </div>
      <div className="sensor-value" style={{ color: config.color }}>
        {displayValue}
        <span className="sensor-unit">{config.unit}</span>
      </div>
      <span className={`sensor-status ${status}`}>
        {status === 'normal' ? '✓' : status === 'warning' ? '⚠' : '✕'} {status}
      </span>
    </div>
  );
}

export { SENSOR_CONFIG };
