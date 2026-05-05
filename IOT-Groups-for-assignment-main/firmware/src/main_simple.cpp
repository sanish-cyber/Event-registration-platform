/*
 * ============================================================
 *  AquaNet — ESP32 Node Firmware (Simple / Self-Contained)
 * ============================================================
 *  Based on original sketch — corrected & extended to connect
 *  to the AquaNet dashboard via WiFi + MQTT.
 *
 *  SENSORS:
 *    1. pH Sensor          → GPIO 34 (analog, 12-bit ADC)
 *    2. EC / TDS Sensor    → GPIO 35 (analog, 12-bit ADC)
 *    3. MQ2 Gas Sensor     → GPIO 32 (analog, 12-bit ADC)
 *    4. DHT11              → GPIO 4  (digital, temp + humidity)
 *    5. Water Temp DS18B20 → GPIO 15 (OneWire digital)
 *
 *  ACTUATOR:
 *    Relay / Motor         → GPIO 23 (LOW = ON, HIGH = OFF)
 *
 *  REQUIRED LIBRARIES (install via PlatformIO / Arduino Library Manager):
 *    - PubSubClient         (MQTT)
 *    - ArduinoJson          (JSON)
 *    - DHT sensor library   (Adafruit)
 *    - Adafruit Unified Sensor
 *    - DallasTemperature    (DS18B20)
 *    - OneWire
 *    - LiquidCrystal_I2C   (LCD)
 * ============================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ============================================================
//  ★ CONFIGURE THESE FOR YOUR SETUP ★
// ============================================================
#define WIFI_SSID       "YOUR_WIFI_SSID"      // ← Your WiFi name
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"  // ← Your WiFi password
#define MQTT_BROKER     "192.168.1.100"       // ← IP of the laptop running the backend
#define MQTT_PORT       1883
#define NODE_ID         "SLAVE_01"            // Unique name for this node
#define FIRMWARE_VER    "1.0.0"

// ============================================================
//  PIN DEFINITIONS
// ============================================================
#define PH_PIN          34   // pH sensor analog output
#define TDS_PIN         35   // EC / TDS sensor analog output
#define MQ_PIN          32   // MQ2 gas sensor analog output
#define DHT_PIN         4    // DHT11 data pin
#define DS18B20_PIN     15   // DS18B20 water temperature (OneWire)
#define RELAY_PIN       23   // Relay controlling the motor

// ============================================================
//  CALIBRATION — Adjust after measuring with known solutions
// ============================================================
// pH: voltage measured at pH7 and pH4 buffer solutions
#define PH_V_AT_PH7     1.50   // Volts when probe is in pH 7.0 buffer
#define PH_V_AT_PH4     2.03   // Volts when probe is in pH 4.0 buffer

// EC: TDS raw ADC → mS/cm conversion factor (adjust per probe)
// Raw ADC (0-4095) → voltage → resistance → EC
// Simple linear approximation: EC ≈ (rawADC / 4095.0) * 3.3 / EC_K_VALUE
#define EC_K_VALUE      0.5    // Cell constant (calibrate with 1413 µS/cm solution)

// MQ2: approx ppm from raw ADC reading (pre-calibrated ratio)
#define MQ2_RL          10.0   // Load resistor in kΩ
#define MQ2_RO          9.83   // Sensor R in clean air / RO ratio

// ============================================================
//  MOTOR CONTROL THRESHOLDS
// ============================================================
// Motor turns ON automatically when ANY threshold is breached
#define PH_MIN          6.5    // Motor ON if pH < 6.5
#define PH_MAX          8.5    // Motor ON if pH > 8.5
#define EC_MAX          1.5    // Motor ON if EC > 1.5 mS/cm
#define GAS_MAX         500.0  // Motor ON if gas > 500 ppm
#define WATER_TEMP_MAX  30.0   // Motor ON if water temp > 30°C
#define WATER_TEMP_MIN  10.0   // Motor ON if water temp < 10°C

// ============================================================
//  TIMING
// ============================================================
#define SENSOR_INTERVAL     2000   // ms between sensor reads
#define PUBLISH_INTERVAL    2000   // ms between MQTT publishes
#define HEARTBEAT_INTERVAL  5000   // ms between heartbeats

// ============================================================
//  MQTT TOPICS
// ============================================================
#define TOPIC_SENSORS    "aquanet/nodes/" NODE_ID "/sensors"
#define TOPIC_HEARTBEAT  "aquanet/nodes/" NODE_ID "/status/heartbeat"
#define TOPIC_LWT        "aquanet/nodes/" NODE_ID "/status/lwt"
#define TOPIC_MOTOR_CMD  "aquanet/nodes/" NODE_ID "/motor/command"
#define TOPIC_MOTOR_STAT "aquanet/nodes/" NODE_ID "/motor/status"
#define TOPIC_DISCOVERY  "aquanet/system/discovery"

// ============================================================
//  OBJECTS
// ============================================================
WiFiClient    wifiClient;
PubSubClient  mqtt(wifiClient);

DHT           dht(DHT_PIN, DHT11);
OneWire       oneWire(DS18B20_PIN);
DallasTemperature waterTempSensor(&oneWire);

LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============================================================
//  STATE
// ============================================================
struct SensorData {
    float ph         = 7.0;
    float ec         = 0.5;   // mS/cm
    float gasPPM     = 100.0;
    float airTemp    = 25.0;
    float humidity   = 50.0;
    float waterTemp  = 25.0;
};

SensorData data;
bool motorOn     = false;
bool motorAuto   = true;   // Dashboard can switch to MANUAL
unsigned long lastSensor    = 0;
unsigned long lastPublish   = 0;
unsigned long lastHeartbeat = 0;
unsigned long bootTime      = 0;

// ============================================================
//  SENSOR READING HELPERS
// ============================================================

// Average 10 ADC readings to reduce noise
int stableADC(int pin) {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(pin);
        delay(5);
    }
    return sum / 10;
}

// Convert raw ADC → pH using two-point calibration
float readPH() {
    int raw = stableADC(PH_PIN);
    float voltage = (raw / 4095.0) * 3.3;   // ESP32 ADC is 12-bit, 3.3V ref
    // Two-point linear interpolation
    float slope = (4.0 - 7.0) / (PH_V_AT_PH4 - PH_V_AT_PH7);
    float ph = slope * (voltage - PH_V_AT_PH7) + 7.0;
    return constrain(ph, 0.0, 14.0);
}

// Convert raw ADC → EC in mS/cm (temperature compensated)
float readEC(float tempC) {
    int raw = stableADC(TDS_PIN);
    float voltage = (raw / 4095.0) * 3.3;

    // Resistance of water between electrodes (simplified)
    // EC = 1 / (resistance * EC_K_VALUE)
    // voltage divider: Rwater = EC_K_VALUE * (3.3 - voltage) / voltage
    if (voltage <= 0.01) return 0.0;
    float resistance = EC_K_VALUE * (3.3 - voltage) / voltage;
    float ec = (resistance > 0) ? (1.0 / resistance) : 0;

    // Temperature compensation (standard: 25°C reference)
    float tempComp = 1.0 + 0.02 * (tempC - 25.0);
    ec = ec / tempComp;

    return constrain(ec, 0.0, 20.0);
}

// Convert raw ADC → gas ppm using MQ2 characteristics
float readGasPPM() {
    int raw = stableADC(MQ_PIN);
    float voltage = (raw / 4095.0) * 3.3;
    if (voltage <= 0.01) return 0.0;

    // Rs = RL * (VCC - Vout) / Vout
    float rs = MQ2_RL * (3.3 - voltage) / voltage;
    float ratio = rs / MQ2_RO;

    // LPG/Smoke curve approximation: ppm = a * ratio^b
    // For MQ2 smoke: a≈658.71, b≈-2.168
    float ppm = 658.71 * pow(ratio, -2.168);
    return constrain(ppm, 0.0, 10000.0);
}

// ============================================================
//  MOTOR LOGIC
// ============================================================
void updateMotor() {
    if (!motorAuto) return;   // Manual mode — dashboard controls motor

    bool shouldBeOn = false;
    if (data.ph < PH_MIN || data.ph > PH_MAX)           shouldBeOn = true;
    if (data.ec > EC_MAX)                                shouldBeOn = true;
    if (data.gasPPM > GAS_MAX)                           shouldBeOn = true;
    if (data.waterTemp > WATER_TEMP_MAX || data.waterTemp < WATER_TEMP_MIN) shouldBeOn = true;

    motorOn = shouldBeOn;
    // Relay: LOW = motor ON (active-low relay module)
    digitalWrite(RELAY_PIN, motorOn ? LOW : HIGH);
}

// ============================================================
//  LCD UPDATE
// ============================================================
void updateLCD() {
    lcd.clear();
    // Line 1: pH + EC
    lcd.setCursor(0, 0);
    lcd.print("pH:");
    lcd.print(data.ph, 1);
    lcd.print(" EC:");
    lcd.print(data.ec, 1);

    // Line 2: Temp + Motor
    lcd.setCursor(0, 1);
    lcd.print("T:");
    lcd.print(data.airTemp, 0);
    lcd.print("C M:");
    lcd.print(motorOn ? "ON " : "OFF");
}

// ============================================================
//  SERIAL DEBUG
// ============================================================
void printSerial() {
    Serial.println("───── Sensor Readings ─────────────────");
    Serial.printf("  pH:        %.2f\n", data.ph);
    Serial.printf("  EC:        %.3f mS/cm\n", data.ec);
    Serial.printf("  Gas (MQ2): %.1f ppm\n", data.gasPPM);
    Serial.printf("  Air Temp:  %.1f °C\n", data.airTemp);
    Serial.printf("  Humidity:  %.1f %%\n", data.humidity);
    Serial.printf("  WaterTemp: %.1f °C\n", data.waterTemp);
    Serial.printf("  Motor:     %s (%s)\n", motorOn ? "ON" : "OFF", motorAuto ? "AUTO" : "MANUAL");
    Serial.println("───────────────────────────────────────");
}

// ============================================================
//  MQTT PUBLISH — Sensor Data
// ============================================================
void publishSensors() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["timestamp"] = (millis() - bootTime) / 1000;

    JsonObject sensors = doc["sensors"].to<JsonObject>();

    JsonObject ph = sensors["ph"].to<JsonObject>();
    ph["value"] = round(data.ph * 100) / 100.0;
    ph["unit"]  = "pH";
    ph["status"] = (data.ph >= PH_MIN && data.ph <= PH_MAX) ? "normal" : "alert";

    JsonObject ec = sensors["ec"].to<JsonObject>();
    ec["value"] = round(data.ec * 100) / 100.0;
    ec["unit"]  = "mS/cm";
    ec["status"] = (data.ec <= EC_MAX) ? "normal" : "alert";

    JsonObject gas = sensors["gas"].to<JsonObject>();
    gas["value"] = round(data.gasPPM * 10) / 10.0;
    gas["unit"]  = "ppm";
    gas["status"] = (data.gasPPM <= GAS_MAX) ? "normal" : "alert";

    JsonObject temp = sensors["temperature"].to<JsonObject>();
    temp["value"] = round(data.airTemp * 10) / 10.0;
    temp["unit"]  = "°C";
    temp["status"] = "normal";

    JsonObject hum = sensors["humidity"].to<JsonObject>();
    hum["value"] = round(data.humidity * 10) / 10.0;
    hum["unit"]  = "%";
    hum["status"] = "normal";

    JsonObject wt = sensors["water_temp"].to<JsonObject>();
    wt["value"] = round(data.waterTemp * 10) / 10.0;
    wt["unit"]  = "°C";
    wt["status"] = (data.waterTemp >= WATER_TEMP_MIN && data.waterTemp <= WATER_TEMP_MAX) ? "normal" : "alert";

    doc["motor_status"] = motorOn ? "ON" : "OFF";
    doc["motor_mode"]   = motorAuto ? "AUTO" : "MANUAL";

    char buf[768];
    serializeJson(doc, buf);
    mqtt.publish(TOPIC_SENSORS, buf);
}

// ============================================================
//  MQTT PUBLISH — Heartbeat
// ============================================================
void publishHeartbeat() {
    JsonDocument doc;
    doc["node_id"]  = NODE_ID;
    doc["uptime"]   = (millis() - bootTime) / 1000;
    doc["wifi_rssi"]= WiFi.RSSI();
    doc["free_heap"]= ESP.getFreeHeap();
    doc["motor"]    = motorOn ? "ON" : "OFF";

    char buf[256];
    serializeJson(doc, buf);
    mqtt.publish(TOPIC_HEARTBEAT, buf);
}

// ============================================================
//  MQTT PUBLISH — Motor Status
// ============================================================
void publishMotorStatus() {
    JsonDocument doc;
    doc["node_id"] = NODE_ID;
    doc["motor"]   = motorOn ? "ON" : "OFF";
    doc["mode"]    = motorAuto ? "AUTO" : "MANUAL";

    char buf[128];
    serializeJson(doc, buf);
    mqtt.publish(TOPIC_MOTOR_STAT, buf, true);  // retained
}

// ============================================================
//  MQTT PUBLISH — Discovery (registers node with master)
// ============================================================
void publishDiscovery() {
    JsonDocument doc;
    doc["node_id"]          = NODE_ID;
    doc["mac"]              = WiFi.macAddress();
    doc["ip"]               = WiFi.localIP().toString();
    doc["firmware_version"] = FIRMWARE_VER;
    doc["status"]           = "online";

    JsonArray sens = doc["sensors"].to<JsonArray>();
    sens.add("ph");
    sens.add("ec");
    sens.add("gas");
    sens.add("temperature");
    sens.add("humidity");
    sens.add("water_temp");

    JsonArray caps = doc["capabilities"].to<JsonArray>();
    caps.add("motor_control");

    char buf[512];
    serializeJson(doc, buf);
    mqtt.publish(TOPIC_DISCOVERY, buf, true);  // retained
    Serial.println("[MQTT] Discovery published — node registered with master.");
}

// ============================================================
//  MQTT CALLBACK — Receives commands from dashboard
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int len) {
    char msg[len + 1];
    memcpy(msg, payload, len);
    msg[len] = '\0';

    String t = String(topic);
    Serial.println("[MQTT] Received: " + t + " → " + String(msg));

    // Motor command: ON / OFF / AUTO
    if (t == TOPIC_MOTOR_CMD) {
        JsonDocument doc;
        if (deserializeJson(doc, msg)) return;

        const char* action = doc["action"];
        if (strcmp(action, "ON") == 0) {
            motorAuto = false;
            motorOn   = true;
            digitalWrite(RELAY_PIN, LOW);
        } else if (strcmp(action, "OFF") == 0) {
            motorAuto = false;
            motorOn   = false;
            digitalWrite(RELAY_PIN, HIGH);
        } else if (strcmp(action, "AUTO") == 0) {
            motorAuto = true;
            updateMotor();
        }
        publishMotorStatus();
        Serial.printf("[Motor] Command received: %s (%s)\n", action, motorAuto ? "AUTO" : "MANUAL");
    }
}

// ============================================================
//  WiFi CONNECT
// ============================================================
void connectWiFi() {
    Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 30) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Connected! IP: %s | RSSI: %d dBm\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("\n[WiFi] FAILED. Will retry in loop.");
    }
}

// ============================================================
//  MQTT CONNECT
// ============================================================
void connectMQTT() {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    mqtt.setBufferSize(1024);

    String lwt = "{\"node_id\":\"" NODE_ID "\",\"status\":\"offline\",\"reason\":\"unexpected_disconnect\"}";

    Serial.print("[MQTT] Connecting to broker...");
    bool ok = mqtt.connect(NODE_ID, NULL, NULL, TOPIC_LWT, 1, true, lwt.c_str());

    if (ok) {
        Serial.println(" Connected!");
        mqtt.subscribe(TOPIC_MOTOR_CMD, 1);
        Serial.println("[MQTT] Subscribed to motor commands.");
        publishDiscovery();
    } else {
        Serial.printf(" Failed (rc=%d). Will retry.\n", mqtt.state());
    }
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n╔══════════════════════════════════════╗");
    Serial.println("║   AquaNet Node — " NODE_ID "          ║");
    Serial.println("╚══════════════════════════════════════╝");

    bootTime = millis();

    // Actuator
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, HIGH);  // Motor OFF on boot

    // Sensors
    dht.begin();
    waterTempSensor.begin();

    // LCD
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("AquaNet Booting");

    // Network
    connectWiFi();
    if (WiFi.status() == WL_CONNECTED) {
        connectMQTT();
    }

    Serial.println("[System] Boot complete. Entering main loop.\n");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {

    // ── WiFi watchdog ─────────────────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Lost connection. Reconnecting...");
        connectWiFi();
        return;
    }

    // ── MQTT watchdog ─────────────────────────────────────
    if (!mqtt.connected()) {
        connectMQTT();
    }
    mqtt.loop();

    unsigned long now = millis();

    // ── Read sensors every SENSOR_INTERVAL ───────────────
    if (now - lastSensor >= SENSOR_INTERVAL) {
        lastSensor = now;

        // DHT11
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t) && t > 0 && t < 60) data.airTemp   = t;
        if (!isnan(h) && h >= 0 && h <= 100) data.humidity = h;

        // DS18B20 Water Temperature
        waterTempSensor.requestTemperatures();
        float wt = waterTempSensor.getTempCByIndex(0);
        if (wt != DEVICE_DISCONNECTED_C && wt > -10 && wt < 85) {
            data.waterTemp = wt;
        }

        // Analog sensors
        data.ph      = readPH();
        data.ec      = readEC(data.waterTemp);
        data.gasPPM  = readGasPPM();

        // Motor auto-logic
        updateMotor();

        // LCD update
        updateLCD();

        // Serial debug
        printSerial();
    }

    // ── Publish sensor data every PUBLISH_INTERVAL ────────
    if (now - lastPublish >= PUBLISH_INTERVAL) {
        lastPublish = now;
        if (mqtt.connected()) {
            publishSensors();
        }
    }

    // ── Heartbeat every HEARTBEAT_INTERVAL ────────────────
    if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        lastHeartbeat = now;
        if (mqtt.connected()) {
            publishHeartbeat();
        }
    }
}
