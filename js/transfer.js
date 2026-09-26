let transferController = null;
let autoTransferTimeout = null;


// ============================================================
// ESP32設定
// ============================================================

const ESP32_MAX_SCENES = 6;
const ESP32_MAX_WIDTH = 256;
const ESP32_MIN_WIDTH = 64;
const ESP32_MAX_SCROLL_WIDTH = 4096;
const ESP32_HEADER_SIZE = 20;


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


// クリックによる自動転送
document.addEventListener("click", (e) => {
    if (
        e.target.tagName === "BUTTON" ||
        e.target.closest(".buttonGroup") ||
        e.target.closest(".selectGroup") ||
        e.target.closest(".numberInput") ||
        e.target.closest("#scroll") ||
        e.target.id === "scrollText" ||
        e.target.id === "scrollCheck"
    ) {
        triggerAutoTransfer();
    }
});


// スクロール文字入力などの変更で自動転送
document.addEventListener("input", (e) => {
    if (
        e.target.id === "scrollText" ||
        e.target.id === "scroll-text-input" ||
        e.target.id === "scroll-color" ||
        e.target.id === "scroll-speed" ||
        e.target.id === "hardwareWidth" ||
        e.target.id === "softBrightness" ||
        e.target.id === "gammaCorrection" ||
        e.target.id === "hwBrightness"
    ) {
        triggerAutoTransfer();
    }
});

document.addEventListener("change", (e) => {
    if (
        e.target.id === "scrollCheck" ||
        e.target.id === "scrollText" ||
        e.target.id === "scroll-text-input" ||
        e.target.id === "scroll-color" ||
        e.target.id === "scroll-speed" ||
        e.target.id === "hardwareWidth" ||
        e.target.id === "softBrightness" ||
        e.target.id === "gammaCorrection" ||
        e.target.id === "hwBrightness"
    ) {
        triggerAutoTransfer();
    }
});


// ============================================================
// 数値取得
// ============================================================

function getNumberValue(id, defaultValue) {
    const element = document.getElementById(id);

    if (!element) {
        return defaultValue;
    }

    // inputそのもの
    if (element.matches && element.matches("input")) {
        const value = Number(element.value);

        return Number.isFinite(value)
            ? value
            : defaultValue;
    }

    // #jaTime のようなコンテナ
    const input = element.querySelector
        ? element.querySelector("input")
        : null;

    if (!input) {
        return defaultValue;
    }

    const value = Number(input.value);

    return Number.isFinite(value)
        ? value
        : defaultValue;
}


// ============================================================
// スクロール文字取得
// ============================================================

function getScrollText() {
    // リポジトリ本来のID
    const scrollText =
        document.getElementById("scrollText");

    if (scrollText) {
        return scrollText.value || "";
    }

    // 旧バージョンとの互換
    const oldScrollText =
        document.getElementById("scroll-text-input");

    if (oldScrollText) {
        return oldScrollText.value || "";
    }

    return "";
}


// ============================================================
// スクロールが有効か
// ============================================================

function isScrollEnabled() {
    const scrollCheck =
        document.getElementById("scrollCheck");

    // チェックボックスが存在しない構成なら
    // 文字が入力されていれば有効とする
    if (!scrollCheck) {
        return getScrollText().length > 0;
    }

    return scrollCheck.checked;
}


// ============================================================
// スクロール色
// ============================================================
//
// drawScroll() は
//
//   r: 255
//   g: 242
//   b: 0
//
// を使用しているため、デフォルトは同じ色。
// #scroll-color が存在する場合のみ、その色を使用する。
//

function getScrollColor() {
    const colorInput =
        document.getElementById("scroll-color");

    // リポジトリ本来の色
    const defaultColor = {
        r: 255,
        g: 242,
        b: 0
    };

    if (!colorInput || !colorInput.value) {
        return defaultColor;
    }

    const value =
        colorInput.value.trim();

    const match =
        value.match(
            /^#([0-9a-fA-F]{6})$/
        );

    if (!match) {
        return defaultColor;
    }

    return {
        r: parseInt(
            match[1].slice(0, 2),
            16
        ),
        g: parseInt(
            match[1].slice(2, 4),
            16
        ),
        b: parseInt(
            match[1].slice(4, 6),
            16
        )
    };
}


