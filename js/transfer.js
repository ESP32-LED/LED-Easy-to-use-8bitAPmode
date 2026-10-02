let transferController = null;
let autoTransferTimeout = null;

// ============================================================
// ESP32設定
// ============================================================
const ESP32_MAX_SCENES = 6;
const ESP32_MAX_WIDTH = 256;
const ESP32_MIN_WIDTH = 64;
const ESP32_MAX_SCROLL_WIDTH = 4096;
const ESP32_HEADER_SIZE = 64; // ヘッダーサイズを64バイトに拡張

// ============================================================
// 自動転送
// ============================================================
function triggerAutoTransfer() {
    if (autoTransferTimeout) {
        clearTimeout(autoTransferTimeout);
    }
    autoTransferTimeout = setTimeout(() => {
        const ip = document.getElementById("esp32Ip");
        if (ip && ip.value.trim() !== "") {
            transferToESP32();
        }
    }, 500);
}

document.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest(".buttonGroup") || e.target.closest(".selectGroup") || e.target.closest(".numberInput") || e.target.closest("#scroll") || e.target.id === "scrollText" || e.target.id === "scrollCheck") {
        triggerAutoTransfer();
    }
});

document.addEventListener("input", (e) => {
    if (["scrollText", "scroll-text-input", "scroll-color", "scroll-speed", "hardwareWidth", "softBrightness", "gammaCorrection", "hwBrightness"].includes(e.target.id)) {
        triggerAutoTransfer();
    }
});

document.addEventListener("change", (e) => {
    if (["scrollCheck", "scrollText", "scroll-text-input", "scroll-color", "scroll-speed", "hardwareWidth", "softBrightness", "gammaCorrection", "hwBrightness"].includes(e.target.id)) {
        triggerAutoTransfer();
    }
});

function getNumberValue(id, defaultValue) {
    const element = document.getElementById(id);
    if (!element) return defaultValue;
    if (element.matches && element.matches("input")) {
        const value = Number(element.value);
        return Number.isFinite(value) ? value : defaultValue;
    }
    const input = element.querySelector ? element.querySelector("input") : null;
    if (!input) return defaultValue;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : defaultValue;
}

function getScrollText() {
    const scrollText = document.getElementById("scrollText");
    if (scrollText) return scrollText.value || "";
    const oldScrollText = document.getElementById("scroll-text-input");
    if (oldScrollText) return oldScrollText.value || "";
    return "";
}

function isScrollEnabled() {
    return clickStartScrollBtn;
}

function getScrollColor() {
    const colorInput = document.getElementById("scroll-color");
    const defaultColor = { r: 255, g: 242, b: 0 };
    if (!colorInput || !colorInput.value) return defaultColor;
    const match = colorInput.value.trim().match(/^#([0-9a-fA-F]{6})$/);
    if (!match) return defaultColor;
    return {
        r: parseInt(match[1].slice(0, 2), 16),
        g: parseInt(match[1].slice(2, 4), 16),
        b: parseInt(match[1].slice(4, 6), 16)
    };
}

// テキストスクロールデータの生成
function createESP32TextScrollData(br, gam, margin) {
    const text = getScrollText();
    let tw = 0;
    let sbuf = new Uint8Array(0);
    
    let areaLeft = 48;
    const type = typeof getItem === "function" ? getItem("type", typeId) : null;
    let typeIsFull = false;
    if (type && typeof isTypeFullScreen === "function") typeIsFull = isTypeFullScreen(type);
    if (typeId === null && config.hasScrollFullScreen) areaLeft = 0;
    if (config.hasNextFullScreen) areaLeft = 0;
    
    const active = config.hasScroll === true && isScrollEnabled() && text.length > 0 && !typeIsFull;

    if (active) {
        const chars = [...text];
        tw = chars.length * 16;
        if (tw > ESP32_MAX_SCROLL_WIDTH) tw = ESP32_MAX_SCROLL_WIDTH;
        
        sbuf = new Uint8Array(tw * 16 * 2);
        let sp = 0;
        const baseColor = getScrollColor();

        for (let charIndex = 0; charIndex < tw / 16; charIndex++) {
            const char = chars[charIndex];
            const data = fontData[char];
            for (let px = 0; px < 16; px++) {
                for (let py = 0; py < 16; py++) {
                    let r = 0, g = 0, b = 0;
                    if (data && data[py * 16 + px] === 1) {
                        r = Math.min(255, Math.max(0, Math.round(Math.pow(baseColor.r / 255, gam) * br * 255)));
                        g = Math.min(255, Math.max(0, Math.round(Math.pow(baseColor.g / 255, gam) * br * 255)));
                        b = Math.min(255, Math.max(0, Math.round(Math.pow(baseColor.b / 255, gam) * br * 255)));
                    }
                    const rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
                    sbuf[sp++] = rgb565 & 0xFF;
                    sbuf[sp++] = (rgb565 >> 8) & 0xFF;
                }
            }
        }
    }
    return { tw, th: 16, sbuf, areaLeft: areaLeft + margin, areaRight: Number(config.ledWidth) + margin, areaTop: 0, areaBottom: 16 };
}

// 種別・行先スクロールデータの生成（生データから直接計算）
function createExtraScrollData(lang, typeOrDest, br, gam, margin) {
    const state = typeOrDest === 'type' 
        ? (lang === 'ja' ? typeJaScrollState : typeEnScrollState) 
        : (lang === 'ja' ? destinationJaScrollState : destinationEnScrollState);

    if (!state || !state.active || state.width === 0) return null;

    const dataObj = getItem(typeOrDest, typeOrDest === 'type' ? typeId : destinationId);
    if (!dataObj) return null;
    const view = dataObj.view?.normal?.[lang];
    if (!view || !view.data) return null;

    const tw = state.width;
    const th = state.height;
    const sbuf = new Uint8Array(tw * th * 2);
    let sp = 0;
    const data = view.data;

    for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
            const idx = (y * tw + x) * 3;
            const r = Math.min(255, Math.max(0, Math.round(Math.pow(data[idx] / 255, gam) * br * 255)));
            const g = Math.min(255, Math.max(0, Math.round(Math.pow(data[idx+1] / 255, gam) * br * 255)));
            const b = Math.min(255, Math.max(0, Math.round(Math.pow(data[idx+2] / 255, gam) * br * 255)));
            const rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
            sbuf[sp++] = rgb565 & 0xFF;
            sbuf[sp++] = (rgb565 >> 8) & 0xFF;
        }
    }

    return {
        tw, th, sbuf,
        areaLeft: state.areaLeft + margin,
        areaRight: state.areaRight + margin,
        areaTop: state.areaTop,
        areaBottom: state.areaBottom
    };
}

