const cron = require('node-cron');
const cleanupExpiredRooms = require('./cleanupExpiredRooms');

// Run at 3 AM every day
cron.schedule('0 3 * * *', async () => {
    console.log('Starting scheduled cleanup:', new Date().toISOString());
    try {
        await cleanupExpiredRooms();
        console.log('Scheduled cleanup completed successfully');
    } catch (error) {
        console.error('Scheduled cleanup failed:', error);
    }
});

console.log('Cleanup cron job scheduled');