// ============================================================
// スクロールデータ生成
// ============================================================
//
// リポジトリの drawScroll() / createScrollMatrix() と同じ方式:
//
// 1文字 = 16 × 16 ドット
// 文字列幅 = 文字数 × 16
//
// fontData[文字] に入っている256個の0/1をそのまま使用。
//
// ESP32へ送る順番:
//
//   X0 Y0
//   X0 Y1
//   ...
//   X0 Y15
//   X1 Y0
//   ...
//
// RGB565 little endian
//

function createESP32ScrollData(br, gam) {

    const text = getScrollText();

    // スクロールOFF
    if (!isScrollEnabled()) {
        return {
            tw: 0,
            sbuf: new Uint8Array(0)
        };
    }

    // 文字なし
    if (!text) {
        return {
            tw: 0,
            sbuf: new Uint8Array(0)
        };
    }

    // 車両側がスクロール非対応
    if (config && config.hasScroll === false) {
        return {
            tw: 0,
            sbuf: new Uint8Array(0)
        };
    }


    // --------------------------------------------------------
    // fontData確認
    // --------------------------------------------------------

    if (
        typeof fontData === "undefined" ||
        !fontData
    ) {
        throw new Error(
            "スクロール用フォントデータ(fontData)が読み込まれていません"
        );
    }


    // --------------------------------------------------------
    // drawScroll() と同じ文字分割
    // --------------------------------------------------------

    // for...of と同じくUnicodeコードポイント単位で分割
    const chars = [...text];


    // --------------------------------------------------------
    // 1文字16px
    // --------------------------------------------------------

    const tw =
        chars.length * 16;


    if (tw > ESP32_MAX_SCROLL_WIDTH) {
        throw new Error(
            `スクロール文字が長すぎます（最大${ESP32_MAX_SCROLL_WIDTH}px）`
        );
    }


    // --------------------------------------------------------
    // RGB565用バッファ
    // --------------------------------------------------------

    const sbuf =
        new Uint8Array(
            tw * 16 * 2
        );

    let sp = 0;


    // --------------------------------------------------------
    // スクロール色
    // --------------------------------------------------------

    const baseColor =
        getScrollColor();


    // --------------------------------------------------------
    // 文字ごとに16×16ドットを展開
    // --------------------------------------------------------

    for (
        let charIndex = 0;
        charIndex < chars.length;
        charIndex++
    ) {

        const char =
            chars[charIndex];


        /*
         * display.js の textToMatrix16() と同じ。
         *
         * fontData[char] が無ければ
         * 16×16全消灯。
         */

        const data =
            fontData[char];


        for (
            let px = 0;
            px < 16;
            px++
        ) {

            for (
                let py = 0;
                py < 16;
                py++
            ) {

                let r = 0;
                let g = 0;
                let b = 0;


                // 未登録文字
                if (!data) {
                    r = 0;
                    g = 0;
                    b = 0;

                } else {

                    const index =
                        py * 16 + px;


                    // textToMatrix16() と同じく
                    // value === 1 のみ点灯
                    const on =
                        data[index] === 1;


                    if (on) {

                        // 明るさ・ガンマ補正
                        r = Math.min(
                            255,
                            Math.max(
                                0,
                                Math.round(
                                    Math.pow(
                                        baseColor.r / 255,
                                        gam
                                    ) *
                                    br *
                                    255
                                )
                            )
                        );

                        g = Math.min(
                            255,
                            Math.max(
                                0,
                                Math.round(
                                    Math.pow(
                                        baseColor.g / 255,
                                        gam
                                    ) *
                                    br *
                                    255
                                )
                            )
                        );

                        b = Math.min(
                            255,
                            Math.max(
                                0,
                                Math.round(
                                    Math.pow(
                                        baseColor.b / 255,
                                        gam
                                    ) *
                                    br *
                                    255
                                )
                            )
                        );
                    }
                }


                // RGB888 → RGB565
                const rgb565 =
                    ((r >> 3) << 11) |
                    ((g >> 2) << 5) |
                    (b >> 3);


                // little endian
                sbuf[sp++] =
                    rgb565 & 0xFF;

                sbuf[sp++] =
                    (rgb565 >> 8) & 0xFF;
            }
        }
    }


    return {
        tw,
        sbuf
    };
}


// ============================================================
// ESP32パケット生成
// ============================================================

