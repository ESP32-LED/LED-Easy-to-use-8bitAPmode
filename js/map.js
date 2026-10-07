const vehicleSelectMethod = document.getElementById("vehicleSelectMethod");
const vehicleSelect = document.getElementById("vehicleSelect");
const mapElement = document.getElementById("map");

let railwayMap = null;


// 地図を作成
function createMap() {

    if (railwayMap !== null) {
        return;
    }

    railwayMap = L.map("map").setView([36.2, 138.25], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(railwayMap);
}


// 車両選択方法を変更
vehicleSelectMethod.addEventListener("change", () => {

    if (vehicleSelectMethod.value === "grid") {

        // リストを隠す
        vehicleSelect.hidden = true;

        // 地図を表示
        mapElement.hidden = false;

        // 地図を作成
        createMap();

        // hidden状態から表示した直後のサイズをLeafletに再計算させる
        setTimeout(() => {
            railwayMap.invalidateSize();
        }, 100);

    } else {

        // 地図を隠す
        mapElement.hidden = true;

        // リストを表示
        vehicleSelect.hidden = false;
    }

});