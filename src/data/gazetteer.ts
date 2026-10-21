// Where things are. Neighborhood -> borough -> city -> metro, with coordinates and the names people use for them
// ("BK", "the city", "the Bay"). Coverage is the places this app's people live, plus the big cities; an unknown
// place resolves to nothing rather than a guess (ponytail: add a cached geocoder later if real users need more).

export type PlaceKind = 'hood' | 'borough' | 'city' | 'region'

export type PlaceRec = {
  id: string
  name: string
  kind: PlaceKind
  parent?: string // id of the borough / city it sits in
  lat: number
  lng: number
  aliases?: string[]
  metro?: string // id into METROS; people in the same metro are "in the area" of each other
}

export const METROS: Record<string, { name: string; radiusKm: number }> = {
  nyc: { name: 'New York City', radiusKm: 55 },
  bay: { name: 'the Bay Area', radiusKm: 60 },
  chi: { name: 'Chicago', radiusKm: 60 },
  la: { name: 'Los Angeles', radiusKm: 60 },
  bos: { name: 'Boston', radiusKm: 35 },
  sea: { name: 'Seattle', radiusKm: 40 },
  dc: { name: 'Washington, DC', radiusKm: 45 },
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

type Row = [name: string, lat: number, lng: number, aliases?: string[]]
const mk = (kind: PlaceKind, parent: string | undefined, metro: string | undefined, rows: Row[]): PlaceRec[] =>
  rows.map(([name, lat, lng, aliases]) => ({ id: slug(name), name, kind, parent, lat, lng, aliases, metro }))

// ---- New York City ----
const boroughs: PlaceRec[] = [
  ...mk('borough', 'new-york', 'nyc', [
    ['Brooklyn', 40.678, -73.944, ['bk', 'brooklyn ny', 'brooklyn, ny']],
    ['Manhattan', 40.776, -73.971, ['manhattan ny', 'manhattan, ny', 'the city manhattan']],
    ['Queens', 40.728, -73.794, ['queens ny', 'queens, ny']],
    ['Bronx', 40.845, -73.865, ['the bronx']],
    ['Staten Island', 40.58, -74.15],
  ]),
]

export const PLACES: PlaceRec[] = [
  {
    id: 'new-york',
    name: 'New York City',
    kind: 'city',
    lat: 40.741,
    lng: -73.99,
    aliases: ['new york', 'nyc', 'new york city', 'new york ny', 'new york, ny', 'ny', 'the city', 'big apple'],
    metro: 'nyc',
  },
  ...boroughs,
  ...mk('hood', 'brooklyn', 'nyc', [
    ['Bushwick', 40.6944, -73.9213],
    ['East Williamsburg', 40.7144, -73.9363, ['e williamsburg']],
    ['Williamsburg', 40.7081, -73.9571, ['williamsburg brooklyn', 'billyburg']],
    ['Greenpoint', 40.7304, -73.9515],
    ['Bed-Stuy', 40.6872, -73.9418, ['bed stuy', 'bedstuy', 'bedford stuyvesant']],
    ['Crown Heights', 40.6694, -73.9442],
    ['Prospect Lefferts Gardens', 40.6597, -73.9526, ['plg']],
    ['Park Slope', 40.671, -73.9814],
    ['Prospect Heights', 40.6775, -73.9692],
    ['Fort Greene', 40.6892, -73.9742],
    ['Clinton Hill', 40.6896, -73.9661],
    ['Boerum Hill', 40.6858, -73.9836],
    ['Cobble Hill', 40.686, -73.9962],
    ['Carroll Gardens', 40.6795, -73.9991],
    ['Gowanus', 40.6745, -73.9879],
    ['Red Hook', 40.6734, -74.0083],
    ['Sunset Park', 40.6454, -74.0124],
    ['Bay Ridge', 40.6264, -74.0299],
    ['DUMBO', 40.7033, -73.9881],
    ['Downtown Brooklyn', 40.6928, -73.9903],
    ['Flatbush', 40.6414, -73.9594],
    ['Ditmas Park', 40.6366, -73.9611],
    ['Brighton Beach', 40.5776, -73.9614],
  ]),
  ...mk('hood', 'manhattan', 'nyc', [
    ['Lower East Side', 40.715, -73.9843, ['les', 'the les']],
    ['East Village', 40.7265, -73.9815],
    ['West Village', 40.7358, -74.0036],
    ['Greenwich Village', 40.7335, -74.0027],
    ['SoHo', 40.7233, -74.003],
    ['Nolita', 40.7233, -73.9955],
    ['Tribeca', 40.7163, -74.0086],
    ['Chinatown', 40.7158, -73.997],
    ['Financial District', 40.7075, -74.0113, ['fidi']],
    ['Chelsea', 40.7465, -74.0014],
    ['Flatiron', 40.7411, -73.9897],
    ['Union Square', 40.7359, -73.9911],
    ['Gramercy', 40.7368, -73.9845],
    ['Murray Hill', 40.7479, -73.9757],
    ['Midtown', 40.7549, -73.984],
    ['Hell’s Kitchen', 40.7638, -73.9918, ['hells kitchen', 'hell s kitchen']],
    ['Upper West Side', 40.787, -73.9754, ['uws']],
    ['Upper East Side', 40.7736, -73.9566, ['ues']],
    ['Harlem', 40.8116, -73.9465],
    ['Washington Heights', 40.8417, -73.9393],
    ['Morningside Heights', 40.81, -73.9626],
  ]),
  ...mk('hood', 'queens', 'nyc', [
    ['Astoria', 40.7644, -73.9235],
    ['Long Island City', 40.7447, -73.9485, ['lic']],
    ['Sunnyside', 40.7433, -73.9196],
    ['Woodside', 40.7454, -73.903],
    ['Jackson Heights', 40.7557, -73.8831],
    ['Elmhurst', 40.7365, -73.8794],
    ['Flushing', 40.7675, -73.8331],
    ['Ridgewood', 40.7043, -73.9018],
    ['Forest Hills', 40.7185, -73.8448],
    ['Jamaica', 40.7027, -73.789],
  ]),
  ...mk('hood', 'bronx', 'nyc', [
    ['Mott Haven', 40.809, -73.9229],
    ['Riverdale', 40.8903, -73.9126],
  ]),
  ...mk('city', undefined, 'nyc', [
    ['Jersey City', 40.718, -74.043, ['jersey city nj', 'jersey city, nj', 'jc']],
    ['Hoboken', 40.744, -74.0324, ['hoboken nj', 'hoboken, nj']],
    ['Newark', 40.7357, -74.1724],
    ['Yonkers', 40.9312, -73.8988],
  ]),

  // ---- Bay Area ----
  ...mk('city', undefined, 'bay', [
    ['San Francisco', 37.776, -122.417, ['sf', 'san fran', 'the bay', 'bay area', 'the bay area', 'sfo']],
    ['Oakland', 37.804, -122.271, ['oakland ca', 'oakland, ca']],
    ['Berkeley', 37.872, -122.272, ['berkeley ca', 'berkeley, ca']],
    ['San Jose', 37.339, -121.894],
    ['Palo Alto', 37.4419, -122.143],
    ['Mountain View', 37.3861, -122.0839],
    ['Menlo Park', 37.453, -122.1817],
    ['Cupertino', 37.323, -122.0322],
  ]),
  ...mk('hood', 'san-francisco', 'bay', [
    ['Mission', 37.7599, -122.4148, ['the mission', 'mission district']],
    ['SoMa', 37.7785, -122.4056],
    ['Hayes Valley', 37.7759, -122.4245],
  ]),

  // ---- Chicago ----
  ...mk('city', undefined, 'chi', [
    ['Chicago', 41.878, -87.63, ['chicago il', 'chicago, il', 'chi', 'chitown', 'the windy city']],
    ['Naperville', 41.7508, -88.1535, ['naperville il', 'naperville, il']],
    ['Evanston', 42.0451, -87.6877],
  ]),
  ...mk('hood', 'chicago', 'chi', [
    ['Wicker Park', 41.9088, -87.6796],
    ['Logan Square', 41.9234, -87.7085],
    ['Lincoln Park', 41.9214, -87.6513],
    ['Pilsen', 41.8525, -87.6614],
  ]),

  // ---- Los Angeles ----
  ...mk('city', undefined, 'la', [
    ['Los Angeles', 34.052, -118.244, ['la', 'l.a.', 'los angeles ca', 'socal']],
    ['Santa Monica', 34.0195, -118.4912],
  ]),
  ...mk('hood', 'los-angeles', 'la', [
    ['Silver Lake', 34.0869, -118.2702],
    ['Echo Park', 34.0782, -118.2606],
  ]),

  // ---- Boston ----
  ...mk('city', undefined, 'bos', [
    ['Boston', 42.36, -71.059, ['boston ma', 'beantown']],
    ['Cambridge', 42.3736, -71.1097, ['cambridge ma']],
    ['Somerville', 42.3876, -71.0995],
  ]),

  // ---- Seattle ----
  ...mk('city', undefined, 'sea', [['Seattle', 47.606, -122.332, ['seattle wa']], ['Bellevue', 47.6101, -122.2015]]),
  ...mk('hood', 'seattle', 'sea', [['Capitol Hill', 47.6253, -122.3222]]),

  // ---- Washington DC ----
  ...mk('city', undefined, 'dc', [['Washington, DC', 38.907, -77.037, ['washington dc', 'dc', 'washington']], ['Arlington', 38.8816, -77.091]]),

  // ---- Everywhere else (one entry per city, its own area) ----
  ...mk('city', undefined, undefined, [
    ['Portland', 45.515, -122.679, ['portland or', 'portland oregon']],
    ['Denver', 39.739, -104.99],
    ['Austin', 30.267, -97.743, ['atx', 'austin tx']],
    ['Houston', 29.76, -95.37],
    ['Dallas', 32.7767, -96.797],
    ['Philadelphia', 39.952, -75.165, ['philly']],
    ['Atlanta', 33.749, -84.388, ['atl']],
    ['Miami', 25.7617, -80.1918],
    ['Minneapolis', 44.9778, -93.265],
    ['Madison', 43.0731, -89.4012, ['madison wi']],
    ['Ann Arbor', 42.2808, -83.743, ['ann arbor mi', 'a2']],
    ['Detroit', 42.3314, -83.0458],
    ['Columbus', 39.9612, -82.9988],
    ['Indianapolis', 39.7684, -86.1581],
    ['St. Louis', 38.627, -90.1994, ['saint louis', 'st louis']],
    ['Nashville', 36.1627, -86.7816],
    ['Pittsburgh', 40.4406, -79.9959],
    ['Toronto', 43.653, -79.383],
    ['Vancouver', 49.283, -123.121],
    ['Mexico City', 19.432, -99.133, ['cdmx']],
    ['Buenos Aires', -34.604, -58.382],
    ['São Paulo', -23.551, -46.633, ['sao paulo']],
    ['Lagos', 6.524, 3.379],
    ['Accra', 5.604, -0.187],
    ['Nairobi', -1.292, 36.822],
    ['London', 51.507, -0.128],
    ['Dublin', 53.349, -6.26],
    ['Paris', 48.857, 2.352],
    ['Berlin', 52.52, 13.405],
    ['Hamburg', 53.551, 9.993],
    ['Copenhagen', 55.676, 12.568],
    ['Milan', 45.464, 9.19],
    ['Lisbon', 38.722, -9.139],
    ['Beirut', 33.894, 35.502],
    ['Karachi', 24.861, 67.01],
    ['Mumbai', 19.076, 72.878],
    ['Bangalore', 12.972, 77.595, ['bengaluru']],
    ['Taipei', 25.033, 121.565],
    ['Tokyo', 35.676, 139.65],
    ['Osaka', 34.694, 135.502],
    ['Seoul', 37.566, 126.978],
    ['Sydney', -33.869, 151.209],
    ['Melbourne', -37.814, 144.963],
    ['Cleveland', 41.4993, -81.6944],
    ['Phoenix', 33.4484, -112.074],
    ['Rochester', 43.1566, -77.6088, ['rochester ny', 'rochester, ny']],
    ['Edison', 40.5187, -74.4121, ['edison nj', 'edison, nj']],
    ['Grand Rapids', 42.9634, -85.6681],
    ['Milwaukee', 43.0389, -87.9065],
    ['Honolulu', 21.3069, -157.8583],
    ['San Antonio', 29.4241, -98.4936],
    ['Fairfax', 38.8462, -77.3064],
    ['Montreal', 45.5017, -73.5673],
    ['Pune', 18.5204, 73.8567],
    ['Dubai', 25.2048, 55.2708],
    ['Aarhus', 56.1629, 10.2039],
    ['El Paso', 31.7619, -106.485],
    ['Gary', 41.5934, -87.3464],
    ['Cincinnati', 39.1031, -84.512],
    ['Joliet', 41.525, -88.0817],
    ['Haifa', 32.794, 34.9896],
    ['Quebec City', 46.8139, -71.208],
    ['Dakar', 14.7167, -17.4677],
    ['Charleston', 32.7765, -79.9311],
    ['Tehran', 35.6892, 51.389],
    ['Charlotte', 35.2271, -80.8431],
    ['Baltimore', 39.2904, -76.6122],
    ['Kyiv', 50.4501, 30.5234],
    ['Santiago', -33.4489, -70.6693],
    ['Lahore', 31.5204, 74.3587],
    ['Kingston', 17.9714, -76.7936],
    ['Bogota', 4.711, -74.0721],
    ['Cairo', 30.0444, 31.2357],
    ['Hong Kong', 22.3193, 114.1694],
    ['Lyon', 45.764, 4.8357],
    ['Athens', 37.9838, 23.7275],
    ['Kyoto', 35.0116, 135.7681],
    ['San Juan', 18.4655, -66.1057],
    ['Rio de Janeiro', -22.9068, -43.1729],
    ['Naples', 40.8518, 14.2681],
    ['Madrid', 40.4168, -3.7038],
    ['Providence', 41.824, -71.4128],
    ['Birmingham', 33.5186, -86.8104],
    ['Munich', 48.1351, 11.582],
    ['New Orleans', 29.9511, -90.0715],
    ['Prague', 50.0755, 14.4378],
    ['Warsaw', 52.2297, 21.0122],
    ['Santo Domingo', 18.4861, -69.9312],
    ['Stockholm', 59.3293, 18.0686],
  ]),
]
