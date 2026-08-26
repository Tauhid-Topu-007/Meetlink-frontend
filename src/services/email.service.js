const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (config.email.host && config.email.user) {
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  } else {
    // Dev: Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Using Ethereal test email account');
  }
  return transporter;
};

const meetingInviteTemplate = ({ meeting, hostName, joinLink }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.4); }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: white; }
    .body { padding: 32px; }
    .meta { background: #0f172a; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .meta p { margin: 8px 0; font-size: 14px; color: #94a3b8; }
    .meta strong { color: #f1f5f9; }
    .btn { display: inline-block; background: #6366f1; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>MeetLink</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">You're invited to a meeting</p>
    </div>
    <div class="body">
      <p>Hi there,</p>
      <p><strong>${hostName}</strong> has invited you to join a meeting on MeetLink.</p>
      <div class="meta">
        <p><strong>Title:</strong> ${meeting.title}</p>
        ${meeting.scheduledStart ? `<p><strong>When:</strong> ${new Date(meeting.scheduledStart).toLocaleString()}</p>` : '<p><strong>Type:</strong> Instant meeting</p>'}
        <p><strong>Meeting ID:</strong> ${meeting.meetingId}</p>
        ${meeting.hasPassword ? '<p><strong>Password:</strong> Required (provided by host)</p>' : ''}
      </div>
      <p style="text-align: center;">
        <a href="${joinLink}" class="btn">Join Meeting</a>
      </p>
      <p style="font-size: 13px; color: #94a3b8;">Or copy this link: ${joinLink}</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} MeetLink · Advanced Real-Time Communication
    </div>
  </div>
</body>
</html>
`;

const sendMeetingInvitation = async ({ to, meeting, hostName, joinLink }) => {
  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: config.email.from,
    to,
    subject: `Invitation: ${meeting.title} — MeetLink`,
    html: meetingInviteTemplate({ meeting, hostName, joinLink }),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
};

const sendGenericEmail = async ({ to, subject, html }) => {
  const transport = await getTransporter();
  return transport.sendMail({
    from: config.email.from,
    to,
    subject,
    html,
  });
};

module.exports = {
  sendMeetingInvitation,
  sendGenericEmail,
};