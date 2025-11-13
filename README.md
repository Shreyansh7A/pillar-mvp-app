# Video Chat with WebRTC and Firebase

Build a 1-to-1 video chat feature with WebRTC, Firestore, and JavaScript. 

Watch the [WebRTC Explanation on YouTube](https://youtu.be/WmR9IMUD_CY) and follow the full [WebRTC Firebase Tutorial](https://fireship.io/lessons/webrtc-firebase-video-chat) on Fireship.io. 


## Usage

Update the firebase project config in the main.js file. 

```
git clone <this-repo>
npm install

npm run dev
```

## HTTPS Requirement

**Important:** When accessing this app from an IP address (not localhost), you need to use HTTPS. Browsers require a secure context for WebRTC APIs like `getUserMedia` when accessed from non-localhost addresses.

### Running with HTTPS for Mobile Testing:

1. **Start the dev server with HTTPS:**
   ```bash
   npm run dev:https
   ```

2. **Find your local IP address:**
   - On Mac/Linux: `ifconfig | grep "inet "` or `ipconfig getifaddr en0`
   - On Windows: `ipconfig` (look for IPv4 Address)
   - The server will be accessible at: `https://YOUR_IP_ADDRESS:5173`

3. **Accept the self-signed certificate (Mobile Browsers):**

   **For iOS Safari:**
   - Open `https://YOUR_IP_ADDRESS:5173`
   - You'll see "This Connection is Not Private"
   - Tap "Show Details" at the bottom
   - Tap "visit this website" at the bottom
   - Tap "Visit Website" in the popup
   
   **For Android Chrome:**
   - Open `https://YOUR_IP_ADDRESS:5173`
   - You'll see "Your connection is not private"
   - Tap "Advanced" at the bottom
   - Tap "Proceed to [IP address] (unsafe)"
   
   **For iOS Chrome:**
   - Open `https://YOUR_IP_ADDRESS:5173`
   - Tap "Advanced" → "Proceed to [IP address]"

4. **Better Solution: Use mkcert for trusted certificates (Recommended):**
   
   This creates certificates that browsers trust automatically:
   
   ```bash
   # Install mkcert (one time, requires Homebrew)
   brew install mkcert
   
   # Install the local CA (adds trust to your system)
   mkcert -install
   
   # Generate certificate for your IP (replace with your actual IP)
   mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 192.168.10.7
   
   # Update vite.config.js to use these certificates
   ```
   
   Then update `vite.config.js` to use the certificates (see below).

### Other Solutions:

1. **For local development:** Use `localhost` instead of your IP address (only works on same device)
2. **For production:** Deploy to a service that provides HTTPS (Firebase Hosting, Vercel, Netlify, etc.)

The app will show a helpful error message if `getUserMedia` is not available due to the secure context requirement.
