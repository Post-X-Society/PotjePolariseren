const Replicate = require('replicate');
const AppError = require('../utils/appError');
const { models } = require('../database');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

class ScoringService {
  constructor(videoModel, emailService) {
    this.Video = videoModel;
    this.emailService = emailService;
  }

  async scoreTranscription(videoId) {
    // Find the video with proper includes using the models
    const video = await this.Video.findByPk(videoId, {
      include: [
        {
          model: models.Room,
          as: 'room'
        },
        {
          model: models.User,
          as: 'student'
        },
        {
          model: models.User,
          as: 'teacher'
        }
      ]
    });

    if (!video) {
      throw new AppError('Video not found', 404);
    }
    if (!video.transcription) {
      throw new AppError('Transcription not available for this video', 400);
    }

    await this.Video.update({ scoringStatus: 'processing' }, { where: { id: videoId } });

    const sanitizedInput = video.transcription.replace(/'/g, "''");

    const input = {
      top_k: 50,
      top_p: 0.9,
      prompt: `Analyseer het volgende bericht op kenmerken van polarisatie en geef je antwoord als een JSON object:

Bericht: '${sanitizedInput}'

Analyseer op de volgende kenmerken:
1. Sentiment: Gebruik van termen over sterke positieve of negatieve gevoelens.
2. Stelligheid: woorden zoals "altijd", "nooit", "moet", "alle", etc.
3. Emotioneel geladen: woorden die sterke emoties oproepen.
4. Verdeeldheid: sterke steun voor een standpunt, of sterke oppositie.
5. Negatieve Stereotypes: negatieve eigenschappen toeschrijven aan een groep.
6. Partijdigheid: Taalgebruik dat aansluit bij een politieke ideologie.

Geef je antwoord als een JSON object met voor elk kenmerk een score (1-5) en een korte uitleg in het Nederlands.

Gebruik exact deze JSON structuur:
{
  "Sentiment": {"score": 1, "explanation": "Je uitleg hier."},
  "Stelligheid": {"score": 1, "explanation": "Je uitleg hier."},
  "Emotioneel geladen": {"score": 1, "explanation": "Je uitleg hier."},
  "Verdeeldheid": {"score": 1, "explanation": "Je uitleg hier."},
  "Negatieve Stereotypes": {"score": 1, "explanation": "Je uitleg hier."},
  "Partijdigheid": {"score": 1, "explanation": "Je uitleg hier."}
}`,
      max_tokens: 2048,
      min_tokens: 0,
      temperature: 0.3,
      system_prompt: "Je bent een Nederlandstalige polarisatie detector. Antwoord uitsluitend met een geldig JSON object. Gebruik alleen de opgegeven structuur.",
      stop_sequences: "<|end_of_text|>,<|eot_id|>",
      presence_penalty: 0,
      frequency_penalty: 0
    };

    try {
      // Use run() instead of stream() for better JSON mode support
      const output = await replicate.run("meta/llama-4-maverick-instruct", { input });

      // Output should be an array of strings, join them
      const eventsData = Array.isArray(output) ? output.join('') : String(output);

      console.log('Raw scoring result:', eventsData);

      let scoreData;
      try {
        // With JSON mode, the entire response should be valid JSON
        scoreData = JSON.parse(eventsData);
      } catch (parseError) {
        console.error('Parse error:', parseError);
        console.error('Failed to parse:', eventsData);

        // Fallback: try to extract JSON object
        const jsonMatch = eventsData.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            scoreData = JSON.parse(jsonMatch[0]);
          } catch (e) {
            throw new AppError(`Failed to parse scoring result: ${parseError.message}`, 500);
          }
        } else {
          throw new AppError(`No valid JSON found in response: ${parseError.message}`, 500);
        }
      }

      if (!scoreData || typeof scoreData !== 'object') {
        throw new AppError('Invalid scoring result format', 500);
      }

      // Validate that we have the expected properties
      const expectedProps = ['Sentiment', 'Stelligheid', 'Emotioneel geladen', 'Verdeeldheid', 'Negatieve Stereotypes', 'Partijdigheid'];
      const missingProps = expectedProps.filter(prop => !scoreData[prop]);
      if (missingProps.length > 0) {
        console.warn('Missing properties in score data:', missingProps);
      }

      await video.update({
        scoreData: scoreData,
        scoringStatus: 'completed'
      });

      // Send notification email if we have a recipient
      if (video.student?.email || video.teacher?.email) {
        try {
          await this.emailService.sendScoringCompleteEmail(
            video.student?.email || video.teacher?.email,
            video.id,
            video.title,
            scoreData,
            video.room.uniqueIdentifier
          );
        } catch (emailError) {
          console.error('Failed to send score notification email:', emailError);
        }
      }

      console.log(`Scoring completed for video ${videoId}`);
      return scoreData;
    } catch (error) {
      console.error('Error in scoring process:', error);
      if (error instanceof AppError) {
        throw error;
      }
      await this.Video.update({ scoringStatus: 'failed' }, { where: { id: videoId } });
      throw new AppError(`Failed to score transcription: ${error.message}`, 500);
    }
  }
}

module.exports = ScoringService;
