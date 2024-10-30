const express = require('express');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { sequelize, models } = require('./database');
const authMiddleware = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Custom logging setup with timestamps
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logFile = fs.createWriteStream(path.join(logDir, 'app.log'), { flags: 'a' });
const logStdout = process.stdout;

console.log = function () {
    const timestamp = new Date().toISOString();
    const logMessage = util.format.apply(null, arguments);
    const timestampedMessage = `[${timestamp}] ${logMessage}\n`;
    logFile.write(timestampedMessage);
    logStdout.write(timestampedMessage);
}
console.error = console.log;

// Ensure REPLICATE_API_KEY is set
if (!process.env.REPLICATE_API_KEY) {
  console.error('REPLICATE_API_KEY is not set in the .env file');
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Use auth middleware globally
app.use(authMiddleware.setUser);

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const videoRoutes = require('./routes/video');

// Routes
app.use('/auth', authRoutes);
app.use('/rooms', roomRoutes);
app.use('/videos', videoRoutes);

app.get('/', (req, res) => {
    res.render('index', { title: 'Potje Polariseren' });
});

app.get('/over', (req, res) => {
    res.render('over', { title: 'Over Potje Polariseren' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  // Log the stack trace
  console.error(err.stack);

  // Check if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }

  // Render the error page
  res.status(err.status || 500);
  res.render('error', {
    title: 'Error',  // Always provide a title
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message,
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Sync database and start the server
sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch(err => {
    console.error('Unable to sync database:', err);
});

module.exports = app;