<div align="center">

# gitted

**Your git story, visualized.**

Transform your GitHub repositories into stunning visualizations, AI-powered narratives, Spotify Wrapped-style recaps, and real-time Gource tree animations — all from your commit history.

[Get Started](#getting-started) &nbsp;&middot;&nbsp; [Features](#features) &nbsp;&middot;&nbsp; [Tech Stack](#tech-stack) &nbsp;&middot;&nbsp; [Contributing](#contributing)

</div>

---

## Features

### Gource Visualization
Real-time force-directed tree visualization of your repositories. Files bloom as nodes, contributors move between them, and commit beams pulse through your codebase. Supports individual repos or all of them combined with playback controls, timeline scrubbing, and camera controls.

- Weighted radial sector tree layout with incremental updates
- Structure-of-Arrays typed buffers for high-performance physics
- WebGL2 instanced rendering pipeline (Canvas 2D fallback)
- Web Worker offloading for physics computation
- Object-pooled beams and particles with zero steady-state allocations

### Developer Wrapped
Spotify Wrapped, but for your code. Discover your most productive months, longest streaks, peak coding hours, favorite commit words, and whether you're a night owl or an early bird — presented in animated slides you can share.

### AI-Powered Story
Claude processes thousands of commits — batching, summarizing, and weaving them into a narrative of your developer journey. Each repository gets its own chapter, unified into one story.

### Analytics Dashboard
Contribution heatmaps, commit frequency timelines, language breakdowns, coding pattern matrices, year-over-year growth, monthly breakdowns, superlatives, badges, and productivity metrics — all computed client-side from your real commit data.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| UI Components | [Radix UI](https://www.radix-ui.com) + [shadcn/ui](https://ui.shadcn.com) |
| State | [Zustand](https://zustand.docs.pmnd.rs) |
| Animation | [Framer Motion](https://www.framer.com/motion) |
| Charts | [Recharts](https://recharts.org) |
| AI | [Claude API](https://docs.anthropic.com) |
| Auth & Data | [GitHub REST API](https://docs.github.com/en/rest) + OAuth |
| Caching | IndexedDB (via [idb](https://github.com/jakearchibald/idb)) |
| Visualization | Canvas 2D / WebGL2 instanced rendering |
| Physics | Web Workers + SharedArrayBuffer |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub account
- A [Claude API key](https://console.anthropic.com) (optional — only needed for the Story feature)

### Setup

```bash
# Clone the repository
git clone https://github.com/mitiskuma/gitted.git
cd gitted

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your GitHub account to get started.

### Environment Variables

```bash
cp .env.example .env.local
```

Fill in your GitHub OAuth credentials. See [`.env.example`](.env.example) for all available variables. Claude API tokens are provided by users through the UI at runtime.

---

## Contributing

Contributions are welcome. Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your branch (`git checkout -b feature/something`)
3. Commit your changes
4. Push to the branch (`git push origin feature/something`)
5. Open a Pull Request

---

## License

MIT License. Copyright (c) 2026 mitiskuma. See [LICENSE](LICENSE) for details.

---

<div align="center">

Built with care for developers who ship.

[GitHub](https://github.com/mitiskuma/gitted) &nbsp;&middot;&nbsp; [Report a Bug](https://github.com/mitiskuma/gitted/issues)

</div>
