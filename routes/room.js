const express = require('express');
const { models } = require('../database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// This route requires teacher authentication
router.get('/:roomId', authMiddleware.requireAuth, authMiddleware.requireTeacher, async (req, res) => {
    try {
        const room = await models.Room.findOne({
            where: { uniqueIdentifier: req.params.roomId },
            include: [
                {
                    model: models.Video,
                    as: 'videos',
                    include: [
                        { model: models.User, as: 'student', attributes: ['email'] },
                        { model: models.User, as: 'teacher', attributes: ['email'] }
                    ]
                }
            ]
        });

        if (!room) {
            return res.status(404).render('error', { title: 'Error', message: 'Room not found' });
        }

        // Check if the logged-in teacher is associated with this room
        if (room.teacherId !== req.user.id) {
            return res.status(403).render('error', { title: 'Error', message: 'You do not have permission to access this room' });
        }

        res.render('teacher-room', { 
            title: `Room ${room.uniqueIdentifier}`,
            room,
            videos: room.videos
        });
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).render('error', { title: 'Error', message: 'An error occurred while fetching the room data' });
    }
});

module.exports = router;