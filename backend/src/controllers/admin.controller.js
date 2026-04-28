const axios = require('axios');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { validateUsZipCode } = require('../utils/usZipValidation');
const { ensureUserMessageArchiveTable } = require('../utils/ensureMessageArchiveTable');

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const ZIP_IMPORT_QUERIES = [
  { categoryId: 1, query: 'food pantry' },
  { categoryId: 2, query: 'community health center' },
  { categoryId: 3, query: 'workforce development center' },
  { categoryId: 4, query: 'housing assistance' },
  { categoryId: 5, query: 'legal aid' },
  { categoryId: 6, query: 'social services' },
];

function extractZipCode(address) {
  if (!address) return null;
  const stateZip = address.match(/,\s*[A-Z]{2}\s+(\d{5})(?:-\d{4})?\b/i);
  if (stateZip) return stateZip[1];
  const zipPlus4 = address.match(/\b(\d{5})-\d{4}\b/);
  if (zipPlus4) return zipPlus4[1];
  const tail = address.match(/\b(\d{5})\s*$/);
  return tail ? tail[1] : null;
}

function extractCity(address) {
  if (!address) return null;
  const parts = address.split(',');
  if (parts.length >= 3) return parts[parts.length - 3]?.trim() || null;
  return null;
}

function extractState(address) {
  if (!address) return null;
  const match = address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

function formatHours(openingHours) {
  if (!openingHours || !openingHours.weekday_text) return null;
  return openingHours.weekday_text.join(' | ');
}

async function searchPlaces(query, zipCode) {
  const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
    params: {
      query: `${query} ${zipCode} USA`,
      key: PLACES_API_KEY,
      region: 'us',
    },
  });
  const status = response.data?.status;
  const results = response.data?.results || [];
  if (status === 'OK' || status === 'ZERO_RESULTS') {
    return results;
  }
  const errMsg = response.data?.error_message || status || 'Unknown error';
  const err = new Error(`Google Places text search failed (${status}): ${errMsg}`);
  err.googleStatus = status;
  throw err;
}

async function getPlaceDetails(placeId) {
  const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id: placeId,
      fields: 'name,formatted_address,formatted_phone_number,opening_hours,website,geometry',
      key: PLACES_API_KEY,
    },
  });
  const status = response.data?.status;
  if (status !== 'OK') {
    return {};
  }
  return response.data.result || {};
}

