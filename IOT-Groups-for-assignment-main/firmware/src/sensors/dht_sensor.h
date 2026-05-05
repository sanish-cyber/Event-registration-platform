#ifndef DHT_SENSOR_H
#define DHT_SENSOR_H

#include <DHT.h>

class DHTSensor {
public:
    DHTSensor(uint8_t pin, uint8_t type);
    void begin();
    float readTemperature();   // Returns temperature in °C
    float readHumidity();      // Returns humidity in %
    bool isValid(float temp, float humidity);
    const char* getTempStatus(float temp);
    const char* getHumidityStatus(float humidity);

private:
    DHT _dht;
    float _lastTemp;
    float _lastHumidity;
};

#endif
