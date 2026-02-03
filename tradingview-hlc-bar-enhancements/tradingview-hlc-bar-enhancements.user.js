// ==UserScript==
// @name         TradingView HLC Bar Enhancements
// @namespace    https://github.com/major/tradingview-thicker-bars
// @version      4.0.0
// @description  Enhance HLC bars: adjustable thickness and StockCharts-style close ticks on both sides
// @author       major
// @match        https://www.tradingview.com/chart/*
// @match        https://www.tradingview.com/chart
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = 'TradingView HLC Bar Enhancements';
    const LOG_PREFIX = `[${SCRIPT_NAME}]`;

    // Default settings
    const DEFAULT_MIN_BAR_WIDTH = 3;
    const DEFAULT_MAX_BAR_WIDTH = 0;
    const DEFAULT_DOUBLE_CLOSE_TICK = true;

    // Load settings
    let minBarWidth = GM_getValue('minBarWidth', DEFAULT_MIN_BAR_WIDTH);
    let maxBarWidth = GM_getValue('maxBarWidth', DEFAULT_MAX_BAR_WIDTH);
    let doubleCloseTick = GM_getValue('doubleCloseTick', DEFAULT_DOUBLE_CLOSE_TICK);

    // Menu commands
    GM_registerMenuCommand('Set minimum bar width', () => {
        const input = prompt(
            'Enter MINIMUM bar width in pixels.\n\n' +
            'Prevents bars from getting too thin when zoomed out.\n' +
            'Recommended: 2-4 pixels\n\n' +
            'Current value: ' + minBarWidth,
            minBarWidth
        );

        if (input !== null) {
            const value = parseFloat(input);
            if (!isNaN(value) && value >= 1 && value <= 20) {
                minBarWidth = value;
                GM_setValue('minBarWidth', value);
                console.log(LOG_PREFIX, 'Min bar width set to', value, 'px');
            } else {
                alert('Invalid value. Please enter a number between 1 and 20.');
            }
        }
    });

    GM_registerMenuCommand('Set maximum bar width', () => {
        const input = prompt(
            'Enter MAXIMUM bar width in pixels.\n\n' +
            'Prevents bars from getting too fat when zoomed in.\n' +
            'Set to 0 for no maximum (default TradingView behavior).\n' +
            'Recommended: 8-12 pixels, or 0 to disable\n\n' +
            'Current value: ' + maxBarWidth,
            maxBarWidth
        );

        if (input !== null) {
            const value = parseFloat(input);
            if (!isNaN(value) && value >= 0 && value <= 50) {
                maxBarWidth = value;
                GM_setValue('maxBarWidth', value);
                console.log(LOG_PREFIX, 'Max bar width set to', value === 0 ? 'unlimited' : value + 'px');
            } else {
                alert('Invalid value. Please enter a number between 0 and 50.');
            }
        }
    });

    GM_registerMenuCommand('Toggle double-sided close tick', () => {
        doubleCloseTick = !doubleCloseTick;
        GM_setValue('doubleCloseTick', doubleCloseTick);
        const status = doubleCloseTick ? 'ON (StockCharts style)' : 'OFF (TradingView default)';
        console.log(LOG_PREFIX, 'Double-sided close tick:', status);
        alert('Double-sided close tick: ' + status + '\n\nRefresh the chart to apply changes.');
    });

    function getBarRenderer() {
        try {
            const collection = unsafeWindow._exposed_chartWidgetCollection;
            if (!collection) return null;

            const activeWidget = collection.activeChartWidget;
            if (!activeWidget) return null;

            const widget = activeWidget._value || activeWidget;
            if (!widget) return null;

            const mainSeries = widget.model().mainSeries();
            if (!mainSeries) return null;

            const paneView = mainSeries._paneView;
            if (!paneView) return null;

            const renderer = paneView.renderer();
            if (!renderer || !renderer._renderers || !renderer._renderers[0]) return null;

            return renderer._renderers[0];
        } catch (e) {
            return null;
        }
    }

    function applyPatches() {
        const barRenderer = getBarRenderer();
        if (!barRenderer) return false;

        const proto = Object.getPrototypeOf(barRenderer);

        if (proto._hlcEnhancementsPatchApplied) {
            return true;
        }

        // Patch 1: Bar width calculation (min/max enforcement)
        const originalCalcWidth = proto._calcRealBarWidth;
        if (!originalCalcWidth) {
            console.log(LOG_PREFIX, '_calcRealBarWidth not found');
            return false;
        }

        proto._calcRealBarWidth = function(t, e) {
            let result = originalCalcWidth.call(this, t, e);
            result = Math.max(result, minBarWidth);
            if (maxBarWidth > 0) {
                result = Math.min(result, maxBarWidth);
            }
            return result;
        };

        // Patch 2: Double-sided close tick (StockCharts style)
        const originalDrawImpl = proto._drawImpl;
        if (!originalDrawImpl) {
            console.log(LOG_PREFIX, '_drawImpl not found');
            return false;
        }

        proto._drawImpl = function(t) {
            const { context: e, horizontalPixelRatio: i, verticalPixelRatio: s } = t;
            e.save();
            let r = null;

            for (const t of this._bars) {
                let n = this._calcRealBarWidth(t.right - t.left, i);
                if (n >= 2) {
                    Math.max(1, Math.floor(i)) % 2 != n % 2 && n--;
                }

                const o = this._thinBars ? Math.min(n, Math.floor(i)) : n;
                const a = o <= n && t.right - t.left >= Math.floor(1.5 * i);

                r !== t.color && (e.fillStyle = t.color, r = t.color);

                const l = Math.floor(0.5 * o);
                const u = Math.round(t.center * i);
                const c = u - l;
                const h = o;
                const d = c + h - 1;
                const _ = Math.min(t.high, t.low);
                const p = Math.max(t.high, t.low);
                const f = Math.round(_ * s) - l;
                const m = Math.round(p * s) + l;
                const y = Math.max(m - f, o);

                // Draw vertical bar (high-low line)
                e.fillRect(c, f, h, y);

                const v = Math.ceil(1.5 * n);

                if (a) {
                    const leftTickX = u - v;
                    const rightTickX = u + v;
                    const tickWidth = Math.min(c - leftTickX, rightTickX - d);

                    // Draw open tick (left side) - only for OHLC bars
                    if (!this._dontDrawOpen) {
                        let openY = Math.max(f, Math.round(t.open * s) - l);
                        let openYEnd = openY + h - 1;
                        if (openYEnd > f + y - 1) {
                            openYEnd = f + y - 1;
                            openY = openYEnd - h + 1;
                        }
                        e.fillRect(leftTickX, openY, tickWidth, openYEnd - openY + 1);
                    }

                    // Calculate close tick position
                    let closeY = Math.max(f, Math.round(t.close * s) - l);
                    let closeYEnd = closeY + h - 1;
                    if (closeYEnd > f + y - 1) {
                        closeYEnd = f + y - 1;
                        closeY = closeYEnd - h + 1;
                    }

                    // Draw close tick on RIGHT side (always)
                    e.fillRect(d + 1, closeY, tickWidth, closeYEnd - closeY + 1);

                    // Draw close tick on LEFT side (StockCharts style) - only for HLC bars
                    if (doubleCloseTick && this._dontDrawOpen) {
                        e.fillRect(leftTickX, closeY, tickWidth, closeYEnd - closeY + 1);
                    }
                }
            }
            e.restore();
        };

        proto._hlcEnhancementsPatchApplied = true;

        console.log(LOG_PREFIX, 'Patches applied:',
            'min:', minBarWidth + 'px,',
            'max:', maxBarWidth === 0 ? 'unlimited' : maxBarWidth + 'px,',
            'double-close:', doubleCloseTick ? 'ON' : 'OFF'
        );
        return true;
    }

    function waitAndPatch(maxAttempts = 100) {
        let attempts = 0;

        const check = () => {
            attempts++;

            if (applyPatches()) {
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(check, 200);
            } else {
                console.log(LOG_PREFIX, 'Could not find bar renderer after', maxAttempts, 'attempts');
            }
        };

        check();
    }

    console.log(LOG_PREFIX, 'Starting:',
        'min:', minBarWidth + 'px,',
        'max:', maxBarWidth === 0 ? 'unlimited' : maxBarWidth + 'px,',
        'double-close:', doubleCloseTick ? 'ON' : 'OFF'
    );
    waitAndPatch();

})();