function createESP32Packet() {

    if (
        typeof buildSceneList !== "function" ||
        typeof buildTypeSceneList !== "function" ||
        typeof createDisplayMatrix !== "function" ||
        typeof applyScene !== "function" ||
        typeof applyTypeScene !== "function"
    ) {
        throw new Error(
            "表示関連のJavaScriptが正しく読み込まれていません"
        );
    }


    if (!config) {
        throw new Error(
            "車両configが読み込まれていません"
        );
    }


    // --------------------------------------------------------
    // スクロール状態を取得
    // --------------------------------------------------------

    const scrollText =
        getScrollText();


    const scrollActive =
        config.hasScroll === true &&
        isScrollEnabled() &&
        scrollText.length > 0;


    // --------------------------------------------------------
    // スクロール表示時は
    // buildSceneList() にもscrollId=trueとして扱わせる
    //
    // drawScroll() と同じ状態にするため
    // --------------------------------------------------------

    const oldScrollId =
        typeof scrollId !== "undefined"
            ? scrollId
            : null;


    if (scrollActive) {
        scrollId = true;
    }


    try {

        // ----------------------------------------------------
        // シーン構築
        // ----------------------------------------------------

        buildSceneList();
        buildTypeSceneList();


        if (sceneList.length === 0) {
            return new Uint8Array();
        }


        const typeCount =
            typeSceneList.length > 0
                ? typeSceneList.length
                : 1;


        const calculatedSceneCount =
            lcm(
                sceneList.length,
                typeCount
            );


        if (
            calculatedSceneCount >
            ESP32_MAX_SCENES
        ) {
            throw new Error(
                `シーン数が多すぎます（最大${ESP32_MAX_SCENES}）`
            );
        }


        const sceneCount =
            calculatedSceneCount;


        // ----------------------------------------------------
        // ハードウェア幅
        // ----------------------------------------------------

        const hw =
            Math.round(
                getNumberValue(
                    "hardwareWidth",
                    160
                )
            );


        if (
            hw < ESP32_MIN_WIDTH ||
            hw > ESP32_MAX_WIDTH
        ) {
            throw new Error(
                `ハードウェア幅は${ESP32_MIN_WIDTH}～${ESP32_MAX_WIDTH}pxにしてください`
            );
        }


        // ----------------------------------------------------
        // 表示データ幅
        // ----------------------------------------------------

        const pw =
            Number(config.ledWidth);


        if (
            !Number.isFinite(pw) ||
            pw <= 0
        ) {
            throw new Error(
                "config.ledWidth が正しくありません"
            );
        }


        // ----------------------------------------------------
        // ハードウェア上での右詰め余白
        // ----------------------------------------------------

        const margin =
            Math.max(
                0,
                hw - pw
            );


        // ----------------------------------------------------
        // 明るさ・ガンマ
        // ----------------------------------------------------

        const br =
            getNumberValue(
                "softBrightness",
                1.0
            );


        const gam =
            getNumberValue(
                "gammaCorrection",
                1.5
            );


        // ----------------------------------------------------
        // スクロール速度
        // ----------------------------------------------------

        let scrollSpeed =
            getNumberValue(
                "scroll-speed",
                10
            );


        scrollSpeed =
            Math.max(
                0,
                Math.min(
                    255,
                    Math.round(
                        scrollSpeed
                    )
                )
            );


        // ----------------------------------------------------
        // スクロールデータ
        // ----------------------------------------------------

        const scrollData =
            createESP32ScrollData(
                br,
                gam
            );


        // ----------------------------------------------------
        // スクロール開始位置
        //
        // drawScroll():
        //
        //   通常 → areaLeft = 48
        //   全画面 → areaLeft = -1
        //
        // ハードウェア側では
        // 表示データ全体の右詰め分marginを加える。
        // ----------------------------------------------------

        let areaLeft = 48;


        const type =
            typeof getItem === "function"
                ? getItem(
                    "type",
                    typeId
                )
                : null;


        let typeIsFull =
            false;


        if (
            type &&
            typeof isTypeFullScreen === "function"
        ) {
            typeIsFull =
                isTypeFullScreen(type);
        }


        // drawScroll() と同じく
        // フル画面種別ではスクロールしない
        if (
            scrollActive &&
            typeIsFull
        ) {
            scrollData.tw = 0;
            scrollData.sbuf =
                new Uint8Array(0);
        }


        if (
            typeId === null &&
            config.hasScrollFullScreen
        ) {
            areaLeft = 0;
        }


        if (
            config.hasNextFullScreen
        ) {
            areaLeft = 0;
        }


        let xOff =
            areaLeft + margin;


        xOff =
            Math.max(
                0,
                Math.min(
                    255,
                    xOff
                )
            );


        // ----------------------------------------------------
        // ヘッダー
        // ----------------------------------------------------

        const header =
            createESP32Header(
                sceneCount,
                hw,
                margin,
                scrollData.tw,
                scrollSpeed,
                xOff
            );


        // ----------------------------------------------------
        // シーンデータ
        // ----------------------------------------------------

        const sceneData =
            createAllESP32Scenes(
                sceneCount,
                hw,
                margin
            );


        // ----------------------------------------------------
        // 最終パケット
        //
        // [20byte header]
        // [scroll RGB565]
        // [scene data]
        // ----------------------------------------------------

        const packet =
            new Uint8Array(
                header.length +
                scrollData.sbuf.length +
                sceneData.length
            );


        packet.set(
            header,
            0
        );


        packet.set(
            scrollData.sbuf,
            header.length
        );


        packet.set(
            sceneData,
            header.length +
            scrollData.sbuf.length
        );


        console.log(
            "ESP32 packet size:",
            packet.length,
            "bytes"
        );

        console.log(
            "ESP32 scroll width:",
            scrollData.tw
        );

        console.log(
            "ESP32 scroll bytes:",
            scrollData.sbuf.length
        );

        console.log(
            "ESP32 scene count:",
            sceneCount
        );

        console.log(
            "ESP32 scroll xOff:",
            xOff
        );


        return packet;

    } finally {

        // 元のscrollIdを必ず復元
        if (
            typeof scrollId !== "undefined"
        ) {
            scrollId =
                oldScrollId;
        }
    }
}


