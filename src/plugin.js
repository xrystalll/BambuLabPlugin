import { plugin, logger } from "@eniac/flexdesigner";
import { connect } from "mqtt";
import loadUserConfiguration from "./config";
import parseBambuData from "./parse";
import renderBambuWidget from "./render";

let device = {
    serialNumber: "",
    keys: []
};
let mqttClient = null;
let userConfig = {
    PRINTER_IP: "",
    ACCESS_CODE: "",
    SERIAL_NUMBER: ""
};
let printerData = {
    file: "No file",
    status: "Idle",
    layer: 0,
    totalLayers: 0,
    nozzleTemp: 0,
    bedTemp: 0,
    progress: 0,
    remainingTime: "0m",
    endTime: "--:--",
    vtTray: null,
    amsUnits: []
};

function registerDevice(serialNumber, keys) {
    device.serialNumber = serialNumber;
    device.keys = keys || [];
}

function checkWidgetVisibility() {
    const hasActiveWidget = device.keys && Array.isArray(device.keys) && device.keys.length > 0;

    if (hasActiveWidget) {
        const key = device.keys[0];

        if (key && key.cid === "com.xrystalll.bambu.monitor") {
            startMqtt();
            renderBambuWidget(printerData, device.serialNumber, key);
            return;
        }
    }

    stopMqtt();
}

function startPlugin() {
    logger.debug("Plugin run");

    try {
        userConfig = loadUserConfiguration(userConfig);
        checkWidgetVisibility();
    } catch (err) {
        logger.error("CRITICAL: error in startPlugin");
        logger.error(err);
    }
}

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
                printerData = parseBambuData(printerData, data.print);

                if (device.keys && Array.isArray(device.keys) && device.keys.length > 0) {
                    const key = device.keys[0];

                    if (key && key.cid === "com.xrystalll.bambu.monitor") {
                        renderBambuWidget(printerData, device.serialNumber, key);
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
