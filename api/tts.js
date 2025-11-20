// Vercel serverless function for Google Cloud Text-to-Speech
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// Initialize the client (will use credentials from environment variable)
let ttsClient = null;

function getTTSClient() {
  if (!ttsClient) {
    try {
      // Google Cloud credentials from environment variable
      const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
      
      if (!credentials) {
        console.error('GOOGLE_CLOUD_CREDENTIALS environment variable not set');
        throw new Error('GOOGLE_CLOUD_CREDENTIALS environment variable not set');
      }
      
      let credentialsJson;
      try {
        credentialsJson = JSON.parse(credentials);
      } catch (parseError) {
        console.error('Error parsing GOOGLE_CLOUD_CREDENTIALS:', parseError);
        throw new Error('Invalid JSON in GOOGLE_CLOUD_CREDENTIALS');
      }
      
      ttsClient = new TextToSpeechClient({
        credentials: credentialsJson
      });
      
      console.log('TTS client initialized successfully');
    } catch (error) {
      console.error('Error initializing TTS client:', error);
      throw error;
    }
  }
  return ttsClient;
}

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('TTS request received for text:', text.substring(0, 50) + '...');

    // Get TTS client
    const client = getTTSClient();

    // Configure the request
    const request = {
      input: { text: text.trim() },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Standard-D', // High-quality voice
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0,
        volumeGainDb: 0
      }
    };

    console.log('Calling Google Cloud TTS API...');
    
    // Call the TTS API
    const [response] = await client.synthesizeSpeech(request);

    console.log('TTS API call successful, audio length:', response.audioContent.length);

    // Return the audio content as base64
    const audioContent = response.audioContent.toString('base64');

    res.status(200).json({
      audioContent: audioContent,
      audioEncoding: 'mp3'
    });

  } catch (error) {
    console.error('Error in TTS function:', error);
    console.error('Error stack:', error.stack);
    
    // Return a more user-friendly error
    if (error.message && error.message.includes('GOOGLE_CLOUD_CREDENTIALS')) {
      return res.status(500).json({ 
        error: 'TTS service not configured. Please set up Google Cloud credentials.',
        details: 'GOOGLE_CLOUD_CREDENTIALS environment variable is missing or invalid'
      });
    }
    
    if (error.message && error.message.includes('Invalid JSON')) {
      return res.status(500).json({ 
        error: 'Invalid credentials format',
        details: 'GOOGLE_CLOUD_CREDENTIALS must be valid JSON'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate speech',
      details: error.message || 'Unknown error',
      type: error.constructor.name
    });
  }
}

