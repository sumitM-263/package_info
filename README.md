# PackageLens

PackageLens is a HyperDart React component for looking up npm packages. It shows live package metadata, compares packages, and finds alternatives using data from the npm registry and npm downloads API.

The app does not show a demo package on initial open. It displays package results after it receives a usable package query.

## Features

- Package details: latest version, description, license, release date, dependency count, unpacked size, and download history.
- Comparisons for up to three packages, including downloads, release dates, sizes, dependency counts, licenses, and deprecation notices when available.
- Alternative suggestions ranked using shared keywords and weekly downloads.
- Loading, empty, partial-data, and error states, with retry actions for package loading errors.

## Requirements

- Node.js and npm
- Network access to `registry.npmjs.org` and `api.npmjs.org` for live package data

## Run locally

From the project directory:

```sh
npm install
npm start
```

Open the local URL printed by Vite in your browser. The sandbox is configured through `src/sandbox/main.jsx` and `src/sandbox/index.css`.

## Example searches

- `react`
- `latest version of express`
- `compare react vs vue`
- `alternatives to moment`

In HyperDart, `hyperdart.config.js` declares the keywords and query patterns that activate the component. The platform provides the raw query as `searchQuery` and may provide parsed entities through `searchData`. PackageLens uses those entities when available and falls back to extracting package-like names from the raw query.

## Data and errors

Package information is fetched at runtime; it is not bundled as static search data. Package details come from the npm registry, and download counts come from the npm downloads API. Responses are cached in memory for five minutes. The shared HTTP helper applies timeouts and retries. If supplementary metadata or download history is unavailable, the component can still show the package with partial data; if the latest package record cannot be loaded, it shows an error with a retry option.

## Build

```sh
npm run build
```

Vite writes the built component to `dist/`. The package's `prepublishOnly` script runs `scripts/validate-publish.js` before publishing. Replace the placeholder GitHub and YouTube URLs in `hyperdart.config.js` with real project information before publishing.

## Project structure

- `src/frontend/PackageLens.jsx`: query-driven UI and result states.
- `src/frontend/logic/`: package-name normalization and intent detection.
- `src/frontend/api/`: npm API requests and shared HTTP handling.
- `src/sandbox/`: local sandbox entry point and styles.
- `hyperdart.config.js`: HyperDart triggers, query patterns, and component configuration.
- `resource.json`: optional structured-query schema metadata; the current UI does not depend on it.
