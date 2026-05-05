#include "gas_sensor.h"
#include "../config.h"
#include <Arduino.h>

GasSensor::GasSensor(Adafruit_ADS1115* ads, uint8_t channel)
    : _ads(ads), _channel(channel), _lastReading(200.0) {
    _ro = MQ2_RO_CLEAN_AIR;
    _startTime = 0;
}

void GasSensor::begin() {
    _startTime = millis();
    Serial.println("[MQ2] Gas sensor initialized. Warming up...");
}

bool GasSensor::isWarmedUp() {
    return (millis() - _startTime) >= MQ2_WARMUP_TIME;
}

float GasSensor::calculatePPM(float rsRoRatio) {
    // LPG curve approximation from MQ2 datasheet
    // log(ppm) = (log(Rs/Ro) - b) / m
    // For LPG: m = -0.47, b = 1.30 (from datasheet curve)
    float logPPM = (log10(rsRoRatio) - 1.30) / (-0.47);
    return pow(10, logPPM);
}

float GasSensor::read() {
    if (!isWarmedUp()) {
        Serial.println("[MQ2] Still warming up...");
        return _lastReading;
    }

    int16_t rawADC = _ads->readADC_SingleEnded(_channel);
    float voltage = rawADC * 0.000125;  // ADS1115 LSB

    // Calculate sensor resistance
    // Rs = RL * (Vc - Vout) / Vout
    float vcc = 5.0;
    if (voltage < 0.01) voltage = 0.01;  // Prevent division by zero
    float rs = MQ2_RL * (vcc - voltage) / voltage;

    // Rs/Ro ratio
    float ratio = rs / _ro;

    // Convert to ppm
    float ppm = calculatePPM(ratio);

    // Clamp to reasonable range
    if (ppm < 0.0) ppm = 0.0;
    if (ppm > 10000.0) ppm = 10000.0;

    // Exponential moving average
    _lastReading = (_lastReading * 0.7) + (ppm * 0.3);
    return _lastReading;
}

float GasSensor::readRaw() {
    int16_t rawADC = _ads->readADC_SingleEnded(_channel);
    return rawADC * 0.000125;
}

bool GasSensor::isValid(float ppm) {
    return (ppm >= 0.0 && ppm <= 10000.0);
}

const char* GasSensor::getStatus(float ppm) {
    if (ppm > 1000.0) return "critical";
    if (ppm > 500.0) return "warning";
    return "normal";
}
