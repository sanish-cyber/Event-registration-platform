import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CHART_LINES = [
  { key: 'ph', name: 'pH', color: '#8b5cf6', yAxisId: 'left' },
  { key: 'ec', name: 'EC (mS/cm)', color: '#06b6d4', yAxisId: 'left' },
  { key: 'wqi', name: 'WQI', color: '#10b981', yAxisId: 'right' },
  { key: 'waterTemp', name: 'Water °C', color: '#3b82f6', yAxisId: 'left' },
  { key: 'gas', name: 'Gas (ppm)', color: '#f59e0b', yAxisId: 'right' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '12px 16px',
      backdropFilter: 'blur(10px)',
      fontSize: '12px',
    }}>
      <div style={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
          <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function LiveChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card chart-card">
        <div className="card-header">
          <span className="card-title">Live Sensor Trends</span>
          <span className="card-icon">📈</span>
        </div>
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Waiting for sensor data...
        </div>
      </div>
    );
  }

  return (
    <div className="card chart-card">
      <div className="card-header">
        <span className="card-title">Live Sensor Trends</span>
        <span className="card-icon">📈</span>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 'auto']} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
            {CHART_LINES.map((line) => (
              <Line
                key={line.key}
                yAxisId={line.yAxisId}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
                animationDuration={300}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