async function listResources(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         r.id, r.name, r.description, r.address, r.city, r.state, r.zip_code,
         r.phone_number, r.hours_of_operation, r.website, r.requirements,
         r.category_id, c.name AS category_name, r.is_verified, r.verified_at,
         (
           SELECT COUNT(*)
           FROM saved_resources sr
           WHERE sr.resource_id = r.id
         )::int AS save_count,
         (
           SELECT COUNT(*)
           FROM resource_submissions rs
           WHERE rs.notes ILIKE ('FLAGGED RESOURCE (' || r.id::text || ')%')
         )::int AS flag_count
       FROM resources r
       LEFT JOIN categories c ON c.id = r.category_id
       ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
       LIMIT 500;`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function createResource(req, res, next) {
  const {
    name,
    description,
    address,
    city,
    state,
    zipCode,
    phoneNumber,
    hoursOfOperation,
    website,
    requirements,
    categoryId,
    isVerified = false,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO resources (
         name, description, address, city, state, zip_code,
         phone_number, hours_of_operation, website, requirements,
         category_id, is_verified, verified_at, verified_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *;`,
      [
        name,
        description || null,
        address,
        city || null,
        state || 'NJ',
        zipCode || null,
        phoneNumber || null,
        hoursOfOperation || null,
        website || null,
        requirements || null,
        categoryId || null,
        Boolean(isVerified),
        isVerified ? new Date() : null,
        isVerified ? req.user.sub : null,
      ]
    );

    await pool.query(
      `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
       VALUES ($1, $2, 'created', $3::jsonb);`,
      [
        result.rows[0].id,
        req.user.sub,
        JSON.stringify({ after: result.rows[0] }),
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function importZipResources(req, res, next) {
  const zipCode = (req.body.zipCode || '').trim();
  const actorId = req.user.sub;

  if (!PLACES_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is missing on backend.' });
  }

  try {
    const zipValidation = await validateUsZipCode(zipCode);
    if (!zipValidation.isValid) {
      return res.status(400).json({
        error: `ZIP ${zipCode} is not a valid US ZIP code.`,
        zipCode,
      });
    }
    const validatedState = zipValidation.stateCode || 'NJ';

    const seenPlaceIds = new Set();
    const insertedResources = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let matchedZipPlaceCount = 0;

    for (const { categoryId, query } of ZIP_IMPORT_QUERIES) {
      const places = await searchPlaces(query, zipCode);

      for (const place of places.slice(0, 6)) {
        if (!place.place_id || seenPlaceIds.has(place.place_id)) {
          continue;
        }
        seenPlaceIds.add(place.place_id);

        const summaryAddress = place.formatted_address || '';
        const details = await getPlaceDetails(place.place_id);
        const address = (details.formatted_address || '').trim() || summaryAddress;
        const extractedZip = extractZipCode(address) || extractZipCode(summaryAddress);
        if (extractedZip !== zipCode) {
          skippedCount += 1;
          continue;
        }
        matchedZipPlaceCount += 1;
        const finalZip = zipCode;

        const result = await pool.query(
          `INSERT INTO resources (
             name, description, address, city, state, zip_code,
             phone_number, hours_of_operation, website, requirements,
             category_id, is_verified, verified_at, verified_by,
             google_place_id, latitude, longitude
           )
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, NULL, $9, FALSE, NULL, NULL, $10, $11, $12)
           ON CONFLICT (google_place_id) DO UPDATE
             SET zip_code = EXCLUDED.zip_code,
                 city = COALESCE(EXCLUDED.city, resources.city),
                 address = COALESCE(EXCLUDED.address, resources.address),
                 phone_number = COALESCE(EXCLUDED.phone_number, resources.phone_number),
                 hours_of_operation = COALESCE(EXCLUDED.hours_of_operation, resources.hours_of_operation),
                 website = COALESCE(EXCLUDED.website, resources.website),
                 category_id = COALESCE(resources.category_id, EXCLUDED.category_id),
                 latitude = COALESCE(EXCLUDED.latitude, resources.latitude),
                 longitude = COALESCE(EXCLUDED.longitude, resources.longitude),
                 updated_at = NOW()
           RETURNING id, name, (xmax = 0) AS inserted_new;`,
          [
            details.name || place.name,
            address,
            extractCity(address),
            extractState(address) || validatedState,
            finalZip,
            details.formatted_phone_number || null,
            formatHours(details.opening_hours),
            details.website || null,
            categoryId,
            place.place_id,
            details.geometry?.location?.lat || place.geometry?.location?.lat || null,
            details.geometry?.location?.lng || place.geometry?.location?.lng || null,
          ]
        );

        if (result.rowCount > 0 && result.rows[0].inserted_new) {
          insertedCount += 1;
          insertedResources.push(result.rows[0]);
          await pool.query(
            `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
             VALUES ($1, $2, 'created', $3::jsonb);`,
            [result.rows[0].id, actorId, JSON.stringify({ source: 'zip_import', zipCode, placeId: place.place_id })]
          );
        } else if (result.rowCount > 0) {
          updatedCount += 1;
          await pool.query(
            `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
             VALUES ($1, $2, 'updated', $3::jsonb);`,
            [result.rows[0].id, actorId, JSON.stringify({ source: 'zip_import', zipCode, placeId: place.place_id })]
          );
        } else {
          skippedCount += 1;
        }
      }
    }

    if (matchedZipPlaceCount === 0) {
      return res.status(404).json({
        error: `No resources found for ZIP ${zipCode}. Please verify the ZIP and try again.`,
        zipCode,
      });
    }

    return res.json({
      message: `ZIP ${zipCode} import complete.`,
      zipCode,
      insertedCount,
      updatedCount,
      skippedCount,
      insertedResources,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateResource(req, res, next) {
  const resourceId = req.params.id;
  const {
    name,
    description,
    address,
    city,
    state,
    zipCode,
    phoneNumber,
    hoursOfOperation,
    website,
    requirements,
    categoryId,
    isVerified,
  } = req.body;

  try {
    const current = await pool.query('SELECT * FROM resources WHERE id = $1 LIMIT 1;', [resourceId]);
    if (current.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const oldRow = current.rows[0];
    const nextIsVerified = typeof isVerified === 'boolean' ? isVerified : oldRow.is_verified;

    const updated = await pool.query(
      `UPDATE resources
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           zip_code = COALESCE($6, zip_code),
           phone_number = COALESCE($7, phone_number),
           hours_of_operation = COALESCE($8, hours_of_operation),
           website = COALESCE($9, website),
           requirements = COALESCE($10, requirements),
           category_id = COALESCE($11, category_id),
           is_verified = $12,
           verified_at = CASE WHEN $12 = TRUE THEN COALESCE(verified_at, NOW()) ELSE NULL END,
           verified_by = CASE WHEN $12 = TRUE THEN COALESCE(verified_by, $14) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $13
       RETURNING *;`,
      [
        name ?? null,
        description ?? null,
        address ?? null,
        city ?? null,
        state ?? null,
        zipCode ?? null,
        phoneNumber ?? null,
        hoursOfOperation ?? null,
        website ?? null,
        requirements ?? null,
        categoryId ?? null,
        nextIsVerified,
        resourceId,
        nextIsVerified ? req.user.sub : null,
      ]
    );

    await pool.query(
      `INSERT INTO resource_audit_log (resource_id, changed_by, action, changes)
       VALUES ($1, $2, 'updated', $3::jsonb);`,
      [
        resourceId,
        req.user.sub,
        JSON.stringify({
          before: oldRow,
          after: updated.rows[0],
        }),
      ]
    );

    return res.json(updated.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function getResourceAuditLog(req, res, next) {
  const resourceId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT
         ral.id,
         ral.resource_id,
         ral.action,
         ral.changes,
         ral.created_at,
         u.id AS changed_by_user_id,
         CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS changed_by_name,
         u.email AS changed_by_email
       FROM resource_audit_log ral
       LEFT JOIN users u ON u.id = ral.changed_by
       WHERE ral.resource_id = $1
       ORDER BY ral.created_at DESC;`,
      [resourceId]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function listResourceSubmissions(req, res, next) {
  const status = req.query.status;

  try {
    const params = [];
    let whereClause = '';

    if (status && ['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
      params.push(status);
      whereClause = `WHERE rs.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         rs.id, rs.submitter_name, rs.submitter_contact, rs.zip_or_city,
         rs.category_id, c.name AS category_name, rs.resource_name, rs.address,
         rs.phone_number, rs.website, rs.notes, rs.status, rs.review_notes,
         rs.reviewed_by, rs.reviewed_at, rs.created_at, rs.updated_at,
         NULLIF(TRIM(CONCAT(COALESCE(ru.first_name, ''), ' ', COALESCE(ru.last_name, ''))), '') AS reviewer_name,
         ru.email AS reviewer_email
       FROM resource_submissions rs
       LEFT JOIN categories c ON c.id = rs.category_id
       LEFT JOIN users ru ON ru.id = rs.reviewed_by
       ${whereClause}
       ORDER BY rs.created_at DESC;`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function selectSubmissionRowWithReviewer(submissionId) {
  const result = await pool.query(
    `SELECT
       rs.id, rs.submitter_name, rs.submitter_contact, rs.zip_or_city,
       rs.category_id, c.name AS category_name, rs.resource_name, rs.address,
       rs.phone_number, rs.website, rs.notes, rs.status, rs.review_notes,
       rs.reviewed_by, rs.reviewed_at, rs.created_at, rs.updated_at,
       NULLIF(TRIM(CONCAT(COALESCE(ru.first_name, ''), ' ', COALESCE(ru.last_name, ''))), '') AS reviewer_name,
       ru.email AS reviewer_email
     FROM resource_submissions rs
     LEFT JOIN categories c ON c.id = rs.category_id
     LEFT JOIN users ru ON ru.id = rs.reviewed_by
     WHERE rs.id = $1
     LIMIT 1;`,
    [submissionId]
  );
  return result.rowCount > 0 ? result.rows[0] : null;
}

async function updateResourceSubmissionStatus(req, res, next) {
  const submissionId = req.params.id;
  const { status, reviewNotes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE resource_submissions
       SET status = $1,
           review_notes = $2,
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
         AND status <> 'cancelled'
       RETURNING id;`,
      [status, reviewNotes || null, req.user.sub, submissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    const row = await selectSubmissionRowWithReviewer(submissionId);
    return res.json(row);
  } catch (error) {
    return next(error);
  }
}

async function deleteResourceSubmission(req, res, next) {
  const submissionId = req.params.id;

  try {
    const result = await pool.query(
      `DELETE FROM resource_submissions
       WHERE id = $1
       RETURNING id;`,
      [submissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    return res.json({ message: 'Submission deleted.' });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.role,
         u.is_verified,
         u.created_at,
         u.updated_at
       FROM users u
       WHERE u.role = 'user'
       ORDER BY u.created_at DESC;`
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  const userId = req.params.id;
  const { currentPassword } = req.body || {};

  try {
    const pwd = typeof currentPassword === 'string' ? currentPassword.trim() : '';
    if (!pwd) {
      return res.status(400).json({ error: 'Enter your admin password to confirm this action.' });
    }

    const adminResult = await pool.query(
      `SELECT id, password_hash FROM users WHERE id = $1 AND role = 'admin' LIMIT 1;`,
      [req.user.sub]
    );
    if (adminResult.rowCount === 0) {
      return res.status(403).json({ error: 'Admin account not found.' });
    }
    const adminRow = adminResult.rows[0];
    if (!adminRow.password_hash) {
      return res.status(400).json({ error: 'Password confirmation is unavailable for this admin account.' });
    }
    const passwordOk = await bcrypt.compare(pwd, adminRow.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Your password is incorrect.' });
    }

    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
         AND role = 'user'
       RETURNING id;`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    return res.json({ message: 'User account deleted successfully.' });
  } catch (error) {
    return next(error);
  }
}

async function listUserMessages(req, res, next) {
  const scope = (req.query.scope || 'active').toLowerCase() === 'archived' ? 'archived' : 'active';

  try {
    await ensureUserMessageArchiveTable(pool);
    const archivedClause =
      scope === 'archived'
        ? `EXISTS (SELECT 1 FROM user_message_thread_archive a WHERE a.member_user_id = um.user_id)`
        : `NOT EXISTS (SELECT 1 FROM user_message_thread_archive a WHERE a.member_user_id = um.user_id)`;

    const result = await pool.query(
      `SELECT
         um.id,
         um.body,
         um.created_at,
         um.user_id AS thread_user_id,
         um.sender_user_id,
         tu.email AS thread_user_email,
         tu.first_name AS thread_user_first_name,
         tu.last_name AS thread_user_last_name,
         NULLIF(TRIM(CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, ''))), '') AS sender_name,
         su.email AS sender_email,
         su.role AS sender_role
       FROM user_messages um
       JOIN users tu ON tu.id = um.user_id
       JOIN users su ON su.id = um.sender_user_id
       WHERE ${archivedClause}
       ORDER BY um.created_at ASC
       LIMIT 1000;`
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function archiveMessageThread(req, res, next) {
  const threadUserId = (req.body.threadUserId || '').trim();

  try {
    await ensureUserMessageArchiveTable(pool);
    const memberResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 LIMIT 1;`,
      [threadUserId]
    );

    if (memberResult.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (memberResult.rows[0].role !== 'user') {
      return res.status(400).json({ error: 'Only member threads can be archived.' });
    }

    await pool.query(
      `INSERT INTO user_message_thread_archive (member_user_id, archived_by)
       VALUES ($1, $2)
       ON CONFLICT (member_user_id) DO UPDATE
         SET archived_at = NOW(), archived_by = EXCLUDED.archived_by;`,
      [threadUserId, req.user.sub]
    );

    return res.json({ message: 'Conversation archived.' });
  } catch (error) {
    return next(error);
  }
}

async function unarchiveMessageThread(req, res, next) {
  const threadUserId = (req.body.threadUserId || '').trim();

  try {
    await ensureUserMessageArchiveTable(pool);
    const result = await pool.query(
      `DELETE FROM user_message_thread_archive WHERE member_user_id = $1 RETURNING member_user_id;`,
      [threadUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Thread is not archived.' });
    }

    return res.json({ message: 'Conversation restored to active inbox.' });
  } catch (error) {
    return next(error);
  }
}

async function createAdminThreadMessage(req, res, next) {
  const threadUserId = (req.body.threadUserId || '').trim();
  const text = (req.body.body || '').trim();

  try {
    const memberResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 LIMIT 1;`,
      [threadUserId]
    );

    if (memberResult.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    if (memberResult.rows[0].role !== 'user') {
      return res.status(400).json({ error: 'You can only message member accounts.' });
    }

    const insert = await pool.query(
      `INSERT INTO user_messages (user_id, body, sender_user_id)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at, user_id AS thread_user_id, sender_user_id;`,
      [threadUserId, text, req.user.sub]
    );

    return res.status(201).json({
      message: 'Reply sent.',
      row: insert.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listResources,
  createResource,
  importZipResources,
  updateResource,
  getResourceAuditLog,
  listResourceSubmissions,
  updateResourceSubmissionStatus,
  deleteResourceSubmission,
  listUsers,
  deleteUser,
  listUserMessages,
  createAdminThreadMessage,
  archiveMessageThread,
  unarchiveMessageThread,
};
