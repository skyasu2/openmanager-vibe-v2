# CLAUDE.md

**응답 언어: 한국어로 답변. 기술 용어는 영어 허용.**

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**This is a mockup/demo prototype, not a production system.**

OpenManager AI is a UI mockup demonstrating the concept of natural language server monitoring. The purpose is to showcase the user experience and interface design - not actual functionality.

Key limitations to understand:
- **No real server monitoring**: All data is randomly generated dummy data
- **No actual AI/LLM**: Natural language processing is simple keyword matching, not real AI
- **No backend**: Pure frontend HTML/CSS/JS only
- **No build process**: No bundler, no tests, no linting

This is a "Vibe Coding" prototype built rapidly with AI assistance (GPT, Claude, Gemini) to demonstrate concepts.

## Work Scope

**Minor UI improvements only.** Do NOT:
- Add backend/server-side code
- Add new features
- Integrate real APIs or databases
- Add build tools, bundlers, or package.json
- Over-engineer or refactor extensively

Keep it simple - this is a completed mockup that only needs small polish.

## Running Locally

```bash
npx serve .
```

Then open `index.html` (landing page) or `server_dashboard.html` (main dashboard) in a browser.

## Architecture

### Module Dependencies (Load Order Matters)

```
settings.local.js      # Central configuration (loads first)
    ↓
dummy_data_generator.js # Generates 50 simulated servers
    ↓
ai_processor.js        # Natural language query processing
    ↓
agent.js               # Automated incident detection (depends on AIProcessor)
    ↓
data_processor.js      # UI controller, filtering, pagination
```

### Key Files

- **settings.local.js**: Central config hub - thresholds (CPU/memory/disk), server count (50), update intervals (10 min), pagination settings
- **ai_processor.js**: `AIProcessor` class - keyword-based NLP (no actual LLM), pattern matching against predefined queries, maintains 24-hour historical data per server
- **data_processor.js**: `DataProcessor` class - filtering, pagination, DOM rendering, event binding
- **agent.js**: `Agent` class - background monitoring, incident tracking with 1-hour deduplication, 24-hour retention
- **dummy_data_generator.js**: `DummyDataGenerator` - creates realistic server data with ~3% critical, ~6% warning distribution

### Data Flow

1. `DummyDataGenerator` creates server data → stored in `window.serverData`
2. `serverDataUpdated` custom event broadcasts to listeners
3. `DataProcessor` renders to DOM, `AIProcessor` updates historical data
4. User queries processed via keyword matching in `AIProcessor.analyzeQuery()`

### Server Data Structure

```javascript
{
  hostname: "web-01-kr",
  cpu_usage: 45.2,
  memory_usage_percent: 62.3,
  disk: [{ disk_usage_percent: 54.1 }],
  services: { nginx: 'running' },
  errors: ["Connection timeout"],
  net: { rx_errors: 5, tx_errors: 2 },
  zombie_count: 3
}
```

## Important Patterns

- **Event-driven**: Uses `serverDataUpdated` custom event for data broadcasting
- **Global singletons**: `AIProcessor`, `DataProcessor`, `Agent` instantiated once on `window`
- **Graceful degradation**: `DataProcessor` works without `AIProcessor` if unavailable
- **No actual LLM**: NLP is keyword-based pattern matching, not real AI

## Tech Stack

### Frontend (No Framework)
- HTML5, CSS3 (with CSS Variables), Vanilla JavaScript (ES6)

### External Libraries (CDN)
| Library | Version | Purpose |
|---------|---------|---------|
| Bootstrap | 5.3.0 | UI framework, grid, modals |
| Bootstrap Icons | 1.10.0 | Icons |
| Font Awesome | 6.4.0 | Icons |
| Chart.js | latest | Charts/graphs |
| Google Fonts | - | Noto Sans KR |

### Project Files
- **HTML**: 3 pages (index.html, server_dashboard.html, server_detail.html)
- **JavaScript**: 5 files (settings.local.js, dummy_data_generator.js, ai_processor.js, agent.js, data_processor.js)
- **CSS**: 2 files (css/style.css, css/modern-style.css)

### Development Tools
- **Build**: None
- **Bundler**: None
- **Package Manager**: None (no package.json)
- **Tests**: None
- **Linter**: None

### Deployment
- Netlify (static hosting)

## Language

Primary language is Korean. UI text, comments, and natural language queries are in Korean.
