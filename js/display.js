function drawCarNumber(carNumber, matrix) {

    if (!carNumber) return;

    let usedNormal = true;
    let destinationWidth;

    const view = isCarNumberFullScreen(carNumber)
        ? "full"
        : "normal";

    const data =
        carNumber.view?.[view]?.[lang]
        ?? carNumber.view?.[view]?.ja
        ?? carNumber.view?.normal?.[lang]
        ?? carNumber.view?.normal?.ja;

    if (!data) return;

    const type = getItem("type", typeId);
    const dest = getItem("destination", destinationId);

    if (config.hasCarNumberFull) {
        destinationWidth = 0;
    }
    if (config.hasCarNumberSmall) {
        destinationWidth =
            config.carNumber === "right"
                ? getDestinationWidth(type, dest, usedNormal)
                : 0;
    }
    if (config.hasCarNumberNormal) {
        destinationWidth = getTypeWidth(type, usedNormal);
    }
    drawImage(data, destinationWidth, 0, matrix);
}

function drawType(type, matrix) {
    let usedNormal = true;
    let carNumberWidth;
    let typeLang = lang;
    if (typeMode === "information") {
        typeLang = "information";
    }

    const view = isTypeFullScreen(type)
        ? "full"
        : "normal";

    let data = null;
    
    if (config.languageSwitching) {
        data =
            type.view?.[view]?.[typeLang]
            ?? type.view?.[view]?.ja
            ?? type.view?.normal?.[typeLang]
            ?? type.view?.normal?.ja;
    } else {
        if (nextId != null || scrollId != null) {
            data =
                type.view?.[view]?.[typeLang]
                ?? type.view?.[view]?.ja
                ?? type.view?.normal?.[typeLang]
                ?? type.view?.normal?.ja;
        } else {
            data =
                type.view?.[view]?.ja_en
                ?? type.view?.[view]?.[typeLang]
                ?? type.view?.[view]?.ja
                ?? type.view?.normal?.ja_en
                ?? type.view?.normal?.[typeLang]
                ?? type.view?.normal?.ja
        }
    }

    const carNumber = getItem("carNumber", carNumberId)
    
    if (config.hasCarNumberSmall) {
        carNumberWidth = getCarNumberWidth(carNumber, usedNormal)
    } else {
        carNumberWidth = 0;
    }

    if (!data) return;

    drawImage(data, carNumberWidth, 0, matrix);
}

function drawTypeSmall(type, matrix) {

    let usedNormal = true;
    let carNumberWidth;
    let typeLang = lang;
    if (typeMode === "information") {
        typeLang = "information";
    }

    const view = isTypeFullScreen(type)
        ? "full"
        : "normal";

    let data =
        type.view?.[view]?.[lang]
        ?? type.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            type.view?.normal?.[lang]
            ?? type.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;

    const carNumber = getItem("carNumber", carNumberId)
    if (usedNormal) {
        carNumberWidth = getCarNumberWidth(carNumber, usedNormal);
    } else {
        carNumberWidth = 0;
    }

    drawImage(data, carNumberWidth, 0, matrix);
}

function drawDestination(dest, matrix) {

    let usedNormal = false;
    let typewidth;

    const view = isDestinationFullScreen(dest)
        ? "full"
        : "normal";

    let data =
        dest.view?.[view]?.[lang]
        ?? dest.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            dest.view?.normal?.[lang]
            ?? dest.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;

    const type = getItem("type", typeId);
    const carNumber = getItem("carNumber", carNumberId);
    let yOffset;
    
    if (usedNormal) {
        if (config.destinationPosition === "normal") {
            typewidth = getTypeWidth(type, usedNormal);
        }
        if (config.destinationPosition === "next") {
            typewidth = getCarNumberWidth(carNumber, usedNormal);
        }
    } else {
        typewidth = 0;
    }
    if (config.destinationPosition === "next") {
        yOffset = config.nextPosition;
    } else {
        yOffset = 0;
    }

    drawImage(data, typewidth, yOffset, matrix);
}

