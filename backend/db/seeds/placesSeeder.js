const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'crf_sesmag_db',
  user: process.env.DB_USER || 'rodrigo',
  password: process.env.DB_PASSWORD,
});

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const ZIP_CODES = [
  '07201', '07202', '07208',
  '07083',
  '07060', '07061', '07062',
  '07090', '07091',
  '07036',
  '07974',
  '07922',
];

const CATEGORY_SEARCHES = [
  { categoryId: 1, queries: ['food bank', 'soup kitchen', 'food pantry'] },
  { categoryId: 2, queries: ['free clinic', 'community health center', 'mental health center'] },
  { categoryId: 3, queries: ['job training center', 'employment agency', 'workforce development'] },
  { categoryId: 4, queries: ['homeless shelter', 'housing assistance', 'transitional housing'] },
  { categoryId: 5, queries: ['legal aid', 'legal services', 'law clinic'] },
  { categoryId: 6, queries: ['social services', 'government assistance', 'community services'] },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchPlaces(query, zip) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      {
        params: {
          query: `${query} ${zip} New Jersey`,
          key: PLACES_API_KEY,
          region: 'us',
        },
      }
    );

    const status = response.data.status;
    if (status !== 'OK' && status !== 'ZERO_RESULTS') {
      console.log(`  ⚠️  API Status: ${status} — ${response.data.error_message || ''}`);
    }

    return response.data.results || [];
  } catch (err) {
    console.error(`❌ Error searching "${query}" in ${zip}:`, err.message);
    return [];
  }
}

async function getPlaceDetails(placeId) {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,opening_hours,website,geometry',
          key: PLACES_API_KEY,
        },
      }
    );
    return response.data.result || {};
  } catch (err) {
    console.error(`❌ Error getting details for ${placeId}:`, err.message);
    return {};
  }
}

function extractZipCode(address) {
  if (!address) return null;
  const match = address.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

function extractCity(address) {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length >= 3) return parts[parts.length - 3]?.trim();
  return null;
}

function formatHours(openingHours) {
  if (!openingHours || !openingHours.weekday_text) return null;
  return openingHours.weekday_text.join(' | ');
}

async function insertResource(resource) {
  const sql = `
    INSERT INTO resources (
      name, address, city, state, zip_code,
      phone_number, hours_of_operation, website,
      category_id, is_verified, google_place_id,
      latitude, longitude
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (google_place_id) DO NOTHING
    RETURNING id, name;
  `;

  const values = [
    resource.name,
    resource.address,
    resource.city,
    'NJ',
    resource.zipCode,
    resource.phoneNumber,
    resource.hoursOfOperation,
    resource.website,
    resource.categoryId,
    false,
    resource.googlePlaceId,
    resource.latitude,
    resource.longitude,
  ];

  try {
    const result = await pool.query(sql, values);
    if (result.rows.length > 0) {
      console.log(`  ✅ Inserted: ${resource.name}`);
      return true;
    } else {
      console.log(`  ⏭️  Skipped (duplicate): ${resource.name}`);
      return false;
    }
  } catch (err) {
    console.error(`  ❌ Failed to insert ${resource.name}:`, err.message);
    return false;
  }
}

async function runSeeder() {
  console.log('🌱 Starting Google Places seeder for Union County NJ...\n');
  console.log(`🔑 API Key: ${PLACES_API_KEY ? PLACES_API_KEY.substring(0, 8) + '...' : '❌ NOT FOUND'}\n`);

  if (!PLACES_API_KEY) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY is missing. Set it in backend/.env and ensure Places API is enabled for that key.'
    );
  }

  let totalInserted = 0;
  const seenPlaceIds = new Set();

  for (const { categoryId, queries } of CATEGORY_SEARCHES) {
    console.log(`\n📂 Category ID: ${categoryId}`);

    for (const query of queries) {
      for (const zip of ZIP_CODES) {
        console.log(`\n🔍 Searching: "${query}" in ${zip}`);

        const places = await searchPlaces(query, zip);
        await delay(300);

        for (const place of places.slice(0, 3)) {
          if (seenPlaceIds.has(place.place_id)) continue;
          seenPlaceIds.add(place.place_id);

          // Only include NJ results
          const addr = place.formatted_address || '';
          if (!addr.includes('NJ') && !addr.includes('New Jersey')) continue;

          const details = await getPlaceDetails(place.place_id);
          await delay(300);

          const extractedZip = extractZipCode(details.formatted_address || addr);
          const finalZip = extractedZip || zip;

          const resource = {
            name: details.name || place.name,
            address: details.formatted_address || addr,
            city: extractCity(details.formatted_address || addr),
            zipCode: finalZip,
            phoneNumber: details.formatted_phone_number || null,
            hoursOfOperation: formatHours(details.opening_hours),
            website: details.website || null,
            categoryId,
            googlePlaceId: place.place_id,
            latitude: details.geometry?.location?.lat || place.geometry?.location?.lat,
            longitude: details.geometry?.location?.lng || place.geometry?.location?.lng,
          };

          const inserted = await insertResource(resource);
          if (inserted) totalInserted++;
        }
      }
    }
  }

  console.log(`\n🎉 Seeder complete! Inserted ${totalInserted} places.`);
  await pool.end();
}

runSeeder().catch((err) => {
  console.error('❌ Seeder failed:', err);
  pool.end();
});