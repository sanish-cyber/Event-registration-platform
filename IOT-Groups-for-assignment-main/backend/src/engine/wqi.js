/**
 * AquaNet WQI Engine (Node.js)
 * Mirrors the ESP32 WQI calculator for server-side validation
 */

// Weights (must sum to 1.0)
const WEIGHTS = {
    ph: 0.30,
    ec: 0.25,
    gas: 0.20,
    waterTemp: 0.15,
    humidity: 0.10,
};

function calcPHScore(ph) {
    const deviation = Math.abs(ph - 7.0);
    if (deviation <= 0.5) return 100;
    if (deviation <= 1.5) return 100 - (deviation - 0.5) * 30;
    if (deviation <= 2.5) return 70 - (deviation - 1.5) * 50;
    return Math.max(0, 20 - (deviation - 2.5) * 20);
}

function calcECScore(ec) {
    if (ec <= 0.2) return 100;
    if (ec <= 0.5) return 100 - (ec - 0.2) * 10;
    if (ec <= 1.5) return 97 - (ec - 0.5) * 27;
    if (ec <= 3.0) return 70 - (ec - 1.5) * 40;
    return Math.max(0, 10 - (ec - 3.0) * 5);
}

function calcGasScore(ppm) {
    if (ppm <= 200) return 100;
    if (ppm <= 500) return 100 - (ppm - 200) * 0.1;
    if (ppm <= 1000) return 70 - (ppm - 500) * 0.1;
    return Math.max(0, 20 - (ppm - 1000) * 0.02);
}

function calcWaterTempScore(temp) {
    const deviation = Math.abs(temp - 25);
    if (deviation <= 5) return 100;
    if (deviation <= 10) return 100 - (deviation - 5) * 10;
    if (deviation <= 15) return 50 - (deviation - 10) * 10;
    return 0;
}

function calcHumidityScore(humidity) {
    const deviation = Math.abs(humidity - 50);
    if (deviation <= 20) return 100;
    if (deviation <= 30) return 100 - (deviation - 20) * 7;
    if (deviation <= 40) return 30 - (deviation - 30) * 3;
    return 0;
}

function calculateWQI(sensorData) {
    const phScore = calcPHScore(sensorData.ph || 7);
    const ecScore = calcECScore(sensorData.ec || 0.5);
    const gasScore = calcGasScore(sensorData.gas || 200);
    const waterTempScore = calcWaterTempScore(sensorData.waterTemp || 25);
    const humidityScore = calcHumidityScore(sensorData.humidity || 50);

    const wqi =
        phScore * WEIGHTS.ph +
        ecScore * WEIGHTS.ec +
        gasScore * WEIGHTS.gas +
        waterTempScore * WEIGHTS.waterTemp +
        humidityScore * WEIGHTS.humidity;

    const score = Math.min(100, Math.max(0, wqi));

    let level, motorAction;
    if (score >= 70) {
        level = "good";
        motorAction = "ON";
    } else if (score >= 40) {
        level = "warning";
        motorAction = "STANDBY";
    } else {
        level = "critical";
        motorAction = "OFF";
    }

    return {
        score: Math.round(score * 10) / 10,
        level,
        motorAction,
        breakdown: {
            ph: { value: sensorData.ph, score: Math.round(phScore * 10) / 10 },
            ec: { value: sensorData.ec, score: Math.round(ecScore * 10) / 10 },
            gas: { value: sensorData.gas, score: Math.round(gasScore * 10) / 10 },
            waterTemp: { value: sensorData.waterTemp, score: Math.round(waterTempScore * 10) / 10 },
            humidity: { value: sensorData.humidity, score: Math.round(humidityScore * 10) / 10 },
        },
    };
}

module.exports = { calculateWQI };
