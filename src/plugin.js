const { plugin, logger, pluginPath, resourcesPath } = require("@eniac/flexdesigner");
const { createCanvas, loadImage } = require('canvas');
const mqtt = require("mqtt");
const path = require("path");
const fs = require("fs");

let device = {
    serialNumber: "",
    keys: []
};

function registerDevice(serialNumber, keys) {
    device.serialNumber = serialNumber;
    device.keys = keys || [];
}

const configPath = path.join(pluginPath, "config.json");
let userConfig = {
    PRINTER_IP: "",
    ACCESS_CODE: "",
    SERIAL_NUMBER: ""
};

let mqttClient = null; 
let isAssetsLoaded = false;

function loadUserConfiguration() {
    try {
        if (fs.existsSync(configPath)) {
            const fileData = fs.readFileSync(configPath, "utf8");
            const parsed = JSON.parse(fileData);

            userConfig.PRINTER_IP = parsed.printerIp || parsed.PRINTER_IP || "";
            userConfig.ACCESS_CODE = parsed.accessCode || parsed.ACCESS_CODE || "";
            userConfig.SERIAL_NUMBER = parsed.serialNumber || parsed.SERIAL_NUMBER || "";
        }
    } catch (e) {
        logger.error("=== Error reading config ===", e);
    }
}

// Local printer state
let printerData = {
    file: "No file",
    layer: 0,
    totalLayers: 0,
    nozzleTemp: 0,
    bedTemp: 0,
    progress: 0,
    remainingTime: "0m",
    endTime: "--:--"
};

const padding = 3;
const gap = 12;
const firstBtn = 682;
const btnW = 126;
const btnH = 54;
const icSize = 38;

let imgExtruder = null;
let imgHeatBed = null;
let imgBambulab = null;

const canvas = createCanvas(2170, 60);
const ctx = canvas.getContext("2d");

function stopMqtt() {
    if (mqttClient) {
        logger.info("=== Disconnecting from Bambu Lab MQTT... ===");
        mqttClient.end(true);
        mqttClient = null;
    }
}

function startMqtt() {
    if (mqttClient) return; 

    if (!userConfig.PRINTER_IP || !userConfig.ACCESS_CODE || !userConfig.SERIAL_NUMBER) {
        logger.error("Fill config fields or check plugin settings!");
        return;
    }

    logger.info(`=== Connecting to MQTT at ${userConfig.PRINTER_IP}... ===`);

    mqttClient = mqtt.connect(`mqtts://${userConfig.PRINTER_IP}:8883`, {
        username: "bblp",
        password: userConfig.ACCESS_CODE,
        rejectUnauthorized: false,
        reconnectPeriod: 5000
    });

    mqttClient.on("connect", () => {
        logger.info("=== Connected to Bambu Lab MQTT! ===");
        mqttClient.subscribe(`device/${userConfig.SERIAL_NUMBER}/report`);
    });

    mqttClient.on("message", (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data && data.print) {
                parseBambuData(data.print);

                if (device.keys && Array.isArray(device.keys) && device.keys.length > 0) {
                    const key = device.keys[0];

                    if (key && key.cid === "com.xrystalll.bambu.monitor") {
                        renderBambuWidget(device.serialNumber, key);
                    }
                } else {
                    stopMqtt();
                }
            }
        } catch (e) {
            logger.error("=== Error parsing MQTT data:", e);
        }
    });

    mqttClient.on("close", () => {
        if (mqttClient && device.serialNumber && device.serialNumber.length > 0) {
            plugin.showFlexbarSnackbarMessage(device.serialNumber, "Unable to connect to printer!", "error", "bell", 4000);
        }
    });
}

function checkWidgetVisibility() {
    if (!isAssetsLoaded) return;

    const hasActiveWidget = device.keys && Array.isArray(device.keys) && device.keys.length > 0;
    
    if (hasActiveWidget) {
        const key = device.keys[0];
        if (key && key.cid === "com.xrystalll.bambu.monitor") {
            startMqtt();
            return;
        }
    }

    stopMqtt();
}

async function startPlugin() {
    try {
        loadUserConfiguration();

        const extruderPath = path.join(resourcesPath, "extruder.png");
        const heatbedPath = path.join(resourcesPath, "heatbed.png");
        const bambulogoPath = path.join(resourcesPath, "bambulab.png");

        imgExtruder = await loadImage(extruderPath);
        imgHeatBed = await loadImage(heatbedPath);
        imgBambulab = await loadImage(bambulogoPath);
        isAssetsLoaded = true;

        checkWidgetVisibility();
    } catch (err) {
        logger.error("=== CRITICAL: error ===");
        logger.error(err);
    }
}

