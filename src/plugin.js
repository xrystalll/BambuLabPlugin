import { plugin, logger, resourcesPath } from "@eniac/flexdesigner";
import { connect } from "mqtt";
import { join, resolve } from "path";
import { existsSync, readFileSync } from "fs";

let device = {
    serialNumber: "",
    keys: []
};

function registerDevice(serialNumber, keys) {
    device.serialNumber = serialNumber;
    device.keys = keys || [];
}

const configPath = resolve(__dirname, "..", "config.json");
let userConfig = {
    PRINTER_IP: "",
    ACCESS_CODE: "",
    SERIAL_NUMBER: ""
};

let mqttClient = null;
let isAssetsLoaded = false;

function loadUserConfiguration() {
    try {
        if (existsSync(configPath)) {
            const fileData = readFileSync(configPath, "utf8");
            const parsed = JSON.parse(fileData);

            userConfig.PRINTER_IP = parsed.printerIp || "";
            userConfig.ACCESS_CODE = parsed.accessCode || "";
            userConfig.SERIAL_NUMBER = parsed.serialNumber || "";
        }
    } catch (e) {
        logger.error("Error reading config:", e);
    }
}

let printerData = {
    file: "No file",
    status: "Idle",
    layer: 0,
    totalLayers: 0,
    nozzleTemp: 0,
    bedTemp: 0,
    progress: 0,
    remainingTime: "0m",
    endTime: "--:--"
};

const padding = 3;
const gap = 14;
const btnW = 126;
const btnH = 54;
const icSize = 38;

let imgExtruderBase64 = null;
let imgHeatBedBase64 = null;
let imgBambulabBase64 = null;

function stopMqtt() {
    if (mqttClient) {
        logger.info("Disconnecting from Bambu Lab MQTT...");
        mqttClient.end(true);
        mqttClient = null;
    }
}

function startMqtt() {
    if (mqttClient) return;

    if (!userConfig.PRINTER_IP || !userConfig.ACCESS_CODE || !userConfig.SERIAL_NUMBER) {
        logger.error("Fill config fields or check plugin settings!");

        if (device.serialNumber && device.serialNumber.length > 0) {
            plugin.showFlexbarSnackbarMessage(device.serialNumber, "Fill config fields!", "error", "bell", 4000);
        }
        return;
    }

    logger.info(`Connecting to MQTT at ${userConfig.PRINTER_IP}...`);

    mqttClient = connect(`mqtts://${userConfig.PRINTER_IP}:8883`, {
        username: "bblp",
        password: userConfig.ACCESS_CODE,
        rejectUnauthorized: false,
        reconnectPeriod: 5000
    });

    mqttClient.on("connect", () => {
        logger.info("Connected to Bambu Lab MQTT!");
        mqttClient.subscribe(`device/${userConfig.SERIAL_NUMBER}/report`);
    });

    mqttClient.on("message", (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data && data.print) {
                parseBambuData(data.print);

                if (device.keys && Array.isArray(device.keys) && device.keys.length > 0) {
                    const key = device.keys;

                    if (key && key.cid === "com.xrystalll.bambu.monitor") {
                        renderBambuWidget(device.serialNumber, key);
                    }
                } else {
                    stopMqtt();
                }
            }
        } catch (e) {
            logger.error("Error parsing MQTT data:", e);
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
        const key = device.keys;
        if (key && key.cid === "com.xrystalll.bambu.monitor") {
            startMqtt();
            renderBambuWidget(device.serialNumber, key);
            return;
        }
    }

    stopMqtt();
}

function safeLoadImageBase64(filePath) {
    try {
        if (existsSync(filePath)) {
            const buffer = readFileSync(filePath);
            return `data:image/png;base64,${buffer.toString("base64")}`;
        } else {
            logger.error(`Image asset not found at path: ${filePath}`);
            return null;
        }
    } catch (err) {
        logger.error(`Failed to load image: ${filePath}`, err);
        return null;
    }
}

