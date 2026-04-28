const pool = require('../config/db');
const { validateUsZipCode } = require('../utils/usZipValidation');
const { ensureResourceSubmissionCategoryNullable } = require('../utils/ensureResourceSubmissionSchema');

function isZipOnlyRequest(resourceName, notes) {
  const normalizedName = (resourceName || '').trim().toUpperCase();
  const normalizedNotes = (notes || '').trim().toUpperCase();
  return normalizedName.startsWith('FOR ZIP ') || normalizedNotes.includes('REQUESTED ALL RESOURCE TYPES FOR ZIP');
}

async function createSubmission(req, res, next) {
  const {
    zipOrCity,
    categoryId,
    resourceName,
    notes,
    submitterName,
    submitterContact,
  } = req.body;

  try {
    const trimmed = (zipOrCity || '').trim();
    const zipMatch = trimmed.match(/^(\d{5})(-\d{4})?$/);
    const normalizedZipOrCity = zipMatch ? zipMatch[1] : trimmed;

    if (/^\d+$/.test(trimmed) && !zipMatch) {
      return res.status(400).json({
        error:
          'Use a valid 5-digit U.S. ZIP code (you can use ZIP+4 as 12345-6789) or enter a city name instead.',
      });
    }

    if (isZipOnlyRequest(resourceName, notes)) {
      if (!zipMatch) {
        return res.status(400).json({ error: 'ZIP requests must use a valid 5-digit US ZIP code.' });
      }
    }

    if (zipMatch) {
      if (!process.env.GOOGLE_PLACES_API_KEY) {
        return res.status(503).json({
          error: 'ZIP validation is temporarily unavailable. Please try again later.',
        });
      }
      const zipCheck = await validateUsZipCode(normalizedZipOrCity);
      if (!zipCheck.isValid) {
        return res.status(400).json({
          error:
            'This ZIP code does not exist in the United States. Please check the number and try again.',
        });
      }
    }

    let finalSubmitterName = submitterName?.trim() || null;
    let finalSubmitterContact = submitterContact?.trim() || null;
    const submittedByUserId = req.user?.sub || null;
    let userEmail = null;

    if (req.user?.sub) {
      const userResult = await pool.query(
        `SELECT first_name, last_name, email
         FROM users
         WHERE id = $1
         LIMIT 1;`,
        [req.user.sub]
      );
      if (userResult.rowCount > 0) {
        const user = userResult.rows[0];
        userEmail = user.email || null;
        if (!finalSubmitterName) {
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
          finalSubmitterName = fullName || 'Registered user';
        }
      } else if (!finalSubmitterName) {
        finalSubmitterName = 'Registered user';
      }
    }

    if (!finalSubmitterContact && userEmail) {
      finalSubmitterContact = userEmail;
    }

    if (!finalSubmitterName) {
      finalSubmitterName = 'Anonymous user';
    }

    let finalCategoryId = null;
    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const n = Number(categoryId);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Invalid category.' });
      }
      finalCategoryId = n;
    }

    if (finalCategoryId == null && submittedByUserId) {
      return res.status(400).json({ error: 'Category is required.' });
    }

    const suggestionAllTypes =
      !submittedByUserId && finalCategoryId == null && !isZipOnlyRequest(resourceName, notes);

    const finalResourceNameResolved = resourceName?.trim()
      ? resourceName.trim()
      : suggestionAllTypes
        ? `Resource suggestion for ${normalizedZipOrCity} (all resource types)`
        : `Resource suggestion for ${normalizedZipOrCity}`;

    let finalNotes = notes?.trim() || null;
    if (suggestionAllTypes) {
      const prefix = 'Anonymous suggestion — all resource types (food, health, jobs, housing, legal, government).';
      finalNotes = finalNotes ? `${prefix}\n\n${finalNotes}` : prefix;
    }

    if (finalCategoryId == null) {
      await ensureResourceSubmissionCategoryNullable(pool);
    }

    const result = await pool.query(
      `INSERT INTO resource_submissions (
         submitter_name, submitter_contact, zip_or_city, category_id,
         resource_name, address, phone_number, website, notes,
         submitted_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status, created_at;`,
      [
        finalSubmitterName,
        finalSubmitterContact,
        normalizedZipOrCity,
        finalCategoryId,
        finalResourceNameResolved,
        null,
        null,
        null,
        finalNotes,
        submittedByUserId,
      ]
    );

    return res.status(201).json({
      message: 'Suggestion submitted for admin review.',
      submission: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
}

async function listMySubmissions(req, res, next) {
  const userId = req.user?.sub;

  try {
    const userResult = await pool.query(
      `SELECT email
       FROM users
       WHERE id = $1
       LIMIT 1;`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const email = userResult.rows[0].email;
    const emailLower = (email || '').trim().toLowerCase();
    const result = await pool.query(
      `SELECT
         rs.id,
         rs.status,
         rs.review_notes,
         rs.updated_at,
         rs.reviewed_at,
         NULLIF(TRIM(CONCAT(COALESCE(ru.first_name, ''), ' ', COALESCE(ru.last_name, ''))), '') AS reviewer_name,
         ru.email AS reviewer_email,
         CASE
           WHEN rs.notes ILIKE 'FLAGGED RESOURCE (%' THEN 'flag'
           ELSE 'zip_request'
         END AS submission_kind
       FROM resource_submissions rs
       LEFT JOIN users ru ON ru.id = rs.reviewed_by
       WHERE
         (
           (
             rs.notes ILIKE 'FLAGGED RESOURCE (%'
             AND (
               rs.submitted_by_user_id = $2::uuid
               OR rs.notes ILIKE $1
             )
           )
           OR
           (
             rs.zip_or_city ~ '^[0-9]{5}$'
             AND (
               rs.resource_name ILIKE 'For ZIP %'
               OR COALESCE(rs.notes, '') ILIKE '%Requested all resource types for ZIP%'
             )
             AND COALESCE(rs.notes, '') NOT ILIKE 'FLAGGED RESOURCE (%'
             AND COALESCE(rs.notes, '') NOT ILIKE 'VERIFY REQUEST%'
             AND COALESCE(rs.notes, '') NOT ILIKE '%VERIFICATION REQUEST%'
             AND (
               rs.submitted_by_user_id = $2::uuid
               OR (
                 rs.submitted_by_user_id IS NULL
                 AND rs.submitter_contact IS NOT NULL
                 AND LOWER(TRIM(rs.submitter_contact)) = $3
               )
             )
           )
         )
       ORDER BY rs.updated_at DESC;`,
      [`%by ${email}:`, userId, emailLower]
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

async function withdrawMyZipSubmission(req, res, next) {
  const submissionId = req.params.id;
  const userId = req.user.sub;

  try {
    const result = await pool.query(
      `UPDATE resource_submissions
       SET status = 'cancelled',
           review_notes = COALESCE(NULLIF(TRIM(review_notes), ''), 'Cancelled by requester.'),
           updated_at = NOW()
       WHERE id = $1
         AND status = 'pending'
         AND zip_or_city ~ '^[0-9]{5}$'
         AND (resource_name ILIKE 'For ZIP %' OR COALESCE(notes, '') ILIKE '%Requested all resource types for ZIP%')
         AND COALESCE(notes, '') NOT ILIKE 'FLAGGED RESOURCE (%'
         AND COALESCE(notes, '') NOT ILIKE 'VERIFY REQUEST%'
         AND COALESCE(notes, '') NOT ILIKE '%VERIFICATION REQUEST%'
         AND (
           submitted_by_user_id = $2
           OR (
             submitted_by_user_id IS NULL
             AND submitter_contact IS NOT NULL
             AND submitter_contact = (SELECT u.email FROM users u WHERE u.id = $2 LIMIT 1)
           )
         )
       RETURNING id;`,
      [submissionId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or you cannot cancel it.' });
    }

    return res.json({ message: 'Request cancelled.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSubmission,
  listMySubmissions,
  withdrawMyZipSubmission,
};
