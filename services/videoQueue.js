const Queue = require('bull');
const ffmpeg = require('fluent-ffmpeg');
const { models } = require('../database');
const fs = require('fs').promises;
const TranscriptionService = require('./transcriptionService');

const videoQueue = new Queue('video processing', process.env.REDIS_URL);

videoQueue.process(async (job) => {
    const { videoId, inputPath, outputPath } = job.data;

    try {
        await models.Video.update({ processingStatus: 'processing' }, { where: { id: videoId } });

        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions('-c:v', 'libx264')
                .outputOptions('-c:a', 'aac')
                .output(outputPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        await fs.unlink(inputPath);

        await models.Video.update(
            { 
                filePath: path.basename(outputPath),
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
    }
});

module.exports = videoQueue;