async function startPlugin() {
    logger.debug("Plugin run");

    try {
        loadUserConfiguration();

        const extruderPath = resolve(join(resourcesPath, "extruder.png"));
        const heatbedPath = resolve(join(resourcesPath, "heatbed.png"));
        const bambulogoPath = resolve(join(resourcesPath, "bambulab.png"));

        imgExtruderBase64 = safeLoadImageBase64(extruderPath);
        imgHeatBedBase64 = safeLoadImageBase64(heatbedPath);
        imgBambulabBase64 = safeLoadImageBase64(bambulogoPath);

        isAssetsLoaded = true;
        checkWidgetVisibility();
    } catch (err) {
        logger.error("CRITICAL: error in startPlugin");
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

    if (print.stg_cur !== undefined) {
        switch (print.stg_cur) {
            case -2:
                printerData.status = "Offline";
                break;
            case -1:
            case 255:
                printerData.status = "Idle";
                break;
            case 0:
                printerData.status = "Printing";
                break;
            case 1:
                printerData.status = "Auto bed leveling";
                break;
            case 2:
                printerData.status = "Heatbed preheating";
                break;
            case 3:
                printerData.status = "Vibration compensation";
                break;
            case 4:
                printerData.status = "Changing filament";
                break;
            case 5:
                printerData.status = "Pause in G-code";
                break;
            case 6:
                printerData.status = "Paused due to filament runout";
                break;
            case 7:
                printerData.status = "Heating hotend";
                break;
            case 8:
                printerData.status = "Calibrating dynamic flow";
                break;
            case 9:
                printerData.status = "Scanning bed surface";
                break;
            case 10:
                printerData.status = "Inspecting first layer";
                break;
            case 11:
                printerData.status = "Identify build plate";
                break;
            case 13:
                printerData.status = "Homing toolhead";
                break;
            case 14:
                printerData.status = "Cleaning nozzle tip";
                break;
            case 15:
                printerData.status = "Checking extruder temperature";
                break;
            case 16:
                printerData.status = "Printing was paused by the user";
                break;
            case 17:
                printerData.status = "Pause of front cover falling";
                break;
            case 18:
                printerData.status = "Calibrating micro lidar";
                break;
            case 19:
                printerData.status = "Calibrating extrusion flow";
                break;
            case 20:
                printerData.status = "Paused due to nozzle temperature malfunction";
                break;
            case 21:
                printerData.status = "Paused due to heat bed temperature malfunction";
                break;
            case 22:
                printerData.status = "Paused. Front cover falling";
                break;
            case 23:
                printerData.status = "Paused. HMS error";
                break;
            case 24:
                printerData.status = "Paused. Filament tangle";
                break;
            case 25:
                printerData.status = "Paused. Nozzle clogged";
                break;
            case 26:
                printerData.status = "Paused. Cut filament failed";
                break;
            case 36:
                printerData.status = "Fallen toolhead / collision detect";
                break;
            case 37:
                printerData.status = "Filament hub overload";
                break;
            case 51:
                printerData.status = "Printing calibration lines";
                break;
            case 74:
                printerData.status = "Preparing";
                break;
            default:
                break;
        }
    }
}

function escapeXml(unsafe) {
    if (!unsafe) return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function truncateTextApprox(text, maxWidth, fontSize) {
    if (!text) return "";
    const avgCharWidth = fontSize * 0.55;
    const maxChars = Math.floor(maxWidth / avgCharWidth);
    if (text.length <= maxChars) return text;
    if (maxChars <= 3) return "...";
    return text.slice(0, maxChars - 3) + "...";
}

function renderBambuWidget(serialNumber, key) {
    const width = key.style?.width || 1000;
    const height = 60;

    const pbX = btnH + gap;
    let centerContainerMaxWidth = width - pbX - btnW * 2 - gap * 2;
    if (centerContainerMaxWidth > 1200) {
        centerContainerMaxWidth = 1200;
    }
    const pbHeight = 6;
    const pbY = height / 2 - pbHeight / 2;
    const corner = 3;

    let svgParts = [];

    svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#000000" />`);

    svgParts.push(`<rect x="${padding}" y="${padding}" width="${btnH}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    if (imgBambulabBase64) {
        svgParts.push(`<image href="${imgBambulabBase64}" x="11" y="11" width="${icSize}" height="${icSize}" />`);
    }

    if (printerData.status === "Idle") {
        const statusStr = escapeXml(truncateTextApprox(printerData.status, centerContainerMaxWidth, 24));
        const textY = height / 2 + 8;
        svgParts.push(`<text x="${btnH + gap * 2}" y="${textY}" font-family="Tahoma, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="start">${statusStr}</text>`);
    } else {
        let statusText = printerData.status;
        if (printerData.status === "Printing") {
            statusText = `${printerData.status}: ${printerData.file}`;
        }

        const statusStr = escapeXml(truncateTextApprox(statusText, centerContainerMaxWidth, 18));
        svgParts.push(`<text x="${btnH + gap}" y="19" font-family="Tahoma, sans-serif" font-size="18" fill="#DFDFDF" text-anchor="start">${statusStr}</text>`);

        svgParts.push(`<rect x="${pbX}" y="${pbY}" width="${centerContainerMaxWidth}" height="${pbHeight}" rx="${corner}" ry="${corner}" fill="#2a2a30" />`);

        const fillWidth = Math.max(0, Math.min(centerContainerMaxWidth, (printerData.progress / 100) * centerContainerMaxWidth));
        if (fillWidth > 0) {
            svgParts.push(`<rect x="${pbX}" y="${pbY}" width="${fillWidth}" height="${pbHeight}" rx="${corner}" ry="${corner}" fill="#00B700" />`);
        }

        const bottomY = height - padding * 2;

        svgParts.push(`<text x="${pbX}" y="${bottomY}" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="#FFFFFF" text-anchor="start">${printerData.progress}%</text>`);

        svgParts.push(`<text x="${pbX + btnH + gap}" y="${bottomY - 1}" font-family="Arial, sans-serif" font-size="15" fill="#ADADAD" text-anchor="start">Layer: ${printerData.layer} / ${printerData.totalLayers}</text>`);

        const rightText = escapeXml(`Ends in: ${printerData.endTime} (${printerData.remainingTime})`);
        svgParts.push(`<text x="${centerContainerMaxWidth + btnH + gap}" y="${bottomY - 1}" font-family="Arial, sans-serif" font-size="15" fill="#ADADAD" text-anchor="end">${rightText}</text>`);
    }

    const nozzleBtnX = width - btnW * 2 - gap;
    const bedBtnX = width - btnW;
    const tempTextY = btnH - 20 + padding;

    svgParts.push(`<rect x="${nozzleBtnX}" y="${padding}" width="${btnW}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    if (imgExtruderBase64) {
        svgParts.push(`<image href="${imgExtruderBase64}" x="${nozzleBtnX + 8}" y="${height / 2 - icSize / 2}" width="${icSize}" height="${icSize}" />`);
    }
    svgParts.push(`<text x="${nozzleBtnX + btnW / 2 + 16}" y="${tempTextY}" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle">${printerData.nozzleTemp}°C</text>`);

    svgParts.push(`<rect x="${bedBtnX}" y="${padding}" width="${btnW}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    if (imgHeatBedBase64) {
        svgParts.push(`<image href="${imgHeatBedBase64}" x="${bedBtnX + 8}" y="${height / 2 - icSize / 2}" width="${icSize}" height="${icSize}" />`);
    }
    svgParts.push(`<text x="${bedBtnX + btnW / 2 + 16}" y="${tempTextY}" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle">${printerData.bedTemp}°C</text>`);

    const svgString = `<svg xmlns="http://w3.org" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgParts.join("")}</svg>`;

    try {
        const base64Svg = Buffer.from(svgString, "utf8").toString("base64");

        key.style.showImage = true;
        key.style.showIcon = false;
        key.style.showTitle = false;
        key.style.bgColor = "#000";
        key.style.borderWidth = 0;
        key.style.image = `data:image/svg+xml;base64,${base64Svg}`;

        plugin.draw(serialNumber, key, "draw");
    } catch (encodeError) {
        logger.error("Error encoding SVG:", encodeError);
    }
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
