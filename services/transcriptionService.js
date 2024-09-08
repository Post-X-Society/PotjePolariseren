const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const Replicate = require('replicate');
const { models } = require('../database');
const Queue = require('bull');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const transcriptionQueue = new Queue('transcription', process.env.REDIS_URL);

class TranscriptionService {
  static async extractAudio(videoPath) {
    const audioPath = videoPath.replace(/\.[^/.]+$/, '.mp3');
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions('-vn')
        .save(audioPath)
        .on('end', () => resolve(audioPath))
        .on('error', (err) => reject(new Error(`Failed to extract audio: ${err.message}`)));
    });
  }

  static async transcribeAudio(audioPath) {
    try {
      const audioBuffer = await fs.readFile(audioPath);
      const base64Audio = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

      const output = await replicate.run(
        "openai/whisper:4d50797290df275329f202e48c76360b3f22b08d28c196cbc54600319435f8d2",
        { input: { audio: audioUrl } }
      );

      // Extract only the text from the output
      if (typeof output === 'object' && output.segments) {
        return output.segments.map(segment => segment.text).join(' ').trim();
      } else if (Array.isArray(output)) {
        return output.join(' ').trim();
      }
      return typeof output === 'string' ? output.trim() : '';
    } catch (error) {
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  static async processTranscription(videoId, maxRetries = 1) {
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        const video = await models.Video.findByPk(videoId);
        if (!video) {
          throw new Error('Video not found');
        }

        await models.Video.update({ processingStatus: 'transcribing' }, { where: { id: videoId } });

        const videoPath = path.join(__dirname, '..', 'uploads', video.filePath);
        const audioPath = await TranscriptionService.extractAudio(videoPath);

        const transcription = await TranscriptionService.transcribeAudio(audioPath);

        await video.update({ 
          transcription, 
          processingStatus: 'completed'
        });

        // Clean up the temporary audio file
        await fs.unlink(audioPath);

        console.log(`Transcription completed for video ${videoId}`);
        return transcription;
      } catch (error) {
        console.error(`Error in transcription process for video ${videoId}, attempt ${retries + 1}:`, error);
        retries++;
        if (retries > maxRetries) {
          await models.Video.update(
            { processingStatus: 'failed' },
            { where: { id: videoId } }
          );
          throw error;
        }
        // Wait for 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  static async queueTranscription(videoId) {
    try {
      await transcriptionQueue.add({ videoId });
      console.log(`Transcription queued for video ${videoId}`);
    } catch (error) {
      console.error(`Error queuing transcription for video ${videoId}:`, error);
      throw error;
    }
  }
}

transcriptionQueue.process(async (job) => {
  const { videoId } = job.data;
  await TranscriptionService.processTranscription(videoId);
});

module.exports = TranscriptionService;