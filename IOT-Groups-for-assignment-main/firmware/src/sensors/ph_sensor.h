#ifndef PH_SENSOR_H
#define PH_SENSOR_H

#include <Adafruit_ADS1X15.h>

class PHSensor {
public:
    PHSensor(Adafruit_ADS1115* ads, uint8_t channel);
    void begin();
    float read();            // Returns pH value (0-14)
    float readVoltage();     // Returns raw voltage
    bool isValid(float ph);  // Check if reading is in valid range
    const char* getStatus(float ph);  // "normal", "warning", "critical"

private:
    Adafruit_ADS1115* _ads;
    uint8_t _channel;
    float _offset;
    float _slope;
    float _lastReading;

    float voltageToPhValue(float voltage);
};

#endif