// ============================================================
// ESP32用フレーム生成
// ============================================================

function createESP32Frame(
    matrix,
    hw,
    margin
) {

    const frame =
        Array.from(
            { length: 8 },
            () =>
                Array.from(
                    { length: 16 },
                    () =>
                        new Uint8Array(hw)
                )
        );


    const br =
        getNumberValue(
            "softBrightness",
            1.0
        );


    const gam =
        getNumberValue(
            "gammaCorrection",
            1.5
        );


    const ledHeight =
        Number(config.ledHeight);


    const ledWidth =
        Number(config.ledWidth);


    // 縦32未満なら中央寄せ
    const yOffset =
        ledHeight < 32
            ? Math.floor(
                (32 - ledHeight) / 2
            )
            : 0;


    for (
        let y = 0;
        y < ledHeight;
        y++
    ) {

        for (
            let x = 0;
            x < ledWidth;
            x++
        ) {

            const pixel =
                matrix[y]?.[x];


            if (!pixel) {
                continue;
            }


            const targetX =
                x + margin;


            if (
                targetX < 0 ||
                targetX >= hw
            ) {
                continue;
            }


            const targetY =
                y + yOffset;


            if (
                targetY < 0 ||
                targetY >= 32
            ) {
                continue;
            }


            const r =
                Math.min(
                    255,
                    Math.max(
                        0,
                        Math.round(
                            Math.pow(
                                pixel.r / 255,
                                gam
                            ) *
                            br *
                            255
                        )
                    )
                );


            const g =
                Math.min(
                    255,
                    Math.max(
                        0,
                        Math.round(
                            Math.pow(
                                pixel.g / 255,
                                gam
                            ) *
                            br *
                            255
                        )
                    )
                );


            const b =
                Math.min(
                    255,
                    Math.max(
                        0,
                        Math.round(
                            Math.pow(
                                pixel.b / 255,
                                gam
                            ) *
                            br *
                            255
                        )
                    )
                );


            for (
                let bit = 0;
                bit < 8;
                bit++
            ) {

                if (
                    (r >> bit) & 1
                ) {
                    frame[bit]
                        [targetY % 16]
                        [targetX] |=
                        targetY < 16
                            ? 0x01
                            : 0x08;
                }


                if (
                    (g >> bit) & 1
                ) {
                    frame[bit]
                        [targetY % 16]
                        [targetX] |=
                        targetY < 16
                            ? 0x02
                            : 0x10;
                }


                if (
                    (b >> bit) & 1
                ) {
                    frame[bit]
                        [targetY % 16]
                        [targetX] |=
                        targetY < 16
                            ? 0x04
                            : 0x20;
                }
            }
        }
    }


    return frame;
}


