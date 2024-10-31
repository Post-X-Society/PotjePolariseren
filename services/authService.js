const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const emailService = require('./emailService');
const { models } = require('../database');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;

class AuthService {
  constructor(User, Room) {
    this.User = User;
    this.Room = Room;
  }

  async registerTeacher(email) {
    /* More than one room per teacher
	const existingUser = await this.User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Emailadres al in gebruik');
    } */

    const user = await this.User.create({
      email,
      role: 'teacher'
    });

    const roomIdentifier = uuidv4().substr(0, 8);
    const pinCode = Math.floor(1000 + Math.random() * 9000).toString();
    const room = await this.Room.create({
      uniqueIdentifier: roomIdentifier,
      pinCode,
      teacherId: user.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days from now
    });

    try {
      await emailService.sendRegistrationEmail(email, roomIdentifier, pinCode);
    } catch (error) {
      console.error('Versturen van gegevens mislukt:', error);
      // Depending on your requirements, you might want to delete the created user and room here
      // await user.destroy();
      // await room.destroy();
      throw new Error('Potje is aangemaakt, maar mail is niet verstuurd.');
    }

    return { user, room };
  }

  async teacherLogin(roomIdentifier, pinCode) {
    const room = await this.Room.findOne({ 
      where: { uniqueIdentifier: roomIdentifier },
      include: ['teacher']
    });

    if (!room || room.pinCode !== pinCode) {
      throw new Error('Onjuist Potje ID of PIN');
    }

    const token = jwt.sign({ id: room.teacher.id, role: 'teacher', roomId: room.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return { token, roomIdentifier: room.uniqueIdentifier };
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
	
  async retrieveRoomCredentials(email) {
    console.log(`[retrieveRoomCredentials] Starting credential retrieval for email: ${email}`);
    try {
      // Find all teachers with this email
      console.log(`[retrieveRoomCredentials] Looking up teachers with email: ${email}`);
      const teachers = await this.User.findAll({
        where: {
          email: email,
          role: 'teacher'
        },
        logging: console.log // Enable Sequelize query logging
      });

      console.log(`[retrieveRoomCredentials] Found ${teachers.length} teachers with email: ${email}`);

      if (!teachers || teachers.length === 0) {
        console.log(`[retrieveRoomCredentials] No teachers found with email: ${email}`);
        return;
      }

      // Get all teacher IDs
      const teacherIds = teachers.map(teacher => teacher.id);
      console.log(`[retrieveRoomCredentials] Teacher IDs found:`, teacherIds);

      // Get all active rooms for all teachers with this email
      const currentDate = new Date();
      console.log(`[retrieveRoomCredentials] Fetching active rooms for teacher IDs: ${teacherIds.join(', ')}`);
      console.log(`[retrieveRoomCredentials] Current date for comparison: ${currentDate.toISOString()}`);
      
      const rooms = await this.Room.findAll({
        where: {
          teacherId: {
            [Op.in]: teacherIds
          },
          expiresAt: {
            [Op.gt]: currentDate
          }
        },
        order: [['createdAt', 'DESC']],
        include: [{
          model: this.User,
          as: 'teacher',
          attributes: ['email']
        }],
        logging: console.log // Enable Sequelize query logging
      });

      console.log(`[retrieveRoomCredentials] Found ${rooms.length} active rooms total`);
      
      if (rooms.length > 0) {
        console.log('[retrieveRoomCredentials] Room details:');
        rooms.forEach((room, index) => {
          console.log(`Room ${index + 1}:`, {
            id: room.id,
            uniqueIdentifier: room.uniqueIdentifier,
            expiresAt: room.expiresAt,
            createdAt: room.createdAt,
            teacherId: room.teacherId
          });
        });

        // Group rooms by teacher for more organized display
        const groupedRooms = this.groupRoomsByTeacher(rooms);
        console.log('[retrieveRoomCredentials] Grouped rooms by teacher:', 
          Object.keys(groupedRooms).length, 'different teachers');

        // Send consolidated email with all room credentials
        await this.sendConsolidatedCredentials(email, groupedRooms);
        console.log('[retrieveRoomCredentials] Successfully sent consolidated credentials email');
      } else {
        console.log('[retrieveRoomCredentials] No active rooms found for any teacher account');
      }

      return;
    } catch (error) {
      console.error('[retrieveRoomCredentials] Error occurred:', error);
      console.error('[retrieveRoomCredentials] Error stack:', error.stack);
      throw new Error('Er is een fout opgetreden bij het ophalen van de inloggegevens.');
    }
  }

  groupRoomsByTeacher(rooms) {
    return rooms.reduce((grouped, room) => {
      const teacherId = room.teacherId;
      if (!grouped[teacherId]) {
        grouped[teacherId] = [];
      }
      grouped[teacherId].push({
        identifier: room.uniqueIdentifier,
        pinCode: room.pinCode,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt
      });
      return grouped;
    }, {});
  }

  async sendConsolidatedCredentials(email, groupedRooms) {
    console.log(`[sendConsolidatedCredentials] Starting email send to: ${email}`);
    try {
      console.log(`[sendConsolidatedCredentials] Sending details for ${Object.keys(groupedRooms).length} teacher accounts`);
      
      await emailService.sendConsolidatedRoomCredentials(email, groupedRooms);
      console.log('[sendConsolidatedCredentials] Email sent successfully');
    } catch (error) {
      console.error('[sendConsolidatedCredentials] Error sending email:', error);
      console.error('[sendConsolidatedCredentials] Error stack:', error.stack);
      throw new Error('Er is een fout opgetreden bij het versturen van de inloggegevens.');
    }
  }
	
  async requestStudentLink(email, roomId) {
    try {
      const room = await this.Room.findOne({ where: { uniqueIdentifier: roomId } });
      if (!room) {
        throw new Error('Onjuist Potje ID');
      }
	
	  /* more than one link per student
      let student = await this.User.findOne({ where: { email, role: 'student' } });
      if (!student) {
        student = await this.User.create({ email, role: 'student' });
      } */
	  let student = await this.User.create({ email, role: 'student' });

      const token = jwt.sign({ id: student.id, role: 'student', roomId: room.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const accessLink = `${process.env.APP_URL}/auth/student-access/${token}`;

      await emailService.sendStudentAccessLink(email, accessLink);

      return { message: 'Link is verstuurd per mail' };
    } catch (error) {
      console.error('Error in requestStudentLink:', error);
      if (error.name === 'SequelizeValidationError') {
        throw new Error('Validation error: ' + error.errors.map(e => e.message).join(', '));
      }
      throw error;
    }
  }

  async verifyStudentToken(token) {
    try {
      console.log('Verifying token:', token);
      
      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not set');
        throw new Error('Server configuration error');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Decoded token:', decoded);
      
      if (decoded.role !== 'student') {
        console.log('Invalid role:', decoded.role);
        throw new Error('Invalid token: not a student token');
      }
      
      console.log('Searching for room with ID:', decoded.roomId);
      const room = await this.Room.findByPk(decoded.roomId);
      console.log('Found room:', room ? room.toJSON() : 'not found');
      
      if (!room) {
        throw new Error('Room not found');
      }
      
      const newToken = jwt.sign(
        { id: decoded.id, role: 'student', roomId: decoded.roomId },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      console.log('Generated new token');
      
      return { token: newToken, roomIdentifier: room.uniqueIdentifier };
    } catch (error) {
      console.error('Error in verifyStudentToken:', error);
      throw error;
    }
  }
}

module.exports = AuthService;