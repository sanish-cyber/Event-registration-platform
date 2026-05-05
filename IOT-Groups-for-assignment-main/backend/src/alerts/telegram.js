/**
 * AquaNet Telegram Alert Service
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

class TelegramAlert {
    constructor(botToken, chatId) {
        this.botToken = botToken;
        this.chatId = chatId;
        this.enabled = !!(botToken && chatId);
        this.lastAlertTime = {};
        this.cooldownMs = 60000; // 1 minute cooldown per node
    }

    async sendAlert(nodeId, wqi, sensorData, level) {
        if (!this.enabled) return;

        // Cooldown check
        const now = Date.now();
        if (this.lastAlertTime[nodeId] && now - this.lastAlertTime[nodeId] < this.cooldownMs) {
            return;
        }
        this.lastAlertTime[nodeId] = now;

        const emoji = level === "critical" ? "🔴" : "🟡";
        const message = `${emoji} *AquaNet Alert — ${nodeId}*\n\n` +
            `*WQI Score:* ${wqi.score}/100 (${level.toUpperCase()})\n\n` +
            `📊 *Sensor Readings:*\n` +
            `• pH: ${sensorData.ph?.toFixed(2) || "N/A"}\n` +
            `• EC: ${sensorData.ec?.toFixed(2) || "N/A"} mS/cm\n` +
            `• Gas: ${sensorData.gas?.toFixed(1) || "N/A"} ppm\n` +
            `• Water Temp: ${sensorData.waterTemp?.toFixed(1) || "N/A"} °C\n` +
            `• Humidity: ${sensorData.humidity?.toFixed(1) || "N/A"} %\n\n` +
            `⚡ *Motor Action:* ${wqi.motorAction}\n` +
            `🕐 ${new Date().toLocaleString()}`;

        try {
            const url = `${TELEGRAM_API}${this.botToken}/sendMessage`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: "Markdown",
                }),
            });
            if (res.ok) {
                console.log(`[Telegram] Alert sent for ${nodeId}`);
            } else {
                console.error(`[Telegram] Failed: ${res.status}`);
            }
        } catch (err) {
            console.error(`[Telegram] Error: ${err.message}`);
        }
    }

    async sendNodeOffline(nodeId) {
        if (!this.enabled) return;

        const message = `🔌 *AquaNet — Node Offline*\n\n` +
            `Node *${nodeId}* has disconnected unexpectedly.\n` +
            `🕐 ${new Date().toLocaleString()}`;

        try {
            const url = `${TELEGRAM_API}${this.botToken}/sendMessage`;
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: "Markdown",
                }),
            });
        } catch (err) {
            console.error(`[Telegram] Error: ${err.message}`);
        }
    }
}

module.exports = TelegramAlert;