// ============================================================
// フレーム → Uint8Array
// ============================================================

function frameToUint8Array(
    frame,
    hw
) {

    const sceneBuf =
        new Uint8Array(
            8 * 16 * hw
        );


    let p = 0;


    for (
        let bit = 0;
        bit < 8;
        bit++
    ) {

        for (
            let y = 0;
            y < 16;
            y++
        ) {

            for (
                let x = 0;
                x < hw;
                x++
            ) {

                sceneBuf[p++] =
                    frame[bit][y][x];
            }
        }
    }


    return sceneBuf;
}


// ============================================================
// 全シーン生成
// ============================================================

function createAllESP32Scenes(
    sceneCount,
    hw,
    margin
) {

    const sceneSize =
        8 * 16 * hw;


    const allData =
        new Uint8Array(
            sceneCount *
            sceneSize
        );


    let offset = 0;


    const oldScene =
        scene;


    const oldTypeScene =
        typeScene;


    try {

        for (
            let i = 0;
            i < sceneCount;
            i++
        ) {

            scene =
                i % sceneList.length;


            typeScene =
                typeSceneList.length > 0
                    ? i % typeSceneList.length
                    : 0;


            applyScene();
            applyTypeScene();


            const matrix =
                createDisplayMatrix();


            const frame =
                createESP32Frame(
                    matrix,
                    hw,
                    margin
                );


            const sceneBuf =
                frameToUint8Array(
                    frame,
                    hw
                );


            allData.set(
                sceneBuf,
                offset
            );


            offset +=
                sceneSize;
        }

    } finally {

        scene =
            oldScene;


        typeScene =
            oldTypeScene;


        // 表示状態を復元
        try {
            applyScene();
            applyTypeScene();
        } catch (e) {
            console.warn(
                "表示状態の復元に失敗:",
                e
            );
        }
    }


    return allData;
}


// ============================================================
// ESP32ヘッダー
// ============================================================
//
// 0  AA
// 1  56
// 2  sceneCount
// 3  scrollSpeed
// 4  scrollWidth LOW
// 5  scrollWidth HIGH
// 6  scrollXOffset
// 7-16  scene interval × 5
// 17 hardware brightness
// 18 hardware width LOW
// 19 hardware width HIGH
//

function createESP32Header(
    sceneCount,
    hw,
    margin,
    scrollWidth,
    scrollSpeed,
    xOff
) {

    const header =
        new Uint8Array(
            ESP32_HEADER_SIZE
        );


    let times;


    // --------------------------------------------------------
    // シーン切替時間
    // --------------------------------------------------------

    if (
        config.setSwitchingTime
    ) {

        const jaTime =
            getNumberValue(
                "jaTime",
                3
            ) * 1000;


        const enTime =
            getNumberValue(
                "enTime",
                3
            ) * 1000;


        const infoTime =
            getNumberValue(
                "infoTime",
                3
            ) * 1000;


        const carNumberTime =
            getNumberValue(
                "carNumberTime",
                3
            ) * 1000;


        times =
            sceneList
                .slice(
                    0,
                    ESP32_MAX_SCENES
                )
                .map(
                    currentScene => {

                        if (
                            currentScene.information ===
                            "carNumber" ||
                            currentScene.information ===
                            "carNumber_normal" ||
                            currentScene.information ===
                            "carNumber_destination"
                        ) {
                            return carNumberTime;
                        }


                        if (
                            currentScene.information ===
                            "information"
                        ) {
                            return infoTime;
                        }


                        if (
                            currentScene.information ===
                            "destination"
                        ) {

                            if (
                                currentScene.lang ===
                                "ja"
                            ) {
                                return jaTime;
                            }


                            if (
                                currentScene.lang ===
                                "en"
                            ) {
                                return enTime;
                            }
                        }


                        return 3000;
                    }
                );

    } else {

        times = [
            3000,
            3000,
            3000,
            3000,
            3000
        ];
    }


    // --------------------------------------------------------
    // 固定ヘッダー
    // --------------------------------------------------------

    header[0] =
        0xAA;


    header[1] =
        0x56;


    header[2] =
        sceneCount & 0xFF;


    header[3] =
        scrollSpeed & 0xFF;


    header[4] =
        scrollWidth & 0xFF;


    header[5] =
        (scrollWidth >> 8) & 0xFF;


    header[6] =
        xOff & 0xFF;


    // --------------------------------------------------------
    // シーン時間
    // --------------------------------------------------------

    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const time =
            Math.max(
                0,
                Math.min(
                    65535,
                    Math.round(
                        times[i] ??
                        3000
                    )
                )
            );


        header[7 + i * 2] =
            time & 0xFF;


        header[8 + i * 2] =
            (time >> 8) & 0xFF;
    }


    // --------------------------------------------------------
    // ハードウェア輝度
    // --------------------------------------------------------

    const hwBright =
        Math.max(
            0,
            Math.min(
                255,
                Math.round(
                    getNumberValue(
                        "hwBrightness",
                        12
                    )
                )
            )
        );


    header[17] =
        hwBright & 0xFF;


    // --------------------------------------------------------
    // ハードウェア幅
    // --------------------------------------------------------

    header[18] =
        hw & 0xFF;


    header[19] =
        (hw >> 8) & 0xFF;


    return header;
}


