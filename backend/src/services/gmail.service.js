const { google } = require('googleapis');

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function buildRawEmail({ to, from, subject, html }) {
  const messageParts = [
    `From: Community Resource Finder <${from}>`,
    `To: ${to}`,
    'Content-Type: text/html; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    html,
  ];

  return Buffer.from(messageParts.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendVerificationEmail({ to, name, verificationUrl }) {
  const sender = process.env.GMAIL_SENDER_EMAIL;
  const oauth2Client = getOAuthClient();

  if (!sender || !oauth2Client) {
    return {
      sent: false,
      reason: 'gmail_not_configured',
      verificationUrl,
    };
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const subject = 'Verify your Community Resource Finder account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px;">
      <h2>Welcome${name ? `, ${name}` : ''}!</h2>
      <p>Thanks for creating your account. Please verify your email to activate account features.</p>
      <p>
        <a href="${verificationUrl}" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;">
          Verify Email
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    </div>
  `;

  const raw = buildRawEmail({
    to,
    from: sender,
    subject,
    html,
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return { sent: true };
}

module.exports = { sendVerificationEmail };
