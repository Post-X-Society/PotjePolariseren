const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { models } = require('../database');
const TranscriptionService = require('./transcriptionService');

const videoQueue = new Queue('video processing', process.env.REDIS_URL);

videoQueue.process(async (job) => {
    const { videoId } = job.data;
    
    try {
        // Get video record from database
        const video = await models.Video.findByPk(videoId);
        if (!video) {
            throw new Error('Video not found');
        }

        await models.Video.update({ processingStatus: 'processing' }, { where: { id: videoId } });

        // Setup input and output paths
        const inputPath = path.join(__dirname, '..', 'uploads', video.filePath);
        const outputFileName = `processed_${Date.now()}_${path.basename(video.filePath, path.extname(video.filePath))}.mp4`;
        const outputPath = path.join(__dirname, '..', 'uploads', outputFileName);

        // Process the video
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    '-c:v', 'libx264',     // Video codec
                    '-c:a', 'aac',         // Audio codec
                    '-preset', 'medium',    // Encoding speed preset
                    '-movflags', '+faststart'  // Enable fast start for web playback
                ])
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // Delete the original file
        await fs.unlink(inputPath);

        // Update the video record with the new file path
        await models.Video.update(
            { 
                filePath: outputFileName,
                processingStatus: 'pending_transcription'
            },
            { where: { id: videoId } }
        );

        console.log(`Video ${videoId} processed successfully`);

        // Queue the video for transcription
        await TranscriptionService.queueTranscription(videoId);

    } catch (error) {
        console.error(`Error processing video ${videoId}:`, error);
        await models.Video.update(
            { processingStatus: 'failed' },
            { where: { id: videoId } }
        );
        throw error;
    }
});

// Add error handler
videoQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed:`, error);
});

module.exports = videoQueue;