// ============================================================
// ESP32パケット生成
// ============================================================
function createESP32Packet() {
    const hw = Math.round(getNumberValue("hardwareWidth", 160));
    const pw = Number(config.ledWidth);
    const margin = Math.max(0, hw - pw);
    const br = getNumberValue("softBrightness", 1.0);
    const gam = getNumberValue("gammaCorrection", 1.5);

    // 全てのスクロール情報を集約
    const scrolls = [];
    const textScroll = createESP32TextScrollData(br, gam, margin);
    if (textScroll.tw > 0) scrolls.push(textScroll);

    if (typeof typeJaScrollState !== 'undefined') {
        const extras = [
            createExtraScrollData('ja', 'type', br, gam, margin),
            createExtraScrollData('en', 'type', br, gam, margin),
            createExtraScrollData('ja', 'destination', br, gam, margin),
            createExtraScrollData('en', 'destination', br, gam, margin)
        ];
        extras.forEach(ext => { if (ext && ext.tw > 0) scrolls.push(ext); });
    }

    // スクロール時の強制ID書き換え
    const oldScrollId = typeof scrollId !== "undefined" ? scrollId : null;
    const oldTypeDestScrollId = typeof typeDestinationScrollId !== "undefined" ? typeDestinationScrollId : null;
    if (textScroll.tw > 0) scrollId = true;
    if (scrolls.length > (textScroll.tw > 0 ? 1 : 0)) typeDestinationScrollId = true;

    try {
        buildSceneList();
        buildTypeSceneList();

        if (sceneList.length === 0) return new Uint8Array();

        const typeCount = typeSceneList.length > 0 ? typeSceneList.length : 1;
        const sceneCount = lcm(sceneList.length, typeCount);

        // ヘッダー作成 (64バイト)
        const header = new Uint8Array(ESP32_HEADER_SIZE);
        header[0] = 0xAA; header[1] = 0x56;
        header[2] = sceneCount & 0xFF;
        header[3] = 17; // scroll speed
        header[4] = scrolls.length & 0xFF; // スクロール領域の数 (最大5)
        
        // シーン切替時間
        const jaTime = getNumberValue("jaTime", 3) * 1000;
        const enTime = getNumberValue("enTime", 3) * 1000;
        const infoTime = getNumberValue("infoTime", 3) * 1000;
        const carNumberTime = getNumberValue("carNumberTime", 3) * 1000;
        
        for (let i = 0; i < 5; i++) {
            let time = 3000;
            if (config.setSwitchingTime && sceneList[i]) {
                const info = sceneList[i].information;
                if (info.includes("carNumber")) time = carNumberTime;
                else if (info === "information") time = infoTime;
                else if (info === "destination") time = sceneList[i].lang === "ja" ? jaTime : enTime;
            }
            header[7 + i * 2] = time & 0xFF;
            header[8 + i * 2] = (time >> 8) & 0xFF;
        }

        header[17] = Math.max(0, Math.min(255, Math.round(getNumberValue("hwBrightness", 12)))) & 0xFF;
        header[18] = hw & 0xFF;
        header[19] = (hw >> 8) & 0xFF;

        // スクロール情報のメタデータ (20バイト目から)
        let hOff = 20;
        let totalScrollBytes = 0;
        scrolls.forEach(s => {
            header[hOff++] = s.tw & 0xFF; header[hOff++] = (s.tw >> 8) & 0xFF;
            header[hOff++] = s.th & 0xFF;
            header[hOff++] = s.areaLeft & 0xFF; 
            header[hOff++] = s.areaRight & 0xFF;
            header[hOff++] = s.areaTop & 0xFF;
            header[hOff++] = s.areaBottom & 0xFF;
            header[hOff++] = 0; // reserved
            totalScrollBytes += s.sbuf.length;
        });

        const sceneData = createAllESP32Scenes(sceneCount, hw, margin);
        const packet = new Uint8Array(ESP32_HEADER_SIZE + totalScrollBytes + sceneData.length);
        
        packet.set(header, 0);
        let pOffset = ESP32_HEADER_SIZE;
        scrolls.forEach(s => {
            packet.set(s.sbuf, pOffset);
            pOffset += s.sbuf.length;
        });
        packet.set(sceneData, pOffset);

        return packet;

    } finally {
        if (typeof scrollId !== "undefined") scrollId = oldScrollId;
        if (typeof typeDestinationScrollId !== "undefined") typeDestinationScrollId = oldTypeDestScrollId;
    }
}

