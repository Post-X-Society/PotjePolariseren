const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { models } = require('../database');
const authMiddleware = require('../middleware/auth');
const videoQueue = require('../services/videoQueue');
const TranscriptionService = require('../services/transcriptionService');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// Helper function to check edit permissions
async function checkEditPermission(videoId, userId, userRole) {
    const video = await models.Video.findByPk(videoId, { include: ['room'] });
    if (!video) {
        throw new Error('Video not found');
    }
    if (userRole === 'teacher' && video.room.teacherId === userId) {
        return video; // Teacher of the room can edit
    }
    if (userRole === 'student' && video.studentId === userId) {
        return video; // Student who owns the video can edit
    }
    throw new Error('You do not have permission to edit this video');
}

// This route requires student authentication
router.get('/upload/:roomIdentifier', authMiddleware.requireAuth, authMiddleware.requireStudent, async (req, res, next) => {

    try {
        console.log('Attempting to load upload page for room:', req.params.roomIdentifier);
        
        const room = await models.Room.findOne({ where: { uniqueIdentifier: req.params.roomIdentifier } });
        console.log('Found room:', room ? room.toJSON() : 'not found');
        
        if (!room) {
            console.log('Room not found, returning 404');
            return res.status(404).render('error', { title: 'Error', message: 'Room not found' });
        }

        const videos = await models.Video.findAll({
            where: { roomId: room.id, studentId: req.user.id },
            order: [['createdAt', 'DESC']]
        });
        console.log('Found videos:', videos.length);

        // Add MIME type information to each video
        const videosWithMimeTypes = videos.map(video => ({
            ...video.toJSON(),
            mimeType: getMimeType(video.filePath)
        }));

        res.render('student-upload', { 
            title: 'Upload Video',
            room,
            videos: videosWithMimeTypes
        });
    } catch (error) {
        console.error('Error loading upload page:', error);
        next(error);
    }
});

// This route requires authentication (either student or teacher)
router.post('/upload', authMiddleware.requireAuth, upload.single('video'), async (req, res) => {
    try {
        const { title, roomId } = req.body;
        console.log('Uploading video for room:', roomId);

        const room = await models.Room.findByPk(roomId);
        if (!room) {
            console.log('Room not found');
            return res.status(404).json({ error: 'Room not found' });
        }

        // Check permissions
        if (req.user.role === 'teacher' && room.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'You do not have permission to upload to this room' });
        }

        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();

        const videoData = {
            title,
            filePath: path.basename(filePath),
            roomId: room.id,
            processingStatus: fileExtension === '.mp4' ? 'pending_transcription' : 'processing'
        };

        // Set the appropriate user ID based on role
        if (req.user.role === 'student') {
            videoData.studentId = req.user.id;
        } else if (req.user.role === 'teacher') {
            videoData.teacherId = req.user.id;
        }

        const video = await models.Video.create(videoData);

        if (fileExtension !== '.mp4') {
            const outputPath = filePath.replace(fileExtension, '.mp4');
            videoQueue.add({
                videoId: video.id,
                inputPath: filePath,
                outputPath: outputPath
            }).catch(error => {
                console.error('Error adding job to video queue:', error);
            });
        } else {
            // If it's already an MP4, queue it for transcription immediately
            await TranscriptionService.queueTranscription(video.id);
        }

        console.log('Video uploaded successfully:', video.id);
        res.status(200).json({ message: 'Video uploaded successfully and is being processed', videoId: video.id });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ error: 'An error occurred while uploading the video' });
    }
});

// This route requires authentication
router.get('/viewScore/:videoId', authMiddleware.requireAuth, async (req, res) => {
    try {
        //const video = await models.Video.findByPk(req.params.videoId);
		
		const video = await models.Video.findOne({
            where: { id: req.params.videoId },
			include: [
				{ model: models.User, as: 'student', attributes: ['email'] },
				{ model: models.User, as: 'teacher', attributes: ['email'] },
				{ 
					model: models.Room, 
					as: 'room',
					attributes: ['uniqueIdentifier']
				}
			]
        });
		
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
		res.render('view-score', { 
				title: 'Video Score',
				video: video
		});
	  } catch (error) {
        console.error('Error viewing video score:', error);
        res.status(500).json({ error: 'An error occurred while viewing video score' });
    }	
});

