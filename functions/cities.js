// The cities an institution can be in, for the weather of the day's summary.
// The app shows the same list by id and name (constants/cities.ts); the
// coordinates stay here, so the server decides where the forecast is from.
// Coordinates are the city's centre, a few decimals are enough for a forecast.

const CITIES = [
  { id: "arica", name: "Arica", lat: -18.4783, lon: -70.3126 },
  { id: "iquique", name: "Iquique", lat: -20.2133, lon: -70.1503 },
  { id: "alto-hospicio", name: "Alto Hospicio", lat: -20.27, lon: -70.1 },
  { id: "calama", name: "Calama", lat: -22.4544, lon: -68.9294 },
  { id: "antofagasta", name: "Antofagasta", lat: -23.6509, lon: -70.3975 },
  { id: "copiapo", name: "Copiapó", lat: -27.3668, lon: -70.3323 },
  { id: "vallenar", name: "Vallenar", lat: -28.5708, lon: -70.7581 },
  { id: "la-serena", name: "La Serena", lat: -29.9027, lon: -71.2519 },
  { id: "coquimbo", name: "Coquimbo", lat: -29.9533, lon: -71.3395 },
  { id: "ovalle", name: "Ovalle", lat: -30.6015, lon: -71.199 },
  { id: "los-andes", name: "Los Andes", lat: -32.8337, lon: -70.5983 },
  { id: "san-felipe", name: "San Felipe", lat: -32.7507, lon: -70.7251 },
  { id: "quillota", name: "Quillota", lat: -32.8833, lon: -71.2489 },
  { id: "valparaiso", name: "Valparaíso", lat: -33.0472, lon: -71.6127 },
  { id: "vina-del-mar", name: "Viña del Mar", lat: -33.0245, lon: -71.5518 },
  { id: "quilpue", name: "Quilpué", lat: -33.0475, lon: -71.4425 },
  { id: "san-antonio", name: "San Antonio", lat: -33.5933, lon: -71.6217 },
  { id: "santiago", name: "Santiago", lat: -33.4489, lon: -70.6693 },
  { id: "puente-alto", name: "Puente Alto", lat: -33.6117, lon: -70.5758 },
  { id: "maipu", name: "Maipú", lat: -33.5167, lon: -70.7667 },
  { id: "san-bernardo", name: "San Bernardo", lat: -33.5922, lon: -70.6996 },
  { id: "melipilla", name: "Melipilla", lat: -33.6891, lon: -71.2153 },
  { id: "rancagua", name: "Rancagua", lat: -34.1708, lon: -70.7444 },
  { id: "san-fernando", name: "San Fernando", lat: -34.5853, lon: -70.9894 },
  { id: "curico", name: "Curicó", lat: -34.9828, lon: -71.2394 },
  { id: "talca", name: "Talca", lat: -35.4264, lon: -71.6554 },
  { id: "linares", name: "Linares", lat: -35.8467, lon: -71.5931 },
  { id: "cauquenes", name: "Cauquenes", lat: -35.9671, lon: -72.3225 },
  { id: "chillan", name: "Chillán", lat: -36.6066, lon: -72.1034 },
  { id: "concepcion", name: "Concepción", lat: -36.827, lon: -73.0503 },
  { id: "talcahuano", name: "Talcahuano", lat: -36.7249, lon: -73.1168 },
  { id: "coronel", name: "Coronel", lat: -37.0167, lon: -73.1333 },
  { id: "los-angeles", name: "Los Ángeles", lat: -37.4697, lon: -72.3537 },
  { id: "angol", name: "Angol", lat: -37.795, lon: -72.7167 },
  { id: "victoria", name: "Victoria", lat: -38.2333, lon: -72.3333 },
  { id: "lautaro", name: "Lautaro", lat: -38.5302, lon: -72.436 },
  { id: "temuco", name: "Temuco", lat: -38.7359, lon: -72.5904 },
  { id: "nueva-imperial", name: "Nueva Imperial", lat: -38.7447, lon: -72.9503 },
  { id: "villarrica", name: "Villarrica", lat: -39.2857, lon: -72.2279 },
  { id: "pucon", name: "Pucón", lat: -39.2823, lon: -71.9545 },
  { id: "valdivia", name: "Valdivia", lat: -39.8142, lon: -73.2459 },
  { id: "osorno", name: "Osorno", lat: -40.5739, lon: -73.1336 },
  { id: "puerto-varas", name: "Puerto Varas", lat: -41.3195, lon: -72.9854 },
  { id: "puerto-montt", name: "Puerto Montt", lat: -41.4693, lon: -72.9424 },
  { id: "ancud", name: "Ancud", lat: -41.8697, lon: -73.8203 },
  { id: "castro", name: "Castro", lat: -42.48, lon: -73.7622 },
  { id: "coyhaique", name: "Coyhaique", lat: -45.5712, lon: -72.0685 },
  { id: "puerto-natales", name: "Puerto Natales", lat: -51.7236, lon: -72.5064 },
  { id: "punta-arenas", name: "Punta Arenas", lat: -53.1638, lon: -70.9171 },
];

const BY_ID = new Map(CITIES.map(city => [city.id, city]));

function cityById(id) {
  return typeof id === "string" ? BY_ID.get(id) || null : null;
}

module.exports = { CITIES, cityById };
