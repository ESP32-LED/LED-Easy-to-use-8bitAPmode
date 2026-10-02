const CACHE_NAME = "led-simulator-v2.0.1";


// ========================================
// Service Worker インストール
// ========================================

self.addEventListener("install", event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);

            // index.html と JS / CSS / manifest
            await cacheAppFiles(cache);

            // vehicles.json
            const vehiclesUrl = new URL(
                "./vehicles/vehicles.json",
                self.location.href
            ).href;

            const response = await fetch(vehiclesUrl, {
                cache: "no-cache"
            });

            if (!response.ok) {
                throw new Error(
                    "vehicles.jsonを取得できませんでした"
                );
            }

            await cache.put(
                vehiclesUrl,
                response.clone()
            );

            const vehicles = await response.json();

            // 登録されている車両のファイルをキャッシュ
            await cacheVehicleFiles(
                cache,
                vehicles
            );

            console.log(
                "Service Workerのインストール完了"
            );

            // 新しいService Workerをすぐ有効化
            await self.skipWaiting();
        })()
    );
});


// ========================================
// Service Worker 有効化
// ========================================

self.addEventListener("activate", event => {
    event.waitUntil(
        (async () => {

            const cacheNames = await caches.keys();

            for (const cacheName of cacheNames) {

                // 現在のキャッシュ以外を削除
                if (
                    cacheName !== CACHE_NAME &&
                    (
                        cacheName.startsWith("led-simulator-") ||
                        cacheName.startsWith("old_led-simulator-")
                    )
                ) {
                    await caches.delete(cacheName);

                    console.log(
                        "古いキャッシュを削除:",
                        cacheName
                    );
                }
            }

            // 現在開いているページにも適用
            await self.clients.claim();

            console.log(
                "Service Workerの有効化完了"
            );
        })()
    );
});


// ========================================
// fetch
// ========================================

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);


    // ========================================
    // vehicles.json
    // ========================================
    //
    // vehicles.jsonだけはネットワーク優先
    //
    // オンライン
    //   ↓
    // 最新版を取得
    //
    // オフライン
    //   ↓
    // キャッシュを使用
    //
    // ========================================

    if (
        url.pathname.endsWith(
            "/vehicles/vehicles.json"
        )
    ) {
        event.respondWith(
            getVehiclesJson(event.request)
        );

        return;
    }


    // ========================================
    // その他のファイル
    // ========================================
    //
    // キャッシュ優先
    //
    // ========================================

    event.respondWith(
        getCachedFile(event.request)
    );
});


// ========================================
// vehicles.jsonを取得
// ========================================

async function getVehiclesJson(request) {

    try {

        // キャッシュを使わずネットから取得
        const response = await fetch(
            request,
            {
                cache: "no-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        // 最新版をキャッシュに保存
        const cache = await caches.open(
            CACHE_NAME
        );

        await cache.put(
            request,
            response.clone()
        );

        console.log(
            "最新のvehicles.jsonを取得しました"
        );

        return response;

    } catch (error) {

        console.warn(
            "vehicles.jsonをネットから取得できません。キャッシュを使用します。",
            error
        );

        // オフラインならキャッシュ
        const cached = await caches.match(
            request
        );

        if (cached) {
            return cached;
        }

        throw error;
    }
}


// ========================================
// 通常ファイルを取得
// ========================================

async function getCachedFile(request) {

    // まずキャッシュを確認
    const cached = await caches.match(
        request
    );

    if (cached) {
        return cached;
    }


    // キャッシュに無ければネットから取得
    try {

        const response = await fetch(
            request
        );

        if (response.ok) {

            const cache = await caches.open(
                CACHE_NAME
            );

            await cache.put(
                request,
                response.clone()
            );
        }

        return response;

    } catch (error) {

        // オフラインでページを開いた場合
        if (
            request.mode === "navigate"
        ) {

            const indexUrl = new URL(
                "./index.html",
                self.location.href
            ).href;

            const index = await caches.match(
                indexUrl
            );

            if (index) {
                return index;
            }
        }

        throw error;
    }
}


// ========================================
// index.htmlから
// JS / CSS / manifestなどを探してキャッシュ
// ========================================

async function cacheAppFiles(cache) {

    const indexUrl = new URL(
        "./index.html",
        self.location.href
    ).href;

    const response = await fetch(
        indexUrl,
        {
            cache: "no-cache"
        }
    );

    if (!response.ok) {
        throw new Error(
            "index.htmlを取得できませんでした"
        );
    }

    // index.htmlを保存
    await cache.put(
        indexUrl,
        response.clone()
    );

    const html = await response.text();

    const files = new Set();


    // ========================================
    // script
    // ========================================

    const scriptRegex =
        /<script[^>]+src=["']([^"']+)["']/gi;

    for (const match of html.matchAll(
        scriptRegex
    )) {
        files.add(match[1]);
    }


    // ========================================
    // link
    // ========================================

    const linkRegex =
        /<link[^>]+href=["']([^"']+)["']/gi;

    for (const match of html.matchAll(
        linkRegex
    )) {

        const path = match[1];

        if (
            !path.startsWith("http://") &&
            !path.startsWith("https://") &&
            !path.startsWith("data:") &&
            !path.startsWith("#")
        ) {
            files.add(path);
        }
    }


    // ========================================
    // キャッシュ
    // ========================================

    for (const file of files) {

        const fileUrl = new URL(
            file,
            indexUrl
        ).href;

        await cacheFile(
            cache,
            fileUrl
        );
    }
}


// ========================================
// vehicles.jsonに登録されている
// 全車両のファイルをキャッシュ
// ========================================

async function cacheVehicleFiles(
    cache,
    vehicles
) {

    const files = new Set();

    for (const vehicle of vehicles) {

        if (vehicle.config) {
            files.add(vehicle.config);
        }

        if (vehicle.led) {
            files.add(vehicle.led);
        }

        if (vehicle.site) {
            files.add(vehicle.site);
        }

        if (vehicle.font) {
            files.add(vehicle.font);
        }

        if (Array.isArray(vehicle.icons)) {

            for (const icon of vehicle.icons) {
                files.add(icon);
            }
        }
    }


    // ========================================
    // 各ファイルをキャッシュ
    // ========================================

    for (const file of files) {

        const fileUrl = new URL(
            "./" + file,
            self.location.href
        ).href;

        await cacheFile(
            cache,
            fileUrl
        );
    }
}


// ========================================
// ファイルを取得してキャッシュ
// ========================================

async function cacheFile(
    cache,
    url
) {

    try {

        const response = await fetch(
            url,
            {
                cache: "no-cache"
            }
        );

        if (!response.ok) {

            console.warn(
                "ファイル取得失敗:",
                url,
                response.status
            );

            return;
        }

        await cache.put(
            url,
            response.clone()
        );

        console.log(
            "キャッシュ:",
            url
        );

    } catch (error) {

        console.warn(
            "ファイルのキャッシュ失敗:",
            url,
            error
        );
    }
}
