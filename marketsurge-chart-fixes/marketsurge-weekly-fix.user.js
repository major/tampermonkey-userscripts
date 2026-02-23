// ==UserScript==
// @name         MarketSurge Weekly Chart Fix
// @namespace    https://github.com/major
// @version      4.0.0
// @description  Fixes weekly/monthly chart scaling by removing the Earnings overlay study
//               (which plots EPS on the price axis, destroying semi-log scaling) and
//               correcting the Y-axis range when ChartIQ's semiLog calculation is broken.
// @author       major
// @match        https://marketsurge.investors.com/*
// @match        https://marketsurge-beta.investors.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var PADDING_FACTOR = 0.08;
    var LOG_RATIO_THRESHOLD = 2.5;
    var CHECK_INTERVAL_MS = 1500;

    function removeEarningsStudy(stx) {
        var studies = stx.layout.studies;
        if (!studies) return;

        Object.keys(studies).forEach(function (k) {
            if (studies[k].type === 'Earnings') {
                CIQ.Studies.removeStudy(stx, studies[k]);
                console.log('[MS-Fix] Removed Earnings study:', k);
            }
        });
    }

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

        return {
            min: minLow * (1 - PADDING_FACTOR),
            max: maxHigh * (1 + PADDING_FACTOR)
        };
    }

    /**
     * Compares axis vs data ranges in log space. If the axis log range is
     * LOG_RATIO_THRESHOLD times wider than the data, it's broken.
     */
    function isAxisBroken(stx, bounds) {
        var yAxis = stx.chart.yAxis;
        if (bounds.min <= 0 || yAxis.low <= 0) return false;

        var axisLogRange = Math.log10(yAxis.high) - Math.log10(yAxis.low);
        var dataLogRange = Math.log10(bounds.max) - Math.log10(bounds.min);
        if (dataLogRange <= 0) return false;

        return (axisLogRange / dataLogRange) > LOG_RATIO_THRESHOLD;
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
        if (!isWeeklyOrLonger(stx)) return;

        removeEarningsStudy(stx);

        var bounds = calcVisibleBounds(stx.chart.dataSegment);
        if (!bounds) return;

        if (isAxisBroken(stx, bounds)) {
            stx.chart.yAxis.min = bounds.min;
            stx.chart.yAxis.max = bounds.max;
            stx.draw();
            console.log('[MS-Fix] Axis fix:', bounds.min.toFixed(2), '\u2192', bounds.max.toFixed(2));
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

        console.log('[MS-Fix] MarketSurge Weekly Chart Fix v4.0.0 loaded');
    }

    setTimeout(init, 2000);
})();
