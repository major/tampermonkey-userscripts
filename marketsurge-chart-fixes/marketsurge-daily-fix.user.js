// ==UserScript==
// @name         MarketSurge Daily Chart Fix
// @namespace    https://github.com/major
// @version      1.0.1
// @description  Fixes daily/intraday charts where large price moves cause the data to go
//               off-canvas. Detects when visible price data exceeds the Y-axis bounds and
//               overrides the range to include all visible bars.
// @author       major
// @match        https://marketsurge.investors.com/*
// @match        https://marketsurge-beta.investors.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var PADDING_FACTOR = 0.05;
    var RATIO_THRESHOLD = 3;
    var CHECK_INTERVAL_MS = 1500;

    function calcVisibleBounds(dataSegment) {
        var minLow = Infinity;
        var maxHigh = 0;
        var count = 0;

        for (var i = 0; i < dataSegment.length; i++) {
            var bar = dataSegment[i];
            if (!bar || bar.Low == null || bar.High == null) continue;
            if (bar.Low <= 0 || bar.High <= 0) continue;
            if (bar.Low < minLow) minLow = bar.Low;
            if (bar.High > maxHigh) maxHigh = bar.High;
            count++;
        }

        if (count === 0 || minLow === Infinity || maxHigh === 0) return null;

        var pad = (maxHigh - minLow) * PADDING_FACTOR;
        return {
            min: Math.max(0, minLow - pad),
            max: maxHigh + pad
        };
    }

    function isWeeklyOrLonger(stx) {
        var interval = stx.layout.interval;
        var timeUnit = stx.layout.timeUnit;
        return interval === 'week' || interval === 'month'
            || timeUnit === 'week' || timeUnit === 'month';
    }

    function checkAndFix() {
        var stx = window.stx;
        if (!stx || !stx.chart || !stx.chart.dataSegment) return;
        if (isWeeklyOrLonger(stx)) return;

        var bounds = calcVisibleBounds(stx.chart.dataSegment);
        if (!bounds) return;

        var yAxis = stx.chart.yAxis;
        var dataOffCanvas = bounds.max > yAxis.high || bounds.min < yAxis.low;
        var axisRange = yAxis.high - yAxis.low;
        var dataRange = bounds.max - bounds.min;
        var axisTooWide = dataRange > 0 && (axisRange / dataRange) > RATIO_THRESHOLD;

        if (dataOffCanvas || axisTooWide) {
            stx.chart.yAxis.min = bounds.min;
            stx.chart.yAxis.max = bounds.max;
            stx.draw();
            console.log('[MS-DailyFix] Axis fix:', bounds.min.toFixed(2), '\u2192', bounds.max.toFixed(2));
        }
    }

    function init() {
        var stx = window.stx;
        if (!stx) {
            setTimeout(init, 1000);
            return;
        }

        setInterval(checkAndFix, CHECK_INTERVAL_MS);
        checkAndFix();

        console.log('[MS-DailyFix] MarketSurge Daily Chart Fix v1.0.1 loaded');
    }

    setTimeout(init, 2000);
})();
