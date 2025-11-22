# Security Policy

## Overview

quant.term is a **client-side, read-only trading terminal** designed for educational and analysis purposes. While it does not execute real trades or handle API keys, security best practices are still critical for protecting user data and ensuring system reliability.

## Data Handling

### What Data is Collected

quant.term processes the following data **entirely within your browser**:

| Data Type | Purpose | Storage Location | Retention |
|-----------|---------|------------------|-----------|
| **Market Data** | Real-time price feeds, order books | Memory only (not persisted) | Cleared on page refresh |
| **User Preferences** | Watchlist, selected symbol | localStorage | Persistent |
| **Alert Configurations** | User-created alerts | localStorage | Persistent |
| **Paper Trading Positions** | Simulated positions, P&L | localStorage | Persistent |

### What Data is NOT Collected

- ❌ No API keys (read-only public WebSocket streams)
- ❌ No personal information
- ❌ No trading history sent to external servers
- ❌ No analytics or tracking
- ❌ No cookies

## Attack Surface Analysis

### 1. Client-Side XSS (Cross-Site Scripting)

**Risk**: Malicious scripts injected through alert messages or custom notes

**Mitigation**:
- All user inputs sanitized before rendering
- React's built-in XSS protection (auto-escaping)
- No `dangerouslySetInnerHTML` usage
- Content Security Policy headers recommended for production

**Example Vuln erability** (Fixed):
```typescript
// ❌ VULNERABLE
<div dangerouslySetInnerHTML={{__html: userAlertMessage}} />

// ✅ SAFE
<div>{userAlertMessage}</div> // React auto-escapes
```

### 2. WebSocket Man-in-the-Middle (MITM) Attacks

**Risk**: Attacker intercepts WebSocket data to predict trades or manipulate displays

**Mitigation**:
- **WSS (WebSocket Secure)** exclusively used
- Binance and Deribit enforce TLS 1.2+
- Certificate validation handled by browser
- No custom certificate pinning (browser default is secure)

**User Verification**:
```bash
# In browser console, check WebSocket URL
console.log(ws.url); // Should start with wss:// not ws://
```

### 3. LocalStorage Security

**Risk**: Malicious extensions or XSS could access trading preferences

**Mitigation**:
- **No sensitive data** stored in localStorage
- Only non-critical data persisted (watchlist, alerts, paper positions)
- User can clear via browser settings
- No encryption needed (no API keys or passwords)

**What's Safe to Store**:
- ✅ Symbol watchlist (`['BTCUSDT', 'ETHUSDT']`)
- ✅ Alert configurations
- ✅ Paper trading positions (simulated)

**What Should NEVER Be Stored**:
- ❌ API keys or secrets
- ❌ Private keys or seed phrases
- ❌ Real trading credentials

### 4. Dependency Vulnerabilities

**Risk**: Vulnerable npm packages in dependencies

**Mitigation**:
- Regular `npm audit` checks
- Automated Dependabot PRs on GitHub
- Pinned dependency versions in package-lock.json
- Manual review of security advisories

```bash
# Check for vulnerabilities
npm audit

# Auto-fix non-breaking vulnerabilities
npm audit fix

# Update all dependencies (test thoroughly)
npm update
```

## Content Security Policy (CSP)

### Recommended Production Headers

For production deployments, configure your web server with these CSP headers:

```http
Content-Security-Policy: 
  default-src 'self'; 
  script-src 'self'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data: https:; 
  font-src 'self' data:; 
  connect-src 'self' wss://stream.binance.com wss://www.deribit.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**Explanation**:
- `connect-src`: Allows WebSocket connections only to Binance and Deribit
- `script-src 'self'`: No external scripts (prevents CDN injection)
- `frame-ancestors 'none'`: Prevent clickjacking
- `unsafe-inline` for styles: Required for dynamic theming (consider removing in favor of CSS-in-JS)

## Browser Permissions

### Required Permissions

quant.term requests the following browser permissions:

| Permission | Purpose | When Requested |
|------------|---------|----------------|
| **Notifications** | Alert notifications when price/indicator triggers | First alert creation (optional) |
| None others | | |

**Note**: WebSocket connections do NOT require explicit permission (same-origin policy handles this).

## Third-Party Services

### WebSocket Connections

| Service | URL | Purpose | Security |
|---------|-----|---------|----------|
| **Binance Futures** | `wss://fstream.binance.com` | Market data, order books | WSS with TLS 1.2+ |
| **Deribit** | `wss://www.deribit.com/ws/api/v2` | Options data, Greeks | WSS with TLS 1.2+ |

