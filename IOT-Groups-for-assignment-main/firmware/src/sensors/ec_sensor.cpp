#include "ec_sensor.h"
#include "../config.h"

ECSensor::ECSensor(Adafruit_ADS1115* ads, uint8_t channel)
    : _ads(ads), _channel(channel), _lastReading(0.5) {
    _kValue = EC_K_VALUE;
}

void ECSensor::begin() {
    Serial.println("[EC] Sensor initialized on ADS1115 channel " + String(_channel));
}

float ECSensor::voltageToEC(float voltage, float temperature) {
    // EC = (voltage / RL) * K * temp_compensation
    // Temperature compensation: EC25 = EC_measured / (1 + coeff * (T - 25))
    float rawEC = (voltage * 1000.0) / (EC_K_VALUE * 100.0);  // Raw EC in mS/cm
    float tempCompensation = 1.0 + EC_TEMP_COEFF * (temperature - 25.0);
    float compensatedEC = rawEC / tempCompensation;
    return compensatedEC;
}

float ECSensor::read(float waterTemp) {
    int16_t rawADC = _ads->readADC_SingleEnded(_channel);
    float voltage = rawADC * 0.000125;  // ADS1115 LSB

    float ec = voltageToEC(voltage, waterTemp);

    // Clamp to reasonable range
    if (ec < 0.0) ec = 0.0;
    if (ec > 20.0) ec = 20.0;

    // Exponential moving average
    _lastReading = (_lastReading * 0.7) + (ec * 0.3);
    return _lastReading;
}

float ECSensor::readTDS(float waterTemp) {
    float ec = read(waterTemp);
    // TDS (ppm) ≈ EC (mS/cm) × 500
    return ec * 500.0;
}

bool ECSensor::isValid(float ec) {
    return (ec >= 0.0 && ec <= 20.0);
}

const char* ECSensor::getStatus(float ec) {
    if (ec > 3.0) return "critical";
    if (ec > 1.5) return "warning";
    return "normal";
}
