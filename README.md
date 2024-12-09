# Potje Polariseren
De Potje Polariseren tool is onderdeel van een lespakket over polarisatie in MBO Burgerschapsonderwijs. Het bevat een uniek polarisatiedetectie algoritme dat scoort op de volgende indicatoren:

- Wij-Zij denken
- Emotioneel taalgebruik
- Vooroordelen
- Stelligheid
- Sentiment
- Partijdigheid

Meer informatie: [https://www.postxsociety.org/lespakket-polarisatie/]

## Contact
Voor vragen of suggesties, neem contact op met Post-X Society [mail@postxsociety.org](https://www.postxsociety.org/over-ons/contact/)

# Technical documentation
De technische documentatie is verder in het Engels:

## Application Features

- Registration of a room
- Teacher authentication, room management and password recovery
- Secure student access through unique room identifiers and PIN codes
- Video upload, validation and processing
- Automatic transcription of video content via Replicate.ai Whisper service
- AI-powered polarization analysis iva Replicate.ai LLama service
- Email notifications for important events
- Automatic cleanup of expired rooms and content
- WCAG compliant

## Technical Stack

- Node.js
- Express.js
- Sequelize ORM
- Redis for job queues
- Bull for background job processing
- PostgreSQL database
- Replicate API for AI analysis
- Multer for file uploads

## Configuration
The application requires several environment variables to be set:

```
DB_NAME=[PostgreSQL database name]
DB_USER=[PostgreSQL datase user]
DB_PASS=[PostgreSQL datase password]
DB_HOST=[PostgreSQL datase URL]
PORT=[PostgreSQL datase port]
JWT_SECRET=[unique secret]
APP_URL=[public application URL]
REPLICATE_API_KEY=[Replicate API Key]
SMTP_USER=[mail user]
SMTP_PASSWORD=[mail password]
REDIS_URL=[redis://127.0.0.1:6379]
BASE_URL=[public base url]
```

## Maintenance Scripts
The application include a maintenance script:

### Room Cleanup ###
Automatically removes expired rooms and their associated content:
```node scripts/cleanupExpiredRooms.js```

## Met dank aan
Dit lespakket is ontwikkeld door Stichting Post-X Society, Nationaal Instituut Beeld & Geluid en het Albeda College, dankzij financiering door het SIDN Fonds.
