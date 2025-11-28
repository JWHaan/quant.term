# Order Book Liquidity Heatmap - User Guide

## 🎯 What is it?

The **Order Book Liquidity Heatmap** is an advanced visualization tool that displays the density and distribution of buy and sell orders over time. It helps traders:

- **Identify liquidity clusters** - Where large orders are concentrated
- **Spot support/resistance levels** - Price levels with high order density
- **Detect spoofing** - Unusual order patterns that may indicate manipulation
- **Understand market depth** - How liquidity changes over time

## 🖼️ Visual Guide

### Heatmap Layout

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 Liquidity Heatmap | BTCUSDT              [Reset]     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Price                                                   │
│    ↑                                                     │
│ $42,100 ██████████░░░░░░░░░░░░  ← High ask liquidity   │
│ $42,050 ████████░░░░░░░░░░░░░░                          │
│ $42,000 ██████░░░░░░░░░░░░░░░░                          │
│         ─────────────────────── ← Spread                │
│ $41,950 ░░░░░░░░░░░░░░████████                          │
│ $41,900 ░░░░░░░░░░░░██████████  ← High bid liquidity   │
│ $41,850 ░░░░░░░░░░████████████                          │
│    └────────────────────────────→ Time                  │
│        13:50        13:52        13:55                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ 🟢 Bid Liquidity  🔴 Ask Liquidity  |  Snapshots: 150  │
└─────────────────────────────────────────────────────────┘
```

### Color Coding

- **🟢 Green Gradient**: Bid (buy) orders
  - Light green = Low liquidity
  - Dark green = High liquidity
  
- **🔴 Red Gradient**: Ask (sell) orders
  - Light red = Low liquidity
  - Dark red = High liquidity

## 🚀 Quick Start

### 1. Enable the Heatmap

**Option A: Command Palette**
1. Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
2. Type "heatmap"
3. Select "Show Liquidity Heatmap"

**Option B: Header Button**
1. Click the "Heatmap" button in the top navigation
2. The heatmap panel will appear

### 2. Wait for Data Collection

The heatmap needs to collect historical snapshots before displaying:
- **Initial wait**: ~30 seconds
- **Full history**: ~5 minutes (300 snapshots)
- **Status**: Shows "Collecting data... (X/300 snapshots)"

### 3. Interpret the Visualization

Once data is collected, you'll see:
- **Horizontal bands**: Price levels with consistent liquidity
- **Vertical bands**: Time periods with high order activity
- **Bright spots**: Liquidity clusters (potential support/resistance)
- **Dark areas**: Low liquidity zones (potential volatility)

## 🎮 Interactive Features

### Hover Tooltips

Hover over any cell to see detailed information:
```
┌─────────────────────┐
│ 13:52:30           │
│ Price: $41,950.00  │
│ Bids: 12.5000      │
│ Asks: 3.2500       │
│ Total: 15.7500     │
└─────────────────────┘
```

### Reset View

Click the "Reset" button to:
- Clear zoom/pan state
- Refresh the visualization
- Reset color scales

## 📊 Reading Patterns

### 1. Support/Resistance Levels

**What to look for:**
- Horizontal bands of high liquidity (bright colors)
- Consistent across multiple time periods

**Example:**
```
$42,000 ████████████████████  ← Strong resistance
$41,900 ░░░░░░░░░░░░░░░░░░░░
$41,800 ████████████████████  ← Strong support
```

**Interpretation:**
- Large orders clustered at $42,000 (resistance)
- Large orders clustered at $41,800 (support)
- Price likely to bounce between these levels

### 2. Liquidity Imbalance

**What to look for:**
- Asymmetry between bid and ask colors
- One side significantly brighter than the other

**Example:**
```
Asks: ██████░░░░░░  ← Low ask liquidity
      ─────────────
Bids: ░░░░████████  ← High bid liquidity
```

**Interpretation:**
- More buyers than sellers
- Potential upward price pressure
- Watch for breakout above resistance

### 3. Spoofing Detection

**What to look for:**
- Sudden appearance of large orders
- Quick disappearance (vertical stripe pattern)
- Repeating on/off pattern

**Example:**
```
Time: 13:50  13:51  13:52  13:53
      ████  ░░░░  ████  ░░░░  ← Suspicious pattern
```

**Interpretation:**
- Orders appearing and disappearing rapidly
- Possible market manipulation
- Exercise caution

### 4. Liquidity Migration

**What to look for:**
- Diagonal patterns
- Liquidity moving from one price to another

**Example:**
```
$42,000 ████░░░░░░░░░░░░
$41,950 ░░░░████░░░░░░░░
$41,900 ░░░░░░░░████░░░░
        ↓ Time →
```

**Interpretation:**
- Orders moving down in price
- Potential downward trend
- Sellers becoming more aggressive

## ⚙️ Configuration

### Adjusting Time Window

Default: 5 minutes

```typescript
// Show last 10 minutes
<OrderBookHeatmap timeWindowMinutes={10} />

// Show last 2 minutes (high-frequency trading)
<OrderBookHeatmap timeWindowMinutes={2} />
```

### Adjusting Price Bins

Default: $1 for BTC

```typescript
// More granular (0.1 bins)
<OrderBookHeatmap priceBinSize={0.1} />