// This route requires authentication
router.get('/:videoId/status', authMiddleware.requireAuth, async (req, res) => {
    try {
        const video = await models.Video.findByPk(req.params.videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        res.json({
            processingStatus: video.processingStatus,
			transcription: video.transcription,
			scoringStatus: video.scoringStatus,
			scoreData: video.scoreData,
            filePath: video.filePath
        });
    } catch (error) {
        console.error('Error checking video status:', error);
        res.status(500).json({ error: 'An error occurred while checking video status' });
    }
});

const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4'
};

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    return mimeTypes[ext] || 'video/mp4';
}

// This route requires authentication
router.get('/stream/:name', authMiddleware.requireAuth, (req, res) => {
    const videoName = req.params.name;
    const videoPath = path.resolve(__dirname, '../uploads/', videoName);
    const contentType = getMimeType(videoName);

    fs.stat(videoPath, (err, stat) => {
        if (err) {
            console.error("File doesn't exist or there is an error: ", err);
            return res.status(404).send('Video not found');
        }

        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType
            };
            res.writeHead(200, head);
            fs.createReadStream(videoPath).pipe(res);
        }
    });
});

// These routes require authentication and use the checkEditPermission function
router.put('/:videoId/title', authMiddleware.requireAuth, async (req, res) => {
     try {
        const video = await checkEditPermission(req.params.videoId, req.user.id, req.user.role);
        await video.update({ title: req.body.title });
        res.json({ message: 'Title updated successfully' });
    } catch (error) {
        console.error('Error updating video title:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

router.put('/:videoId/comment', authMiddleware.requireAuth, async (req, res) => {
    try {
        const video = await checkEditPermission(req.params.videoId, req.user.id, req.user.role);
        await video.update({ comment: req.body.comment });
        res.json({ message: 'Comment updated successfully' });
    } catch (error) {
        console.error('Error updating video comment:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

router.put('/:videoId/editedTranscription', authMiddleware.requireAuth, async (req, res) => {
    try {
        const video = await checkEditPermission(req.params.videoId, req.user.id, req.user.role);
        await video.update({ editedTranscription: req.body.editedTranscription });
        res.json({ message: 'Edited transcription updated successfully' });
    } catch (error) {
        console.error('Error updating edited transcription:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

// Update the delete route to use the same permission check
router.delete('/:videoId', authMiddleware.requireAuth, async (req, res) => {
    try {
        const video = await checkEditPermission(req.params.videoId, req.user.id, req.user.role);
        const filePath = path.join(__dirname, '..', 'uploads', video.filePath);
        try {
            await fs.unlink(filePath);
        } catch (unlinkError) {
            console.error('Error deleting file:', unlinkError);
            // Continue with video deletion even if file deletion fails
        }
        await video.destroy();
        res.json({ message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(error.message.includes('permission') ? 403 : 500).json({ error: error.message });
    }
});

// These routes require teacher authentication
router.post('/:videoId/transcribe', authMiddleware.requireAuth, authMiddleware.requireTeacher, async (req, res) => {
   try {
    const transcription = await transcriptionService.transcribeVideo(req.params.videoId);
    res.redirect(`/videos/room/${req.body.roomId}`);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(400).render('error', { message: error.message });
  }
});

router.post('/:videoId/retry-transcription', authMiddleware.requireTeacher, async (req, res) => {
    try {
        const video = await models.Video.findByPk(req.params.videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        await video.update({ processingStatus: 'pending_transcription' });
        await TranscriptionService.queueTranscription(video.id);

        res.json({ message: 'Transcription process restarted successfully' });
    } catch (error) {
        console.error('Error restarting transcription:', error);
        res.status(500).json({ error: 'An error occurred while restarting transcription' });
    }
});

router.post('/:videoId/score', authMiddleware.requireAuth, authMiddleware.requireTeacher, async (req, res) => {
  try {
    const scoreData = await scoringService.scoreTranscription(req.params.videoId);
    res.redirect(`/videos/room/${req.body.roomId}`);
  } catch (error) {
    console.error('Scoring error:', error);
    res.status(400).render('error', { message: error.message });
  }
});

module.exports = router;