// ============================================================
// ESP32へ転送
// ============================================================

async function transferToESP32() {

    const status =
        document.getElementById(
            "transferStatus"
        );


    const ipInput =
        document.getElementById(
            "esp32Ip"
        );


    const ip =
        ipInput
            ? ipInput.value.trim()
            : "192.168.4.1";


    if (!ip) {

        if (status) {
            status.textContent =
                "ESP32のIPアドレスを入力してください";
        }

        return;
    }


    // --------------------------------------------------------
    // 前の転送を停止
    // --------------------------------------------------------

    if (transferController) {
        transferController.abort();
    }


    transferController =
        new AbortController();


    try {

        if (status) {
            status.textContent =
                "データ作成中...";
        }


        const packet =
            createESP32Packet();


        if (
            !packet ||
            packet.length === 0
        ) {
            throw new Error(
                "表示シーンがありません"
            );
        }


        if (status) {
            status.textContent =
                `Wi-Fi転送中... (${packet.length} bytes)`;
        }


        console.log(
            "ESP32 packet:",
            packet.length,
            "bytes"
        );


        // ----------------------------------------------------
        // FormData
        // ----------------------------------------------------

        const formData =
            new FormData();


        formData.append(
            "file",
            new Blob(
                [packet],
                {
                    type:
                        "application/octet-stream"
                }
            ),
            "led.bin"
        );


        // ----------------------------------------------------
        // Wi-Fi POST
        // ----------------------------------------------------

        const response =
            await fetch(
                `http://${ip}/update`,
                {
                    method: "POST",
                    body: formData,
                    signal:
                        transferController.signal
                }
            );


        if (!response.ok) {

            throw new Error(
                `転送失敗: HTTP ${response.status}`
            );
        }


        let responseText = "";

        try {
            responseText =
                await response.text();
        } catch (e) {
            // 本文を取得できなくても
            // HTTP成功なら転送成功とする
        }


        console.log(
            "ESP32 response:",
            responseText
        );


        if (status) {
            status.textContent =
                "転送完了";
        }


    } catch (error) {

        if (
            error &&
            error.name === "AbortError"
        ) {

            console.log(
                "ESP32転送を中断しました"
            );

            return;
        }


        console.error(
            "ESP32転送エラー:",
            error
        );


        if (status) {

            status.textContent =
                "転送失敗: " +
                (
                    error?.message ||
                    "不明なエラー"
                );
        }

    } finally {

        transferController =
            null;
    }
}


// ============================================================
// GCD
// ============================================================

function gcd(a, b) {

    a = Math.abs(a);
    b = Math.abs(b);

    while (b !== 0) {

        const temp =
            a % b;

        a = b;
        b = temp;
    }

    return a;
}


// ============================================================
// LCM
// ============================================================

function lcm(a, b) {

    if (
        a === 0 ||
        b === 0
    ) {
        return 0;
    }

    return Math.abs(
        a / gcd(a, b) * b
    );
}
