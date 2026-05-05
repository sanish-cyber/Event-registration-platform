#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
// AquaNet Configuration — Edit these values for your setup
// ============================================================

// --- WiFi Credentials ---
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"

// --- MQTT Broker (your laptop IP when running Mosquitto) ---
#define MQTT_BROKER        "192.168.1.100"
#define MQTT_PORT          1883
#define MQTT_USER          ""       // Leave empty if no auth
#define MQTT_PASSWORD      ""       // Leave empty if no auth

// --- Node Identity ---
// Change this for each slave node: "SLAVE_01", "SLAVE_02", "SLAVE_03"
#define NODE_ID            "SLAVE_01"
#define FIRMWARE_VERSION   "1.0.0"

// --- Sensor Pins (via ADS1115 I2C channels) ---
#define ADS1115_ADDR       0x48    // Default I2C address
#define PH_ADS_CHANNEL     0      // ADS1115 channel 0
#define EC_ADS_CHANNEL     1      // ADS1115 channel 1
#define MQ2_ADS_CHANNEL    2      // ADS1115 channel 2

// --- Digital Sensor Pins ---
#define DHT_PIN            4       // GPIO 4 for DHT11
#define DHT_TYPE           DHT11
#define DS18B20_PIN        15      // GPIO 15 for DS18B20

// --- Actuator Pins ---
#define RELAY_PIN          26      // GPIO 26 for relay/motor

// --- Timing (milliseconds) ---
#define SENSOR_READ_INTERVAL    2000   // Read sensors every 2 seconds
#define MQTT_PUBLISH_INTERVAL   2000   // Publish data every 2 seconds
#define HEARTBEAT_INTERVAL      5000   // Send heartbeat every 5 seconds
#define WIFI_RETRY_DELAY        5000   // Retry WiFi every 5 seconds
#define MQTT_RETRY_DELAY        5000   // Retry MQTT every 5 seconds

// --- WQI Thresholds (can be updated via MQTT) ---
#define WQI_MOTOR_ON_THRESHOLD    70   // WQI >= 70 → Motor ON
#define WQI_MOTOR_OFF_THRESHOLD   40   // WQI <  40 → Motor OFF

// --- pH Calibration ---
// Calibrate with pH 4.0 and pH 7.0 buffer solutions
// Measure voltage at pH 4.0 and pH 7.0, then update these values
#define PH_VOLTAGE_AT_PH7   1.5    // Voltage (V) when probe is in pH 7.0 buffer
#define PH_VOLTAGE_AT_PH4   2.0    // Voltage (V) when probe is in pH 4.0 buffer
#define PH_SLOPE             -5.70  // (pH4 - pH7) / (V_pH4 - V_pH7)
#define PH_OFFSET             7.0

// --- EC Calibration ---
#define EC_K_VALUE           1.0    // Cell constant (calibrate with known solution)
#define EC_TEMP_COEFF        0.02   // Temperature compensation coefficient

// --- MQ2 Calibration ---
#define MQ2_RL               10.0   // Load resistance in kOhm
#define MQ2_RO_CLEAN_AIR     9.83   // Sensor resistance in clean air / RO
#define MQ2_WARMUP_TIME      30000  // 30 seconds minimum warm-up

// --- MQTT Topics ---
#define TOPIC_SENSORS        "aquanet/nodes/" NODE_ID "/sensors"
#define TOPIC_HEARTBEAT      "aquanet/nodes/" NODE_ID "/status/heartbeat"
#define TOPIC_LWT            "aquanet/nodes/" NODE_ID "/status/lwt"
#define TOPIC_MOTOR_CMD      "aquanet/nodes/" NODE_ID "/motor/command"
#define TOPIC_MOTOR_STATUS   "aquanet/nodes/" NODE_ID "/motor/status"
#define TOPIC_CONFIG         "aquanet/nodes/" NODE_ID "/config/#"
#define TOPIC_DISCOVERY      "aquanet/system/discovery"

#endif // CONFIG_H
