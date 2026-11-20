import { logger } from "@eniac/flexdesigner";
import { resolve } from "path";
import { existsSync, readFileSync } from "fs";

const configPath = resolve(__dirname, "..", "config.json");

function loadUserConfiguration(userConfig) {
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

    return userConfig;
}

export default loadUserConfiguration;
