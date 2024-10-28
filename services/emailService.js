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
      subject: 'Potje Polariseren inloggegevens',
      text: `Bedankt voor het aanmaken van een potje! Dit zijn de inlogggevens:\n\nPotje ID: ${roomIdentifier}\nPIN: ${pinCode}\n\nHoud deze informatie geheimd.`,
      html: `
        <h1>Bedankt voor het aanmaken van een potje!</h1>
        <p>Dit zijn de inlogggevens:</p>
        <ul>
          <li><strong>Potje ID:</strong> ${roomIdentifier}</li>
          <li><strong>PIN:</strong> ${pinCode}</li>
        </ul>
        <p>Houd deze informatie geheim.</p>
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
      subject: 'Potje Polariseren toegangslink',
      text: `Volg deze link om videos toe te voegen aan de "Potje Polariseren" sessie van jouw klas:\n\n${accessLink}\n\nDeze link verloopt na 1 uur.`,
      html: `
        <h1>Potje Polariseren toegangslink</h1>
        <p>Volg deze link om videos toe te voegen aan de "Potje Polariseren" sessie van jouw klas:</p>
        <a href="${accessLink}">${accessLink}</a>
        <p>Deze link verloopt na 1 uur.</p>
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