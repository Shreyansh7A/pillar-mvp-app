# Troubleshooting Google Cloud TTS

If the TTS API is not working, follow these steps:

## 1. Check Browser Console

Open your browser's developer console (F12) and look for errors when feedback is sent. Common errors:

- **404 Not Found**: API route not found
- **500 Internal Server Error**: Server-side error (check Vercel logs)
- **Network Error**: CORS or connection issue

## 2. Check Vercel Function Logs

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Deployments** → Click on latest deployment
4. Click **Functions** tab
5. Click on `/api/tts` function
6. Check the **Logs** tab for errors

Common log errors:
- `GOOGLE_CLOUD_CREDENTIALS environment variable not set`
- `Invalid JSON in GOOGLE_CLOUD_CREDENTIALS`
- Authentication errors from Google Cloud

## 3. Verify Environment Variable

1. Go to Vercel project → **Settings** → **Environment Variables**
2. Check that `GOOGLE_CLOUD_CREDENTIALS` exists
3. Verify it's enabled for **Production**, **Preview**, and **Development**
4. **Important**: The value should be the **entire JSON file content** as a single string

Example format (should be one long line):
```
{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

## 4. Test the API Directly

You can test the API endpoint directly using curl or Postman:

```bash
curl -X POST https://your-app.vercel.app/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello world"}'
```

Expected response:
```json
{
  "audioContent": "base64-encoded-audio...",
  "audioEncoding": "mp3"
}
```

## 5. Verify Google Cloud Setup

1. **API Enabled?**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - APIs & Services → Library
   - Search "Cloud Text-to-Speech API"
   - Should show "API enabled"

2. **Service Account Permissions?**
   - IAM & Admin → IAM
   - Find your service account
   - Should have "Cloud Text-to-Speech API User" role

3. **Billing Enabled?**
   - Billing → Link billing account
   - TTS API requires billing (but has free tier)

## 6. Common Issues

### Issue: "TTS service not configured"
**Solution**: Environment variable not set or invalid. Re-add it in Vercel.

### Issue: "Invalid JSON"
**Solution**: The credentials JSON might have line breaks. Make sure it's all on one line when pasting into Vercel.

### Issue: "Permission denied"
**Solution**: Service account doesn't have the right role. Add "Cloud Text-to-Speech API User" role.

### Issue: "API not enabled"
**Solution**: Enable the Cloud Text-to-Speech API in Google Cloud Console.

### Issue: 404 on /api/tts
**Solution**: 
- Make sure the file is at `/api/tts.js` (not `/api/tts/index.js`)
- Redeploy after creating the API file
- Check Vercel function logs

## 7. Test Locally (Optional)

To test the API locally before deploying:

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel dev`
3. Test: `curl -X POST http://localhost:3000/api/tts -H "Content-Type: application/json" -d '{"text":"test"}'`

Note: You'll need to set the environment variable locally too.

## 8. Fallback Behavior

If Google Cloud TTS fails, the app automatically falls back to the browser's Web Speech API. Check the console for "Falling back to Web Speech API" message.

## Still Not Working?

1. Check Vercel function logs for detailed error messages
2. Verify the service account JSON is correct
3. Test the Google Cloud TTS API directly using their API explorer
4. Make sure you've redeployed after adding environment variables

