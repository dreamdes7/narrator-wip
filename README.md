# Narrator

An interactive browser-based game featuring procedural world generation, a narrative storytelling system, and strategic gameplay elements. Explore kingdoms, interact with unique locations, and forge your own story in the world of **Ethereal**.

![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7.2.4-646CFF?logo=vite)

## Features

- **Procedural World Generation** — Every session creates a unique fantasy world with distinct kingdoms, cities, and landmarks.
- **Narrative System** — Interactive events with choices that impact your resources and story progression.
- **War Mode** — Strategic layer allowing for combat actions and territory conquest on the world map.
- **Dynamic Map** — Interactive visualization with diverse biomes (forests, mountains, plains, oceans) built with D3.js.
- **Resource Management** — Balance gold and mana reserves to sustain your journey.
- **Seasonal System** — Dynamic season changes that alter the visual atmosphere of the world.

## Tech Stack

- **React 19** — User Interface
- **TypeScript** — Type Safety & Logic
- **Vite** — Build Tool & Dev Server
- **D3.js** — Data Visualization & Map Geometry
- **Simplex Noise** — Procedural Generation Algorithms
- **Polygon Clipping** — Geometric Operations

## Quick Start

### Prerequisites

Ensure you have Node.js installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Production Build

Build the project for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## How to Play

1. **Explore** — Interact with the map by clicking on locations such as cities, fortresses, and ruins.
2. **Decide** — Choose your actions carefully: investigate mysteries, negotiate with locals, or declare war.
3. **Manage** — Monitor your Gold and Mana resources in the status bar.
4. **Control** — Use the interface controls to toggle between War/Peace modes or change the current season.

## Project Structure

```
narrator/
├── src/
│   ├── components/          # React components
│   │   ├── GameInterface.tsx    # Main game layout and logic
│   │   ├── WorldMap.tsx         # D3.js map visualization
│   │   └── ui/                  # UI elements (Cards, Logs, Status)
│   ├── services/
│   │   └── narrator.ts          # Narrative generation service
│   ├── types/
│   │   └── world.ts             # TypeScript interfaces for world data
│   ├── utils/
│   │   └── worldGenerator.ts    # Procedural generation algorithms
│   └── App.tsx                  # Application entry point
├── public/                  # Static assets
└── package.json
```

## License

This project is created for educational purposes.