function drawDestinationSmall(dest, matrix) {

    let usedSmall = false;
    let typewidth;

    const view = isDestinationFullScreen(dest)
        ? "full_small"
        : "small";

    let data =
        dest.view?.[view]?.[lang]
        ?? dest.view?.[view]?.ja;
        if (view === "small") {
            usedSmall = true;
        }

    if (!data) {
        data =
            dest.view?.small?.[lang]
            ?? dest.view?.small?.ja;
        usedSmall = true;
    }

    if (!data) return;

    const type = getItem("type", typeId)
    if (usedSmall) {
        typewidth = getTypeWidth(type, usedSmall);
    } else {
        typewidth = 0;
    }

    drawImage(data, typewidth, 0, matrix);
}

function drawInformation(info, matrix) {

    let usedNormal = false;
    let typewidth;

    let view = isInformationFullScreen(info)
        ? "full"
        : "normal";
    const dest = getItem("destination", destinationId);
    if (isDestinationFullScreen(dest)) {
        view = "full";
    }

    let data =
        info.view?.[view]?.[lang]
        ?? info.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            info.view?.normal?.[lang]
            ?? info.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;

    const type = getItem("type", typeId)
    if (usedNormal) {
        typewidth = getTypeWidth(type, usedNormal);
    } else {
        typewidth = 0;
    }
    let yOffset;
    const nextPosition = config.nextPosition;
    if (config.informationPosition === "next") {
        const info = getItem("information", informationId);
        if (!isInformationFullScreen(info)) {
            yOffset = nextPosition;
        } else {
            yOffset = 0;
        }
    } else {
        yOffset = 0;
    }

    drawImage(data, typewidth, yOffset, matrix);
}

function drawInformation2(info2, matrix) {

    let usedNormal = false;
    let typewidth;

    let view = isInformation2FullScreen(info2)
        ? "full"
        : "normal";
    const dest = getItem("destination", destinationId);
    if (isDestinationFullScreen(dest)) {
        view = "full";
    }

    let data =
        info2.view?.[view]?.[lang]
        ?? info2.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            info2.view?.normal?.[lang]
            ?? info2.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;

    const type = getItem("type", typeId)
    if (usedNormal) {
        typewidth = getTypeWidth(type, usedNormal);
    } else {
        typewidth = 0;
    }
    let yOffset;
    const nextPosition = config.nextPosition;
    if (config.informationPosition === "next") {
        const info = getItem("information2", information2Id);
        if (!isInformation2FullScreen(info)) {
            yOffset = nextPosition;
        } else {
            yOffset = 0;
        }
    } else {
        yOffset = 0;
    }

    drawImage(data, typewidth, yOffset, matrix);
}

function drawLine(info, matrix) {

    let usedNormal = false;
    let typewidth;

    const view = isLineFullScreen(info)
        ? "full"
        : "normal";

    let data =
        info.view?.[view]?.[lang]
        ?? info.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            info.view?.normal?.[lang]
            ?? info.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;

    const type = getItem("type", typeId)
    if (usedNormal) {
        typewidth = getTypeWidth(type, usedNormal);
    } else {
        typewidth = 0;
    }

    drawImage(data, typewidth, 0, matrix);
}

function drawInformationSmall(info, matrix) {

    let usedSmall = false;
    let typewidth;

    const view = isInformationFullScreen(info)
        ? "full_small"
        : "small";

    let data =
        info.view?.[view]?.[lang]
        ?? info.view?.[view]?.ja;
        if (view === "small" || view === "small1" || view === "small2") {
            usedSmall = true;
        }

    if (!data) {
        data =
            info.view?.small?.[lang]
            ?? info.view?.small?.ja;
        usedSmall = true;
    }

    if (!data) return;
    const type = getItem("type", typeId)
    if (usedSmall) {
        typewidth = getTypeWidth(type, usedSmall);
    } else {
        typewidth = 0;
    }
    drawImage(data, typewidth, 0, matrix);
}

