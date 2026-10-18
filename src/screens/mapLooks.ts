import type maplibregl from 'maplibre-gl'

// Base-map looks we're comparing. See them side by side at #/map-looks, or open one with #/?look=b.
export type MapLook = 'a' | 'b' | 'c' | 'd'

export const mapLooks: { id: MapLook; name: string; description: string }[] = [
  {
    id: 'a',
    name: 'Soft frosted',
    description:
      'A refined version of today’s map: white land, pale lavender oceans, a lavender glow around the globe. Labels only appear once you zoom in.',
  },
  {
    id: 'b',
    name: 'Pastel ocean',
    description:
      'Oceans in soft lilac with a pink-to-peach glow behind the globe, so the globe itself feels like one of the gradient orbs.',
  },
  {
    id: 'c',
    name: 'Glass globe',
    description:
      'A see-through globe: frosted white land and clear oceans with a pastel gradient glowing through from behind, like frosted glass.',
  },
  {
    id: 'd',
    name: 'Minimal mono',
    description:
      'Almost no color in the map at all: light grey land, white oceans, no glow. The pastel dots are the only color on screen.',
  },
]

type LookStyle = {
  land: string
  landOpacity: number
  water: string
  waterOpacity: number
  // Other filled areas (parks, landcover, buildings)
  fillOpacity: number
  horizon: string
  atmosphere: boolean
  // Show the pastel glow behind the globe (a CSS layer, see .globe-glow)
  glow: boolean
  // Tint roads, parks, buildings and borders in soft pastels (otherwise the map's own greys)
  pastelFeatures: boolean
}

// Soft pastel colors for map features, keyed by the base style's layer ids.
// Pink for motorways, lilac for other roads and buildings, mint for green space, lavender for borders and rivers.
const pastelFeatureColors: Record<string, string> = {
  park: '#e2f5eb',
  landcover_wood: '#dcf1e5',
  landuse_residential: '#f8f4f7',
  building: '#f0eaf8',
  'aeroway-area': '#f7f5fa',
  waterway: '#d5dbf5',
  highway_path: '#efebf7',
  highway_minor: '#ebe5f6',
  highway_major_casing: '#e4d9f5',
  highway_major_inner: '#ffffff',
  highway_major_subtle: '#e6ddf5',
  highway_motorway_casing: '#f5cfe0',
  highway_motorway_inner: '#fff0f6',
  highway_motorway_subtle: '#f3d3e2',
  highway_motorway_bridge_casing: '#f5cfe0',
  highway_motorway_bridge_inner: '#fff0f6',
  tunnel_motorway_casing: '#f7dde8',
  tunnel_motorway_inner: '#fff6fa',
  railway: '#e3def0',
  railway_transit: '#e3def0',
  railway_service: '#e3def0',
  boundary_2: '#cbc1ec',
  boundary_3: '#d8d0f1',
  boundary_disputed: '#d8d0f1',
}

const looks: Record<MapLook, LookStyle> = {
  a: {
    land: '#fcfcfd',
    landOpacity: 1,
    water: '#ebeaf8',
    waterOpacity: 1,
    fillOpacity: 0.9,
    horizon: '#ece4ff',
    atmosphere: true,
    glow: false,
    pastelFeatures: true,
  },
  b: {
    land: '#ffffff',
    landOpacity: 1,
    water: '#eadffc',
    waterOpacity: 1,
    fillOpacity: 0.9,
    horizon: '#ffe0ee',
    atmosphere: true,
    glow: true,
    pastelFeatures: true,
  },
  c: {
    land: '#ffffff',
    landOpacity: 0.62,
    water: '#f4f0ff',
    waterOpacity: 0.2,
    fillOpacity: 0.5,
    horizon: '#efe6ff',
    atmosphere: true,
    glow: true,
    pastelFeatures: true,
  },
  d: {
    land: '#f3f3f5',
    landOpacity: 1,
    water: '#ffffff',
    waterOpacity: 1,
    fillOpacity: 0.35,
    horizon: '#ffffff',
    atmosphere: false,
    glow: false,
    pastelFeatures: false,
  },
}

export const lookHasGlow = (look: MapLook) => looks[look].glow

// Restyle the base map (called once its style loads). Our own pin layers are added afterwards, so they aren't touched.
export function applyLook(map: maplibregl.Map, look: MapLook) {
  const style = looks[look]
  for (const layer of map.getStyle().layers) {
    const pastel = style.pastelFeatures ? pastelFeatureColors[layer.id] : undefined
    if (pastel && (layer.type === 'line' || layer.type === 'fill')) {
      map.setPaintProperty(layer.id, layer.type === 'line' ? 'line-color' : 'fill-color', pastel)
    }

    if (layer.type === 'background') {
      map.setPaintProperty(layer.id, 'background-color', style.land)
      map.setPaintProperty(layer.id, 'background-opacity', style.landOpacity)
    } else if (layer.type === 'raster') {
      // Shaded relief: too busy for this style
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    } else if (layer.type === 'fill' && layer.id.includes('water')) {
      map.setPaintProperty(layer.id, 'fill-color', style.water)
      map.setPaintProperty(layer.id, 'fill-opacity', style.waterOpacity)
    } else if (layer.type === 'fill') {
      map.setPaintProperty(layer.id, 'fill-opacity', style.fillOpacity)
    } else if (layer.type === 'symbol') {
      // Keep the globe clean: place names only once you zoom in
      map.setLayerZoomRange(layer.id, 3, 24)
      map.setPaintProperty(layer.id, 'text-color', '#9a9aa4')
      map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(255,255,255,0.85)')
    }
  }
  map.setSky({
    'sky-color': '#ffffff',
    'horizon-color': style.horizon,
    'fog-color': '#ffffff',
    'atmosphere-blend': style.atmosphere ? ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] : 0,
  })
}
