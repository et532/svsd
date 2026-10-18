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
  'aeroway-area': '#f1f5ff',
  waterway: '#d5dbf5',
  highway_path: '#ece8f8',
  highway_minor: '#e6e0f7',
  highway_major_casing: '#dcd0f5',
  highway_major_inner: '#ffffff',
  highway_major_subtle: '#e6ddf5',
  highway_motorway_casing: '#f5cfe0',
  highway_motorway_inner: '#fff0f6',
  highway_motorway_subtle: '#f3d3e2',
  highway_motorway_bridge_casing: '#f5cfe0',
  highway_motorway_bridge_inner: '#fff0f6',
  tunnel_motorway_casing: '#f7dde8',
  tunnel_motorway_inner: '#fff6fa',
  railway: '#d9dff5',
  railway_transit: '#d9dff5',
  railway_service: '#d9dff5',
  'aeroway-taxiway': '#d9e3fb',
  'aeroway-runway-casing': '#d9e3fb',
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
      // Place names and other map text stay grey; road sign numbers a touch darker to read on the blue signs
      map.setPaintProperty(layer.id, 'text-color', layer.id.includes('shield') ? '#7c7c88' : '#9a9aa4')
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

// Pastel blue for the map's icons (road signs, airport, city dots), from darkest to lightest
const ICON_DARK = [124, 148, 226]
const ICON_LIGHT = [226, 234, 255]

// Recolor the base map's icons pastel blue, keeping their shapes: dark pixels become the deeper blue,
// light pixels the paler one. Call after the map has loaded, once its icon images are available.
export function tintIcons(map: maplibregl.Map, look: MapLook) {
  if (!looks[look].pastelFeatures) return
  for (const id of map.listImages()) {
    const image = map.getImage(id)
    if (!image || image.sdf) continue
    const { width, height, data } = image.data
    const tinted = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i += 4) {
      const lightness = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
      for (let c = 0; c < 3; c++) tinted[i + c] = ICON_DARK[c] + (ICON_LIGHT[c] - ICON_DARK[c]) * lightness
      tinted[i + 3] = data[i + 3]
    }
    map.updateImage(id, { width, height, data: tinted })
  }
}
