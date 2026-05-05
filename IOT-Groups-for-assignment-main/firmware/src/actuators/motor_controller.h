#ifndef MOTOR_CONTROLLER_H
#define MOTOR_CONTROLLER_H

#include <Arduino.h>

class MotorController {
public:
    MotorController(uint8_t relayPin);
    void begin();
    void turnOn();
    void turnOff();
    bool isOn();
    void setAuto(bool autoMode);
    bool isAutoMode();
    const char* getStatusString();

private:
    uint8_t _relayPin;
    bool _isOn;
    bool _autoMode;
};

#endif
