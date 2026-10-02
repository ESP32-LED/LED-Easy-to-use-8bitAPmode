let transferController = null;
let autoTransferTimeout = null;

const ESP32_MAX_SCENES = 6;
const ESP32_MAX_WIDTH = 256;
const ESP32_MIN_WIDTH = 64;
const ESP32_MAX_SCROLL_WIDTH = 4096;
const ESP32_HEADER_SIZE = 64; // ヘッダーサイズを拡張

function triggerAutoTransfer() {
    if (autoTransferTimeout) clearTimeout(autoTransferTimeout);
    autoTransferTimeout = setTimeout(() => {
        const ip = document.getElementById("esp32Ip");
        if (ip && ip.value.trim() !== "") transferToESP32();
    }, 500);
}

document.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest(".buttonGroup") || e.target.closest(".selectGroup") || e.target.closest(".numberInput") || e.target.closest("#scroll") || e.target.id === "scrollText" || e.target.id === "scrollCheck") triggerAutoTransfer();
});

document.addEventListener("input", (e) => {
    if (["scrollText", "scroll-text-input", "scroll-color", "scroll-speed", "hardwareWidth", "softBrightness", "gammaCorrection", "hwBrightness"].includes(e.target.id)) triggerAutoTransfer();
});

document.addEventListener("change", (e) => {
    if (["scrollCheck", "scrollText", "scroll-text-input", "scroll-color", "scroll-speed", "hardwareWidth", "softBrightness", "gammaCorrection", "hwBrightness"].includes(e.target.id)) triggerAutoTransfer();
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

// 汎用スクロールデータ抽出関数
function extractScrollStateData(state, br, gam) {
    if (!state || !state.active || state.width === 0) return { tw: 0, sbuf: new Uint8Array(0), areaLeft: 0, areaRight: 0, areaTop: 0, areaBottom: 0 };
    const tw = state.width;
    const th = state.height;
    const sbuf = new Uint8Array(tw * th * 2);
    let sp = 0;
    const imageData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height).data;
    
    for (let x = 0; x < tw; x++) {
        for (let y = 0; y < th; y++) {
            // ピッチ(pitch)に応じた間引き取得
            const px = x * pitch;
            const py = y * pitch;
            const idx = (py * state.canvas.width + px) * 4;
            const r = Math.min(255, Math.max(0, Math.round(Math.pow(imageData[idx] / 255, gam) * br * 255)));
            const g = Math.min(255, Math.max(0, Math.round(Math.pow(imageData[idx+1] / 255, gam) * br * 255)));
            const b = Math.min(255, Math.max(0, Math.round(Math.pow(imageData[idx+2] / 255, gam) * br * 255)));
            const rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
            sbuf[sp++] = rgb565 & 0xFF;
            sbuf[sp++] = (rgb565 >> 8) & 0xFF;
        }
    }
    return { tw, th, sbuf, areaLeft: state.areaLeft, areaRight: state.areaRight, areaTop: state.areaTop, areaBottom: state.areaBottom };
}

function createESP32ScrollData(br, gam) {
    const text = getScrollText();
    let tw = 0;
    let sbuf = new Uint8Array(0);
    if (isScrollEnabled() && text && (!config || config.hasScroll !== false)) {
        const chars = [...text];
        tw = chars.length * 16;
        sbuf = new Uint8Array(tw * 16 * 2);
        let sp = 0;
        const baseColor = getScrollColor();
        for (let charIndex = 0; charIndex < chars.length; charIndex++) {
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
    return { tw, th: 16, sbuf, areaLeft: 48, areaRight: Number(config.ledWidth), areaTop: 0, areaBottom: 16 };
}

function createESP32Packet() {
    const br = getNumberValue("softBrightness", 1.0);
    const gam = getNumberValue("gammaCorrection", 1.5);
    
    // スクロール状態の収集
    const scrolls = [];
    const textScroll = createESP32ScrollData(br, gam);
    if (textScroll.tw > 0) scrolls.push(textScroll);
    
    if (typeof typeJaScrollState !== 'undefined') {
        const states = [typeJaScrollState, typeEnScrollState, destinationJaScrollState, destinationEnScrollState];
        states.forEach(state => {
            const data = extractScrollStateData(state, br, gam);
            if (data.tw > 0) scrolls.push(data);
        });
    }

    const hw = Math.round(getNumberValue("hardwareWidth", 160));
    const pw = Number(config.ledWidth);
    const margin = Math.max(0, hw - pw);
    
    buildSceneList();
    buildTypeSceneList();
    const typeCount = typeSceneList.length > 0 ? typeSceneList.length : 1;
    const sceneCount = lcm(sceneList.length, typeCount);

    const header = new Uint8Array(ESP32_HEADER_SIZE);
    header[0] = 0xAA; header[1] = 0x56;
    header[2] = sceneCount & 0xFF;
    header[3] = 17; // scrollSpeed
    header[4] = scrolls.length & 0xFF; // スクロール領域の数
    header[17] = Math.max(0, Math.min(255, Math.round(getNumberValue("hwBrightness", 12)))) & 0xFF;
    header[18] = hw & 0xFF; header[19] = (hw >> 8) & 0xFF;
    
    let hOffset = 20;
    let totalScrollBytes = 0;
    scrolls.forEach(s => {
        header[hOffset++] = s.tw & 0xFF; header[hOffset++] = (s.tw >> 8) & 0xFF;
        header[hOffset++] = s.th & 0xFF;
        header[hOffset++] = (s.areaLeft + margin) & 0xFF; 
        header[hOffset++] = (s.areaRight + margin) & 0xFF;
        header[hOffset++] = s.areaTop & 0xFF;
        header[hOffset++] = s.areaBottom & 0xFF;
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
}

// （以降の createESP32Frame, frameToUint8Array, createAllESP32Scenes, transferToESP32 等は元の実装をそのまま維持）
