const path = require('path');
const fs = require('fs').promises;
const { models, sequelize } = require('../database');
const { Op } = require('sequelize');

async function cleanupExpiredRooms() {
    const transaction = await sequelize.transaction();
    
    try {
        console.log('Starting cleanup of expired rooms...');
        
        // Find all expired rooms
        const expiredRooms = await models.Room.findAll({
            where: {
                expiresAt: {
                    [Op.lt]: new Date()
                }
            },
            include: [{
                model: models.Video,
                as: 'videos'
            }],
            transaction
        });

        console.log(`Found ${expiredRooms.length} expired rooms`);

        for (const room of expiredRooms) {
            console.log(`Processing room: ${room.uniqueIdentifier}`);
            
            // Delete associated video files
            for (const video of room.videos) {
                try {
                    const filePath = path.join(__dirname, '../uploads', video.filePath);
                    await fs.unlink(filePath);
                    console.log(`Deleted file: ${video.filePath}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error(`Error deleting file ${video.filePath}:`, error);
                    }
                }
            }

            // Delete all videos associated with this room
            await models.Video.destroy({
                where: { roomId: room.id },
                transaction
            });

            console.log(`Deleted all videos for room: ${room.uniqueIdentifier}`);
        }

        // Delete the expired rooms
        await models.Room.destroy({
            where: {
                id: expiredRooms.map(room => room.id)
            },
            transaction
        });

        await transaction.commit();
        console.log(`Successfully deleted ${expiredRooms.length} expired rooms and their associated data`);

    } catch (error) {
        await transaction.rollback();
        console.error('Error during cleanup:', error);
        throw error;
    }
}

// If running directly (not required as a module)
if (require.main === module) {
    cleanupExpiredRooms()
        .then(() => {
            console.log('Cleanup completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Cleanup failed:', error);
            process.exit(1);
        });
}

module.exports = cleanupExpiredRooms;