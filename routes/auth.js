const express = require('express');
const AuthService = require('../services/authService');
const { models } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService(models.User, models.Room);

// Public routes
router.get('/teacher-login', (req, res) => {
  res.render('teacher-login', { 
    title: 'Teacher Login',
    roomId: req.query.roomId,
    pinCode: req.query.pinCode
  });
});

router.post('/teacher-login', async (req, res) => {
  try {
    const { roomId, pinCode } = req.body;
    const { token, roomIdentifier } = await authService.teacherLogin(roomId, pinCode);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.redirect(`/rooms/${roomIdentifier}`);
  } catch (error) {
    console.error('Login error:', error);
    res.render('teacher-login', { title: 'Teacher Login', error: error.message });
  }
});

router.get('/student-login', (req, res) => {
  res.render('student-login', { title: 'Student Login' });
});

router.post('/student-login', async (req, res) => {
  try {
    const { roomId, email } = req.body;
    await authService.requestStudentLink(email, roomId);
    res.render('student-login', { 
      title: 'Student Login', 
      success: 'Een login link is naar je mail gestuurd. Check je inbox.'
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.render('student-login', { 
      title: 'Student Login', 
      error: error.message || 'An unexpected error occurred'
    });
  }
});

router.get('/student-access/:token', async (req, res, next) => {
  try {
    console.log('Received token:', req.params.token);
    const { token, roomIdentifier } = await authService.verifyStudentToken(req.params.token);
    console.log('Verified token, room identifier:', roomIdentifier);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    console.log('Set cookie, redirecting to:', `/videos/upload/${roomIdentifier}`);
    res.redirect(`/videos/upload/${roomIdentifier}`);
  } catch (error) {
    console.error('Student access error:', error);
    next(error);
  }
});

router.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});

router.post('/register', async (req, res) => {
  try {
    const { email } = req.body;
    const { room } = await authService.registerTeacher(email);
    res.render('register', { 
      title: 'Register', 
      success: 'Potje is gestart! Alle details zijn ook naar je gemaild.',
      roomIdentifier: room.uniqueIdentifier,
      pinCode: room.pinCode
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { 
      title: 'Register', 
      error: error.message
    });
  }
});

// Protected route
router.get('/logout', authMiddleware.requireAuth, (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

module.exports = router;