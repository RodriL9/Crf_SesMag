const axios = require('axios');

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function normalizeZip5FromGeocoder(value) {
  if (value == null || value === '') return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{5})(?:-\d{4})?$/);
  if (match) return match[1];
  const loose = str.match(/(\d{5})/);
  return loose ? loose[1] : '';
}

function parseGeocodeComponents(components) {
  if (!Array.isArray(components)) {
    return { postal5: '', stateCode: '', country: '' };
  }
  const postal = components.find((item) => Array.isArray(item.types) && item.types.includes('postal_code'));
  const country = components.find((item) => Array.isArray(item.types) && item.types.includes('country'));
  const regionLevel1 = components.find(
    (item) => Array.isArray(item.types) && item.types.includes('administrative_area_level_1')
  );
  return {
    postal5: normalizeZip5FromGeocoder(postal?.short_name || postal?.long_name || ''),
    stateCode: (regionLevel1?.short_name || '').toUpperCase(),
    country: (country?.short_name || '').toUpperCase(),
  };
}

function findMatchingZipInGeocodeResults(results, zipCode) {
  if (!Array.isArray(results)) return null;
  for (const row of results) {
    const parsed = parseGeocodeComponents(row.address_components);
    if (parsed.country === 'US' && parsed.postal5 === zipCode) {
      return parsed;
    }
  }
  return null;
}

/**
 * Verifies a 5-digit string is a real US postal code via Google Geocoding API.
 * @returns {{ isValid: boolean, stateCode: string }}
 */
async function validateUsZipCode(zipCode) {
  if (!PLACES_API_KEY) {
    return { isValid: false, stateCode: '' };
  }

  const tryRequests = [
    {
      params: {
        key: PLACES_API_KEY,
        components: `postal_code:${zipCode}|country:US`,
      },
    },
    {
      params: {
        key: PLACES_API_KEY,
        address: `${zipCode}, USA`,
        region: 'us',
      },
    },
  ];

  for (const config of tryRequests) {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', config);

    const status = response.data?.status;
    const results = response.data?.results;
    if (status !== 'OK' || !Array.isArray(results) || results.length === 0) {
      continue;
    }

    const match = findMatchingZipInGeocodeResults(results, zipCode);
    if (match) {
      return { isValid: true, stateCode: match.stateCode };
    }
  }

  return { isValid: false, stateCode: '' };
}

module.exports = {
  validateUsZipCode,
};
