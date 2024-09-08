const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const emailService = require('./emailService');
const { models } = require('../database');

class AuthService {
  constructor(User, Room) {
    this.User = User;
    this.Room = Room;
  }

  async registerTeacher(email) {
    const existingUser = await this.User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Email already registered');
    }

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
      console.error('Failed to send registration email:', error);
      // Depending on your requirements, you might want to delete the created user and room here
      // await user.destroy();
      // await room.destroy();
      throw new Error('Registration successful, but failed to send email. Please contact support.');
    }

    return { user, room };
  }

  async teacherLogin(roomIdentifier, pinCode) {
    const room = await this.Room.findOne({ 
      where: { uniqueIdentifier: roomIdentifier },
      include: ['teacher']
    });

    if (!room || room.pinCode !== pinCode) {
      throw new Error('Invalid room identifier or PIN');
    }

    const token = jwt.sign({ id: room.teacher.id, role: 'teacher', roomId: room.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return { token, roomIdentifier: room.uniqueIdentifier };
  }

  verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
	
  async requestStudentLink(email, roomId) {
    try {
      const room = await this.Room.findOne({ where: { uniqueIdentifier: roomId } });
      if (!room) {
        throw new Error('Invalid room identifier');
      }

      let student = await this.User.findOne({ where: { email, role: 'student' } });
      if (!student) {
        student = await this.User.create({ email, role: 'student' });
      }

      const token = jwt.sign({ id: student.id, role: 'student', roomId: room.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const accessLink = `${process.env.APP_URL}/auth/student-access/${token}`;

      await emailService.sendStudentAccessLink(email, accessLink);

      return { message: 'Access link sent to email' };
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