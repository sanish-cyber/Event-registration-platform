#include "ph_sensor.h"
#include "../config.h"

PHSensor::PHSensor(Adafruit_ADS1115* ads, uint8_t channel)
    : _ads(ads), _channel(channel), _lastReading(7.0) {
    _offset = PH_OFFSET;
    _slope = PH_SLOPE;
}

void PHSensor::begin() {
    Serial.println("[pH] Sensor initialized on ADS1115 channel " + String(_channel));
}

float PHSensor::readVoltage() {
    int16_t rawADC = _ads->readADC_SingleEnded(_channel);
    // ADS1115 gain = ±4.096V, 16-bit → LSB = 0.000125V
    float voltage = rawADC * 0.000125;
    return voltage;
}

float PHSensor::voltageToPhValue(float voltage) {
    // Linear conversion: pH = slope * (voltage - V_at_pH7) + 7.0
    float ph = _slope * (voltage - PH_VOLTAGE_AT_PH7) + _offset;
    return ph;
}

float PHSensor::read() {
    float voltage = readVoltage();
    float ph = voltageToPhValue(voltage);

    // Clamp to valid pH range
    if (ph < 0.0) ph = 0.0;
    if (ph > 14.0) ph = 14.0;

    // Simple moving average filter (smooth out noise)
    _lastReading = (_lastReading * 0.7) + (ph * 0.3);

    return _lastReading;
}

bool PHSensor::isValid(float ph) {
    return (ph >= 0.0 && ph <= 14.0);
}

const char* PHSensor::getStatus(float ph) {
    if (ph < 5.0 || ph > 9.5) return "critical";
    if (ph < 6.5 || ph > 8.5) return "warning";
    return "normal";
}
