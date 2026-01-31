// ==UserScript==
// @name         TradingView Thicker Bars
// @namespace    https://github.com/major/tradingview-thicker-bars
// @version      3.1.0
// @description  Keep OHLC bars visually thick when zoomed out by patching the bar width calculation
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

    const DEFAULT_MIN_BAR_WIDTH = 3;
    const DEFAULT_MAX_BAR_WIDTH = 0;
    let minBarWidth = GM_getValue('minBarWidth', DEFAULT_MIN_BAR_WIDTH);
    let maxBarWidth = GM_getValue('maxBarWidth', DEFAULT_MAX_BAR_WIDTH);

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
                console.log('[TradingView Thicker Bars] Min bar width set to', value, 'px');
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
                console.log('[TradingView Thicker Bars] Max bar width set to', value === 0 ? 'unlimited' : value + 'px');
            } else {
                alert('Invalid value. Please enter a number between 0 and 50.');
            }
        }
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

    function patchBarWidthCalculation() {
        const barRenderer = getBarRenderer();
        if (!barRenderer) return false;

        const proto = Object.getPrototypeOf(barRenderer);
        
        if (proto._thickBarsPatchApplied) {
            return true;
        }

        const original = proto._calcRealBarWidth;
        if (!original) {
            console.log('[TradingView Thicker Bars] _calcRealBarWidth not found');
            return false;
        }

        proto._calcRealBarWidth = function(t, e) {
            let result = original.call(this, t, e);
            result = Math.max(result, minBarWidth);
            if (maxBarWidth > 0) {
                result = Math.min(result, maxBarWidth);
            }
            return result;
        };

        proto._thickBarsPatchApplied = true;
        console.log('[TradingView Thicker Bars] Patched _calcRealBarWidth, min:', minBarWidth, 'px, max:', maxBarWidth === 0 ? 'unlimited' : maxBarWidth + 'px');
        return true;
    }

    function waitAndPatch(maxAttempts = 100) {
        let attempts = 0;

        const check = () => {
            attempts++;

            if (patchBarWidthCalculation()) {
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(check, 200);
            } else {
                console.log('[TradingView Thicker Bars] Could not find bar renderer after', maxAttempts, 'attempts');
            }
        };

        check();
    }

    console.log('[TradingView Thicker Bars] Starting with min:', minBarWidth, 'px, max:', maxBarWidth === 0 ? 'unlimited' : maxBarWidth + 'px');
    waitAndPatch();

})();
