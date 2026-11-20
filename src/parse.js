import { formatBambuColor } from "./utils";

function parseBambuData(printerData, print) {
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

    const trayNow = print.ams && print.ams.tray_now !== undefined ? parseInt(print.ams.tray_now, 10) : null;

    // Ext
    if (print.vt_tray !== undefined) {
        if (print.vt_tray && print.vt_tray.tray_type && print.vt_tray.tray_type.trim() !== "") {
            printerData.vtTray = {
                type: print.vt_tray.tray_type,
                color: formatBambuColor(print.vt_tray.tray_color),
                active: trayNow === 254
            };
        } else {
            printerData.vtTray = null;
        }
    } else if (trayNow !== null && printerData.vtTray) {
        printerData.vtTray.active = trayNow === 254;
    }

    // AMS
    if (print.ams && Array.isArray(print.ams.ams)) {
        printerData.amsUnits = print.ams.ams.map((unit) => {
            const amsId = parseInt(unit.id || "0", 10);
            const trays = Array.isArray(unit.tray)
                ? unit.tray.map((t) => {
                      const trayId = parseInt(t.id || "0", 10);
                      const hasSpool = Boolean(t.tray_type && t.tray_type.trim() !== "");
                      const cumulativeId = amsId * 4 + trayId;
                      return {
                          id: trayId,
                          installed: hasSpool,
                          type: hasSpool ? t.tray_type : "",
                          color: hasSpool ? formatBambuColor(t.tray_color) : null,
                          active: trayNow !== null && trayNow === cumulativeId
                      };
                  })
                : [];
            return { id: amsId, trays };
        });
    } else if (trayNow !== null && printerData.amsUnits.length > 0) {
        printerData.amsUnits.forEach((unit) => {
            unit.trays.forEach((t) => {
                t.active = trayNow === unit.id * 4 + t.id;
            });
        });
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

    return printerData;
}

export default parseBambuData;