function drawNext(next, matrix) {

    let usedNormal = false;
    let typewidth;

    const view = isNextFullScreen(next)
        ? "full"
        : "normal"

    let data =
        next?.view?.[view]?.[lang]
        ?? next?.view?.[view]?.ja;
        if (view === "normal") {
            usedNormal = true;
        }

    if (!data) {
        data =
            next?.view?.normal?.[lang]
            ?? next?.view?.normal?.ja;
        usedNormal = true;
    }

    if (!data) return;
    const type = getItem("type", typeId)
    if (usedNormal) {
        typewidth = getTypeWidth(type, usedNormal);
    } else {
        typewidth = 0;
    }
    const nextPosition = config.nextPosition

    drawImage(data, typewidth, nextPosition, matrix);
}

function getTypeWidth(type, used) {

    if(!type) {
        if(used) {
            if (config.hasCarNumber) {
                let data = getItem("type", "null_type").view.normal.ja.width
                const carNumber = getItem("carNumber", carNumberId)
                return (
                    data + getCarNumberWidth(carNumber, true)
                )

            } else {
                return (
                    getItem("type", "null_type").view.normal.ja.width
                );
            }
        } else {
            return 0;
        }
    }

    const view = isTypeFullScreen(type)
        ? "full"
        : "normal";

    const lang = getLangForPart();

    if (config.hasCarNumber) {
        let data =
            type.view?.[view]?.[lang]?.width
            ?? type.view?.[view]?.ja?.width
            ?? 0
        const carNumber = getItem("carNumber", carNumberId)
        return (
            data + getCarNumberWidth(carNumber, true)
        )

    } else {

        return (
            type.view?.[view]?.[lang]?.width
            ?? type.view?.[view]?.ja?.width
            ?? 0
        );
    }
}

function getDestinationWidth(type, dest, used) {
    let typeData;
    let destData;

    if(!type) {
        if(used) {
            typeData =
                getItem("type", "null_type").view.normal.ja.width;
        } else {
            typeData = 0
        }
    }

    const typeView = isTypeFullScreen(type)
        ? "full"
        : "normal";

    const typeLang = getLangForPart();

    let data;

    if (config.hasCarNumber) {
        if (config.carNumber === "left") {
            if(type != null) {
                data =
                    type.view?.[typeView]?.[typeLang]?.width
                    ?? type.view?.[typeView]?.ja?.width
                    ?? 0
            } else {
                data = typeData
            }
            const carNumber = getItem("carNumber", carNumberId)
            typeData =
                data + getCarNumberWidth(carNumber, true);
        } else {
            if(type != null) {
                typeData =
                    type.view?.[typeView]?.[typeLang]?.width
                    ?? type.view?.[typeView]?.ja?.width
                    ?? 0
            }
        }

    } else {

        if(type != null) {
            typeData =
                type.view?.[typeView]?.[typeLang]?.width
                ?? type.view?.[typeView]?.ja?.width
                ?? 0
        }
    }
    if(!dest) {
        if(used) {
            destData =
                getItem("destination", "null_destination").view.normal.ja.width;
        } else {
            destData = 0
        }
    }
    const destView = isDestinationFullScreen(dest)
        ? "full"
        : "normal";

    const destLang = getLangForPart();

    if (dest != null) {
        destData =
            dest.view?.[destView]?.[destLang]?.width
            ?? dest.view?.[destView]?.ja?.width
            ?? 0
    }
    if (typeView === "full") {
        destData = 0
    }

    return (
        typeData + destData
    )
}

