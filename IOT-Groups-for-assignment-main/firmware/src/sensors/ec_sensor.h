#ifndef EC_SENSOR_H
#define EC_SENSOR_H

#include <Adafruit_ADS1X15.h>

class ECSensor {
public:
    ECSensor(Adafruit_ADS1115* ads, uint8_t channel);
    void begin();
    float read(float waterTemp);   // Returns EC in mS/cm (temp compensated)
    float readTDS(float waterTemp); // Returns TDS in ppm
    bool isValid(float ec);
    const char* getStatus(float ec);

private:
    Adafruit_ADS1115* _ads;
    uint8_t _channel;
    float _kValue;
    float _lastReading;

    float voltageToEC(float voltage, float temperature);
};

#endif