function parseBambuData(print) {
    if (print.subtask_name) printerData.file = print.subtask_name;
    if (print.layer_num !== undefined) printerData.layer = print.layer_num;
    if (print.total_layer_num !== undefined) printerData.totalLayers = print.total_layer_num;
    if (print.nozzle_temper !== undefined) printerData.nozzleTemp = Math.round(print.nozzle_temper);
    if (print.bed_temper !== undefined) printerData.bedTemp = Math.round(print.bed_temper);
    if (print.mc_percent !== undefined) printerData.progress = print.mc_percent;

    if (print.mc_remaining_time !== undefined) {
        const minutesTotal = print.mc_remaining_time;
        const h = Math.floor(minutesTotal / 60);
        const m = minutesTotal % 60;
        printerData.remainingTime = h > 0 ? `${h}h ${m}m` : `${m}m`;

        const now = new Date();
        const end = new Date(now.getTime() + minutesTotal * 60000);
        printerData.endTime = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }
}

function renderBambuWidget(serialNumber, key) {
    const width = key.style?.width || 1000;
    const height = 60;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    drawStaticButton(ctx, padding, padding, btnH, btnH, "");
    if (imgBambulab) {
        ctx.drawImage(imgBambulab, 11, 11, icSize, icSize);
    }

    ctx.font = "18px Arial";
    ctx.fillStyle = "#DFDFDF";
    ctx.textAlign = "left";
    const fileName = truncateText(ctx, printerData.file, 600);
    ctx.fillText(fileName, btnH + gap, 18);

    const pbX = btnH + gap;
    const pbHeight = 6;
    const pbY = height / 2 - pbHeight / 2;
    const pbWidth = 600;
    const corner = 3;

    ctx.fillStyle = "#2a2a30";
    fillRoundRect(ctx, pbX, pbY, pbWidth, pbHeight, corner);

    const fillWidth = (printerData.progress / 100) * pbWidth;
    ctx.fillStyle = "#00B700";
    if (fillWidth > 0) {
        fillRoundRect(ctx, pbX, pbY, fillWidth, pbHeight, corner);
    }

    ctx.fillStyle = "#FFF";
    ctx.font = "bold 20px Arial";
    ctx.fillText(`${printerData.progress}%`, pbX, height - padding * 2);

    ctx.fillStyle = "#ADADAD";
    ctx.font = "14px Arial";
    ctx.fillText(`Layer: ${printerData.layer} / ${printerData.totalLayers}`, pbX + btnH + gap, height - padding * 2 - 2);

    ctx.fillStyle = "#ADADAD";
    ctx.textAlign = "right";
    ctx.fillText(`Ends in: ${printerData.endTime} (${printerData.remainingTime})`, 600 + btnH + gap, height - padding * 2 - 2);

    drawStaticButton(ctx, firstBtn, padding, btnW, btnH, "     " + printerData.nozzleTemp + "°C");
    drawStaticButton(ctx, firstBtn + btnW + gap, padding, btnW, btnH, "     " + printerData.bedTemp + "°C");

    if (imgExtruder && imgHeatBed) {
        ctx.drawImage(imgExtruder, firstBtn + 8, height / 2 - icSize / 2, icSize, icSize);
        ctx.drawImage(imgHeatBed, firstBtn + btnW + gap + 8, height / 2 - icSize / 2, icSize, icSize);
    }

    const imageBuffer = canvas.toBuffer('image/png');
    const base64Image = imageBuffer.toString('base64');

    key.style.showImage = true;
    key.style.showIcon = false;
    key.style.showTitle = false;
    key.style.bgColor = "#000000";
    key.style.borderWidth = 0;
    key.style.image = `data:image/png;base64,${base64Image}`;

    plugin.draw(serialNumber, key, 'draw');
}

function drawStaticButton(ctx, x, y, w, h, text) {
    ctx.fillStyle = "#212121";
    fillRoundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = "#FFF";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    const trimText = truncateText(ctx, text, w);
    ctx.fillText(trimText, x + (w / 2), h - 20 + padding);
}

function fillRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
}

function truncateText(ctx, text, maxWidth) {
    if (!text) return "";
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) return text;
    
    let truncated = text;
    while (width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        width = ctx.measureText(truncated + "...").width;
    }
    return truncated + "...";
}

plugin.on("plugin.alive", (payload) => {
    registerDevice(payload.serialNumber, payload.keys);
    checkWidgetVisibility();
});

plugin.on("plugin.config.updated", (payload) => {
    stopMqtt();

    userConfig.PRINTER_IP = payload.printerIp || "";
    userConfig.ACCESS_CODE = payload.accessCode || "";
    userConfig.SERIAL_NUMBER = payload.serialNumber || "";

    checkWidgetVisibility();
});

startPlugin();

plugin.start();
