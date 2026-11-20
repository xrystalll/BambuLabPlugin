import { plugin, logger } from "@eniac/flexdesigner";
import { escapeXml, getContrastTextColor, truncateTextApprox } from "./utils";

const padding = 3;
const gap = 14;
const btnW = 126;
const btnH = 54;
const icSize = 38;

function renderBambuWidget(printerData, serialNumber, key) {
    const width = key.style?.width || 1000;
    const height = 60;

    const rightBlocks = [];

    if (printerData.vtTray) {
        rightBlocks.push({ kind: "vt", width: 108, data: printerData.vtTray });
    }

    if (Array.isArray(printerData.amsUnits)) {
        printerData.amsUnits.forEach((unit) => {
            const hasAnySpool = unit.trays && unit.trays.some((t) => t.installed);
            if (hasAnySpool) {
                const count = unit.trays.length || 4;
                const slotW = 28;
                const slotGap = 6;
                const padX = 8;
                const blockW = padX * 2 + count * slotW + (count - 1) * slotGap;
                rightBlocks.push({ kind: "ams", width: blockW, data: unit });
            }
        });
    }

    let rightFilamentWidth = 0;
    rightBlocks.forEach((b) => {
        rightFilamentWidth += gap + b.width;
    });

    const pbX = btnH + gap;
    let centerContainerMaxWidth = width - pbX - btnW * 2 - gap * 2 - rightFilamentWidth;
    if (centerContainerMaxWidth > 1200) centerContainerMaxWidth = 1200;

    const pbHeight = 6;
    const pbY = height / 2 - pbHeight / 2;
    const corner = 3;
    let svgParts = [];

    svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#000000" />`);
    svgParts.push(`<rect x="${padding}" y="${padding}" width="${btnH}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    svgParts.push(`
        <g transform="translate(11, 11) scale(1.5833)" fill="#00AE42">
            <path d="M12.662 24V8.959l8.535 3.369V24zm-9.859-.003v-7.521l8.534-3.371-.001 10.892zM2.803 0h8.533l.001 11.672-8.534 3.369zm9.859 0h8.535v10.892l-8.535-3.371z"/>
        </g>
    `);

    if (centerContainerMaxWidth > 40) {
        if (printerData.status === "Idle") {
            const statusStr = escapeXml(truncateTextApprox(printerData.status, centerContainerMaxWidth, 24));
            svgParts.push(`<text x="${btnH + gap * 2}" y="${height / 2 + 8}" font-family="Tahoma, sans-serif" font-size="24" fill="#FFFFFF" text-anchor="start">${statusStr}</text>`);
        } else {
            let statusText = printerData.status === "Printing" ? `${printerData.status}: ${printerData.file}` : printerData.status;
            const statusStr = escapeXml(truncateTextApprox(statusText, centerContainerMaxWidth, 18));

            svgParts.push(`<text x="${btnH + gap}" y="19" font-family="Tahoma, sans-serif" font-size="18" fill="#DFDFDF" text-anchor="start">${statusStr}</text>`);
            svgParts.push(`<rect x="${pbX}" y="${pbY}" width="${centerContainerMaxWidth}" height="${pbHeight}" rx="${corner}" ry="${corner}" fill="#2a2a30" />`);

            const fillWidth = Math.max(0, Math.min(centerContainerMaxWidth, (printerData.progress / 100) * centerContainerMaxWidth));
            if (fillWidth > 0) {
                svgParts.push(`<rect x="${pbX}" y="${pbY}" width="${fillWidth}" height="${pbHeight}" rx="${corner}" ry="${corner}" fill="#00B700" />`);
            }

            const bottomY = height - padding * 2;
            svgParts.push(`<text x="${pbX}" y="${bottomY}" font-family="Arial, sans-serif" font-weight="bold" font-size="20" fill="#FFFFFF" text-anchor="start">${printerData.progress}%</text>`);

            if (centerContainerMaxWidth > 220) {
                svgParts.push(`<text x="${pbX + btnH + gap}" y="${bottomY - 1}" font-family="Arial, sans-serif" font-size="15" fill="#ADADAD" text-anchor="start">Layer: ${printerData.layer} / ${printerData.totalLayers}</text>`);
            }
            if (centerContainerMaxWidth > 360) {
                const rightText = escapeXml(`Ends in: ${printerData.endTime} (${printerData.remainingTime})`);
                svgParts.push(`<text x="${centerContainerMaxWidth + btnH + gap}" y="${bottomY - 1}" font-family="Arial, sans-serif" font-size="15" fill="#ADADAD" text-anchor="end">${rightText}</text>`);
            }
        }
    }

    const nozzleBtnX = width - rightFilamentWidth - btnW * 2 - gap;
    const bedBtnX = width - rightFilamentWidth - btnW;
    const tempTextY = btnH - 20 + padding;
    const icY = height / 2 - icSize / 2;

    svgParts.push(`<rect x="${nozzleBtnX}" y="${padding}" width="${btnW}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    svgParts.push(`
        <g transform="translate(${nozzleBtnX + 8}, ${icY})" fill="none" stroke="#E0E0E0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 6 H26 V18 H12 Z" /><line x1="12" y1="10" x2="26" y2="10" /><line x1="12" y1="14" x2="26" y2="14" />
            <path d="M14 18 H24 V24 L20.5 30 H17.5 L14 24 Z" /><line x1="19" y1="30" x2="19" y2="33" stroke="#E0E0E0" />
        </g>
    `);
    svgParts.push(`
        <text x="${nozzleBtnX + btnW / 2 + 16}" y="${tempTextY}" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle">${printerData.nozzleTemp}°C</text>
    `);

    svgParts.push(`<rect x="${bedBtnX}" y="${padding}" width="${btnW}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);
    svgParts.push(`
        <g transform="translate(${bedBtnX + 8}, ${icY})" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19 C9.5 15, 14.5 11, 12 6" stroke="#E0E0E0" /><path d="M19 19 C16.5 15, 21.5 11, 19 6" stroke="#E0E0E0" />
            <path d="M26 19 C23.5 15, 28.5 11, 26 6" stroke="#E0E0E0" /><rect x="6" y="23" width="26" height="5" stroke="#E0E0E0" />
        </g>
    `);
    svgParts.push(`
        <text x="${bedBtnX + btnW / 2 + 16}" y="${tempTextY}" font-family="Arial, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle">${printerData.bedTemp}°C</text>
    `);

    let currentRightX = bedBtnX + btnW + gap;

    rightBlocks.forEach((block) => {
        svgParts.push(`<rect x="${currentRightX}" y="${padding}" width="${block.width}" height="${btnH}" rx="8" ry="8" fill="#212121" />`);

        if (block.kind === "vt") {
            const spool = block.data;
            const cx = currentRightX + 23;
            const cy = height / 2;
            const strokeAttr = spool.active ? `stroke="#FFFFFF" stroke-width="2.5"` : `stroke="#666666" stroke-width="1.5"`;

            svgParts.push(`<circle cx="${cx}" cy="${cy}" r="15" fill="${spool.color}" ${strokeAttr} />`);
            svgParts.push(`<circle cx="${cx}" cy="${cy}" r="4.5" fill="#212121" />`);

            const matStr = escapeXml(truncateTextApprox(spool.type, 60, 17));
            svgParts.push(`<text x="${currentRightX + 45}" y="${height / 2 + 6}" font-family="Arial, sans-serif" font-weight="bold" font-size="17" fill="#FFFFFF" text-anchor="start">${matStr}</text>`);
        } else if (block.kind === "ams") {
            const slotW = 28;
            const slotH = 44;
            const slotGap = 6;
            const padX = 8;
            const slotY = (height - slotH) / 2;

            block.data.trays.forEach((tray, idx) => {
                const sx = currentRightX + padX + idx * (slotW + slotGap);
                if (tray.installed) {
                    const strokeAttr = tray.active ? `stroke="#FFFFFF" stroke-width="2.5"` : `stroke="#555555" stroke-width="1.2"`;
                    svgParts.push(`<rect x="${sx}" y="${slotY}" width="${slotW}" height="${slotH}" rx="5" ry="5" fill="${tray.color}" ${strokeAttr} />`);

                    if (tray.type) {
                        const rawType = tray.type.trim().toUpperCase().slice(0, 5);
                        const shortType = escapeXml(rawType);
                        const textColor = getContrastTextColor(tray.color);

                        let fontSize = 11;
                        if (rawType.length === 4) fontSize = 9.5;
                        if (rawType.length >= 5) fontSize = 8;

                        const fitAttr = rawType.length >= 4 ? `textLength="24" lengthAdjust="spacingAndGlyphs"` : "";

                        svgParts.push(
                            `<text x="${sx + slotW / 2}" y="${slotY + slotH / 2 + fontSize * 0.35}" font-family="Arial, sans-serif" font-weight="bold" font-size="${fontSize}" ${fitAttr} fill="${textColor}" text-anchor="middle">${shortType}</text>`
                        );
                    }
                } else {
                    svgParts.push(`<rect x="${sx}" y="${slotY}" width="${slotW}" height="${slotH}" rx="5" ry="5" fill="#161616" stroke="#383838" stroke-width="1" />`);
                }
            });
        }

        currentRightX += block.width + gap;
    });

    const svgString = `<svg xmlns="http://w3.org" xmlns:xlink="http://w3.org" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${svgParts.join("")}</svg>`;

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

export default renderBambuWidget;
