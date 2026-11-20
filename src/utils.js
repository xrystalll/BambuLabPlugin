function formatBambuColor(rawColor) {
    if (!rawColor || typeof rawColor !== "string" || rawColor.length < 6) {
        return "#808080";
    }

    return `#${rawColor.slice(0, 6)}`;
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

function getContrastTextColor(hexColor) {
    if (!hexColor || hexColor.length < 7) return "#FFFFFF";

    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;

    return yiq >= 135 ? "#111111" : "#FFFFFF";
}

function truncateTextApprox(text, maxWidth, fontSize) {
    if (!text) return "";

    const avgCharWidth = fontSize * 0.55;
    const maxChars = Math.floor(maxWidth / avgCharWidth);

    if (text.length <= maxChars) return text;
    if (maxChars <= 3) return "...";

    return text.slice(0, maxChars - 3) + "...";
}

export { formatBambuColor, escapeXml, getContrastTextColor, truncateTextApprox }