**Data Sent**:
- subscription requests (symbols only)
- Ping/pong heartbeats

**No Authentication Required**: Public streams only

### External API Calls

Currently **NONE**. All data comes from WebSocket streams.

Future integrations may include:
- CoinGecko API (fallback price data) - public endpoints only
- Economic calendar data (optional feature)

## Privacy Considerations

### Browser Fingerprinting

quant.term does NOT implement any fingerprinting techniques. Standard browser APIs used:

- `localStorage` (user preferences)
- `WebSocket` (market data)
- `Notification` API (alert sounds)
- `performance` API (latency tracking for display only)

### IP Address Exposure

Your IP address is visible to:
- Binance (WebSocket connection)
- Deribit (WebSocket connection)
- Your ISP

This is unavoidable for real-time data but carries no privacy risk (public market data).

## Secure Development Practices

### Code Review Checklist

Before merging code, verify:

- [ ] No API keys committed to repository
- [ ] User inputs sanitized (XSS prevention)
- [ ] No `eval()` or `Function()` constructors
- [ ] Dependencies up-to-date (`npm audit` clean)
- [ ] Error messages don't expose system internals
- [ ] Type safety enforced (TypeScript strict mode)

### Secrets Management

**There are no secrets in this project.** If you need to add authenticated features:

1. **NEVER commit API keys** to Git
2. Use `.env.local` (gitignored by default)
3. Prefix secrets with `VITE_PUBLIC_` only if safe to expose client-side
4. For server-side secrets, use environment variables or secret management (Vault, AWS Secrets Manager)

Example `.env.local` (DO NOT COMMIT):
```bash
# ❌ NEVER COMMIT THIS FILE
# Only for local development
VITE_BINANCE_API_KEY=your_api_key_here
```

## Incident Response

### Reporting Security Vulnerabilities

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email security@quantterm.dev with:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if known)

3. Allow 48-72 hours for initial response
4. Coordinated disclosure timeline: 90 days

### Security Updates

Security patches will be released as:
- **Critical**: Immediate patch release + notification
- **High**: Patch within 7 days
- **Medium/Low**: Included in next regular release

## User Security Best Practices

### For Developers

1. **Keep Dependencies Updated**: Run `npm update` monthly
2. **Audit Regularly**: `npm audit` before each release
3. **Review Code Changes**: No auto-merge of dependency updates
4. **Use HTTPS**: Serve production app over HTTPS only

### For End Users

1. **Use Modern Browsers**: Chrome 120+, Firefox 121+, Safari 17+
2. **Disable Untrusted Extensions**: Browser extensions can access localStorage
3. **Clear Data Periodically**: If using public computers, clear browser data after use
4. **HTTPS Only**: Never use `http://` version if available
5. **No Real Funds**: Remember this is paper trading - never input real API keys

## Compliance

### GDPR (General Data Protection Regulation)

quant.term is **GDPR-compliant** because:
- No personal data collected
- No server-side storage
- User controls all data via browser's localStorage
- Data deletion: Clear browser cache
- No cookies or tracking

### Disclaimer

> ⚠️ **IMPORTANT**: quant.term is provided "AS IS" for **educational purposes only**. 
> - Not financial advice
> - No warranty or liability for losses
> - User assumes all risk
> - Paper trading only - NOT a real trading platform

## Security Roadmap

Planned security enhancements:

- [ ] Subresource Integrity (SRI) for CDN assets
- [ ] Implement CSP reporting endpoint
- [ ] Add rate limiting for alert creation (prevent DoS)
- [ ] Implement WebSocket connection fingerprinting detection
- [ ] Add security.txt file (RFC 9116)

---

**Last Updated**: 2025-11-22  
**Security Contact**: security@quantterm.dev  
**PGP Key**: [TBD]
