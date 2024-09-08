const jwt = require('jsonwebtoken');
const { models } = require('../database');

const authMiddleware = {
  setUser: async (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await models.User.findByPk(decoded.id);
        if (user) {
          req.user = {
            id: user.id,
            role: user.role,
            email: user.email
          };
          res.locals.user = req.user; // Add user to response locals
        } else {
          res.locals.user = null;
        }
      } catch (err) {
        res.locals.user = null;
      }
    } else {
      res.locals.user = null;
    }
    next();
  },

  requireAuth: (req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.status(401).render('error', { title: 'Error', message: 'Please log in to access this page' });
    }
  },

  requireTeacher: (req, res, next) => {
    if (req.user && req.user.role === 'teacher') {
      next();
    } else {
      res.status(403).render('error', { title: 'Error', message: 'Access denied. Teachers only.' });
    }
  },

  requireStudent: (req, res, next) => {
    if (req.user && req.user.role === 'student') {
      next();
    } else {
      res.status(403).render('error', { title: 'Error', message: 'Access denied. Students only.' });
    }
  }
};

module.exports = authMiddleware;