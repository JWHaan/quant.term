# Strategic Roadmap: The "Vim of Trading Terminals"

**Core Philosophy**: Progressive Enhancement & Zero-Cost Infrastructure.
The project works 100% client-side by default, offering optional self-hostable micro-services for power users.

---

## Phase 1: Critical Fixes (0-3 months) — Stabilize the Foundation

### 1. Eliminate Memory Leaks
- **Problem**: Long sessions crash browsers.
- **Solution**:
  - Implement circular buffer for tick data (max 10,000 bars per symbol).
  - Add `WeakRef` for chart objects and aggressively `destroy()` TradingView instances.
  - Build memory profiler UI (MB/s growth rate).
- **Outcome**: Stable 24h+ sessions on 8GB RAM machines.

### 2. Harden WebSocket Layer
- **Problem**: IP bans from rate limits.
- **Solution**:
  - Connection pool manager (max 3 symbols/socket, auto-rotate).
  - Adaptive rate limiter (≤5 msg/sec with jitter).
  - "Offline Mode" with IndexedDB caching.
- **Outcome**: 90% reduction in disconnections.

### 3. Error Boundary & Graceful Degradation
- **Solution**:
  - Wrap major components (`ChartPanel`, `OrderBook`) in React Error Boundaries.
  - Fallback UI with "Reload Component" button.
- **Outcome**: One bug doesn't kill the whole terminal.

---

## Phase 2: Optional Backend (3-6 months) — Enable Superpowers

### 4. Deploy a Free Serverless Backend (Optional)
- **Stack**: Cloudflare Workers + D1 (SQLite).
- **Features**:
  - Rate Limit Proxy.
  - Persistent Alerts (Webhooks to Discord/Telegram).
  - Configuration Sync (Cross-device watchlists).
- **Outcome**: Institutional features at zero cost.

### 5. Mobile-First Responsive Redesign
- **Solution**:
  - CSS Grid + Container Queries.
  - Collapsible sidebar, swipeable charts.
  - `useOptimistic` for touch-friendly interactions.
- **Outcome**: Usable on tablets and phones.

---

## Phase 3: Community & Ecosystem (6-12 months)

### 6. Plugin Architecture
- **Solution**:
  - `ExchangeAdapter` interface for community contributions.
  - Web Workers for sandboxed plugin execution.
- **Outcome**: Scalable exchange support.

### 7. Crowdsourced Indicator Library
- **Solution**:
  - WASM runtime (Pyodide/JS) for user indicators.
  - GitHub Pages "Indicator Store".
- **Outcome**: Community-driven innovation.

### 8. Automated Quality Gates
- **Solution**:
  - GitHub Actions: Latency benchmark, Memory leak detection, Coverage gate (>70%).
  - Visual regression tests (Playwright).
- **Outcome**: Confidence in merging.

---

## Phase 4: Sustainability (12+ months) — Free Forever

### 9. Create "Quant.Term Foundation"
- **Funding**: GitHub Sponsors, Open Collective, Grants.
- **Promise**: Zero features behind paywall.

### 10. Governance & BDFL Transition
- **Solution**: Maintainer council, RFCs via GitHub Discussions.
- **Outcome**: Project longevity.

---

## Anti-Patterns (What NOT to Do)
❌ No Commercial Hosting (Premium Cloud).
❌ No Closed Extensions.
❌ No ICO/Token.
❌ No Enterprise Features (SAML/SSO).
