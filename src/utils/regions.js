const REGIONS = [
  {
    city: 'Trabzon',
    districts: [
      'Ortahisar',
      'Akçaabat',
      'Araklı',
      'Arsin',
      'Beşikdüzü',
      'Çarşıbaşı',
      'Çaykara',
      'Dernekpazarı',
      'Düzköy',
      'Hayrat',
      'Köprübaşı',
      'Maçka',
      'Of',
      'Sürmene',
      'Şalpazarı',
      'Tonya',
      'Vakfıkebir',
      'Yomra',
    ],
  },
  { city: 'Gümüşhane', districts: ['Merkez', 'Kelkit', 'Köse', 'Kürtün', 'Şiran', 'Torul'] },
  {
    city: 'Rize',
    districts: ['Merkez', 'Ardeşen', 'Çamlıhemşin', 'Çayeli', 'Derepazarı', 'Fındıklı', 'Güneysu', 'Hemşin', 'İkizdere', 'İyidere', 'Kalkandere', 'Pazar'],
  },
];

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşöçıİ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRegionKey(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

const REGION_LOOKUP = REGIONS.reduce((acc, region) => {
  acc[normalizeRegionKey(region.city)] = region;
  return acc;
}, {});

function resolveRegion(city) {
  const region = REGION_LOOKUP[normalizeRegionKey(city)];
  return region || REGIONS[0];
}

function normalizeLocation(city, district) {
  const region = resolveRegion(city);
  const normalizedDistrict = normalizeRegionKey(district);
  const matchedDistrict = region.districts.find((entry) => normalizeRegionKey(entry) === normalizedDistrict);
  return {
    city: region.city,
    district: matchedDistrict || region.districts[0],
  };
}

module.exports = {
  REGIONS,
  normalizeText,
  normalizeRegionKey,
  resolveRegion,
  normalizeLocation,
};
