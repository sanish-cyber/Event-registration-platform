#include "dht_sensor.h"
#include "../config.h"

DHTSensor::DHTSensor(uint8_t pin, uint8_t type)
    : _dht(pin, type), _lastTemp(25.0), _lastHumidity(50.0) {
}

void DHTSensor::begin() {
    _dht.begin();
    Serial.println("[DHT11] Sensor initialized on GPIO " + String(DHT_PIN));
}

float DHTSensor::readTemperature() {
    float temp = _dht.readTemperature();

    if (isnan(temp)) {
        Serial.println("[DHT11] Failed to read temperature, using last value");
        return _lastTemp;
    }

    _lastTemp = (_lastTemp * 0.5) + (temp * 0.5);
    return _lastTemp;
}

float DHTSensor::readHumidity() {
    float humidity = _dht.readHumidity();

    if (isnan(humidity)) {
        Serial.println("[DHT11] Failed to read humidity, using last value");
        return _lastHumidity;
    }

    _lastHumidity = (_lastHumidity * 0.5) + (humidity * 0.5);
    return _lastHumidity;
}

bool DHTSensor::isValid(float temp, float humidity) {
    return (!isnan(temp) && !isnan(humidity) &&
            temp >= -10.0 && temp <= 60.0 &&
            humidity >= 0.0 && humidity <= 100.0);
}

const char* DHTSensor::getTempStatus(float temp) {
    if (temp < 0.0 || temp > 50.0) return "critical";
    if (temp < 10.0 || temp > 40.0) return "warning";
    return "normal";
}

const char* DHTSensor::getHumidityStatus(float humidity) {
    if (humidity < 20.0 || humidity > 90.0) return "critical";
    if (humidity < 30.0 || humidity > 70.0) return "warning";
    return "normal";
}
