const { OAuth2Client } = require('google-auth-library');

let googleClient = null;

function getGoogleClient() {
  if (googleClient) return googleClient;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  googleClient = new OAuth2Client(clientId);
  return googleClient;
}

async function verifyGoogleIdToken(idToken) {
  const client = getGoogleClient();
  if (!client) {
    throw new Error('Google OAuth is not configured.');
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
}

module.exports = { verifyGoogleIdToken };
