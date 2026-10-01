const nodemailer = require('nodemailer');
const config = require('../config/config');

const generateOTP = () =>{
    return Math.floor(100000 + Math.random() *900000).toString();
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth:{
        user: config.EMAIL_ID,
        pass: config.EMAIL_PASSWORD
    }
})


const resetPassMailOption = (otpCode, userEmail) => {
  return {
    from: '"MEDCARE AI" <no-reply@medcareai.com>', // Sender address
    to: userEmail, // Receiver address (now passed into the function)
    subject: '🔒 Reset Your MEDCARE AI Password - OTP Verification', // Subject line
    text: `Your MEDCARE AI password reset OTP is ${otpCode}. It is valid for 10 minutes.`, // Plain text fallback
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f9;
            color: #333333;
          }
          .email-container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            border: 1px solid #e1e8ed;
          }
          .header {
            background-color: #0077b6; /* Medical Blue */
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 26px;
            letter-spacing: 1px;
            font-weight: 700;
          }
          .content {
            padding: 40px 30px;
            line-height: 1.6;
          }
          .content h2 {
            color: #005f73;
            margin-top: 0;
            font-size: 20px;
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
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header Section -->
          <div class="header">
            <h1>🏥 MEDCARE AI</h1>
          </div>
          
          <!-- Content Section -->
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset the password associated with your MEDCARE AI account. Use the following One-Time Password (OTP) to proceed with your verification:</p>
            
            <div class="otp-container">
              <p class="otp-code">${otpCode}</p>
            </div>
            
            <p><strong>This OTP is valid for 10 minutes.</strong> Please do not share this code with anyone for security purposes.</p>
            <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <p>Best regards,<br><strong>The MEDCARE AI Team</strong></p>
          </div>
          
          <!-- Footer Section -->
          <div class="footer">
            <p>This is an automated system email. Please do not reply directly to this message.</p>
            <p>&copy; ${new Date().getFullYear()} MEDCARE AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };
};

