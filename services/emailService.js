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
	
	async sendScoringCompleteEmail(to, videoId, videoTitle, scoreData, roomIdentifier) {
    const scorePercentage = Object.values(scoreData)
      .reduce((acc, category) => acc + category.score, 0) / 30 * 100;
    
    const baseUrl = process.env.BASE_URL || 'https://polariseren.postxsociety.cloud';
    const scoreUrl = `${baseUrl}/videos/viewScore/${videoId}`;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: 'Video score beschikbaar - Potje Polariseren',
      text: `
Je video "${videoTitle}" is geanalyseerd!

Polarisatie Score: ${scorePercentage.toFixed(0)}%

Bekijk de gedetailleerde score hier:
${scoreUrl}

Dit bericht is automatisch verzonden door Potje Polariseren.`,
      html: `
        <h1>Je video is geanalyseerd!</h1>
        <p>De analyse van je video "${videoTitle}" is voltooid.</p>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
          <p><strong>Polarisatie Score:</strong> ${scorePercentage.toFixed(0)}%</p>
        </div>

        <p>
          <a href="${scoreUrl}" 
             style="display: inline-block; padding: 10px 20px; background-color: #EE72F8; color: white; text-decoration: none; border-radius: 4px;">
            Bekijk gedetailleerde score
          </a>
        </p>

        <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
          Dit bericht is automatisch verzonden door Potje Polariseren.
        </p>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Score notification email sent:', info.response);
      return info;
    } catch (error) {
      console.error('Error sending score notification email:', error);
      throw error;
    }
  }
	
  async sendConsolidatedRoomCredentials(to, groupedRooms) {
    console.log(`[sendConsolidatedRoomCredentials] Starting to send email to: ${to}`);
    console.log(`[sendConsolidatedRoomCredentials] Number of teacher accounts: ${Object.keys(groupedRooms).length}`);

    // Create HTML for each teacher's rooms
    const roomListHtml = Object.entries(groupedRooms).map(([teacherId, rooms], index) => `
      <div style="margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
        <h3>Potje ${index + 1}</h3>
        ${rooms.map(room => `
          <div style="margin-bottom: 20px; padding: 10px; border: 1px solid #eee; border-radius: 4px;">
            <h4>Potje details:</h4>
            <ul>
              <li><strong>Potje ID:</strong> ${room.identifier}</li>
              <li><strong>PIN:</strong> ${room.pinCode}</li>
              <li><strong>Verloopt op:</strong> ${new Date(room.expiresAt).toLocaleDateString('nl-NL')}</li>
              <li><strong>Aangemaakt op:</strong> ${new Date(room.createdAt).toLocaleDateString('nl-NL')}</li>
            </ul>
          </div>
        `).join('')}
      </div>
    `).join('');

    // Create plain text version
    const roomListText = Object.entries(groupedRooms).map(([teacherId, rooms], index) => {
      const accountHeader = `\nPotje ${index + 1}:\n`;
      const roomsText = rooms.map(room => 
        `\nPotje details:\n` +
        `Potje ID: ${room.identifier}\n` +
        `PIN: ${room.pinCode}\n` +
        `Verloopt op: ${new Date(room.expiresAt).toLocaleDateString('nl-NL')}\n` +
        `Aangemaakt op: ${new Date(room.createdAt).toLocaleDateString('nl-NL')}\n`
      ).join('\n');
      return accountHeader + roomsText;
    }).join('\n');

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: to,
      subject: 'Je Potje Polariseren inloggegevens',
      text: `Hier zijn je inloggegevens voor al je actieve potjes:\n\n${roomListText}\n\nHoud deze informatie geheim.`,
      html: `
        <h1>Je Potje Polariseren inloggegevens</h1>
        <p>Hier zijn je inloggegevens voor al je actieve potjes:</p>
        ${roomListHtml}
        <p>Houd deze informatie geheim.</p>
      `
    };

    try {
      console.log('[sendConsolidatedRoomCredentials] Attempting to send email with config:', {
        from: process.env.SMTP_USER,
        to: to,
        subject: mailOptions.subject,
        numberOfAccounts: Object.keys(groupedRooms).length,
        totalRooms: Object.values(groupedRooms).flat().length
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log('[sendConsolidatedRoomCredentials] Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
      });
      return info;
    } catch (error) {
      console.error('[sendConsolidatedRoomCredentials] Error sending email:', {
        error: error.message,
        stack: error.stack,
        errorCode: error.code,
        errorCommand: error.command,
        responseCode: error.responseCode,
        response: error.response
      });
      throw error;
    }
  }
}

module.exports = new EmailService();