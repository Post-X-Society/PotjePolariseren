const Replicate = require('replicate');
const AppError = require('../utils/appError');

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

class ScoringService {
  constructor(videoModel) {
    this.Video = videoModel;
  }

  async scoreTranscription(videoId) {
    const video = await this.Video.findByPk(videoId);
    if (!video) {
      throw new AppError('Video not found', 404);
    }
    if (!video.transcription) {
      throw new AppError('Transcription not available for this video', 400);
    }

    const sanitizedInput = video.transcription.replace(/'/g, "''");

    const input = {
      top_k: 0,
      top_p: 0.9,
      prompt: `Analyseer het volgende bericht op kenmerken van polarisatie:
'${sanitizedInput}'
Kenmerken:
\t1. Sentiment: Gebruik van termen over sterke positieve of negatieve gevoelens.
\t2. Stelligheid: woorden zoals "altijd", "nooit", "moet", "alle", etc.
\t3. Emotioneel geladen: woorden die sterke emoties oproepen, zoals "afschuwelijk", "bizar".
\t4. Verdeeldheid: sterke steun voor een standpunt, of sterke oppositie.
\t5. Negatieve Stereotypes: negatieve eigenschappen toeschrijven aan een groep.
\t6. Partijdigheid: Taalgebruik dat sterk aansluit bij een bepaalde politieke ideologie, partij of fractie.

\tBeoordeel het bericht op elke eigenschap en ken het een score toe op een schaal van 1 tot 5. Geef ook een korte uitleg in het Nederlands. De uitleg moet volledige zinnen bevatten en niet eindigen met "..." maar afgerond zijn.
Antwoord uitsluitend in de vorm van een JSON-object met daarin de eigenschap, score en volledige uitleg. Bijvoorbeeld: 
\t{
\t\t"Sentiment": {"score": 3, "explanation": "Het bericht is gematigd sentimenteel door het gebruik van woorden zoals 'belachelijk' en 'liefde', die zowel sterke negatieve als positieve gevoelens uitdrukken."},
\t\t"Stelligheid": {"score": 2, "explanation": "Het bericht bevat termen als 'moet' en 'alle' die een zekere stelligheid aanduiden, maar het is niet overdreven stellig."}
\t\t...
\t}`,
      max_tokens: 1024,
      min_tokens: 0,
      temperature: 0.9,
      system_prompt: "Je bent een Nederlandstalige polarisatie detector en antwoord alleen in de vorm van JSON objects. Verder niets.",
      length_penalty: 1,
      stop_sequences: "<|end_of_text|>,<|eot_id|>",
      prompt_template: "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou are a helpful assistant<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
      presence_penalty: 1.15,
      log_performance_metrics: false
    };

    try {
      let eventsData = '';
      for await (const event of replicate.stream("meta/meta-llama-3-70b-instruct", { input })) {
        eventsData += event.toString();
      }

      let scoreData;
      try {
        scoreData = JSON.parse(eventsData);
      } catch (parseError) {
        throw new AppError('Failed to parse scoring result', 500);
      }

      await video.update({ scoreData: scoreData });
      return scoreData;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error processing stream:', error);
      throw new AppError('Failed to score transcription', 500);
    }
  }
}

module.exports = ScoringService;