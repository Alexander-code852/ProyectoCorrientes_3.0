# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Ruta Correntina" — a tourism PWA for the city of Corrientes, Argentina (map of places, favorites, check-ins/points, an explore feed, and an AI chat assistant). UI copy, variable/function names, and comments are in Spanish (with local "correntino" slang in the AI fallback responses) — keep new code and copy consistent with that.

## Running the app

There is no `package.json`, bundler, or build step. This is plain HTML/CSS/JS using native ES modules (`<script type="module" src="./src/main.js">`).

- Serve the repo root with any static HTTP server (ES modules and the service worker require `http://`/`https://`, not `file://`), e.g. `npx serve .` or `python -m http.server`.
- There is no lint, test, or build command configured anywhere in the repo — don't invent one.
- `firebase.json` only configures a Cloud Functions codebase (source `functions`); that directory does not currently exist in the repo, and no Firebase Hosting config is present. `firebase deploy` is not fully wired up as-is.

## Architecture

Everything is loaded as native ES modules imported from `src/main.js`. Firebase SDK and all third-party libraries (Leaflet, Leaflet Routing Machine, Ionicons) are pulled from CDNs (`gstatic.com`, `unpkg.com`) directly in `index.html` / via CDN `import` URLs in JS — there are no npm dependencies.

- `src/core/store.js` — a single mutable `state` object (map instance, current user, lugares/favoritos/visitados arrays, active filters, etc.) imported by nearly every module. Treat this as the app's global state store; there is no reducer/event system around it, modules mutate it directly.
- `src/core/constants.js` — static config (GPS options, check-in radius, default map center, rewards catalog).
- `src/config/firebase.js` — initializes the Firebase app (Auth + Firestore) from a hardcoded config object; exports `auth`, `db`, `app`.
- `src/services/firebaseService.js` — the main data layer: fetches `lugares` (places) from Firestore and merges them with a hardcoded `LUGARES_PRECARGADOS` fallback list, renders map markers/popups, and also implements street-routing via a direct call to the public OSRM API (`router.project-osrm.org`, with route alternatives) plus a compact, accordion-style turn-by-turn nav card. Also loads community reports (`reportes`), user profiles (`users/{uid}`), and events (`eventos`, merged with `src/core/eventos.js`'s `EVENTOS_PRECARGADOS`) — rendered as map pins and in the Explore tab's "Eventos de la Semana" list.
- `src/core/eventos.js` — hand-curated seed list of real Corrientes Capital events (source portals noted per entry via a `fuente` field). Browser-side scraping of those portals isn't possible (no CORS headers on those sites); refreshing this list means re-checking the portals manually, or eventually adding a server-side scraper (e.g. a Cloud Function) that writes into the Firestore `eventos` collection instead.
- `src/services/geminiAi.js` — chat assistant. Calls a Firebase Callable Function `chatConGemini`; if that call fails (e.g. the function isn't deployed), it falls back to canned Spanish/correntino-slang responses matched by keyword. Also wires up Web Speech API (voice input via `SpeechRecognition`, voice output via `speechSynthesis`).
- `src/map/mapManager.js` — Leaflet map init, GPS geolocation/watch, user-location marker.
- `src/map/addPlaceManager.js` — click-to-add-place flow: map click → modal form → `addDoc` into Firestore `lugares`, then re-fetches via `firebaseService.fetchLugares()`.
- `src/map/routingManager.js` — a second, separate routing implementation using Leaflet Routing Machine (`L.Routing.control`), distinct from the OSRM-based routing in `firebaseService.js`. Both exist in parallel; check which one a given call site actually uses before changing routing behavior.
- `src/ui/uiManager.js` — SPA-style tab switching (`cambiarTab`) between the views defined in `index.html` (`view-map`, `view-explore`, `view-juegos`, `view-profile`), plus dark mode, toasts-adjacent UI, chat widget open/close, and profile edit/avatar handlers.
- `src/ui/authUI.js` — Firebase email/password sign-up and sign-in wiring for the full-screen auth form.
- `src/ui/templates.js` — returns HTML strings (e.g. the profile view) injected via `innerHTML`.
- `src/ui/events.js` — a single delegated `document` click listener plus the PWA `beforeinstallprompt` handler (note: `src/utils/pwa.js` also listens for `beforeinstallprompt` independently — there are two separate install-prompt code paths).
- `src/utils/helpers.js` / `src/utils/pwa.js` — distance calc, toast notifications, header greeting/date, and PWA install-button injection.
- `sw.js` — the service worker; its `ASSETS_TO_CACHE` list is stale (references a non-existent `./script.js` and is missing several current `src/` files like `addPlaceManager.js`, `routingManager.js`, `authUI.js`, `templates.js`) — update it when adding/removing source files if offline caching matters.

## Known rough edges

- Many inline `onclick="..."` handlers referenced from `templates.js`/`index.html` (e.g. `abrirFichaNombre`, `toggleFavorite`, `iniciarRuta`, `compartirLugar`, `enviarComentario`, `triggerCheckIn`) are not defined/exported anywhere in `src/` — these flows are incomplete/dangling; verify before assuming a UI action is wired up end-to-end. (The "Ver en el mapa" buttons in `view-explore` are an exception: they use a `data-ir-lugar` attribute handled by the delegated listener in `src/ui/events.js`, calling `irALugarPorNombre` in `src/services/firebaseService.js`.)
- Some DOM IDs referenced in JS don't match `index.html`'s current markup (e.g. `uiManager.js` targets `#ficha-lugar` and `#chat-messages`, while `index.html` defines `#bottom-sheet`/`#ficha-content` and `#chat-body`). Confirm the actual live ID in `index.html` before wiring new behavior to an element.
- `lugares.json` (root) and `style.css` (root) are orphaned/legacy — nothing in `src/` currently loads them (`index.html` loads `src/styles/main.css`; `firebaseService.js` uses a hardcoded `LUGARES_PRECARGADOS` array instead of `lugares.json`). `src/utils/helpers.js`'s `flattenLugares` was written for `lugares.json`'s shape but has no current caller.
- CSS is split under `src/styles/` (`_variables`, `_base`, `_map`, `_explore`, `_profile`, `_components`, `_responsive`) and combined via `@import` in `src/styles/main.css` — edit the relevant partial rather than `main.css` directly.
