#include "motor_controller.h"
#include "../config.h"

MotorController::MotorController(uint8_t relayPin)
    : _relayPin(relayPin), _isOn(false), _autoMode(true) {
}

void MotorController::begin() {
    pinMode(_relayPin, OUTPUT);
    digitalWrite(_relayPin, LOW);  // Start with motor OFF (active LOW relay)
    _isOn = false;
    Serial.println("[Motor] Controller initialized on GPIO " + String(_relayPin));
}

void MotorController::turnOn() {
    if (!_isOn) {
        digitalWrite(_relayPin, HIGH);
        _isOn = true;
        Serial.println("[Motor] Motor turned ON");
    }
}

void MotorController::turnOff() {
    if (_isOn) {
        digitalWrite(_relayPin, LOW);
        _isOn = false;
        Serial.println("[Motor] Motor turned OFF");
    }
}

bool MotorController::isOn() {
    return _isOn;
}

void MotorController::setAuto(bool autoMode) {
    _autoMode = autoMode;
    Serial.println("[Motor] Auto mode: " + String(autoMode ? "ON" : "OFF"));
}

bool MotorController::isAutoMode() {
    return _autoMode;
}

const char* MotorController::getStatusString() {
    return _isOn ? "ON" : "OFF";
}