function getCarNumberWidth(carNumber, used) {

    if(!carNumber) {
        if(used) {
            if (config.carNumber === "left") {
                return (
                    getItem("carNumber", "null_carNumber").view.normal.ja.width
                )
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    const view = isCarNumberFullScreen(carNumber)
        ? "full"
        : "normal";

    const lang = getLangForPart();

    if (config.carNumber === "left") {
        return (
            carNumber.view?.[view]?.[lang]?.width
            ?? carNumber.view?.[view]?.ja?.width
            ?? 0
        );
    } else {
        return 0;
    }
}

function isTypeFullScreen(type) {

    if(!type) return false;

    const hasNormal = !!type.view.normal;
    const hasFull = !!type.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(destinationId===null && nextId===null){
        if (hasFull) {
            return true;
        }
    }

    return false;
}

function isCarNumberFullScreen(carNumber) {

    if(!carNumber) return false;

    const hasNormal = !!carNumber.view.normal;
    const hasFull = !!carNumber.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(config.carNumberFull){
        return true;
    }

    return false;
}

function isDestinationFullScreen(dest) {

    if(!dest) return false;

    const hasNormal = !!dest.view.normal;
    const hasFull = !!dest.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(typeId===null){
        if(hasFull) {
            return true;
        }
    }

    return false;
}

function isInformationFullScreen(info) {

    if(!info) return false;

    const hasNormal = !!info.view.normal;
    const hasFull = !!info.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(typeId===null){
        if(hasFull) {
            return true;
        }
    }

    return false;
}

function isInformation2FullScreen(info2) {

    if(!info2) return false;

    const hasNormal = !!info2.view.normal;
    const hasFull = !!info2.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(typeId===null){
        if(hasFull) {
            return true;
        }
    }

    return false;
}

function isLineFullScreen(info) {

    if(!info) return false;

    const hasNormal = !!info.view.normal;
    const hasFull = !!info.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(typeId===null){
        return true;
    }

    return false;
}

function isNextFullScreen(next) {

    if(!next) return false;

    const hasNormal = !!next.view.normal;
    const hasFull = !!next.view.full;

    if(hasFull && !hasNormal){
        return true;
    }

    if(typeId===null){
        return true;
    }

    return false;
}

function getLangForPart() {
    return lang;
}

function hasEnglishType() {
    const type = getItem("type", typeId);
    if (!type) return;
    return !!type.view?.normal?.en
        || !!type.view?.full?.en;
}

function hasEnglishDestination() {
    const dest = getItem("destination", destinationId);
    if (!dest) return;
    return !!dest.view?.normal?.en
        || !!dest.view?.full?.en
        || !!dest.view?.small?.en
        || !!dest.view?.full_small?.en;
}

function hasEnglishInformation() {
    const info = getItem("information", informationId);
    if (!info) return;
    return !!info.view?.normal?.en
        || !!info.view?.full?.en
        || !!info.view?.small?.en;
}

function hasInformationDestination() {
    const dest = getItem("destination", destinationId);
    if(!dest) return;
    return !!dest.view?.normal?.info
        || !!dest.view?.full?.info
        || !!dest.view?.small?.info
        || !!dest.view?.full_small?.info;
}

function hasEnglishCarNumber() {
    const carNumber = getItem("carNumber", carNumberId);
    if (!carNumber) return;
    return !!carNumber.view?.normal?.en
        || !!carNumber.view?.full?.en;
}

function hasTypeInformation() {
    const type = getItem("type", typeId);
    if (!type) return;
    return !!type.view?.normal?.information
        || !!type.view?.full?.information;
}
 
function textToMatrix16(char) {
    const data = fontData[char];

    // 登録されていない文字 → 16×16の全消灯
    if (!data) {
        return Array.from({ length: 16 }, () =>
            Array(16).fill(false)
        );
    }

    const matrix = [];

    for (let y = 0; y < 16; y++) {
        matrix.push(
            data
                .slice(y * 16, y * 16 + 16)
                .map(value => value === 1)
        );
    }

    return matrix;
}
 
let previousScrollDots = [];

function createScrollMatrix() {
    scrollTextMatrix = [];
    previousScrollDots = [];

    const text = scrollText.value;

    // 各文字を16×16に変換
    for (const char of text) {
        scrollTextMatrix.push(textToMatrix16(char));
    }

    // 文字全体の幅
    scrollTextWidth = scrollTextMatrix.length * 16;

    /*
     * スクロール文字専用Canvas
     *
     * 横幅 = 文字全体
     * 縦幅 = 16行分
     */
    scrollTextCanvas.width = scrollTextWidth * pitch;
    scrollTextCanvas.height = 16 * pitch;

    // 一旦透明にする
    scrollTextCtx.clearRect(
        0,
        0,
        scrollTextCanvas.width,
        scrollTextCanvas.height
    );

    /*
     * 文字をCanvasへ一度だけ描画
     */
    for (let charIndex = 0; charIndex < scrollTextMatrix.length; charIndex++) {
        const charMatrix = scrollTextMatrix[charIndex];

        const charX = charIndex * 16;

        for (let py = 0; py < 16; py++) {
            for (let px = 0; px < 16; px++) {

                if (!charMatrix[py][px]) {
                    continue;
                }

                const x = charX + px;
                const y = py;

                drawLEDCircle(scrollTextCtx, x, y, {
                    r: 255,
                    g: 242,
                    b: 0
                });
            }
        }
    }
}
 
function drawScroll() {
    if (
        !scrollCheck.checked ||
        clickStartScrollBtn === false ||
        scrollId === null
    ) {
        clearInterval(scrollTimer);
        scrollTimer = null;
        return;
    }

    /*
     * Canvas上でのスクロール領域
     */
    const areaPixelLeft = areaLeft * pitch;
    const areaPixelTop = areaTop * pitch;
    const areaPixelWidth = (areaRight - areaLeft) * pitch;
    const areaPixelHeight = (areaBottom - areaTop) * pitch;


    /*
     * まずスクロール領域だけ
     * 元の通常表示に戻す
     *
     * これで前の文字の残像が消える
     */
    ctx.drawImage(
        cacheCanvas,

        areaPixelLeft,
        areaPixelTop,
        areaPixelWidth,
        areaPixelHeight,

        areaPixelLeft,
        areaPixelTop,
        areaPixelWidth,
        areaPixelHeight
    );


    /*
     * スクロール領域から
     * はみ出さないようにクリップ
     */
    ctx.save();

    ctx.beginPath();

    ctx.rect(
        areaPixelLeft,
        areaPixelTop,
        areaPixelWidth,
        areaPixelHeight
    );

    ctx.clip();


    /*
     * 完成済みの文字画像を表示
     *
     * scrollX はLED単位
     */
    ctx.drawImage(
        scrollTextCanvas,
        scrollX * pitch,
        areaPixelTop
    );


    ctx.restore();


    /*
     * 1LED分左へ
     */
    scrollX--;


    /*
     * 全部左へ消えたら
     * 右端から再スタート
     */
    if (scrollX * pitch + scrollTextWidth * pitch < areaPixelLeft) {
        scrollX = areaRight;
    }
}
 
function startScroll() {
    scrollId = true;
    startRenderLoop();
    const scrollCheck = document.getElementById("scrollCheck");

    if (!scrollCheck.checked || clickStartScrollBtn === false) {
        stopScroll();
        return;
    }

    const type = getItem(typeId, "type");

    if (isTypeFullScreen(type)) {
        return;
    }

    // 古いスクロールを無効化
    scrollGeneration++;

    const generation = scrollGeneration;

    // 念のため現在のタイマーも停止
    if (scrollTimer !== null) {
        clearInterval(scrollTimer);
        scrollTimer = null;
    }

    createScrollMatrix();

    scrollX = areaRight;

    scrollTimer = setInterval(() => {
        // 古い世代のタイマーなら何もしない
        if (generation !== scrollGeneration) {
            return;
        }

        drawScroll();
    }, 20);
}

function stopScroll() {
    // 現在までのスクロールを全部「古い世代」にする
    scrollGeneration++;

    if (scrollTimer !== null) {
        clearInterval(scrollTimer);
        scrollTimer = null;
    }

    scrollId = null;
    clickStartScrollBtn = false;
}