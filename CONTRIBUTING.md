# Contributing to quant.term

Thank you for your interest in contributing to quant.term! This document provides guidelines for contributing to the project.

## 🚀 Quick Start

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/quant.term.git
   cd quant.term
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Run tests**
   ```bash
   npm run test
   npm run test:coverage
   ```

## 📋 Code Standards

### TypeScript
- **Strict mode enabled** - No `any` types allowed
- Use explicit return types for functions
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal types

### Code Style
- **ESLint + Prettier** - Run `npm run lint` before committing
- **Naming conventions:**
  - Components: PascalCase (`OrderBookDOM.tsx`)
  - Hooks: camelCase with `use` prefix (`useOrderBook.ts`)
  - Utilities: camelCase (`calculateRSI.ts`)
  - Constants: UPPER_SNAKE_CASE (`MAX_RECONNECTS`)

### Testing
- **70%+ coverage required** for new features
- **100% coverage required** for indicator calculations
- Use descriptive test names: `it('should reconnect with exponential backoff after disconnect')`
- Test edge cases (NaN, Infinity, empty arrays, null values)

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add VWAP indicator
fix: resolve WebSocket race condition
docs: update architecture diagram
test: add coverage for RSI calculation
chore: update dependencies
```

## 🔄 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Write tests first** (TDD approach)
   - Create test file in `src/tests/`
   - Write failing tests
   - Implement feature
   - Ensure tests pass

3. **Run quality checks**
   ```bash
   npm run lint
   npm run type-check
   npm run test -- --coverage
   npm run build
   ```

4. **Submit PR with description**
   - Reference related issues (`Fixes #123`)
   - Describe what changed and why
   - Include screenshots for UI changes
   - Add test coverage report

5. **Code review**
   - Address reviewer feedback
   - Keep PR focused (one feature per PR)
   - Squash commits before merge

## 🎯 What to Contribute

### Good First Issues
Look for issues labeled `good-first-issue`:
- Documentation improvements
- UI polish (animations, transitions)
- Test coverage expansion
- Bug fixes

### High-Impact Contributions
- New technical indicators (with validation)
- Performance optimizations
- Accessibility improvements
- Mobile responsiveness

### Feature Requests
Before implementing major features:
1. Open an issue for discussion
2. Wait for maintainer approval
3. Agree on implementation approach
4. Submit PR with tests

## 🧪 Testing Guidelines

### Unit Tests
```typescript
// src/tests/indicators/rsi.test.ts
import { describe, it, expect } from 'vitest';
import { calculateRSI } from '@/utils/indicators';

describe('calculateRSI', () => {
  it('should calculate RSI correctly for sample data', () => {
    const prices = [44, 44.34, 44.09, 43.61, 44.33];
    const result = calculateRSI(prices, 14);
    expect(result[result.length - 1].value).toBeCloseTo(50, 1);
  });

  it('should handle edge cases', () => {
    expect(calculateRSI([], 14)).toEqual([]);
    expect(calculateRSI([100], 14)).toEqual([]);
  });
});
```

### Component Tests
```typescript
// src/tests/components/OrderBookDOM.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OrderBookDOM from '@/features/market/OrderBookDOM';

describe('OrderBookDOM', () => {
  it('should render order book with bids and asks', () => {
    render(<OrderBookDOM symbol="BTCUSDT" />);
    expect(screen.getByText('DOM')).toBeInTheDocument();
  });
});
```

## 📚 Documentation

### Code Comments
- Use JSDoc for public APIs
- Explain **why**, not **what** (code should be self-explanatory)
- Document complex algorithms with references

```typescript
/**
 * Calculates Relative Strength Index (RSI)
 * @param prices - Array of closing prices
 * @param period - RSI period (default: 14)
 * @returns Array of RSI values (0-100)
 * @see https://www.investopedia.com/terms/r/rsi.asp
 */
export const calculateRSI = (prices: number[], period = 14) => {
  // Implementation...
};
```

### README Updates
- Update feature list when adding new functionality
- Add screenshots for UI changes
- Update roadmap when completing milestones

## 🐛 Bug Reports

When reporting bugs, include:
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Browser/OS version**
- **Console errors** (if any)
- **Screenshots/recordings** (if applicable)

## 💡 Feature Requests

When requesting features:
- **Use case** - Why is this needed?
- **Proposed solution** - How should it work?
- **Alternatives considered** - What else did you think about?
- **Additional context** - Screenshots, mockups, references

## 🔒 Security

If you discover a security vulnerability:
- **DO NOT** open a public issue
- Email the maintainers directly
- Include detailed description and reproduction steps

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

All contributors will be recognized in:
- README.md (Contributors section)
- Release notes
- GitHub contributors page

Thank you for making quant.term better! 🚀
