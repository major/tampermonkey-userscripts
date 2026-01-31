# TradingView Thicker Bars

A Tampermonkey userscript that keeps OHLC bars visually thick when zoomed out on TradingView charts.

## The Problem

TradingView switches from thick bars to thin 1-pixel lines when you zoom out past a certain point (around 10px bar spacing). This makes the bars hard to see.

Even with "Prefer Thicker Bars" enabled in TradingView's settings, the bars still become thin when zoomed out far enough.

## The Solution

This script patches TradingView's internal bar width calculation to enforce a minimum (and optionally maximum) pixel width for OHLC bars.

- **Zoom freely** - no restrictions on how far you can zoom out
- **Bars stay thick** - maintains visibility at any zoom level
- **Configurable** - set your preferred min/max bar widths

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Click on the userscript file: [tradingview-thicker-bars.user.js](tradingview-thicker-bars.user.js)
3. Click "Install" when Tampermonkey prompts you

Or manually:
1. Open Tampermonkey dashboard
2. Create a new script
3. Paste the contents of `tradingview-thicker-bars.user.js`
4. Save (Ctrl+S)

## Configuration

Click the Tampermonkey icon in your browser toolbar to access settings:

- **Set minimum bar width** - Prevents bars from getting too thin when zoomed out (default: 3px)
- **Set maximum bar width** - Prevents bars from getting too fat when zoomed in (default: 0 = unlimited)

Settings are saved and persist across browser sessions.

## How It Works

TradingView's charting library calculates bar body width using an internal `_calcRealBarWidth()` function. This script wraps that function to clamp the return value between your configured min and max values.

This approach:
- Only affects visual rendering, not data loading or chart navigation
- Doesn't interfere with zoom, scroll, or other chart interactions
- Works with the existing "Prefer Thicker Bars" setting

## Compatibility

- Tested with TradingView's web charting platform
- Requires Tampermonkey (or compatible userscript manager with `unsafeWindow` support)
- May break if TradingView significantly changes their internal charting API

## License

MIT
