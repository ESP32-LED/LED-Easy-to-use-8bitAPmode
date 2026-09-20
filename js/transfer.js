let transferController = null;
let autoTransferTimeout = null;

// 自動転送のトリガー (入力やクリック時に呼び出される)
function triggerAutoTransfer() {
    if (autoTransferTimeout) clearTimeout(autoTransferTimeout);
    autoTransferTimeout = setTimeout(() => {
        const ip = document.getElementById("esp32Ip");
        if (ip && ip.value.trim() !== "") {
            transferToESP32();
        }
    }, 500); // 連続操作を防ぐための500msのデバウンス
}

// 画面全体のクリックや入力で自動転送を発火させる
document.addEventListener('click', (e) => {
    // 表示を切り替えるボタンや設定がクリックされた時に自動転送
    if (e.target.tagName === 'BUTTON' || e.target.closest('.buttonGroup') || e.target.closest('.selectGroup') || e.target.closest('.numberInput') || e.target.closest('#scroll-settings')) {
        triggerAutoTransfer();
    }
});

// スクロール用テキストからRGB565の画像データを生成する
function createESP32ScrollData(br, gam) {
    const textInput = document.getElementById('scroll-text-input');
    const text = textInput ? textInput.value : "";
    
    if (!text) {
        return { tw: 0, sbuf: new Uint8Array(0) };
    }

    const colorInput = document.getElementById('scroll-color');
    const color = colorInput ? colorInput.value : "#ffff00";
    
    const tcv = document.createElement('canvas');
    const tctx = tcv.getContext('2d');
    
    tctx.font = "16px 'KagurazakaCustom', monospace, sans-serif";
    const tw = Math.ceil(tctx.measureText(text).width) + 2;
    
    tcv.width = tw;
    tcv.height = 16;
    tctx.fillStyle = "black";
    tctx.fillRect(0, 0, tw, 16);
    
    tctx.fillStyle = color;
    tctx.font = "16px 'KagurazakaCustom', monospace, sans-serif";
    tctx.textBaseline = "top";
    tctx.fillText(text, 0, 0);
    
    const tdata = tctx.getImageData(0, 0, tw, 16).data;
    const sbuf = new Uint8Array(tw * 16 * 2);
    let sp = 0;
    
    for(let x = 0; x < tw; x++){
        for(let y = 0; y < 16; y++){
            let idx = (y * tw + x) * 4;
            let r_raw = tdata[idx];
            let g_raw = tdata[idx+1];
            let b_raw = tdata[idx+2];
            
            if (r_raw > 5 || g_raw > 5 || b_raw > 5) {
                let r = Math.min(255, Math.pow(r_raw / 255, gam) * br * 255);
                let g = Math.min(255, Math.pow(g_raw / 255, gam) * br * 255);
                let b = Math.min(255, Math.pow(b_raw / 255, gam) * br * 255);
                
                let rgb565 = ((Math.floor(r) >> 3) << 11) | ((Math.floor(g) >> 2) << 5) | (Math.floor(b) >> 3);
                sbuf[sp++] = rgb565 & 0xFF;
                sbuf[sp++] = (rgb565 >> 8) & 0xFF;
            } else {
                sbuf[sp++] = 0; sbuf[sp++] = 0;
            }
        }
    }
    
    return { tw, sbuf };
}

function createESP32Packet() { 
    buildSceneList(); 
    buildTypeSceneList(); 

    if (sceneList.length === 0) { 
        return new Uint8Array(); 
    } 
    const typeCount = typeSceneList.length > 0 ? typeSceneList.length : 1; 
    const sceneCount = lcm(sceneList.length, typeCount); 
    
    // 物理幅とデータ幅の取得
    const hwInput = document.getElementById("hardwareWidth");
    const hw = hwInput ? parseInt(hwInput.value) || 160 : 160;
    const pw = config.ledWidth;
    const margin = Math.max(0, hw - pw); // 右詰めするための余白

    // 明るさとガンマ設定を取得 (スクロールデータでも共有)
    const brInput = document.getElementById('softBrightness');
    const gamInput = document.getElementById('gammaCorrection');
    const br = brInput ? parseFloat(brInput.value) || 1.0 : 1.0;
    const gam = gamInput ? parseFloat(gamInput.value) || 1.5 : 1.5;

    // スクロール速度の取得
    const speedInput = document.getElementById('scroll-speed');
    const scrollSpeed = speedInput ? parseInt(speedInput.value) : 10;

    // スクロールデータの作成
    const scrollData = createESP32ScrollData(br, gam);
    
    // オフセット（通常は 種別幅 + 余白）
    const xOff = 80 + margin;

    const header = createESP32Header(sceneCount, hw, margin, scrollData.tw, scrollSpeed, xOff); 
    const sceneData = createAllESP32Scenes(sceneCount, hw, margin); 
    
    const packet = new Uint8Array(header.length + scrollData.sbuf.length + sceneData.length); 
    packet.set(header, 0); 
    packet.set(scrollData.sbuf, header.length); 
    packet.set(sceneData, header.length + scrollData.sbuf.length); 
    
    return packet; 
}

