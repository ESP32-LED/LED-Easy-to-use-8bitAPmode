const CACHE_NAME = "led-simulator-v1";


// ファイルをキャッシュする
async function cacheFile(cache, url) {
    try {
        const response = await fetch(url, {
            cache: "no-cache"
        });

        if (response.ok) {
            await cache.put(url, response.clone());
            console.log("キャッシュ:", url);
        } else {
            console.warn("取得失敗:", url, response.status);
        }
    } catch (error) {
        console.warn("キャッシュ失敗:", url, error);
    }
}


// index.htmlからJS・CSSなどを探す
async function cacheAppFiles(cache) {

    const indexUrl = "./index.html";

    const response = await fetch(indexUrl, {
        cache: "no-cache"
    });

    if (!response.ok) {
        throw new Error("index.htmlを取得できませんでした");
    }

    // index.html自身も保存
    await cache.put(indexUrl, response.clone());

    const html = await response.text();

    const files = new Set();

    // <script src="...">
    const scriptRegex =
        /<script[^>]+src=["']([^"']+)["']/gi;

    for (const match of html.matchAll(scriptRegex)) {
        files.add(match[1]);
    }

    // <link href="...">
    const linkRegex =
        /<link[^>]+href=["']([^"']+)["']/gi;

    for (const match of html.matchAll(linkRegex)) {
        const path = match[1];

        // 外部URLや#～などは除外
        if (
            !path.startsWith("http://") &&
            !path.startsWith("https://") &&
            !path.startsWith("data:") &&
            !path.startsWith("#")
        ) {
            files.add(path);
        }
    }

    // 見つかったファイルをキャッシュ
    for (const file of files) {
        await cacheFile(
            cache,
            new URL(file, indexUrl).pathname
        );
    }
}


// Service Workerのインストール
self.addEventListener("install", event => {

    event.waitUntil((async () => {

        const cache = await caches.open(CACHE_NAME);

        // =========================
        // ① アプリ本体
        // =========================

        await cacheAppFiles(cache);


        // =========================
        // ② vehicles.json
        // =========================

        const vehiclesUrl = "./vehicles/vehicles.json";

        await cacheFile(cache, vehiclesUrl);

        const response = await fetch(
            vehiclesUrl,
            {
                cache: "no-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "vehicles.jsonを取得できませんでした"
            );
        }

        const vehicles = await response.json();


        // =========================
        // ③ 車両ファイル
        // =========================

        const files = new Set();

        for (const vehicle of vehicles) {

            // config.json
            if (vehicle.config) {
                files.add(vehicle.config);
            }

            // led.json
            if (vehicle.led) {
                files.add(vehicle.led);
            }

            // site.json
            if (vehicle.site) {
                files.add(vehicle.site);
            }

            // font
            if (vehicle.font) {
                files.add(vehicle.font);
            }

            // icons
            if (Array.isArray(vehicle.icons)) {

                for (const icon of vehicle.icons) {
                    files.add(icon);
                }

            }
        }


        // =========================
        // ④ 全車両ファイルを保存
        // =========================

        for (const file of files) {

            await cacheFile(
                cache,
                "./" + file
            );

        }


        console.log(
            "アプリ本体・全車両ファイルのキャッシュ完了"
        );


        // 新しいService Workerをすぐ有効化
        await self.skipWaiting();

    })());

});


// Service Workerが有効になったとき
self.addEventListener("activate", event => {

    event.waitUntil((async () => {

        const cacheNames = await caches.keys();

        for (const cacheName of cacheNames) {

            if (
                cacheName.startsWith("led-simulator-") &&
                cacheName !== CACHE_NAME
            ) {
                await caches.delete(cacheName);
            }

        }

        await self.clients.claim();

    })());

});


// ファイルを取得するとき
self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith((async () => {

        // =========================
        // ① キャッシュを探す
        // =========================

        const cachedResponse =
            await caches.match(event.request);

        if (cachedResponse) {
            return cachedResponse;
        }


        // =========================
        // ② なければネットから取得
        // =========================

        try {

            const response =
                await fetch(event.request);


            // =========================
            // ③ 次回のために保存
            // =========================

            if (response.ok) {

                const cache =
                    await caches.open(CACHE_NAME);

                await cache.put(
                    event.request,
                    response.clone()
                );

            }

            return response;

        } catch (error) {

            // =========================
            // ④ オフラインでページを開く
            // =========================

            if (event.request.mode === "navigate") {

                const index =
                    await caches.match("./index.html");

                if (index) {
                    return index;
                }

            }

            throw error;

        }

    })());

});