function createESP32Frame(matrix, hw, margin) {
    const frame = Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => new Uint8Array(hw)));
    const br = getNumberValue("softBrightness", 1.0);
    const gam = getNumberValue("gammaCorrection", 1.5);
    const ledHeight = Number(config.ledHeight);
    const ledWidth = Number(config.ledWidth);
    const yOffset = ledHeight < 32 ? Math.floor((32 - ledHeight) / 2) : 0;

    for (let y = 0; y < ledHeight; y++) {
        for (let x = 0; x < ledWidth; x++) {
            const pixel = matrix[y]?.[x];
            if (!pixel) continue;
            const targetX = x + margin;
            const targetY = y + yOffset;
            if (targetX < 0 || targetX >= hw || targetY < 0 || targetY >= 32) continue;

            const r = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.r / 255, gam) * br * 255)));
            const g = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.g / 255, gam) * br * 255)));
            const b = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.b / 255, gam) * br * 255)));

            for (let bit = 0; bit < 8; bit++) {
                if ((r >> bit) & 1) frame[bit][targetY % 16][targetX] |= targetY < 16 ? 0x01 : 0x08;
                if ((g >> bit) & 1) frame[bit][targetY % 16][targetX] |= targetY < 16 ? 0x02 : 0x10;
                if ((b >> bit) & 1) frame[bit][targetY % 16][targetX] |= targetY < 16 ? 0x04 : 0x20;
            }
        }
    }
    return frame;
}

function frameToUint8Array(frame, hw) {
    const sceneBuf = new Uint8Array(8 * 16 * hw);
    let p = 0;
    for (let bit = 0; bit < 8; bit++) {
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < hw; x++) {
                sceneBuf[p++] = frame[bit][y][x];
            }
        }
    }
    return sceneBuf;
}

function createAllESP32Scenes(sceneCount, hw, margin) {
    const sceneSize = 8 * 16 * hw;
    const allData = new Uint8Array(sceneCount * sceneSize);
    let offset = 0;
    const oldScene = scene;
    const oldTypeScene = typeScene;

    try {
        for (let i = 0; i < sceneCount; i++) {
            scene = i % sceneList.length;
            typeScene = typeSceneList.length > 0 ? i % typeSceneList.length : 0;
            applyScene();
            applyTypeScene();
            const matrix = createDisplayMatrix();
            const frame = createESP32Frame(matrix, hw, margin);
            allData.set(frameToUint8Array(frame, hw), offset);
            offset += sceneSize;
        }
    } finally {
        scene = oldScene;
        typeScene = oldTypeScene;
        try { applyScene(); applyTypeScene(); } catch (e) {}
    }
    return allData;
}

async function transferToESP32() {
    const status = document.getElementById("transferStatus");
    const ipInput = document.getElementById("esp32Ip");
    const ip = ipInput ? ipInput.value.trim() : "192.168.4.1";

    if (!ip) {
        if (status) status.textContent = "ESP32のIPアドレスを入力してください";
        return;
    }

    if (transferController) transferController.abort();
    transferController = new AbortController();

    try {
        if (status) status.textContent = "データ作成中...";
        const packet = createESP32Packet();
        if (!packet || packet.length === 0) throw new Error("表示シーンがありません");
        
        if (status) status.textContent = `Wi-Fi転送中... (${packet.length} bytes)`;
        const formData = new FormData();
        formData.append("file", new Blob([packet], { type: "application/octet-stream" }), "led.bin");

        const response = await fetch(`http://${ip}/update`, {
            method: "POST",
            body: formData,
            signal: transferController.signal
        });

        if (!response.ok) throw new Error(`転送失敗: HTTP ${response.status}`);
        if (status) status.textContent = "転送完了";

    } catch (error) {
        if (error && error.name === "AbortError") return;
        console.error("ESP32転送エラー:", error);
        if (status) status.textContent = "転送失敗: " + (error?.message || "不明なエラー");
    } finally {
        transferController = null;
    }
}

function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b !== 0) { const temp = a % b; a = b; b = temp; }
    return a;
}

function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return Math.abs(a / gcd(a, b) * b);
}
