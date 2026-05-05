#ifndef WATER_TEMP_SENSOR_H
#define WATER_TEMP_SENSOR_H

#include <OneWire.h>
#include <DallasTemperature.h>

class WaterTempSensor {
public:
    WaterTempSensor(uint8_t pin);
    void begin();
    float read();              // Returns water temperature in °C
    bool isValid(float temp);
    const char* getStatus(float temp);

private:
    OneWire _oneWire;
    DallasTemperature _sensors;
    float _lastReading;
};

#endif
