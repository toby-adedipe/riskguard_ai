// All LGAs from data-engine/build_lga_map.py — organised by city
export interface LGAMeta {
  id: string;       // snake_case slug matching backend lga_id
  name: string;     // display name
  city: string;
  state: string;
  tower_prefix: string;
}

export interface PastIncident {
  id: string;
  date: string;
  cause: string;
  duration: string;
  affectedSubs: number;
  resolved: boolean;
}

// Slugify helper — matches backend convention
function slug(name: string): string {
  return name.toLowerCase().replace(/[-\s]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

const CITY_TO_STATE: Record<string, string> = {
  Lagos: "Lagos",
  Abuja: "FCT",
  Kano: "Kano",
  "Port Harcourt": "Rivers",
  Ibadan: "Oyo",
  Ilorin: "Kwara",
  Enugu: "Enugu",
  "Benin City": "Edo",
  Calabar: "Cross River",
  Aba: "Abia",
  Kaduna: "Kaduna",
  Warri: "Delta",
  Abeokuta: "Ogun",
  Onitsha: "Anambra",
  Jos: "Plateau",
};

const RAW: Record<string, { prefix: string; lgas: string[] }> = {
  Lagos: {
    prefix: "LAG",
    lgas: [
      "Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa",
      "Badagry", "Epe", "Eti-Osa", "Ibeju-Lekki", "Ifako-Ijaiye",
      "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland",
      "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere",
    ],
  },
  Abuja: {
    prefix: "ABJ",
    lgas: ["Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji"],
  },
  Kano: {
    prefix: "KAN",
    lgas: [
      "Kano Municipal", "Fagge", "Dala", "Gwale", "Tarauni",
      "Nassarawa", "Ungogo", "Kumbotso", "Dawakin Tofa",
    ],
  },
  "Port Harcourt": {
    prefix: "POR",
    lgas: ["Port Harcourt", "Obio-Akpor", "Eleme", "Oyigbo", "Okrika"],
  },
  Ibadan: {
    prefix: "IBA",
    lgas: [
      "Ibadan North", "Ibadan North-East", "Ibadan North-West",
      "Ibadan South-East", "Ibadan South-West", "Egbeda", "Ona-Ara",
    ],
  },
  Ilorin: {
    prefix: "ILO",
    lgas: ["Ilorin West", "Ilorin East", "Ilorin South"],
  },
  Enugu: {
    prefix: "ENU",
    lgas: ["Enugu North", "Enugu South", "Igbo-Eze North", "Nkanu West"],
  },
  "Benin City": {
    prefix: "BEN",
    lgas: ["Oredo", "Ikpoba-Okha", "Egor", "Ovia North-East"],
  },
  Calabar: {
    prefix: "CAL",
    lgas: ["Calabar Municipal", "Calabar South", "Akpabuyo"],
  },
  Aba: {
    prefix: "ABA",
    lgas: ["Aba North", "Aba South", "Osisioma"],
  },
  Kaduna: {
    prefix: "KAD",
    lgas: ["Kaduna North", "Kaduna South", "Chikun", "Igabi"],
  },
  Warri: {
    prefix: "WAR",
    lgas: ["Warri South", "Warri North", "Warri South-West", "Uvwie"],
  },
  Abeokuta: {
    prefix: "ABE",
    lgas: ["Abeokuta North", "Abeokuta South", "Obafemi-Owode", "Odeda"],
  },
  Onitsha: {
    prefix: "ONI",
    lgas: ["Onitsha North", "Onitsha South", "Ogbaru", "Oyi"],
  },
  Jos: {
    prefix: "JOS",
    lgas: ["Jos North", "Jos South", "Riyom", "Barkin Ladi"],
  },
};

// Build flat LGA list
export const ALL_LGA_META: LGAMeta[] = Object.entries(RAW).flatMap(
  ([city, { prefix, lgas }]) =>
    lgas.map((name) => ({
      id: slug(name),
      name,
      city,
      state: CITY_TO_STATE[city] ?? city,
      tower_prefix: prefix,
    })),
);

export const LGA_BY_ID: Record<string, LGAMeta> = Object.fromEntries(
  ALL_LGA_META.map((l) => [l.id, l]),
);

// Build the lgaNames map for api.ts compatibility (id → display name)
export const LGA_NAMES: Record<string, string> = Object.fromEntries(
  ALL_LGA_META.map((l) => [l.id, l.name]),
);

// Static demo past incidents per LGA (subset — major LGAs get richer history)
export const PAST_INCIDENTS: Record<string, PastIncident[]> = {
  ikeja: [
    { id: "INC-2026-IKJ-001", date: "2026-05-05", cause: "Fibre cut — Oshodi-Ikeja trunk", duration: "2h 14m", affectedSubs: 84200, resolved: true },
    { id: "INC-2026-IKJ-002", date: "2026-04-18", cause: "BTS power failure — Oregun cluster", duration: "47m", affectedSubs: 12400, resolved: true },
    { id: "INC-2026-IKJ-003", date: "2026-03-02", cause: "Core signalling storm — MME overload", duration: "1h 03m", affectedSubs: 38900, resolved: true },
  ],
  alimosho: [
    { id: "INC-2026-ALI-001", date: "2026-04-29", cause: "Generator failure — fuel exhaustion", duration: "1h 38m", affectedSubs: 21000, resolved: true },
    { id: "INC-2026-ALI-002", date: "2026-03-14", cause: "Transmission link degradation", duration: "3h 22m", affectedSubs: 55000, resolved: true },
  ],
  apapa: [
    { id: "INC-2026-APA-001", date: "2026-05-01", cause: "Port area fibre vandalism", duration: "5h 10m", affectedSubs: 9800, resolved: true },
  ],
  surulere: [
    { id: "INC-2026-SUR-001", date: "2026-04-10", cause: "Radio congestion — live event overflow", duration: "35m", affectedSubs: 7400, resolved: true },
  ],
  "eti_osa": [
    { id: "INC-2026-ETI-001", date: "2026-04-22", cause: "Submarine cable micro-cut", duration: "22m", affectedSubs: 4200, resolved: true },
  ],
  abuja_municipal: [
    { id: "INC-2026-ABJ-001", date: "2026-04-30", cause: "Core router failover — partial path loss", duration: "18m", affectedSubs: 15600, resolved: true },
  ],
  "port_harcourt": [
    { id: "INC-2026-PHC-001", date: "2026-04-25", cause: "Pipeline fire — tower damage", duration: "6h 45m", affectedSubs: 62000, resolved: true },
    { id: "INC-2026-PHC-002", date: "2026-03-08", cause: "Flooding — baseband unit failure", duration: "4h 12m", affectedSubs: 38000, resolved: true },
  ],
  kano_municipal: [
    { id: "INC-2026-KAN-001", date: "2026-04-15", cause: "Power grid outage — NEPA failure", duration: "8h 20m", affectedSubs: 91000, resolved: true },
  ],
  obio_akpor: [
    { id: "INC-2026-OBI-001", date: "2026-05-02", cause: "Equipment theft — battery bank", duration: "2h 55m", affectedSubs: 18300, resolved: true },
  ],
};

// LGAs grouped by city for the sidebar city filter
export const LGAS_BY_CITY: Record<string, LGAMeta[]> = {};
for (const lga of ALL_LGA_META) {
  if (!LGAS_BY_CITY[lga.city]) LGAS_BY_CITY[lga.city] = [];
  LGAS_BY_CITY[lga.city].push(lga);
}

export const DEFAULT_LGA_ID = "ikeja";
