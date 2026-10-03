const config = require("../config/config");

// =====================================================
// GENERATE OTP
// =====================================================

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


// =====================================================
// SEND EMAIL USING GMAIL API
// =====================================================

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

const sendEmail = async (to, subject, text, html) => {
  try {
    if (!to) {
      throw new Error("Recipient email is missing");
    }

    let message = `From: MEDCARE AI <${process.env.GMAIL_USER}>\r\n`;
    message += `To: ${to}\r\n`;
    message += `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: multipart/alternative; boundary="boundary-string"\r\n\r\n`;

    if (text) {
      message += `--boundary-string\r\n`;
      message += `Content-Type: text/plain; charset="UTF-8"\r\n\r\n`;
      message += `${text}\r\n\r\n`;
    }

    if (html) {
      message += `--boundary-string\r\n`;
      message += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
      message += `${html}\r\n\r\n`;
    }

    message += `--boundary-string--`;

    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    return res.data;
  } catch (error) {
    console.error("====================================");
    console.error("EMAIL SENDING FAILED");
    console.error("Error:", error.message);
    console.error("====================================");
    throw error;
  }
};


// =====================================================
// PASSWORD RESET EMAIL
// =====================================================

const sendResetPassMail = async (otpCode, userEmail) => {

  const subject =
    "🔒 Reset Your MEDCARE AI Password - OTP Verification";

  const text =
    `Your MEDCARE AI password reset OTP is ${otpCode}. It is valid for 10 minutes.`;

  const html = `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>Reset Your Password</title>

<style>

body {
    margin: 0;
    padding: 0;
    font-family:
        'Segoe UI',
        Tahoma,
        Geneva,
        Verdana,
        sans-serif;
    background-color: #f4f7f9;
    color: #333333;
}

.email-container {
    max-width: 600px;
    margin: 30px auto;
    background: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e1e8ed;
}

.header {
    background-color: #0077b6;
    padding: 30px 20px;
    text-align: center;
}

.header h1 {
    color: #ffffff;
    margin: 0;
    font-size: 26px;
}

.content {
    padding: 40px 30px;
    line-height: 1.6;
}

.content h2 {
    color: #005f73;
    margin-top: 0;
}

.otp-container {
    text-align: center;
    margin: 30px 0;
    padding: 20px;
    background-color: #f0f7f4;
    border-radius: 6px;
    border: 1px dashed #00a896;
}

.otp-code {
    font-size: 32px;
    font-weight: bold;
    color: #0077b6;
    letter-spacing: 6px;
    margin: 0;
}

.footer {
    background-color: #f8f9fa;
    padding: 20px;
    text-align: center;
    font-size: 12px;
    color: #777777;
    border-top: 1px solid #e1e8ed;
}

</style>

</head>


<body>

<div class="email-container">

    <div class="header">

        <h1>🏥 MEDCARE AI</h1>

    </div>


    <div class="content">

        <h2>Password Reset Request</h2>

        <p>Hello,</p>

        <p>
            We received a request to reset the password
            associated with your MEDCARE AI account.
            Use the following OTP to continue.
        </p>


        <div class="otp-container">

            <p class="otp-code">
                ${otpCode}
            </p>

        </div>


        <p>
            <strong>
                This OTP is valid for 10 minutes.
            </strong>
        </p>

        <p>
            Please do not share this code with anyone.
        </p>

        <p>
            If you did not request a password reset,
            you can safely ignore this email.
        </p>

        <p>
            Best regards,<br>
            <strong>The MEDCARE AI Team</strong>
        </p>

    </div>


    <div class="footer">

        <p>
            This is an automated system email.
            Please do not reply directly to this message.
        </p>

        <p>
            &copy; ${new Date().getFullYear()}
            MEDCARE AI. All rights reserved.
        </p>

    </div>

</div>

</body>

</html>
`;

  return sendEmail(
    userEmail,
    subject,
    text,
    html
  );
};


// =====================================================
// ACCOUNT VERIFICATION EMAIL
// =====================================================

const sendAccountVerificationMail = async (
  otpCode,
  userEmail
) => {

  const subject =
    "🔒 Verify Your MEDCARE AI Account";

  const text =
    `Your MEDCARE AI verification code is ${otpCode}. It expires in 10 minutes.`;

  const html = `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>Account Verification</title>

<style>

body {

    font-family:
        'Segoe UI',
        Tahoma,
        Geneva,
        Verdana,
        sans-serif;

    background-color: #f4f7f9;

    margin: 0;

    padding: 0;
}

.email-container {

    max-width: 550px;

    margin: 40px auto;

    background-color: #ffffff;

    border-radius: 12px;

    overflow: hidden;

    border: 1px solid #eef2f5;
}

.email-header {

    background-color: #007bff;

    padding: 30px;

    text-align: center;
}

.email-header h1 {

    color: #ffffff;

    margin: 0;

    font-size: 26px;

    font-weight: 700;
}

.email-body {

    padding: 40px 30px;

    color: #333333;

    line-height: 1.6;
}

.email-body h2 {

    font-size: 20px;

    margin-top: 0;

    color: #1a1a1a;
}

.otp-container {

    background-color: #f0f7ff;

    border: 1px dashed #007bff;

    border-radius: 8px;

    padding: 20px;

    text-align: center;

    margin: 30px 0;
}

.otp-code {

    font-size: 36px;

    font-weight: 800;

    color: #007bff;

    letter-spacing: 6px;

    margin: 0;
}

.expiry-text {

    font-size: 13px;

    color: #666666;

    margin-top: 8px;
}

.email-footer {

    background-color: #f8fafc;

    padding: 20px 30px;

    text-align: center;

    font-size: 12px;

    color: #8c9ba5;

    border-top: 1px solid #eef2f5;
}

</style>

</head>


<body>

<div class="email-container">


    <div class="email-header">

        <h1>MEDCARE AI</h1>

    </div>


    <div class="email-body">

        <h2>
            Verify Your Account
        </h2>


        <p>
            Thank you for choosing MEDCARE AI.
            To complete your account verification,
            please use the OTP below.
        </p>


        <div class="otp-container">

            <p class="otp-code">
                ${otpCode}
            </p>

            <p class="expiry-text">

                This code is valid for
                <strong>
                    10 minutes
                </strong>.

                Do not share it with anyone.

            </p>

        </div>


        <p>

            If you did not request this verification,
            you can safely ignore this email.

        </p>


        <p>

            Best regards,<br>

            <strong>
                The MEDCARE AI Team
            </strong>

        </p>

    </div>


    <div class="email-footer">

        <p>
            © ${new Date().getFullYear()}
            MEDCARE AI. All rights reserved.
        </p>

        <p>
            This is an automated security message.
            Please do not reply directly to this email.
        </p>

    </div>


</div>

</body>

</html>
`;

  return sendEmail(
    userEmail,
    subject,
    text,
    html
  );
};



// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  generateOTP,
  sendResetPassMail,
  sendAccountVerificationMail
};