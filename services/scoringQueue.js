const Queue = require('bull');
const { models } = require('../database');
const emailService = require('../services/emailService');

const scoringQueue = new Queue('scoring', process.env.REDIS_URL);

scoringQueue.process(async (job) => {
    const { videoId } = job.data;
    console.log(`Processing scoring job for video ${videoId}`);

    try {
        // Import ScoringService here to avoid circular dependencies
        const ScoringService = require('../services/scoringService');
        const scoringService = new ScoringService(models.Video, emailService);
        
        await scoringService.scoreTranscription(videoId);
        console.log(`Scoring completed for video ${videoId}`);
    } catch (error) {
        console.error(`Error scoring video ${videoId}:`, error);
        // Update video status to 'failed' if scoring fails after retries
        await models.Video.update(
            { scoringStatus: 'failed' }, 
            { where: { id: videoId } }
        );
        throw error; // This will trigger the retry mechanism
    }
});

// Function to add a job to the scoring queue with retry options
const addScoringJob = async (videoId) => {
    const jobOptions = {
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 5000 // 5 seconds delay before retry
        }
    };

    await scoringQueue.add({ videoId }, jobOptions);
    console.log(`Scoring job queued for video ${videoId}`);
};

module.exports = { scoringQueue, addScoringJob };