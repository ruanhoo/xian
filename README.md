# Hello Xi'an! 🏯

Cartoon-style, mobile-responsive travel guide to Xi'an, China, with sights and food on an interactive map.

## Run
No build step. From this folder:

    python3 -m http.server 8765

then open http://localhost:8765

## Island version (`island/`)
A second, canvas-drawn "living island" take on the same data: open http://localhost:8765/island/ (linked from the main nav; the island page links back to the classic map).
- Five hex islands (Ancient City, Muslim Quarter, Tang Town, Daming Palace, Day-Trip Isle) joined by bridges; landmarks are big buildings, food places are small shops.
- Little people walk between islands, eat, chat and follow an "Emperor" who issues decrees; day/dusk/night/auto cycle with lanterns; labels, follow, pause, bird's-eye, journal.
- Searchable list with favorites (shared `xian-fav` key), place cards, a route planner (nearest-neighbour order, travel/visit times, route drawn on the islands), a 5-step intro, EN / 中文.
- Files: `island/index.html`, `island.css`, `island.js` (engine + UI), `strings.js` (all text). It reuses `js/data.js` and `js/i18n.js`. No tiles or API key needed.
- Debug URL params: `?nointro`, `?lang=zh`, `?tod=0..3`, `?sel=<place id>`, `?panel=drawer|plan|log`, `?route=id,id,...`, `?warm=<seconds>`.

## Structure
- `index.html`  page layout, inline SVG hero illustration
- `css/style.css`  cartoon theme (thick outlines, hard shadows, pastel palette); mobile-first
- `js/i18n.js`  UI strings + Chinese place descriptions for the EN / 中文 toggle
- `js/data.js`  all places (sights + food). Add a new object here and it appears on the map and in the list
- `js/config.js`  map tile provider (URL + attribution)
- `js/app.js`  Leaflet map, clustering, filters, card <-> pin syncing
- `vendor/`  Leaflet 1.9.4 and markercluster 1.5.3 (vendored, no CDN)

## Notes
- Tiles come from tile.openstreetmap.org (no API key). Fine for development and light traffic; use a hosted tile provider before a high-traffic launch.
- Mario-style map: pins are "?" blocks (sights) and warp pipes (food); clusters are coins; the selected pin bumps and pops a coin. Tiles are MapTiler `streets-v2` with a saturation boost (`.leaflet-tile-pane` filter in `css/style.css`). These are ordinary raster tiles, so the map is brightened rather than truly redrawn; a fully illustrated map would need a custom vector style.
- Language toggle: EN / 中文 in the header (remembered in localStorage; `?lang=zh` also works). English mode uses MapTiler tiles (English labels, key in `js/config.js`); Chinese mode uses OpenStreetMap tiles (Chinese labels). With no MapTiler key, both use OSM.
- New place: add it to `js/data.js` and its Chinese `blurb`/`tip` under `places.zh` in `js/i18n.js` (falls back to English if missing).
- Food pins mark good *areas* for a dish, not specific endorsed restaurants.
- Layout: mobile = map on top + swipeable cards below; >=900px = card list left, map right.
