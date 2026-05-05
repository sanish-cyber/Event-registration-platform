#include "water_temp_sensor.h"
#include "../config.h"
#include <Arduino.h>

WaterTempSensor::WaterTempSensor(uint8_t pin)
    : _oneWire(pin), _sensors(&_oneWire), _lastReading(25.0) {
}

void WaterTempSensor::begin() {
    _sensors.begin();
    int deviceCount = _sensors.getDeviceCount();
    Serial.println("[DS18B20] Found " + String(deviceCount) + " sensor(s) on GPIO " + String(DS18B20_PIN));

    if (deviceCount == 0) {
        Serial.println("[DS18B20] WARNING: No sensor detected! Check wiring and 4.7kΩ pull-up resistor.");
    }
}

float WaterTempSensor::read() {
    _sensors.requestTemperatures();
    float temp = _sensors.getTempCByIndex(0);

    // DallasTemperature returns -127.0 on error
    if (temp == DEVICE_DISCONNECTED_C || temp < -50.0) {
        Serial.println("[DS18B20] Read error, using last known value");
        return _lastReading;
    }

    _lastReading = (_lastReading * 0.5) + (temp * 0.5);
    return _lastReading;
}

bool WaterTempSensor::isValid(float temp) {
    return (temp > -50.0 && temp < 125.0);
}

const char* WaterTempSensor::getStatus(float temp) {
    if (temp < 10.0 || temp > 40.0) return "critical";
    if (temp < 20.0 || temp > 30.0) return "warning";
    return "normal";
}
