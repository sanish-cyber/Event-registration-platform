/**
 * AquaNet Master Server
 * Combines: MQTT handler + WQI engine + REST API + WebSocket + Alerts
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");

const { calculateWQI } = require("./engine/wqi");
const AquaNetDB = require("./db/database");
const TelegramAlert = require("./alerts/telegram");

// ---- Config ----
const PORT = process.env.PORT || 3001;
const MQTT_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "aquanet.db");

// ---- Initialize ----
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// Serve the dashboard build (production)
app.use(express.static(path.join(__dirname, "..", "..", "dashboard", "dist")));

let db; // Will be set async before server starts
const telegram = new TelegramAlert(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_CHAT_ID
);

// ---- In-Memory State ----
const nodes = new Map(); // nodeId → { lastData, lastHeartbeat, status }

// ============================================================
// MQTT Client — Connects to Mosquitto broker
// ============================================================
console.log(`[MQTT] Connecting to broker: ${MQTT_URL}`);
const mqttClient = mqtt.connect(MQTT_URL, {
    clientId: "aquanet-master-" + Date.now(),
    clean: true,
    reconnectPeriod: 5000,
});

mqttClient.on("connect", () => {
    console.log("[MQTT] Connected to broker ✓");

    // Subscribe to all node topics
    mqttClient.subscribe("aquanet/nodes/+/sensors", { qos: 1 });
    mqttClient.subscribe("aquanet/nodes/+/status/heartbeat", { qos: 0 });
    mqttClient.subscribe("aquanet/nodes/+/status/lwt", { qos: 1 });
    mqttClient.subscribe("aquanet/nodes/+/motor/status", { qos: 1 });
    mqttClient.subscribe("aquanet/system/discovery", { qos: 1 });

    console.log("[MQTT] Subscribed to all node topics");
});

mqttClient.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
});

mqttClient.on("message", (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        handleMQTTMessage(topic, payload);
    } catch (err) {
        console.error("[MQTT] Parse error:", err.message);
    }
});

// ============================================================
// MQTT Message Handler
// ============================================================
function handleMQTTMessage(topic, payload) {
    const parts = topic.split("/");

    // --- Discovery: aquanet/system/discovery ---
    if (topic === "aquanet/system/discovery") {
        handleDiscovery(payload);
        return;
    }

    // Extract node_id from topic: aquanet/nodes/{node_id}/...
    if (parts[0] !== "aquanet" || parts[1] !== "nodes" || parts.length < 4) return;
    const nodeId = parts[2];
    const msgType = parts.slice(3).join("/");

    switch (msgType) {
        case "sensors":
            handleSensorData(nodeId, payload);
            break;
        case "status/heartbeat":
            handleHeartbeat(nodeId, payload);
            break;
        case "status/lwt":
            handleLWT(nodeId, payload);
            break;
        case "motor/status":
            handleMotorStatus(nodeId, payload);
            break;
    }
}

function handleDiscovery(payload) {
    const nodeId = payload.node_id;
    console.log(`[Discovery] Node registered: ${nodeId} (${payload.ip})`);

    db.registerNode(payload);

    nodes.set(nodeId, {
        ...payload,
        status: "online",
        lastHeartbeat: Date.now(),
        lastData: null,
    });

    // Notify dashboard
    io.emit("node:discovered", {
        nodeId,
        mac: payload.mac,
        ip: payload.ip,
        firmware: payload.firmware_version,
        sensors: payload.sensors,
        timestamp: Date.now(),
    });

    // Send default config to new node
    mqttClient.publish(
        `aquanet/nodes/${nodeId}/config/thresholds`,
        JSON.stringify({
            ph_min: 6.5, ph_max: 8.5,
            ec_max: 1.5,
            gas_max: 500,
            water_temp_min: 20, water_temp_max: 30,
        }),
        { qos: 1 }
    );
}

function handleSensorData(nodeId, payload) {
    // Extract sensor values
    const sensors = payload.sensors || {};
    const sensorData = {
        ph: sensors.ph?.value,
        ec: sensors.ec?.value,
        gas: sensors.gas?.value,
        airTemp: sensors.temperature?.value,
        humidity: sensors.humidity?.value,
        waterTemp: sensors.water_temp?.value,
    };

    // Server-side WQI calculation (validates ESP32's calculation)
    const wqi = calculateWQI(sensorData);

    // Update in-memory state
    const nodeState = nodes.get(nodeId) || {};
    nodeState.lastData = { ...sensorData, wqi: wqi.score, wqiLevel: wqi.level };
    nodeState.status = "online";
    nodeState.lastHeartbeat = Date.now();
    nodes.set(nodeId, nodeState);

    // Store in database
    db.insertReading(nodeId, {
        ...sensorData,
        wqi: wqi.score,
        wqiLevel: wqi.level,
        motorStatus: payload.motor_status || "OFF",
    });

    // Update node status
    db.setNodeStatus(nodeId, "online");

    // Broadcast to dashboard
    io.emit("sensor:data", {
        nodeId,
        sensors: sensorData,
        wqi,
        motorStatus: payload.motor_status,
        motorMode: payload.motor_mode,
        timestamp: Date.now(),
    });

    // Check for alerts
    if (wqi.level === "critical") {
        const alertMsg = `WQI dropped to ${wqi.score} — Motor ${wqi.motorAction}`;
        db.insertAlert(nodeId, "critical", alertMsg, wqi.score);
        io.emit("alert:new", { nodeId, level: "critical", message: alertMsg, wqi: wqi.score, timestamp: Date.now() });
        telegram.sendAlert(nodeId, wqi, sensorData, "critical");
    } else if (wqi.level === "warning") {
        const alertMsg = `WQI at ${wqi.score} — Water quality degrading`;
        db.insertAlert(nodeId, "warning", alertMsg, wqi.score);
        io.emit("alert:new", { nodeId, level: "warning", message: alertMsg, wqi: wqi.score, timestamp: Date.now() });
    }
}

function handleHeartbeat(nodeId, payload) {
    const nodeState = nodes.get(nodeId) || {};
    nodeState.lastHeartbeat = Date.now();
    nodeState.status = "online";
    nodeState.uptime = payload.uptime;
    nodeState.rssi = payload.wifi_rssi;
    nodeState.freeHeap = payload.free_heap;
    nodes.set(nodeId, nodeState);

    db.setNodeStatus(nodeId, "online");
    io.emit("node:heartbeat", { nodeId, ...payload, timestamp: Date.now() });
}

function handleLWT(nodeId, payload) {
    console.log(`[LWT] Node ${nodeId} went OFFLINE: ${payload.reason}`);
    const nodeState = nodes.get(nodeId) || {};
    nodeState.status = "offline";
    nodes.set(nodeId, nodeState);

    db.setNodeStatus(nodeId, "offline");
    db.insertAlert(nodeId, "critical", `Node ${nodeId} disconnected unexpectedly`, 0);
    io.emit("node:offline", { nodeId, reason: payload.reason, timestamp: Date.now() });
    telegram.sendNodeOffline(nodeId);
}

function handleMotorStatus(nodeId, payload) {
    io.emit("motor:status", { nodeId, ...payload, timestamp: Date.now() });
}

// ============================================================
// Offline Detection Timer (check every 15s)
// ============================================================
setInterval(() => {
    const now = Date.now();
    for (const [nodeId, state] of nodes) {
        if (state.status === "online" && now - state.lastHeartbeat > 15000) {
            console.log(`[Watchdog] Node ${nodeId} timed out (no heartbeat for 15s)`);
            state.status = "offline";
            db.setNodeStatus(nodeId, "offline");
            io.emit("node:offline", { nodeId, reason: "heartbeat_timeout", timestamp: now });
        }
    }
}, 15000);

// ============================================================
// REST API
// ============================================================
app.get("/api/nodes", (req, res) => {
    const dbNodes = db.getNodes();
    const enriched = dbNodes.map((n) => {
        const memState = nodes.get(n.node_id) || {};
        return { ...n, ...memState };
    });
    res.json(enriched);
});

app.get("/api/nodes/:nodeId/readings", (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const readings = db.getReadings(req.params.nodeId, limit);
    res.json(readings);
});

app.get("/api/nodes/:nodeId/latest", (req, res) => {
    const reading = db.getLatestReading(req.params.nodeId);
    res.json(reading || {});
});

app.get("/api/alerts", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = db.getAlerts(limit);
    res.json(alerts);
});

app.post("/api/alerts/:id/acknowledge", (req, res) => {
    db.acknowledgeAlert(parseInt(req.params.id));
    res.json({ success: true });
});

// Motor control endpoint
app.post("/api/nodes/:nodeId/motor", (req, res) => {
    const { nodeId } = req.params;
    const { action } = req.body; // "ON", "OFF", "AUTO"

    if (!["ON", "OFF", "AUTO"].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Use ON, OFF, or AUTO" });
    }

    mqttClient.publish(
        `aquanet/nodes/${nodeId}/motor/command`,
        JSON.stringify({ action, source: "dashboard", timestamp: Date.now() }),
        { qos: 2 } // Exactly once for motor commands
    );

    console.log(`[API] Motor command: ${nodeId} → ${action}`);
    res.json({ success: true, nodeId, action });
});

// Data export
app.get("/api/nodes/:nodeId/export", (req, res) => {
    const { nodeId } = req.params;
    const from = parseInt(req.query.from) || 0;
    const to = parseInt(req.query.to) || Date.now();
    const readings = db.getReadingsCSV(nodeId, from, to);

    // Convert to CSV
    const headers = "timestamp,ph,ec,gas,air_temp,humidity,water_temp,wqi,wqi_level,motor_status\n";
    const csv = readings.map((r) =>
        `${r.timestamp},${r.ph},${r.ec},${r.gas},${r.air_temp},${r.humidity},${r.water_temp},${r.wqi},${r.wqi_level},${r.motor_status}`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=aquanet-${nodeId}.csv`);
    res.send(headers + csv);
});

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        mqtt: mqttClient.connected,
        nodes: nodes.size,
        uptime: process.uptime(),
    });
});

// SPA fallback
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "dashboard", "dist", "index.html"));
});

// ============================================================
// WebSocket (Socket.IO)
// ============================================================
io.on("connection", (socket) => {
    console.log(`[WS] Dashboard connected: ${socket.id}`);

    // Send current state to new connections
    const currentNodes = [];
    for (const [nodeId, state] of nodes) {
        currentNodes.push({ nodeId, ...state });
    }
    socket.emit("init:state", { nodes: currentNodes });

    // Motor control from dashboard
    socket.on("motor:command", (data) => {
        const { nodeId, action } = data;
        mqttClient.publish(
            `aquanet/nodes/${nodeId}/motor/command`,
            JSON.stringify({ action, source: "dashboard", timestamp: Date.now() }),
            { qos: 2 }
        );
        console.log(`[WS] Motor command from dashboard: ${nodeId} → ${action}`);
    });

    socket.on("disconnect", () => {
        console.log(`[WS] Dashboard disconnected: ${socket.id}`);
    });
});

// ============================================================
// Start Server (async — wait for DB init)
// ============================================================
(async () => {
    db = await AquaNetDB.create(DB_PATH);

    server.listen(PORT, () => {
        console.log();
        console.log("╔══════════════════════════════════════╗");
        console.log("║     AquaNet Master Server v1.0.0     ║");
        console.log("╚══════════════════════════════════════╝");
        console.log(`  API Server:  http://localhost:${PORT}`);
        console.log(`  MQTT Broker: ${MQTT_URL}`);
        console.log(`  Database:    ${DB_PATH}`);
        console.log(`  Telegram:    ${telegram.enabled ? "Enabled" : "Disabled"}`);
        console.log();
    });
})();

module.exports = { app, server };