const accountVerificationMailOptions = (otpCode, userEmail) => ({
    from: '"MEDCARE AI" <no-reply@medcareai.com>', // Sender address
    to: userEmail,                               // Recipient address
    subject: '🔒 Verify Your MEDCARE AI Account',  // Subject line
    text: `Your MEDCARE AI verification code is ${otpCode}. It expires in 10 minutes.`, // Plain text fallback
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Verification</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .email-container {
            max-width: 550px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            overflow: hidden;
            border: 1px solid #eef2f5;
          }
          .email-header {
            background-color: #007bff; /* Medical Blue color theme */
            padding: 30px;
            text-align: center;
          }
          .email-header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.5px;
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
          .email-footer a {
            color: #007bff;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="email-header">
            <h1>MEDCARE AI</h1>
          </div>
          
          <!-- Body -->
          <div class="email-body">
            <h2>Verify Your Account</h2>
            <p>Thank you for choosing MEDCARE AI. To complete your account verification and secure your profile, please use the One-Time Password (OTP) provided below:</p>
            
            <div class="otp-container">
              <p class="otp-code">${otpCode}</p>
              <p class="expiry-text">This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
            </div>
            
            <p>If you did not request this verification, you can safely ignore this email or contact our support team if you have concerns.</p>
            <p>Best regards,<br><strong>The MEDCARE AI Team</strong></p>
          </div>
          
          <!-- Footer -->
          <div class="email-footer">
            <p>© 2026 MEDCARE AI. All rights reserved.</p>
            <p>This is an automated security message. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
});

const doctorRegistrationVerificationMailOptions = (doctorName, userEmail, verificationLink) => ({
    from: '"MEDCARE AI" <no-reply@medcareai.com>', // Sender address
    to: userEmail, // Recipient address
    subject: '🏥 Welcome to MEDCARE AI - Verify Your Doctor Account', // Subject line

    text: `
Hello Dr. ${doctorName},

Welcome to MEDCARE AI!

Thank you for registering as a doctor with MEDCARE AI.

To continue with your doctor registration, please verify your email address using the link below:

${verificationLink}

Once your email is verified, your application will be forwarded to the MEDCARE AI administration team for review and verification.

Please note that email verification does not mean your doctor account has been approved. Your application must be reviewed and verified by an administrator.

If you did not create this account, you can safely ignore this email.

Best regards,
The MEDCARE AI Team
    `,

    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Doctor Account Verification</title>

        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }

          .email-container {
            max-width: 550px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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
            letter-spacing: 0.5px;
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

          .welcome-container {
            background-color: #f0f7ff;
            border-left: 4px solid #007bff;
            border-radius: 8px;
            padding: 18px;
            margin: 25px 0;
          }

          .welcome-container p {
            margin: 0;
          }

          .verification-container {
            background-color: #f8fafc;
            border: 1px solid #e3edf7;
            border-radius: 8px;
            padding: 25px 20px;
            text-align: center;
            margin: 30px 0;
          }

          .verification-button {
            display: inline-block;
            background-color: #007bff;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-size: 15px;
            font-weight: 600;
          }

          .verification-button:hover {
            background-color: #0069d9;
          }

          .verification-text {
            font-size: 13px;
            color: #666666;
            margin-top: 15px;
          }

          .process-container {
            background-color: #f8fafc;
            border: 1px solid #eef2f5;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }

          .process-container h3 {
            margin-top: 0;
            color: #1a1a1a;
            font-size: 16px;
          }

          .process-step {
            margin: 12px 0;
            color: #555555;
          }

          .step-number {
            display: inline-block;
            width: 24px;
            height: 24px;
            line-height: 24px;
            text-align: center;
            background-color: #007bff;
            color: #ffffff;
            border-radius: 50%;
            font-size: 12px;
            font-weight: 600;
            margin-right: 8px;
          }

          .important-note {
            background-color: #fff8e6;
            border-left: 4px solid #f0ad4e;
            padding: 15px;
            border-radius: 5px;
            font-size: 14px;
            color: #555555;
            margin: 25px 0;
          }

          .email-footer {
            background-color: #f8fafc;
            padding: 20px 30px;
            text-align: center;
            font-size: 12px;
            color: #8c9ba5;
            border-top: 1px solid #eef2f5;
          }

          .email-footer a {
            color: #007bff;
            text-decoration: none;
          }
        </style>
      </head>

      <body>

        <div class="email-container">

          <!-- Header -->
          <div class="email-header">
            <h1>MEDCARE AI</h1>
          </div>

          <!-- Body -->
          <div class="email-body">

            <h2>Welcome to MEDCARE AI, Dr. ${doctorName}!</h2>

            <p>
              Thank you for registering as a doctor with
              <strong>MEDCARE AI</strong>.
              We are pleased to have you join our healthcare platform.
            </p>

            <div class="welcome-container">
              <p>
                To continue with your doctor registration,
                please verify your email address by clicking the button below.
              </p>
            </div>

            <!-- Verification Button -->
            <div class="verification-container">

              <a
                href="${verificationLink}"
                class="verification-button"
              >
                Verify Your Email
              </a>

              <p class="verification-text">
                Click the button above to verify your email address.
              </p>

            </div>

            <!-- Registration Process -->
            <div class="process-container">

              <h3>What happens next?</h3>

              <p class="process-step">
                <span class="step-number">1</span>
                Verify your email address.
              </p>

              <p class="process-step">
                <span class="step-number">2</span>
                Your doctor application will be forwarded to the MEDCARE AI administration team.
              </p>

              <p class="process-step">
                <span class="step-number">3</span>
                The administrator will review your submitted information and credentials.
              </p>

              <p class="process-step">
                <span class="step-number">4</span>
                After administrative verification, your doctor account will be approved.
              </p>

            </div>

            <!-- Important Note -->
            <div class="important-note">
              <strong>Important:</strong>
              Email verification does not mean that your doctor account
              has already been approved. Your application must be reviewed
              and verified by the MEDCARE AI administration team.
            </div>

            <p>
              If you did not create a doctor account on MEDCARE AI,
              you can safely ignore this email.
            </p>

            <p>
              Best regards,<br>
              <strong>The MEDCARE AI Team</strong>
            </p>

          </div>

          <!-- Footer -->
          <div class="email-footer">

            <p>
              © 2026 MEDCARE AI. All rights reserved.
            </p>

            <p>
              This is an automated security message.
              Please do not reply directly to this email.
            </p>

          </div>

        </div>

      </body>
      </html>
    `
});

module.exports = {generateOTP , transporter ,resetPassMailOption ,accountVerificationMailOptions , doctorRegistrationVerificationMailOptions };