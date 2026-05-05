#ifndef WQI_CALCULATOR_H
#define WQI_CALCULATOR_H

struct SensorData {
    float ph;
    float ec;
    float gasPPM;
    float airTemp;
    float humidity;
    float waterTemp;
};

struct WQIResult {
    float score;           // 0-100
    const char* level;     // "good", "warning", "critical"
    const char* motorAction;  // "ON", "STANDBY", "OFF"
    float phScore;
    float ecScore;
    float gasScore;
    float waterTempScore;
    float humidityScore;
};

class WQICalculator {
public:
    WQICalculator();
    WQIResult calculate(const SensorData& data);

private:
    // Weights (must sum to 1.0)
    float _wPH       = 0.30;
    float _wEC       = 0.25;
    float _wGas      = 0.20;
    float _wWaterTemp = 0.15;
    float _wHumidity  = 0.10;

    float calculatePHScore(float ph);
    float calculateECScore(float ec);
    float calculateGasScore(float ppm);
    float calculateWaterTempScore(float temp);
    float calculateHumidityScore(float humidity);
};

#endif
