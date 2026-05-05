import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import SensorCard from './components/SensorCard';
import WQIGauge from './components/WQIGauge';
import MotorControl from './components/MotorControl';
import LiveChart from './components/LiveChart';
import AlertPanel from './components/AlertPanel';

export default function App() {
  const { connected, nodes, alerts, sensorHistory, sendMotorCommand } = useWebSocket();
  const [selectedNode, setSelectedNode] = useState(null);

  const nodeIds = Object.keys(nodes);
  const activeNodeId = selectedNode || nodeIds[0] || null;
  const activeNode = activeNodeId ? nodes[activeNodeId] : null;
  const activeData = activeNode?.lastData || {};
  const activeWQI = activeNode?.wqi || {};
  const activeHistory = activeNodeId ? (sensorHistory[activeNodeId] || []) : [];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">💧</div>
          <div>
            <div className="header-title">AquaNet</div>
            <div className="header-subtitle">Enterprise IoT Water Quality Monitor</div>
          </div>
        </div>
        <div className="header-right">
          <div className={`connection-badge ${connected ? 'online' : 'offline'}`}>
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            {connected ? 'Master Connected' : 'Disconnected'}
          </div>
          <div className="connection-badge">
            {nodeIds.length} Node{nodeIds.length !== 1 ? 's' : ''}
          </div>
        </div>
      </header>

      {/* Node Switcher */}
      {nodeIds.length > 0 && (
        <div className="node-switcher">
          {nodeIds.map((id) => (
            <button
              key={id}
              className={`node-tab ${activeNodeId === id ? 'active' : ''}`}
              onClick={() => setSelectedNode(id)}
            >
              <span className={`node-status ${nodes[id]?.status || 'offline'}`} />
              {id}
              {nodes[id]?.wqi?.score != null && (
                <span style={{ fontSize: '11px', opacity: 0.7 }}>WQI: {Math.round(nodes[id].wqi.score)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Node Info Bar */}
      {activeNode && (
        <div className="node-info-bar">
          <div className="node-info-item">
            <span className="node-info-label">Node ID</span>
            <span className="node-info-value">{activeNodeId}</span>
          </div>
          <div className="node-info-item">
            <span className="node-info-label">Status</span>
            <span className="node-info-value" style={{ color: activeNode.status === 'online' ? 'var(--status-online)' : 'var(--status-offline)' }}>
              {activeNode.status === 'online' ? '● Online' : '● Offline'}
            </span>
          </div>
          {activeNode.ip && (
            <div className="node-info-item">
              <span className="node-info-label">IP Address</span>
              <span className="node-info-value">{activeNode.ip}</span>
            </div>
          )}
          {activeNode.rssi != null && (
            <div className="node-info-item">
              <span className="node-info-label">WiFi Signal</span>
              <span className="node-info-value">{activeNode.rssi} dBm</span>
            </div>
          )}
          {activeNode.uptime != null && (
            <div className="node-info-item">
              <span className="node-info-label">Uptime</span>
              <span className="node-info-value">{formatUptime(activeNode.uptime)}</span>
            </div>
          )}
          {activeNode.firmware && (
            <div className="node-info-item">
              <span className="node-info-label">Firmware</span>
              <span className="node-info-value">v{activeNode.firmware}</span>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {nodeIds.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📡</div>
          <div className="empty-title">Waiting for Nodes</div>
          <div className="empty-description">
            {connected
              ? 'No sensor nodes detected. Power on your ESP32 slave nodes to begin monitoring.'
              : 'Connecting to AquaNet Master server...'}
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      {activeNode && (
        <>
          <div className="dashboard-grid">
            <WQIGauge
              score={activeWQI.score}
              level={activeWQI.level}
            />
            <MotorControl
              motorStatus={activeNode.motorStatus}
              motorMode={activeNode.motorMode}
              onCommand={(action) => sendMotorCommand(activeNodeId, action)}
            />
          </div>

          <div className="dashboard-grid">
            <SensorCard type="ph" value={activeData.ph} />
            <SensorCard type="ec" value={activeData.ec} />
            <SensorCard type="gas" value={activeData.gas} />
            <SensorCard type="waterTemp" value={activeData.waterTemp} />
            <SensorCard type="humidity" value={activeData.humidity} />
            <SensorCard type="airTemp" value={activeData.airTemp} />
          </div>

          <div className="dashboard-grid wide">
            <LiveChart data={activeHistory} />
          </div>
        </>
      )}

      {/* Alerts */}
      <div className="dashboard-grid wide">
        <AlertPanel alerts={alerts} />
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
