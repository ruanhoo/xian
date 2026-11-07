// Map tile provider settings.
// Leave `tileUrl` empty to use plain OpenStreetMap (labels in Chinese inside China).
//
// The MapTiler key below is a browser key (public by design). Keep it restricted to your
// site's domain (plus localhost for testing) in the MapTiler dashboard.
//
// Other example:
//   Stadia: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=YOUR_KEY'
window.XIAN_CONFIG = {
  tileUrl: 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=XqFXUCX4ZAqv1hUERvsm',
  tileAttribution:
    '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> ' +
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  tileOptions: { maxZoom: 18 },
};
