/*
 * ============================================================
 * AquaNet — ESP32 Slave Node Firmware
 * ============================================================
 * Reads 5 sensors (pH, EC, MQ2, DHT11, DS18B20),
 * computes WQI score, publishes to MQTT, controls motor.
 * Supports master-slave with auto-discovery + heartbeat + LWT.
 * ============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_ADS1X15.h>
#include <Wire.h>

#include "config.h"
#include "sensors/ph_sensor.h"
#include "sensors/ec_sensor.h"
#include "sensors/gas_sensor.h"
#include "sensors/dht_sensor.h"
#include "sensors/water_temp_sensor.h"
#include "engine/wqi_calculator.h"
#include "actuators/motor_controller.h"

// ---- Global Objects ----
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
Adafruit_ADS1115 ads;

// Sensors
PHSensor phSensor(&ads, PH_ADS_CHANNEL);
ECSensor ecSensor(&ads, EC_ADS_CHANNEL);
GasSensor gasSensor(&ads, MQ2_ADS_CHANNEL);
DHTSensor dhtSensor(DHT_PIN, DHT_TYPE);
WaterTempSensor waterTempSensor(DS18B20_PIN);

// Engine & Actuator
WQICalculator wqiEngine;
MotorController motor(RELAY_PIN);

// ---- Timing Variables ----
unsigned long lastSensorRead = 0;
unsigned long lastMQTTPublish = 0;
unsigned long lastHeartbeat = 0;
unsigned long bootTime = 0;

// ---- Current Sensor Readings ----
SensorData currentData = {7.0, 0.5, 200.0, 25.0, 50.0, 25.0};
WQIResult currentWQI;

// ============================================================
// WiFi Connection
// ============================================================
void connectWiFi() {
    Serial.print("[WiFi] Connecting to ");
    Serial.println(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("[WiFi] Connected! IP: " + WiFi.localIP().toString());
        Serial.println("[WiFi] RSSI: " + String(WiFi.RSSI()) + " dBm");
    } else {
        Serial.println();
        Serial.println("[WiFi] FAILED to connect. Will retry...");
    }
}

// ============================================================
// MQTT Callback — Receives motor commands & config updates
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
    // Parse payload
    char message[length + 1];
    memcpy(message, payload, length);
    message[length] = '\0';

    String topicStr = String(topic);
    Serial.println("[MQTT] Received: " + topicStr + " → " + String(message));

    // Motor command from master
    if (topicStr == TOPIC_MOTOR_CMD) {
        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, message);
        if (error) {
            Serial.println("[MQTT] JSON parse error for motor command");
            return;
        }

        const char* action = doc["action"];
        if (strcmp(action, "ON") == 0) {
            motor.setAuto(false);
            motor.turnOn();
        } else if (strcmp(action, "OFF") == 0) {
            motor.setAuto(false);
            motor.turnOff();
        } else if (strcmp(action, "AUTO") == 0) {
            motor.setAuto(true);
        }

        // Publish motor status back
        publishMotorStatus();
    }

    // Config update from master (thresholds, intervals)
    if (topicStr.startsWith("aquanet/nodes/" NODE_ID "/config/")) {
        Serial.println("[Config] Received configuration update");
        // Config handling can be extended here
    }
}

// ============================================================
// MQTT Connection + Discovery + LWT
// ============================================================
void connectMQTT() {
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(1024);  // Increase buffer for JSON payloads

    while (!mqttClient.connected()) {
        Serial.print("[MQTT] Connecting to broker...");

        // LWT: If this node disconnects unexpectedly, broker publishes this
        String lwtPayload = "{\"node_id\":\"" NODE_ID "\",\"status\":\"offline\",\"reason\":\"unexpected_disconnect\"}";

        bool connected;
        if (strlen(MQTT_USER) > 0) {
            connected = mqttClient.connect(NODE_ID, MQTT_USER, MQTT_PASSWORD,
                                           TOPIC_LWT, 1, true, lwtPayload.c_str());
        } else {
            connected = mqttClient.connect(NODE_ID,
                                           TOPIC_LWT, 1, true, lwtPayload.c_str());
        }

        if (connected) {
            Serial.println(" Connected!");

            // Subscribe to motor commands
            mqttClient.subscribe(TOPIC_MOTOR_CMD, 1);
            Serial.println("[MQTT] Subscribed to: " TOPIC_MOTOR_CMD);

            // Subscribe to config updates
            mqttClient.subscribe(TOPIC_CONFIG, 1);
            Serial.println("[MQTT] Subscribed to: " TOPIC_CONFIG);

            // Publish discovery message (auto-registration)
            publishDiscovery();

        } else {
            Serial.print(" Failed (rc=");
            Serial.print(mqttClient.state());
            Serial.println("). Retrying in 5s...");
            delay(MQTT_RETRY_DELAY);
        }
    }
}

// ============================================================
// MQTT Publish Functions
// ============================================================

void publishDiscovery() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["mac"] = WiFi.macAddress();
    doc["ip"] = WiFi.localIP().toString();
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["status"] = "online";

    JsonArray sensors = doc["sensors"].to<JsonArray>();
    sensors.add("ph");
    sensors.add("ec");
    sensors.add("gas");
    sensors.add("dht11");
    sensors.add("ds18b20");

    JsonArray capabilities = doc["capabilities"].to<JsonArray>();
    capabilities.add("motor_control");
    capabilities.add("wqi_calculation");

    char buffer[512];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_DISCOVERY, buffer, true);  // Retained
    Serial.println("[Discovery] Published registration to master");
}

void publishSensorData() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["timestamp"] = millis() / 1000;

    JsonObject sensors = doc["sensors"].to<JsonObject>();

    JsonObject ph = sensors["ph"].to<JsonObject>();
    ph["value"] = round(currentData.ph * 100) / 100.0;
    ph["unit"] = "pH";
    ph["status"] = phSensor.getStatus(currentData.ph);

    JsonObject ec = sensors["ec"].to<JsonObject>();
    ec["value"] = round(currentData.ec * 100) / 100.0;
    ec["unit"] = "mS/cm";
    ec["status"] = ecSensor.getStatus(currentData.ec);

    JsonObject gas = sensors["gas"].to<JsonObject>();
    gas["value"] = round(currentData.gasPPM * 10) / 10.0;
    gas["unit"] = "ppm";
    gas["status"] = gasSensor.getStatus(currentData.gasPPM);

    JsonObject temp = sensors["temperature"].to<JsonObject>();
    temp["value"] = round(currentData.airTemp * 10) / 10.0;
    temp["unit"] = "°C";
    temp["status"] = dhtSensor.getTempStatus(currentData.airTemp);

    JsonObject humidity = sensors["humidity"].to<JsonObject>();
    humidity["value"] = round(currentData.humidity * 10) / 10.0;
    humidity["unit"] = "%";
    humidity["status"] = dhtSensor.getHumidityStatus(currentData.humidity);

    JsonObject waterTemp = sensors["water_temp"].to<JsonObject>();
    waterTemp["value"] = round(currentData.waterTemp * 10) / 10.0;
    waterTemp["unit"] = "°C";
    waterTemp["status"] = waterTempSensor.getStatus(currentData.waterTemp);

    // WQI
    doc["wqi"] = round(currentWQI.score * 10) / 10.0;
    doc["wqi_level"] = currentWQI.level;
    doc["motor_status"] = motor.getStatusString();
    doc["motor_mode"] = motor.isAutoMode() ? "AUTO" : "MANUAL";

    char buffer[768];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_SENSORS, buffer);
}

void publishHeartbeat() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["uptime"] = (millis() - bootTime) / 1000;
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["wqi"] = round(currentWQI.score * 10) / 10.0;
    doc["motor"] = motor.getStatusString();

    char buffer[256];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_HEARTBEAT, buffer);
}

void publishMotorStatus() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["motor"] = motor.getStatusString();
    doc["mode"] = motor.isAutoMode() ? "AUTO" : "MANUAL";
    doc["wqi"] = round(currentWQI.score * 10) / 10.0;

    char buffer[128];
    serializeJson(doc, buffer);
    mqttClient.publish(TOPIC_MOTOR_STATUS, buffer, true);  // Retained
}

// ============================================================
// Read All Sensors
// ============================================================
void readAllSensors() {
    // Read water temp first (needed for EC temperature compensation)
    currentData.waterTemp = waterTempSensor.read();

    // Read pH
    currentData.ph = phSensor.read();

    // Read EC (temperature compensated)
    currentData.ec = ecSensor.read(currentData.waterTemp);

    // Read gas
    currentData.gasPPM = gasSensor.read();

    // Read DHT11
    currentData.airTemp = dhtSensor.readTemperature();
    currentData.humidity = dhtSensor.readHumidity();

    // Calculate WQI
    currentWQI = wqiEngine.calculate(currentData);

    // Auto motor control
    if (motor.isAutoMode()) {
        if (strcmp(currentWQI.motorAction, "ON") == 0) {
            motor.turnOn();
        } else if (strcmp(currentWQI.motorAction, "OFF") == 0) {
            motor.turnOff();
        }
        // STANDBY: don't change motor state, keep current state
    }

    // Debug output
    Serial.println("─── Sensor Readings ───────────────────");
    Serial.printf("  pH:         %.2f (%s)\n", currentData.ph, phSensor.getStatus(currentData.ph));
    Serial.printf("  EC:         %.2f mS/cm (%s)\n", currentData.ec, ecSensor.getStatus(currentData.ec));
    Serial.printf("  Gas:        %.1f ppm (%s)\n", currentData.gasPPM, gasSensor.getStatus(currentData.gasPPM));
    Serial.printf("  Air Temp:   %.1f °C\n", currentData.airTemp);
    Serial.printf("  Humidity:   %.1f %%\n", currentData.humidity);
    Serial.printf("  Water Temp: %.1f °C\n", currentData.waterTemp);
    Serial.printf("  WQI Score:  %.1f (%s)\n", currentWQI.score, currentWQI.level);
    Serial.printf("  Motor:      %s (%s)\n", motor.getStatusString(), motor.isAutoMode() ? "AUTO" : "MANUAL");
    Serial.println("───────────────────────────────────────");
}

// ============================================================
// SETUP
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("╔══════════════════════════════════════╗");
    Serial.println("║     AquaNet Slave Node v" FIRMWARE_VERSION "       ║");
    Serial.println("║     Node ID: " NODE_ID "              ║");
    Serial.println("╚══════════════════════════════════════╝");

    bootTime = millis();

    // Initialize I2C for ADS1115
    Wire.begin(21, 22);  // SDA=21, SCL=22
    if (!ads.begin(ADS1115_ADDR)) {
        Serial.println("[ADS1115] FAILED to initialize! Check I2C wiring.");
    } else {
        ads.setGain(GAIN_ONE);  // ±4.096V range
        Serial.println("[ADS1115] Initialized successfully (16-bit, ±4.096V)");
    }

    // Initialize all sensors
    phSensor.begin();
    ecSensor.begin();
    gasSensor.begin();
    dhtSensor.begin();
    waterTempSensor.begin();

    // Initialize motor controller
    motor.begin();

    // Connect to WiFi
    connectWiFi();

    // Connect to MQTT broker
    if (WiFi.status() == WL_CONNECTED) {
        connectMQTT();
    }

    Serial.println("[System] Initialization complete. Starting main loop...");
    Serial.println();
}

// ============================================================
// MAIN LOOP
// ============================================================
void loop() {
    // Ensure WiFi is connected
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Connection lost. Reconnecting...");
        connectWiFi();
        return;
    }

    // Ensure MQTT is connected
    if (!mqttClient.connected()) {
        connectMQTT();
    }
    mqttClient.loop();  // Process incoming messages

    unsigned long now = millis();

    // Read sensors at interval
    if (now - lastSensorRead >= SENSOR_READ_INTERVAL) {
        lastSensorRead = now;
        readAllSensors();
    }

    // Publish sensor data at interval
    if (now - lastMQTTPublish >= MQTT_PUBLISH_INTERVAL) {
        lastMQTTPublish = now;
        publishSensorData();
    }

    // Send heartbeat
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = now;
        publishHeartbeat();
    }
}
