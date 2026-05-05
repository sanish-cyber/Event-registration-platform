#include "wqi_calculator.h"
#include <math.h>

WQICalculator::WQICalculator() {}

// pH scoring: ideal = 7.0, good = 6.5-8.5, bad < 5 or > 9.5
float WQICalculator::calculatePHScore(float ph) {
    float ideal = 7.0;
    float deviation = fabs(ph - ideal);

    if (deviation <= 0.5) return 100.0;        // 6.5-7.5: perfect
    if (deviation <= 1.5) return 100.0 - (deviation - 0.5) * 30.0;  // 5.5-8.5: linear decline
    if (deviation <= 2.5) return 70.0 - (deviation - 1.5) * 50.0;   // 4.5-9.5: steep decline
    return max(0.0f, 20.0f - (deviation - 2.5f) * 20.0f);           // beyond: near zero
}

// EC scoring: ideal < 0.5, good < 1.5, critical > 3.0
float WQICalculator::calculateECScore(float ec) {
    if (ec <= 0.2) return 100.0;
    if (ec <= 0.5) return 100.0 - (ec - 0.2) * 10.0;    // 97-100
    if (ec <= 1.5) return 97.0 - (ec - 0.5) * 27.0;     // 70-97
    if (ec <= 3.0) return 70.0 - (ec - 1.5) * 40.0;     // 10-70
    return max(0.0f, 10.0f - (ec - 3.0f) * 5.0f);       // 0-10
}

// Gas scoring: ideal < 200, warning > 500, critical > 1000
float WQICalculator::calculateGasScore(float ppm) {
    if (ppm <= 200.0) return 100.0;
    if (ppm <= 500.0) return 100.0 - (ppm - 200.0) * 0.1;   // 70-100
    if (ppm <= 1000.0) return 70.0 - (ppm - 500.0) * 0.1;   // 20-70
    return max(0.0f, 20.0f - (ppm - 1000.0f) * 0.02f);      // 0-20
}

// Water temp scoring: ideal = 25°C, good = 20-30, critical < 10 or > 40
float WQICalculator::calculateWaterTempScore(float temp) {
    float ideal = 25.0;
    float deviation = fabs(temp - ideal);

    if (deviation <= 5.0) return 100.0;                              // 20-30: perfect
    if (deviation <= 10.0) return 100.0 - (deviation - 5.0) * 10.0;  // 10-20 or 30-40
    if (deviation <= 15.0) return 50.0 - (deviation - 10.0) * 10.0;  // 5-10 or 40-45
    return 0.0;
}

// Humidity scoring: ideal = 50%, good = 30-70, critical < 20 or > 90
float WQICalculator::calculateHumidityScore(float humidity) {
    float ideal = 50.0;
    float deviation = fabs(humidity - ideal);

    if (deviation <= 20.0) return 100.0;                              // 30-70
    if (deviation <= 30.0) return 100.0 - (deviation - 20.0) * 7.0;  // 20-30 or 70-80
    if (deviation <= 40.0) return 30.0 - (deviation - 30.0) * 3.0;   // 10-20 or 80-90
    return 0.0;
}

WQIResult WQICalculator::calculate(const SensorData& data) {
    WQIResult result;

    // Calculate individual scores
    result.phScore = calculatePHScore(data.ph);
    result.ecScore = calculateECScore(data.ec);
    result.gasScore = calculateGasScore(data.gasPPM);
    result.waterTempScore = calculateWaterTempScore(data.waterTemp);
    result.humidityScore = calculateHumidityScore(data.humidity);

    // Weighted WQI
    result.score = (result.phScore * _wPH) +
                   (result.ecScore * _wEC) +
                   (result.gasScore * _wGas) +
                   (result.waterTempScore * _wWaterTemp) +
                   (result.humidityScore * _wHumidity);

    // Clamp to 0-100
    if (result.score > 100.0) result.score = 100.0;
    if (result.score < 0.0) result.score = 0.0;

    // Determine level and motor action
    if (result.score >= 70.0) {
        result.level = "good";
        result.motorAction = "ON";
    } else if (result.score >= 40.0) {
        result.level = "warning";
        result.motorAction = "STANDBY";
    } else {
        result.level = "critical";
        result.motorAction = "OFF";
    }

    return result;
}
