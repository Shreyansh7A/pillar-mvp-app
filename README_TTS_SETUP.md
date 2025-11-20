# Google Cloud Text-to-Speech Setup

This application uses Google Cloud Text-to-Speech API for high-quality speech synthesis.

## Setup Instructions

### 1. Create Google Cloud Project and Enable TTS API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Text-to-Speech API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Text-to-Speech API"
   - Click "Enable"

### 2. Create Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Give it a name (e.g., "tts-service")
4. Grant it the role: **Cloud Text-to-Speech API User**
5. Click "Done"

### 3. Create and Download JSON Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the JSON file (keep it secure!)

### 4. Add Credentials to Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new environment variable:
   - **Name**: `GOOGLE_CLOUD_CREDENTIALS`
   - **Value**: Copy the entire contents of the downloaded JSON file
   - **Environment**: Production, Preview, and Development (select all)
4. Save the environment variable

### 5. Install Dependencies

The `@google-cloud/text-to-speech` package is already in `package.json`. If you need to install it locally:

```bash
npm install
```

### 6. Deploy to Vercel

After setting up the environment variable, redeploy your application:

```bash
vercel --prod
```

Or push to your Git repository (if connected to Vercel, it will auto-deploy).

## Testing

Once deployed, the TTS functionality will automatically use Google Cloud Text-to-Speech. The client will:
1. Send feedback messages to `/api/tts`
2. Receive MP3 audio data
3. Play the audio using HTML5 Audio API

## Fallback

If Google Cloud TTS fails (e.g., API not configured), the application will automatically fall back to the browser's Web Speech API.

## Cost

Google Cloud Text-to-Speech pricing:
- First 0-4 million characters per month: **Free**
- 4-100 million characters: **$4.00 per 1 million characters**
- Over 100 million: **$2.00 per 1 million characters**

For typical usage, you'll likely stay within the free tier.

## Troubleshooting

### Error: "TTS service not configured"
- Make sure `GOOGLE_CLOUD_CREDENTIALS` environment variable is set in Vercel
- Verify the JSON content is valid
- Redeploy after adding the environment variable

### Error: "Failed to generate speech"
- Check that the Cloud Text-to-Speech API is enabled in your Google Cloud project
- Verify the service account has the correct permissions
- Check Vercel function logs for detailed error messages

