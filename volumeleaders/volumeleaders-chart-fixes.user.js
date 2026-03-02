// ==UserScript==
// @name         VolumeLeaders Chart Fixes
// @namespace    https://volumeleaders.com/
// @version      2.0.0
// @description  Auto-selects Volume-Based bubble sizing and fixes the Trade Levels X-axis corruption bug
// @author       major
// @match        https://www.volumeleaders.com/Chart0*
// @match        https://volumeleaders.com/Chart0*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    const POLL_INTERVAL_MS = 500;
    const MAX_WAIT_MS = 30_000;

    /**
     * The site's `plotTradeLevels` (called by `UpdateChart`) fires ~5 times
     * asynchronously via promise chains over ~2.5s after a bubble sizing
     * toggle. Each invocation uses `xAxis.toValue()` to recalculate Trade
     * Levels X endpoints, producing fractional millisecond timestamps that
     * extend beyond the actual data range. Because each iteration feeds on
     * the corrupted axis from the previous one, the drift compounds.
     *
     * The fix: monkey-patch `setData` on the Trade Levels series so every
     * call from `plotTradeLevels` gets sanitized X coordinates (clean integer
     * timestamps from the candlestick data boundaries). After the async
     * settling window, we also reset xAxis[0] extremes from the navigator
     * axis (xAxis[2]) which is on a separate axis and unaffected by Trade
     * Levels corruption.
     */

    /**
     * Wait for the Highcharts chart to be fully loaded with candlestick data.
     * Resolves with the first chart instance that has populated OHLC series.
     */
    const waitForChart = () => new Promise((resolve, reject) => {
        const deadline = Date.now() + MAX_WAIT_MS;

        const check = () => {
            if (Date.now() > deadline) {
                reject(new Error("[VL Fixes] Timed out waiting for Highcharts chart"));
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

    /**
     * Get the X-axis data range from the candlestick (OHLC) series.
     * This is the untainted source of truth for the chart's time boundaries.
     */
    const getCandlestickRange = (chart) => {
        const ohlc = chart.series.find(s => s.type === "candlestick");
        if (!ohlc?.options?.data?.length) return null;

        const xValues = ohlc.options.data.map(d => d[0] ?? d.x);
        return { min: xValues[0], max: xValues.at(-1) };
    };

    /**
     * Monkey-patch the Trade Levels series' `setData` method to intercept
     * incoming corrupted data and replace X coordinates with clean timestamps
     * from the candlestick data boundaries. The Y values (price levels) are
     * preserved as-is since the site calculates those correctly.
     *
     * This patch runs transparently: the site's `plotTradeLevels` function
     * has no idea its output is being sanitized.
     */
    const patchTradeLevelsSetData = (chart, range) => {
        const tradeLevels = chart.series.find(s => s.name === "Trade Levels");
        if (!tradeLevels) return;

        const originalSetData = tradeLevels.setData;

        tradeLevels.setData = function (data, ...rest) {
            if (!data?.length) {
                return originalSetData.call(this, data, ...rest);
            }

            // Extract unique Y prices, rebuild data with clean X boundaries
            const uniquePrices = [...new Set(data.map(d => d.y ?? d[1]))];
            const sanitized = uniquePrices.flatMap(price => [
                { x: range.min, y: price },
                { x: range.max, y: price },
            ]);

            return originalSetData.call(this, sanitized, ...rest);
        };
    };

    /**
     * Reset the primary X-axis extremes using the navigator axis (xAxis[2]),
     * which is on a separate axis and unaffected by Trade Levels corruption.
     *
     * Called on a delay to let the site's async `UpdateChart` promise chain
     * (which fires `plotTradeLevels` ~5 times over ~2.5s) finish settling.
     */
    const SETTLE_DELAY_MS = 3_500;

    const scheduleAxisReset = (chart) => {
        setTimeout(() => {
            const navAxis = chart.xAxis.find((_, i) => i === 2) ?? chart.xAxis.at(-1);
            if (navAxis?.dataMin != null && navAxis?.dataMax != null) {
                chart.xAxis[0].setExtremes(navAxis.dataMin, navAxis.dataMax, true, false);
            }
        }, SETTLE_DELAY_MS);
    };

    /**
     * Select the Volume-Based radio button. The monkey-patched `setData`
     * handles the corruption automatically for all subsequent async calls.
     */
    const selectVolumeBased = (chart) => {
        const volumeRadio = document.querySelector(
            'input[type="radio"][value="volume"]'
        );

        if (!volumeRadio || volumeRadio.checked) return;

        volumeRadio.click();
        scheduleAxisReset(chart);

        console.log("[VL Fixes] Volume-Based selected; axis reset scheduled");
    };

    /**
     * Observe future bubble sizing toggles. The monkey-patch handles data
     * sanitization; we just need to schedule an axis reset after each toggle
     * so the extremes settle correctly once the site's async chain finishes.
     */
    const observeBubbleToggles = (chart) => {
        const container = document.querySelector(
            'input[type="radio"][value="volume"]'
        )?.closest("div");

        if (!container) return;

        container.addEventListener("change", (e) => {
            if (e.target?.type !== "radio") return;
            scheduleAxisReset(chart);
            console.log("[VL Fixes] Bubble sizing toggled; axis reset scheduled");
        });
    };

    // --- Main ---

    waitForChart()
        .then((chart) => {
            const range = getCandlestickRange(chart);
            if (!range) {
                console.warn("[VL Fixes] Could not determine candlestick data range");
                return;
            }

            patchTradeLevelsSetData(chart, range);
            selectVolumeBased(chart);
            observeBubbleToggles(chart);
        })
        .catch((err) => console.error(err.message));
})();
