export interface IndianStateInfo {
  name: string;
  code: string;
  type: 'state' | 'ut';
  districts: string[];
  /** Camera viewport center for map framing when filtering by state (not a Place pin) */
  viewCenter: { lat: number; lng: number };
  viewZoom: number;
}

export const ALL_INDIA_CENTER = { lat: 22.5937, lng: 78.9629 };
export const ALL_INDIA_ZOOM = 5;

export const INDIAN_STATES_AND_UTS: IndianStateInfo[] = [
  // 28 States (Alphabetical)
  {
    name: 'Andhra Pradesh',
    code: 'AP',
    type: 'state',
    districts: ['Visakhapatnam', 'Vijayawada (NTR)', 'Guntur', 'Tirupati', 'Kakinada', 'Kurnool', 'Nellore', 'Rajahmundry', 'Anantapur', 'Srikakulam'],
    viewCenter: { lat: 15.9129, lng: 79.74 },
    viewZoom: 7,
  },
  {
    name: 'Arunachal Pradesh',
    code: 'AR',
    type: 'state',
    districts: ['Itanagar (Papum Pare)', 'Tawang', 'West Kameng', 'East Siang (Pasighat)', 'Lower Subansiri (Ziro)', 'Lohit (Tezu)', 'Changlang', 'Tirap'],
    viewCenter: { lat: 28.218, lng: 94.7278 },
    viewZoom: 7,
  },
  {
    name: 'Assam',
    code: 'AS',
    type: 'state',
    districts: ['Kamrup', 'Barpeta', 'Morigaon', 'Dhubri', 'Kamrup Metropolitan (Guwahati)', 'Cachar (Silchar)', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Sonitpur (Tezpur)', 'Lakhimpur', 'Dhemaji', 'Tinsukia', 'Majuli'],
    viewCenter: { lat: 26.2006, lng: 92.9376 },
    viewZoom: 7,
  },
  {
    name: 'Bihar',
    code: 'BR',
    type: 'state',
    districts: ['Patna', 'Darbhanga', 'Muzaffarpur', 'Gaya', 'Bhagalpur', 'Purnia', 'Saharsa', 'Supaul', 'Sitamarhi', 'Katihar', 'Begusarai', 'Madhubani'],
    viewCenter: { lat: 25.5941, lng: 85.1376 },
    viewZoom: 7,
  },
  {
    name: 'Chhattisgarh',
    code: 'CG',
    type: 'state',
    districts: ['Raipur', 'Bilaspur', 'Durg', 'Bastar (Jagdalpur)', 'Korba', 'Rajnandgaon', 'Raigarh', 'Dantewada', 'Surguja (Ambikapur)'],
    viewCenter: { lat: 21.2787, lng: 81.8661 },
    viewZoom: 7,
  },
  {
    name: 'Goa',
    code: 'GA',
    type: 'state',
    districts: ['North Goa (Panaji)', 'South Goa (Margao)', 'Mormugao (Vasco)', 'Mapusa', 'Ponda'],
    viewCenter: { lat: 15.2993, lng: 74.124 },
    viewZoom: 9,
  },
  {
    name: 'Gujarat',
    code: 'GJ',
    type: 'state',
    districts: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Kutch (Bhuj)', 'Jamnagar', 'Bhavnagar', 'Gandhinagar', 'Valsad', 'Navsari', 'Porbandar', 'Gir Somnath'],
    viewCenter: { lat: 22.2587, lng: 71.1924 },
    viewZoom: 7,
  },
  {
    name: 'Haryana',
    code: 'HR',
    type: 'state',
    districts: ['Gurugram', 'Faridabad', 'Ambala', 'Karnal', 'Hisar', 'Rohtak', 'Panipat', 'Yamunanagar', 'Kurukshetra', 'Panchkula'],
    viewCenter: { lat: 29.0588, lng: 76.0856 },
    viewZoom: 8,
  },
  {
    name: 'Himachal Pradesh',
    code: 'HP',
    type: 'state',
    districts: ['Shimla', 'Kullu', 'Mandi', 'Kangra (Dharamshala)', 'Chamba', 'Kinnaur', 'Lahaul and Spiti', 'Solan', 'Sirmaur', 'Hamirpur'],
    viewCenter: { lat: 31.8, lng: 77.1734 },
    viewZoom: 7,
  },
  {
    name: 'Jharkhand',
    code: 'JH',
    type: 'state',
    districts: ['Ranchi', 'East Singhbhum (Jamshedpur)', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Dumka', 'Palamu', 'Sahibganj'],
    viewCenter: { lat: 23.6102, lng: 85.2799 },
    viewZoom: 7,
  },
  {
    name: 'Karnataka',
    code: 'KA',
    type: 'state',
    districts: ['Bengaluru Urban', 'Mysuru', 'Dakshina Kannada (Mangaluru)', 'Udupi', 'Kodagu (Madikeri)', 'Belagavi', 'Hubballi-Dharwad', 'Kalaburagi', 'Uttara Kannada (Karwar)', 'Shivamogga'],
    viewCenter: { lat: 15.3173, lng: 75.7139 },
    viewZoom: 7,
  },
  {
    name: 'Kerala',
    code: 'KL',
    type: 'state',
    districts: ['Wayanad', 'Ernakulam (Kochi)', 'Thiruvananthapuram', 'Kozhikode', 'Idukki', 'Alappuzha', 'Pathanamthitta', 'Kottayam', 'Thrissur', 'Malappuram', 'Kannur', 'Palakkad'],
    viewCenter: { lat: 10.8505, lng: 76.2711 },
    viewZoom: 7,
  },
  {
    name: 'Madhya Pradesh',
    code: 'MP',
    type: 'state',
    districts: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Narmadapuram (Hoshangabad)', 'Rewa', 'Sagar', 'Satna', 'Chhindwara'],
    viewCenter: { lat: 22.9734, lng: 78.6569 },
    viewZoom: 6,
  },
  {
    name: 'Maharashtra',
    code: 'MH',
    type: 'state',
    districts: ['Mumbai City', 'Mumbai Suburban', 'Pune', 'Nagpur', 'Thane', 'Raigad', 'Ratnagiri', 'Kolhapur', 'Sangli', 'Nashik', 'Chhatrapati Sambhajinagar', 'Satara'],
    viewCenter: { lat: 19.7515, lng: 75.7139 },
    viewZoom: 6,
  },
  {
    name: 'Manipur',
    code: 'MN',
    type: 'state',
    districts: ['Imphal West', 'Imphal East', 'Churachandpur', 'Thoubal', 'Bishnupur', 'Ukhrul', 'Senapati', 'Tamenglong'],
    viewCenter: { lat: 24.6637, lng: 93.9063 },
    viewZoom: 8,
  },
  {
    name: 'Meghalaya',
    code: 'ML',
    type: 'state',
    districts: ['East Khasi Hills (Shillong)', 'West Garo Hills (Tura)', 'Ri-Bhoi', 'West Jaintia Hills (Jowai)', 'South West Khasi Hills', 'East Garo Hills'],
    viewCenter: { lat: 25.467, lng: 91.3662 },
    viewZoom: 8,
  },
  {
    name: 'Mizoram',
    code: 'MZ',
    type: 'state',
    districts: ['Aizawl', 'Lunglei', 'Champhai', 'Kolasib', 'Serchhip', 'Lawngtlai', 'Saiha', 'Mamit'],
    viewCenter: { lat: 23.1645, lng: 92.9376 },
    viewZoom: 8,
  },
  {
    name: 'Nagaland',
    code: 'NL',
    type: 'state',
    districts: ['Kohima', 'Dimapur', 'Mokokchung', 'Wokha', 'Mon', 'Tuensang', 'Zunheboto', 'Phek'],
    viewCenter: { lat: 26.1584, lng: 94.5624 },
    viewZoom: 8,
  },
  {
    name: 'Odisha',
    code: 'OD',
    type: 'state',
    districts: ['Puri', 'Khordha (Bhubaneswar)', 'Cuttack', 'Ganjam (Berhampur)', 'Balasore', 'Bhadrak', 'Kendrapara', 'Jagatsinghpur', 'Mayurbhanj', 'Sambalpur'],
    viewCenter: { lat: 20.9517, lng: 85.0985 },
    viewZoom: 7,
  },
  {
    name: 'Punjab',
    code: 'PB',
    type: 'state',
    districts: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'SAS Nagar (Mohali)', 'Gurdaspur', 'Pathankot', 'Firozpur', 'Rupnagar (Ropar)', 'Hoshiarpur'],
    viewCenter: { lat: 31.1471, lng: 75.3412 },
    viewZoom: 8,
  },
  {
    name: 'Rajasthan',
    code: 'RJ',
    type: 'state',
    districts: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Bikaner', 'Jaisalmer', 'Barmer', 'Alwar', 'Sirohi', 'Bharatpur'],
    viewCenter: { lat: 27.0238, lng: 74.2179 },
    viewZoom: 6,
  },
  {
    name: 'Sikkim',
    code: 'SK',
    type: 'state',
    districts: ['Gangtok', 'Mangan (North Sikkim)', 'Namchi', 'Gyalshing', 'Pakyong', 'Soreng'],
    viewCenter: { lat: 27.533, lng: 88.5122 },
    viewZoom: 9,
  },
  {
    name: 'Tamil Nadu',
    code: 'TN',
    type: 'state',
    districts: ['Chennai', 'Chengalpattu', 'Cuddalore', 'Nagapattinam', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Kanyakumari', 'Thoothukudi', 'Nilgiris (Ooty)', 'Thanjavur'],
    viewCenter: { lat: 11.1271, lng: 78.6569 },
    viewZoom: 7,
  },
  {
    name: 'Telangana',
    code: 'TG',
    type: 'state',
    districts: ['Hyderabad', 'Rangareddy', 'Medchal-Malkajgiri', 'Warangal', 'Khammam', 'Bhadradri Kothagudem', 'Nizamabad', 'Karimnagar', 'Mulugu'],
    viewCenter: { lat: 18.1124, lng: 79.0193 },
    viewZoom: 7,
  },
  {
    name: 'Tripura',
    code: 'TR',
    type: 'state',
    districts: ['West Tripura (Agartala)', 'Gomati (Udaipur)', 'South Tripura (Belonia)', 'North Tripura (Dharmanagar)', 'Dhalai', 'Unakoti', 'Khowai', 'Sepahijala'],
    viewCenter: { lat: 23.9408, lng: 91.9882 },
    viewZoom: 8,
  },
  {
    name: 'Uttar Pradesh',
    code: 'UP',
    type: 'state',
    districts: ['Lucknow', 'Varanasi', 'Prayagraj', 'Gorakhpur', 'Gautam Buddha Nagar (Noida)', 'Kanpur Nagar', 'Agra', 'Bahraich', 'Lakhimpur Kheri', 'Ballia', 'Ayodhya'],
    viewCenter: { lat: 26.8467, lng: 80.9462 },
    viewZoom: 6,
  },
  {
    name: 'Uttarakhand',
    code: 'UK',
    type: 'state',
    districts: ['Chamoli', 'Dehradun', 'Rudraprayag', 'Uttarkashi', 'Haridwar', 'Nainital', 'Pithoragarh', 'Tehri Garhwal', 'Pauri Garhwal', 'Udham Singh Nagar'],
    viewCenter: { lat: 30.0668, lng: 79.0193 },
    viewZoom: 8,
  },
  {
    name: 'West Bengal',
    code: 'WB',
    type: 'state',
    districts: ['Kolkata', 'South 24 Parganas (Sundarbans)', 'North 24 Parganas', 'Darjeeling', 'Jalpaiguri', 'Howrah', 'Purba Medinipur (Digha)', 'Hooghly', 'Murshidabad', 'Malda'],
    viewCenter: { lat: 22.9868, lng: 87.855 },
    viewZoom: 7,
  },

  // 8 Union Territories (Alphabetical)
  {
    name: 'Andaman and Nicobar Islands',
    code: 'AN',
    type: 'ut',
    districts: ['South Andaman (Port Blair)', 'North and Middle Andaman', 'Nicobar (Car Nicobar)'],
    viewCenter: { lat: 11.7401, lng: 92.6586 },
    viewZoom: 7,
  },
  {
    name: 'Chandigarh',
    code: 'CH',
    type: 'ut',
    districts: ['Chandigarh Central', 'Manimajra', 'Sector 17 Civic Zone'],
    viewCenter: { lat: 30.7333, lng: 76.7794 },
    viewZoom: 11,
  },
  {
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    code: 'DD',
    type: 'ut',
    districts: ['Daman', 'Diu', 'Dadra and Nagar Haveli (Silvassa)'],
    viewCenter: { lat: 20.3974, lng: 72.8328 },
    viewZoom: 9,
  },
  {
    name: 'Delhi (NCT)',
    code: 'DL',
    type: 'ut',
    districts: ['New Delhi', 'East Delhi (Yamuna Khadar)', 'North Delhi', 'Central Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi', 'Shahdara'],
    viewCenter: { lat: 28.6139, lng: 77.209 },
    viewZoom: 10,
  },
  {
    name: 'Jammu and Kashmir',
    code: 'JK',
    type: 'ut',
    districts: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Ramban', 'Doda', 'Kishtwar', 'Pulwama', 'Kupwara', 'Udhampur'],
    viewCenter: { lat: 33.7782, lng: 76.5762 },
    viewZoom: 7,
  },
  {
    name: 'Ladakh',
    code: 'LA',
    type: 'ut',
    districts: ['Leh', 'Kargil', 'Nubra Valley', 'Zanskar'],
    viewCenter: { lat: 34.1526, lng: 77.5771 },
    viewZoom: 7,
  },
  {
    name: 'Lakshadweep',
    code: 'LD',
    type: 'ut',
    districts: ['Kavaratti', 'Agatti', 'Minicoy', 'Andrott'],
    viewCenter: { lat: 10.5667, lng: 72.6417 },
    viewZoom: 9,
  },
  {
    name: 'Puducherry',
    code: 'PY',
    type: 'ut',
    districts: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
    viewCenter: { lat: 11.9416, lng: 79.8083 },
    viewZoom: 10,
  },
];

export const INDIAN_STATES_ONLY = INDIAN_STATES_AND_UTS.filter((s) => s.type === 'state');
export const INDIAN_UTS_ONLY = INDIAN_STATES_AND_UTS.filter((s) => s.type === 'ut');

export function getStateInfo(stateName: string): IndianStateInfo | undefined {
  return INDIAN_STATES_AND_UTS.find(
    (s) => s.name.toLowerCase() === stateName.trim().toLowerCase()
  );
}

export function getDistrictsForState(stateName: string): string[] {
  const info = getStateInfo(stateName);
  return info ? info.districts : ['District Headquarters'];
}

export function inferStateFromDistrict(district?: string, explicitState?: string): string {
  if (explicitState && explicitState.trim()) return explicitState.trim();
  if (!district) return 'Assam';
  const normalized = district.trim().toLowerCase();
  const match = INDIAN_STATES_AND_UTS.find((s) =>
    s.districts.some(
      (d) =>
        d.toLowerCase() === normalized ||
        d.toLowerCase().startsWith(`${normalized} (`)
    )
  );
  return match ? match.name : 'Assam';
}

export function formatLocationWithState(district: string, stateName?: string): string {
  const resolvedState = inferStateFromDistrict(district, stateName);
  if (!district) return resolvedState;
  if (district.toLowerCase().includes(resolvedState.toLowerCase())) {
    return district;
  }
  return `${district}, ${resolvedState}`;
}

export interface DistrictZoneRecord {
  name: string;
  stateName: string;
  lat: number;
  lng: number;
  riskTier: 'critical_flood' | 'high_surge' | 'monitoring' | 'safe_corridor';
  populationDensity: 'high' | 'medium' | 'rural';
  shelterCapacityCount: number;
  openShelters: number;
  activeAlerts: number;
  gridSectorCode: string;
}

export const DISTRICT_COORDINATES_MAP: Record<string, { lat: number; lng: number; riskTier: DistrictZoneRecord['riskTier']; grid: string }> = {
  // Assam
  'Barpeta': { lat: 26.3211, lng: 91.0065, riskTier: 'critical_flood', grid: 'Alpha-4' },
  'Kamrup': { lat: 26.3124, lng: 91.5978, riskTier: 'high_surge', grid: 'Alpha-2' },
  'Morigaon': { lat: 26.2588, lng: 92.3481, riskTier: 'critical_flood', grid: 'Bravo-7' },
  'Dhubri': { lat: 26.0207, lng: 89.9744, riskTier: 'high_surge', grid: 'Delta-1' },
  'Kamrup Metropolitan (Guwahati)': { lat: 26.1445, lng: 91.7362, riskTier: 'monitoring', grid: 'Alpha-1' },
  'Cachar (Silchar)': { lat: 24.8333, lng: 92.7789, riskTier: 'high_surge', grid: 'Epsilon-3' },
  'Dibrugarh': { lat: 27.4728, lng: 94.9120, riskTier: 'monitoring', grid: 'Zeta-4' },
  'Jorhat': { lat: 26.7509, lng: 94.2037, riskTier: 'monitoring', grid: 'Zeta-1' },
  'Nagaon': { lat: 26.3465, lng: 92.6840, riskTier: 'high_surge', grid: 'Bravo-3' },
  'Sonitpur (Tezpur)': { lat: 26.6528, lng: 92.7926, riskTier: 'monitoring', grid: 'Gamma-5' },
  'Lakhimpur': { lat: 27.2345, lng: 94.1042, riskTier: 'high_surge', grid: 'Eta-2' },
  'Dhemaji': { lat: 27.4816, lng: 94.5821, riskTier: 'critical_flood', grid: 'Eta-6' },
  'Tinsukia': { lat: 27.5015, lng: 95.3626, riskTier: 'monitoring', grid: 'Theta-1' },
  'Majuli': { lat: 26.9536, lng: 94.2018, riskTier: 'critical_flood', grid: 'Theta-9' },

  // Bihar
  'Patna': { lat: 25.5941, lng: 85.1376, riskTier: 'high_surge', grid: 'BR-Patna-1' },
  'Darbhanga': { lat: 26.1542, lng: 85.8918, riskTier: 'critical_flood', grid: 'BR-Darb-3' },
  'Muzaffarpur': { lat: 26.1209, lng: 85.3647, riskTier: 'high_surge', grid: 'BR-Muz-2' },
  'Gaya': { lat: 24.7914, lng: 85.0002, riskTier: 'monitoring', grid: 'BR-Gaya-4' },
  'Saharsa': { lat: 25.8835, lng: 86.6006, riskTier: 'critical_flood', grid: 'BR-Sah-5' },
  'Supaul': { lat: 26.1260, lng: 86.6074, riskTier: 'critical_flood', grid: 'BR-Sup-2' },

  // Kerala
  'Wayanad': { lat: 11.6854, lng: 76.1320, riskTier: 'critical_flood', grid: 'KL-Way-1' },
  'Ernakulam (Kochi)': { lat: 9.9816, lng: 76.2999, riskTier: 'high_surge', grid: 'KL-Ern-2' },
  'Idukki': { lat: 9.8494, lng: 76.9804, riskTier: 'high_surge', grid: 'KL-Idu-3' },
  'Alappuzha': { lat: 9.4981, lng: 76.3388, riskTier: 'critical_flood', grid: 'KL-Alp-4' },

  // Odisha
  'Puri': { lat: 19.8135, lng: 85.8312, riskTier: 'critical_flood', grid: 'OD-Puri-1' },
  'Khordha (Bhubaneswar)': { lat: 20.2961, lng: 85.8245, riskTier: 'high_surge', grid: 'OD-Bhub-2' },
  'Cuttack': { lat: 20.4625, lng: 85.8828, riskTier: 'high_surge', grid: 'OD-Cut-3' },
  'Balasore': { lat: 21.4934, lng: 86.9135, riskTier: 'high_surge', grid: 'OD-Bal-4' },

  // Maharashtra
  'Mumbai City': { lat: 18.9388, lng: 72.8354, riskTier: 'high_surge', grid: 'MH-Mum-1' },
  'Thane': { lat: 19.2183, lng: 72.9781, riskTier: 'high_surge', grid: 'MH-Tha-2' },
  'Raigad': { lat: 18.5158, lng: 73.1822, riskTier: 'critical_flood', grid: 'MH-Rai-3' },
  'Kolhapur': { lat: 16.7050, lng: 74.2433, riskTier: 'critical_flood', grid: 'MH-Kol-4' },

  // West Bengal
  'Kolkata': { lat: 22.5726, lng: 88.3639, riskTier: 'high_surge', grid: 'WB-Kol-1' },
  'South 24 Parganas (Sundarbans)': { lat: 22.1352, lng: 88.5830, riskTier: 'critical_flood', grid: 'WB-Sun-2' },
  'Jalpaiguri': { lat: 26.5414, lng: 88.7196, riskTier: 'high_surge', grid: 'WB-Jal-3' }
};

export function getDistrictCoordinates(district: string, stateName?: string): { lat: number; lng: number } {
  // Try direct match
  const exact = DISTRICT_COORDINATES_MAP[district];
  if (exact) return { lat: exact.lat, lng: exact.lng };

  // Fuzzy match
  const clean = district.toLowerCase().split('(')[0].trim();
  const matchedKey = Object.keys(DISTRICT_COORDINATES_MAP).find(k => k.toLowerCase().includes(clean));
  if (matchedKey) {
    return { lat: DISTRICT_COORDINATES_MAP[matchedKey].lat, lng: DISTRICT_COORDINATES_MAP[matchedKey].lng };
  }

  // Fallback to state center with small deterministic offset based on district name
  const stInfo = getStateInfo(stateName || inferStateFromDistrict(district));
  const baseCenter = stInfo?.viewCenter || ALL_INDIA_CENTER;
  let hash = 0;
  for (let i = 0; i < district.length; i++) hash = (hash << 5) - hash + district.charCodeAt(i);
  const latOffset = ((hash % 100) / 100) * 0.45;
  const lngOffset = (((hash >> 3) % 100) / 100) * 0.45;

  return { lat: Number((baseCenter.lat + latOffset).toFixed(4)), lng: Number((baseCenter.lng + lngOffset).toFixed(4)) };
}

export function getDistrictZoneListForState(stateName: string): DistrictZoneRecord[] {
  const distNames = getDistrictsForState(stateName);
  return distNames.map((d, index) => {
    const coords = getDistrictCoordinates(d, stateName);
    const meta = DISTRICT_COORDINATES_MAP[d];
    return {
      name: d,
      stateName,
      lat: coords.lat,
      lng: coords.lng,
      riskTier: meta?.riskTier || (index % 3 === 0 ? 'critical_flood' : index % 3 === 1 ? 'high_surge' : 'monitoring'),
      populationDensity: index % 2 === 0 ? 'high' : 'medium',
      shelterCapacityCount: 350 + (index * 80),
      openShelters: 2 + (index % 3),
      activeAlerts: index === 0 ? 3 : index === 1 ? 2 : 1,
      gridSectorCode: meta?.grid || `Grid-${stateName.slice(0, 2).toUpperCase()}-${index + 1}`
    };
  });
}
