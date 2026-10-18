import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Person } from '../data/people'
import { modeInfo, type Mode } from '../modes'

// Free vector tiles, no API key needed.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
type Props = {
  people: Person[]
  mode: Mode
}

export function MapScreen({ people, mode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const isFirstData = useRef(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-40, 30],
      zoom: 1.1,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
    })

    map.on('load', () => {
      map.addSource('people', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 12,
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'people',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': modeInfo.from.color, // recolored to the current mode once data loads
          'circle-radius': ['step', ['get', 'point_count'], 14, 4, 18, 10, 22],
          'circle-stroke-width': 2.8,
          'circle-stroke-color': '#fff',
        },
      })
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'people',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#fff' },
      })
      map.addLayer({
        id: 'person',
        type: 'circle',
        source: 'people',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': modeInfo.from.color, // recolored to the current mode once data loads
          'circle-radius': 7.5,
          'circle-stroke-width': 2.8,
          'circle-stroke-color': '#fff',
        },
      })
      map.addLayer({
        id: 'person-label',
        type: 'symbol',
        source: 'people',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11.5,
          'text-offset': [0, 1.25],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#1F1D1A',
          'text-halo-color': '#fff',
          'text-halo-width': 1.6,
        },
      })


      setReady(true)
    })

    // Tap a cluster to zoom into it.
    map.on('click', 'clusters', async (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const source = map.getSource('people') as GeoJSONSource
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id)
      // On the globe the expansion zoom can be a barely visible step, so always zoom in a good amount.
      map.easeTo({ center: pointCoords(feature), zoom: Math.max(zoom, map.getZoom() + 2) })
    })

    // Tap a person to see who it is.
    map.on('click', 'person', (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({ offset: 13, closeButton: false, className: 'person-popup' })
        .setLngLat(pointCoords(feature))
        .setDOMContent(popupContent(feature.properties.name, feature.properties.caption))
        .addTo(map)
    })

    for (const layer of ['clusters', 'person']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const data = toGeoJSON(people, mode)
    ;(map.getSource('people') as GeoJSONSource).setData(data)
    popupRef.current?.remove()
    // Pins take the color of the current view so it's clear which places you're looking at.
    for (const layer of ['clusters', 'person']) map.setPaintProperty(layer, 'circle-color', modeInfo[mode].color)

    // Keep the opening globe view; after that, move to whoever matches the search or mode.
    if (isFirstData.current) {
      isFirstData.current = false
      return
    }
    const timer = setTimeout(() => fitToPeople(map, data), 350)
    return () => clearTimeout(timer)
  }, [people, mode, ready])

  return (
    <div className="screen map-screen">
      <div ref={containerRef} className="map-container" />
    </div>
  )
}

function toGeoJSON(people: Person[], mode: Mode): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: people.map((person) => {
      const place = person[mode]
      const [dx, dy] = jitter(person.id)
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [place.lng + dx, place.lat + dy] },
        properties: { id: person.id, name: person.name, caption: caption(person, mode) },
      }
    }),
  }
}

function fitToPeople(map: maplibregl.Map, data: GeoJSON.FeatureCollection<GeoJSON.Point>) {
  if (data.features.length === 0) return
  const bounds = new maplibregl.LngLatBounds()
  for (const feature of data.features) bounds.extend(feature.geometry.coordinates as [number, number])
  // People spread around the world: show the whole globe rather than a zoomed slice of it.
  if (bounds.getEast() - bounds.getWest() > 120) {
    map.easeTo({ center: bounds.getCenter(), zoom: 1.1, duration: 900 })
    return
  }
  map.fitBounds(bounds, {
    // Leave room for the search bar and bottom bar.
    padding: { top: 110, bottom: 120, left: 40, right: 40 },
    maxZoom: 9,
    duration: 900,
  })
}

function caption(person: Person, mode: Mode): string {
  if (mode === 'from') return `From ${person.from.city}`
  if (mode === 'met') return `Met at ${person.met.context} · ${person.met.city}`
  return `Lives in ${person.livesNow.city}`
}

// Small stable offset so people in the same city don't sit exactly on top of each other.
function jitter(id: string): [number, number] {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180)
  const r = 0.004 + ((hash >>> 8) % 100) / 10000
  return [Math.cos(angle) * r, Math.sin(angle) * r]
}

function pointCoords(feature: MapGeoJSONFeature): [number, number] {
  const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates
  return [lng, lat]
}

function popupContent(name: string, caption: string): HTMLElement {
  const root = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = name
  const sub = document.createElement('div')
  sub.textContent = caption
  root.append(title, sub)
  return root
}
