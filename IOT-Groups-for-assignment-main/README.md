# 🏆 AquaNet — Enterprise IoT Water Quality Monitoring System

> Multi-node, master-slave IoT system for real-time water quality monitoring with intelligent motor control.

![AquaNet](https://img.shields.io/badge/AquaNet-v1.0.0-blue)
![ESP32](https://img.shields.io/badge/Hardware-ESP32-green)
![MQTT](https://img.shields.io/badge/Protocol-MQTT-orange)
![React](https://img.shields.io/badge/Dashboard-React-cyan)

## Architecture

```
[Sensors] → [ESP32 Slave] →(MQTT)→ [Master Server] → [React Dashboard]
                                         ↓
                                    [SQLite DB]
                                    [Telegram Alerts]
```

## Quick Start

### 1. Install Mosquitto MQTT Broker
```bash
# Ubuntu/Debian
sudo apt install mosquitto mosquitto-clients

# Start broker
mosquitto -c backend/mosquitto.conf
```

### 2. Start Backend Server
```bash
cd backend
npm install
npm run dev
```

### 3. Start Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 4. Flash ESP32 Firmware
```bash
# Install PlatformIO CLI or use VS Code PlatformIO extension
cd firmware
# Edit src/config.h with your WiFi credentials and laptop IP
pio run --target upload
```

## Project Structure
```
aquanet/
├── firmware/     # ESP32 PlatformIO project
├── backend/      # Node.js master server
├── dashboard/    # React + Vite web dashboard
└── docs/         # Documentation
```

## Features
- ✅ 5-sensor monitoring (pH, EC, MQ2, DHT11, DS18B20)
- ✅ Weighted Water Quality Index (WQI) scoring
- ✅ Automatic motor control based on WQI
- ✅ MQTT pub/sub master-slave architecture
- ✅ Plug-and-play node auto-discovery
- ✅ Real-time glassmorphism web dashboard
- ✅ Telegram alerts for critical events
- ✅ SQLite data logging with CSV export
- ✅ Heartbeat + LWT offline detection
- ✅ Manual/Auto motor control from dashboard

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Microcontroller | ESP32 + PlatformIO |
| Sensors | pH, EC/TDS, MQ2, DHT11, DS18B20 |
| ADC | ADS1115 16-bit external ADC |
| Protocol | MQTT v5 (Mosquitto) |
| Backend | Node.js + Express + Socket.IO |
| Database | SQLite (better-sqlite3) |
| Dashboard | React 18 + Vite + Recharts |
| Alerts | Telegram Bot API |

## Team
- Built by CSE students at ADBU
- Semester 8 IoT Assignment
