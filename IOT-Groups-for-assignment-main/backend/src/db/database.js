/**
 * AquaNet SQLite Database
 * Stores sensor readings, node registry, alerts
 * Uses sql.js (pure JS WebAssembly SQLite — no native compilation needed)
 */

const path = require("path");
const fs = require("fs");

// sql.js WASM is loaded asynchronously. We expose an async init() factory.
// server.js must call AquaNetDB.create(dbPath) and await it.

class AquaNetDB {
    constructor(db, dbPath) {
        this.db = db;
        this.dbPath = dbPath;
    }

    static async create(dbPath) {
        const initSqlJs = require("sql.js");
        const SQL = await initSqlJs();

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let db;
        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            db = new SQL.Database(fileBuffer);
        } else {
            db = new SQL.Database();
        }

        const instance = new AquaNetDB(db, dbPath);
        instance._createTables();
        console.log("[DB] Database initialized (sql.js / pure JS)");
        return instance;
    }

    _save() {
        try {
            const data = this.db.export();
            fs.writeFileSync(this.dbPath, Buffer.from(data));
        } catch (err) {
            console.error("[DB] Save error:", err.message);
        }
    }

    _run(sql, params = []) {
        this.db.run(sql, params);
        this._save();
    }

    _get(sql, params = []) {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        let row;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        return row;
    }

    _all(sql, params = []) {
        const results = [];
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
    }

    _createTables() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS nodes (
                node_id TEXT PRIMARY KEY,
                mac TEXT,
                ip TEXT,
                firmware_version TEXT,
                status TEXT DEFAULT 'offline',
                last_seen INTEGER,
                registered_at INTEGER
            );
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                ph REAL, ec REAL, gas REAL,
                air_temp REAL, humidity REAL, water_temp REAL,
                wqi REAL, wqi_level TEXT, motor_status TEXT
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                level TEXT NOT NULL,
                message TEXT, wqi REAL,
                acknowledged INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_readings_node_time ON sensor_readings(node_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_alerts_node ON alerts(node_id, timestamp);
        `);
        this._save();
    }

    // --- Node Registry ---
    registerNode(data) {
        const now = Date.now();
        const existing = this._get("SELECT node_id FROM nodes WHERE node_id = ?", [data.node_id]);
        if (existing) {
            this._run(
                "UPDATE nodes SET mac=?, ip=?, firmware_version=?, status='online', last_seen=? WHERE node_id=?",
                [data.mac, data.ip, data.firmware_version, now, data.node_id]
            );
        } else {
            this._run(
                "INSERT INTO nodes (node_id, mac, ip, firmware_version, status, last_seen, registered_at) VALUES (?,?,?,?,'online',?,?)",
                [data.node_id, data.mac, data.ip, data.firmware_version, now, now]
            );
        }
    }

    setNodeStatus(nodeId, status) {
        this._run("UPDATE nodes SET status=?, last_seen=? WHERE node_id=?", [status, Date.now(), nodeId]);
    }

    getNodes() {
        return this._all("SELECT * FROM nodes ORDER BY registered_at");
    }

    // --- Sensor Readings ---
    insertReading(nodeId, data) {
        this._run(
            `INSERT INTO sensor_readings
            (node_id, timestamp, ph, ec, gas, air_temp, humidity, water_temp, wqi, wqi_level, motor_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [nodeId, Date.now(), data.ph, data.ec, data.gas,
             data.airTemp, data.humidity, data.waterTemp,
             data.wqi, data.wqiLevel, data.motorStatus]
        );
    }

    getReadings(nodeId, limit = 100) {
        return this._all(
            "SELECT * FROM sensor_readings WHERE node_id=? ORDER BY timestamp DESC LIMIT ?",
            [nodeId, limit]
        );
    }

    getLatestReading(nodeId) {
        return this._get(
            "SELECT * FROM sensor_readings WHERE node_id=? ORDER BY timestamp DESC LIMIT 1",
            [nodeId]
        );
    }

    // --- Alerts ---
    insertAlert(nodeId, level, message, wqi) {
        this._run(
            "INSERT INTO alerts (node_id, timestamp, level, message, wqi) VALUES (?,?,?,?,?)",
            [nodeId, Date.now(), level, message, wqi]
        );
    }

    getAlerts(limit = 50) {
        return this._all("SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?", [limit]);
    }

    acknowledgeAlert(alertId) {
        this._run("UPDATE alerts SET acknowledged=1 WHERE id=?", [alertId]);
    }

    // --- Export ---
    getReadingsCSV(nodeId, from, to) {
        return this._all(
            "SELECT * FROM sensor_readings WHERE node_id=? AND timestamp BETWEEN ? AND ? ORDER BY timestamp",
            [nodeId, from, to]
        );
    }

    close() {
        this._save();
        this.db.close();
    }
}

module.exports = AquaNetDB;