function createESP32Frame(matrix, hw, margin) {
    // 8bit対応 (8ビット x 16行 x ハードウェア幅)
    const frame = Array.from(
        { length: 8 },
        () => Array.from(
            { length: 16 },
            () => new Uint8Array(hw)
        )
    );

    const brInput = document.getElementById('softBrightness');
    const gamInput = document.getElementById('gammaCorrection');
    const br = brInput ? parseFloat(brInput.value) || 1.0 : 1.0;
    const gam = gamInput ? parseFloat(gamInput.value) || 1.5 : 1.5;

    for (let y = 0; y < config.ledHeight; y++) {
        for (let x = 0; x < config.ledWidth; x++) {

            const pixel = matrix[y]?.[x];
            if (!pixel) continue;

            // 右詰めのためのX座標オフセット
            let targetX = x + margin;
            if (targetX >= hw || y >= 32) continue;

            // 色の明るさとガンマ補正の適用
            let rgb = [0, 0, 0];
            rgb[0] = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.r / 255.0, gam) * br * 255)));
            rgb[1] = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.g / 255.0, gam) * br * 255)));
            rgb[2] = Math.min(255, Math.max(0, Math.round(Math.pow(pixel.b / 255.0, gam) * br * 255)));

            const r = rgb[0], g = rgb[1], b = rgb[2];

            for (let bit = 0; bit < 8; bit++) {
                if ((r >> bit) & 1) {
                    frame[bit][y % 16][targetX] |= (y < 16 ? 0x01 : 0x08);
                }
                if ((g >> bit) & 1) {
                    frame[bit][y % 16][targetX] |= (y < 16 ? 0x02 : 0x10);
                }
                if ((b >> bit) & 1) {
                    frame[bit][y % 16][targetX] |= (y < 16 ? 0x04 : 0x20);
                }
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

async function transferToESP32() {
    const status = document.getElementById("transferStatus");
    const ipInput = document.getElementById("esp32Ip");
    const ip = ipInput ? ipInput.value.trim() : "192.168.4.1";

    if (transferController) {
        transferController.abort();
    }
    transferController = new AbortController();

    try {
        if(status) status.textContent = "データ作成中...";

        const packet = createESP32Packet();

        if (packet.length === 0) {
            throw new Error("表示シーンがありません");
        }

        if(status) status.textContent = "Wi-Fi転送中...";

        // 参考ファイルに基づきFormDataでバイナリをPOSTする方式に変更
        const formData = new FormData();
        formData.append('file', new Blob([packet]));

        const response = await fetch(`http://${ip}/update`, {
            method: "POST",
            body: formData,
            signal: transferController.signal
        });

        if (!response.ok) {
            throw new Error(`転送失敗: ${response.status}`);
        }

        if(status) status.textContent = "転送完了";

    } catch (error) {
        if (error.name === "AbortError") {
            console.log("ESP32転送を中断・上書きしました");
            return;
        }

        console.error(error);
        if(status) status.textContent = "転送失敗: " + error.message;

    } finally {
        transferController = null;
    }
}

function createAllESP32Scenes(sceneCount, hw, margin) {
    const sceneSize = 8 * 16 * hw;
    const allData = new Uint8Array(sceneCount * sceneSize);
    let offset = 0;

    const oldScene = scene;
    const oldTypeScene = typeScene;

    for (let i = 0; i < sceneCount; i++) {
        scene = i % sceneList.length;
        typeScene = typeSceneList.length > 0 ? i % typeSceneList.length : 0;

        applyScene();
        applyTypeScene();

        const matrix = createDisplayMatrix();
        const frame = createESP32Frame(matrix, hw, margin);
        const sceneBuf = frameToUint8Array(frame, hw);

        allData.set(sceneBuf, offset);
        offset += sceneSize;
    }

    scene = oldScene;
    typeScene = oldTypeScene;

    return allData;
}

function createESP32Header(sceneCount, hw, margin, scrollWidth, scrollSpeed, xOff) {
    const header = new Uint8Array(20);
    let times;

    if (config.setSwitchingTime) {
        const jaTime = Number(document.querySelector("#jaTime input").value) * 1000 || 3000;
        const enTime = Number(document.querySelector("#enTime input").value) * 1000 || 3000;
        const infoTime = Number(document.querySelector("#infoTime input").value) * 1000 || 3000;
        const carNumberTime = Number(document.querySelector("#carNumberTime input").value) * 1000 || 3000;

        times = sceneList.slice(0, 4).map(currentScene => {
            if (currentScene.information === "carNumber" || currentScene.information === "carNumber_normal") {
                return carNumberTime;
            }
            if (currentScene.information === "information") {
                return infoTime;
            }
            if (currentScene.information === "destination") {
                if (currentScene.lang === "ja") return jaTime;
                if (currentScene.lang === "en") return enTime;
            }
            return 3000;
        });

    } else {
        times = [3000, 3000, 3000, 3000, 3000];
    }

    header[0] = 0xAA;
    header[1] = 0x56;
    header[2] = sceneCount & 0xFF;
    header[3] = scrollSpeed & 0xFF;           // スクロール速度
    header[4] = scrollWidth & 0xFF;           // スクロール幅 下位バイト
    header[5] = (scrollWidth >> 8) & 0xFF;    // スクロール幅 上位バイト
    header[6] = xOff & 0xFF;                  // スクロールオフセット位置

    for (let i = 0; i < 5; i++) {
        const time = times[i] ?? 3000;
        header[7 + i * 2] = time & 0xFF;
        header[8 + i * 2] = (time >> 8) & 0xFF;
    }

    const hwBrightInput = document.getElementById('hwBrightness');
    const hwBright = hwBrightInput ? parseInt(hwBrightInput.value) || 12 : 12;
    header[17] = hwBright & 0xFF;

    header[18] = hw & 0xFF;
    header[19] = (hw >> 8) & 0xFF;

    return header;
}

function gcd(a, b) {
    while (b !== 0) {
        const temp = a % b;
        a = b;
        b = temp;
    }
    return a;
}

function lcm(a, b) {
    return a / gcd(a, b) * b;
}
