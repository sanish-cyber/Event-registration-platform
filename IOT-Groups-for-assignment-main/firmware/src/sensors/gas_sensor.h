#ifndef GAS_SENSOR_H
#define GAS_SENSOR_H

#include <Adafruit_ADS1X15.h>

class GasSensor {
public:
    GasSensor(Adafruit_ADS1115* ads, uint8_t channel);
    void begin();
    float read();              // Returns gas concentration in ppm
    float readRaw();           // Returns raw resistance ratio
    bool isWarmedUp();         // Check if sensor has warmed up
    bool isValid(float ppm);
    const char* getStatus(float ppm);

private:
    Adafruit_ADS1115* _ads;
    uint8_t _channel;
    float _ro;                 // Sensor resistance in clean air
    float _lastReading;
    unsigned long _startTime;

    float calculatePPM(float rsRoRatio);
};

#endif
