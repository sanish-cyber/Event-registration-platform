import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : window.location.origin;

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [nodes, setNodes] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [sensorHistory, setSensorHistory] = useState({});
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected to master');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      setConnected(false);
    });

    // Initial state
    socket.on('init:state', (data) => {
      const nodeMap = {};
      (data.nodes || []).forEach((n) => {
        nodeMap[n.nodeId] = n;
      });
      setNodes(nodeMap);
    });

    // Node discovered
    socket.on('node:discovered', (data) => {
      setNodes((prev) => ({
        ...prev,
        [data.nodeId]: { ...prev[data.nodeId], ...data, status: 'online' },
      }));
    });

    // Sensor data
    socket.on('sensor:data', (data) => {
      setNodes((prev) => ({
        ...prev,
        [data.nodeId]: {
          ...prev[data.nodeId],
          lastData: data.sensors,
          wqi: data.wqi,
          motorStatus: data.motorStatus,
          motorMode: data.motorMode,
          status: 'online',
        },
      }));

      // Maintain history (last 60 data points per node)
      setSensorHistory((prev) => {
        const nodeHist = prev[data.nodeId] || [];
        const newPoint = {
          time: new Date(data.timestamp).toLocaleTimeString(),
          ph: data.sensors.ph,
          ec: data.sensors.ec,
          gas: data.sensors.gas,
          waterTemp: data.sensors.waterTemp,
          humidity: data.sensors.humidity,
          airTemp: data.sensors.airTemp,
          wqi: data.wqi.score,
        };
        const updated = [...nodeHist, newPoint].slice(-60);
        return { ...prev, [data.nodeId]: updated };
      });
    });

    // Heartbeat
    socket.on('node:heartbeat', (data) => {
      setNodes((prev) => ({
        ...prev,
        [data.nodeId]: {
          ...prev[data.nodeId],
          uptime: data.uptime,
          rssi: data.wifi_rssi,
          freeHeap: data.free_heap,
          status: 'online',
        },
      }));
    });

    // Node offline
    socket.on('node:offline', (data) => {
      setNodes((prev) => ({
        ...prev,
        [data.nodeId]: { ...prev[data.nodeId], status: 'offline' },
      }));
      setAlerts((prev) => [
        { nodeId: data.nodeId, level: 'critical', message: `Node ${data.nodeId} went offline`, timestamp: data.timestamp },
        ...prev,
      ].slice(0, 50));
    });

    // Alerts
    socket.on('alert:new', (data) => {
      setAlerts((prev) => [data, ...prev].slice(0, 50));
    });

    return () => socket.disconnect();
  }, []);

  const sendMotorCommand = useCallback((nodeId, action) => {
    if (socketRef.current) {
      socketRef.current.emit('motor:command', { nodeId, action });
    }
  }, []);

  return { connected, nodes, alerts, sensorHistory, sendMotorCommand };
}
