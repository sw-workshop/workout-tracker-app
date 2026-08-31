# Workout Tracker App

Workout Tracker App is a small PWA for recording weighted workout sessions on a smartphone.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```

For GitHub Pages, build with the repository base path.

```bash
VITE_BASE_PATH=/workout-tracker-app/ npm run build
```

## Data Storage

Workout records are stored in browser localStorage.

Data is tied to the browser and origin. It is not synced across devices, and it may be lost if site data is deleted.
