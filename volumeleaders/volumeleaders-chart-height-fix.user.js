// ==UserScript==
// @name         VolumeLeaders Chart Height Fix
// @namespace    https://volumeleaders.com/
// @version      1.1.0
// @description  Fixes chart not filling its container on page load
// @author       major
// @match        https://www.volumeleaders.com/Chart0*
// @match        https://volumeleaders.com/Chart0*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    /**
     * The site stores the user's preferred container height in
     * `localStorage.chartHeight` (e.g. "895px") and applies it to
     * `#OHLCContainer`. But Highcharts reads its initial height from
     * `localStorage.chartConfig`, which always has a stale "550px".
     * The site's async `UpdateChart` promise chain also re-applies
     * this stale height over ~2.5s after load.
     *
     * Fix strategy:
     * 1. At document-start: patch `chartConfig` in localStorage so
     *    the site's own init code reads the correct height.
     * 2. After the async UpdateChart settles: call `setSize()` as a
     *    fallback in case the site overwrote it during its init.
     */

    const syncChartConfigHeight = () => {
        const chartHeight = localStorage.getItem("chartHeight");
        if (!chartHeight) return;

        try {
            const config = JSON.parse(localStorage.getItem("chartConfig") || "{}");
            if (config.chart?.height !== chartHeight) {
                config.chart ??= {};
                config.chart.height = chartHeight;
                localStorage.setItem("chartConfig", JSON.stringify(config));
            }
        } catch { /* corrupt chartConfig, ignore */ }
    };

    // Phase 1: fix localStorage before the site reads it
    syncChartConfigHeight();

    // Phase 2: after chart loads and async UpdateChart settles, force setSize
    const POLL_INTERVAL_MS = 500;
    const MAX_WAIT_MS = 30_000;
    const SETTLE_DELAY_MS = 3_500;

    const waitForChart = () => new Promise((resolve, reject) => {
        const deadline = Date.now() + MAX_WAIT_MS;

        const check = () => {
            if (Date.now() > deadline) {
                reject(new Error("[VL Height Fix] Timed out waiting for chart"));
                return;
            }

            const chart = globalThis.Highcharts?.charts?.find(c => c?.series?.length > 0);
            const hasCandlestick = chart?.series.some(
                s => s.type === "candlestick" && s.options?.data?.length > 0
            );

            if (chart && hasCandlestick) {
                resolve(chart);
            } else {
                setTimeout(check, POLL_INTERVAL_MS);
            }
        };

        check();
    });

    waitForChart()
        .then((chart) => {
            setTimeout(() => {
                const container = document.getElementById("OHLCContainer");
                if (!container) return;

                chart.setSize(null, container.clientHeight, false);
                console.log("[VL Height Fix] Chart resized to match container");
            }, SETTLE_DELAY_MS);
        })
        .catch((err) => console.error(err.message));
})();