// Less granular (10 bins)
<OrderBookHeatmap priceBinSize={10} />
```

### Adjusting Time Bins

Default: 10 seconds

```typescript
// More granular (5-second bins)
<OrderBookHeatmap timeBinSeconds={5} />

// Less granular (30-second bins)
<OrderBookHeatmap timeBinSeconds={30} />
```

## ⚠️ Warnings & Indicators

### Stale Data Warning

```
┌─────────────────────────────┐
│ ⚠️ STALE - Data outdated   │
└─────────────────────────────┘
```

**Causes:**
- WebSocket disconnected
- No updates for >5 seconds
- Network issues

**Action:**
- Check internet connection
- Wait for reconnection
- Refresh if persists

### Low Data Warning

```
┌─────────────────────────────┐
│ Collecting data... (45/300) │
└─────────────────────────────┘
```

**Meaning:**
- Not enough historical data yet
- Heatmap may be sparse

**Action:**
- Wait for more snapshots
- Patterns become clearer over time

## 🎯 Trading Strategies

### 1. Breakout Trading

**Setup:**
1. Identify strong resistance on heatmap (bright horizontal band)
2. Watch for liquidity disappearing at that level
3. Enter long when price breaks through

**Heatmap Signals:**
```
Before:  $42,000 ████████████  ← Resistance
After:   $42,000 ░░░░░░░░░░░░  ← Liquidity gone
Action:  BUY when price > $42,000
```

### 2. Mean Reversion

**Setup:**
1. Identify support/resistance levels
2. Wait for price to approach
3. Enter counter-trend trade

**Heatmap Signals:**
```
Support: $41,800 ████████████
Price:   $41,850 (approaching)
Action:  BUY near $41,800
```

### 3. Liquidity Hunting

**Setup:**
1. Find areas with low liquidity (dark zones)
2. Avoid trading in these areas
3. Wait for price to reach high-liquidity zones

**Heatmap Signals:**
```
$42,000 ████████  ← High liquidity (safe)
$41,950 ░░░░░░░░  ← Low liquidity (avoid)
$41,900 ████████  ← High liquidity (safe)
```

## 🔧 Troubleshooting

### Heatmap Not Showing

**Check:**
1. Is the heatmap panel visible?
2. Is WebSocket connected? (check status indicator)
3. Is data being collected? (check snapshot count)

**Solutions:**
- Toggle heatmap off/on
- Refresh the page
- Check browser console for errors

### Performance Issues

**Symptoms:**
- Slow rendering
- UI lag
- High CPU usage

**Solutions:**
1. Reduce time window: `timeWindowMinutes={2}`
2. Increase bin sizes: `timeBinSeconds={30}`, `priceBinSize={10}`
3. Close other browser tabs
4. Disable browser extensions

### Tooltips Not Working

**Check:**
- Is mouse hovering over cells?
- Is browser zoom at 100%?
- Are browser DevTools open?

**Solutions:**
- Refresh the page
- Try different browser
- Check for JavaScript errors

## 📱 Mobile Usage

### Responsive Behavior

- **Desktop**: Full heatmap with all features
- **Tablet**: Scaled down, touch-enabled tooltips
- **Mobile**: Collapsed by default (enable via settings)

### Touch Gestures

- **Tap**: Show tooltip
- **Long press**: Pin tooltip
- **Pinch**: Zoom (if enabled)
- **Swipe**: Pan (if enabled)

## 🎓 Best Practices

### 1. Combine with Other Indicators

Don't rely solely on the heatmap:
- ✅ Use with price chart
- ✅ Check volume profile
- ✅ Confirm with technical indicators
- ✅ Monitor news/events

### 2. Adjust Settings for Your Strategy

**Day Trading:**
```typescript
timeWindowMinutes={2}
timeBinSeconds={5}
priceBinSize={0.1}
```

**Swing Trading:**
```typescript
timeWindowMinutes={15}
timeBinSeconds={30}
priceBinSize={10}
```

### 3. Watch for Anomalies

- Sudden liquidity spikes
- Unusual patterns
- Rapid changes
- Asymmetric distributions

### 4. Validate Signals

Before acting on heatmap signals:
1. Check multiple timeframes
2. Confirm with order book depth
3. Verify with recent trades
4. Consider market context

## 📚 Additional Resources

- **Data Accuracy Guide**: `docs/DATA_ACCURACY.md`
- **Pull Request Details**: `docs/PR_HEATMAP.md`
- **API Documentation**: `src/components/OrderBookHeatmap.tsx`
- **Test Suite**: `src/tests/orderBookHeatmap.test.ts`

## 💡 Tips & Tricks

1. **Use keyboard shortcuts** for quick access
2. **Bookmark heatmap layouts** for different strategies
3. **Take screenshots** of interesting patterns
4. **Compare across symbols** to find opportunities
5. **Monitor during high volatility** for best insights

## 🆘 Support

Need help?
- Check the FAQ section
- Join the Discord community
- Open a GitHub issue
- Contact support team

---

**Happy Trading!** 📈
