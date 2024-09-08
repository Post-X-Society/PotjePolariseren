const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.strato.com',
      port: 465,
      secure: true, // use SSL
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      authMethod: 'LOGIN',
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
      }
    });
  }

  async sendRegistrationEmail(to, roomIdentifier, pinCode) {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: 'Your Room Registration Details',
      text: `Thank you for registering! Here are your room details:\n\nRoom Identifier: ${roomIdentifier}\nPIN: ${pinCode}\n\nPlease keep this information safe.`,
      html: `
        <h1>Thank you for registering!</h1>
        <p>Here are your room details:</p>
        <ul>
          <li><strong>Room Identifier:</strong> ${roomIdentifier}</li>
          <li><strong>PIN:</strong> ${pinCode}</li>
        </ul>
        <p>Please keep this information safe.</p>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  async sendStudentAccessLink(to, accessLink) {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: 'Your Video Upload Access Link',
      text: `Here's your access link to upload videos: ${accessLink}\n\nThis link will expire in 1 hour.`,
      html: `
        <h1>Video Upload Access</h1>
        <p>Here's your access link to upload videos:</p>
        <a href="${accessLink}">${accessLink}</a>
        <p>This link will expire in 1 hour.</p>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();