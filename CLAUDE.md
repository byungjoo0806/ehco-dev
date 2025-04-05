# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Commands
- Build: `npm run build` (builds for production)
- Dev: `npm run dev` (starts development server)
- Start: `npm run start` (runs production server)
- Lint: `npm run lint` (runs ESLint)
- Sitemap: `npm run postbuild` (generates sitemap)
- Algolia: `npm run sync-algolia` (syncs data to Algolia)

## Code Style Guidelines
- **TypeScript**: Use strict mode, proper typing for all functions/components
- **Components**: Function components with React hooks
- **Imports**: Use path aliases (`@/*`) for src directory imports
- **Formatting**: Use TailwindCSS for styling
- **Error Handling**: Try/catch blocks for async operations
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Architecture**: Follow Next.js App Router conventions
- **Linting**: ESLint with Next.js core-web-vitals preset