# Pillar - WebRTC Fitness Coaching App

A real-time video coaching application built with WebRTC and Firebase, allowing coaches to provide live feedback to clients during workout sessions.

## Features

- **Real-time Video Streaming**: One-way video from client to coach using WebRTC
- **Live Feedback**: Coaches can send text-to-speech feedback to clients
- **Exercise Tracking**: Track exercises (Shoulder Press, Bench Press, Deadlift, Squats) and rep counts
- **Set Management**: Start/end sets with real-time notifications
- **Session Management**: Generate join keys for clients to connect

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **WebRTC**: Peer-to-peer video streaming
- **Firebase**: Firestore for real-time data synchronization
- **Deployment**: Vercel

## Setup

### 1. Firebase Configuration

Update the Firebase project configuration in `coach.js` and `client.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Deploy to Vercel

The app is configured for Vercel deployment:

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy
vercel --prod
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Usage

1. **Coach**: 
   - Open the deployed app
   - Click "Coach" to start a session
   - Share the generated join key with your client

2. **Client**:
   - Open the deployed app
   - Click "Client" and enter the join key
   - Allow camera access when prompted
   - The coach will see your video feed

## How It Works

- **Coach Side**: 
  - No camera required
  - Receives client's video stream
  - Can select exercises, count reps, and send feedback
  - Rep counting only works during active sets

- **Client Side**:
  - Camera required
  - Sends video stream to coach
  - Receives text-to-speech feedback
  - Sees exercise name and rep count in real-time
  - Gets notifications when sets start/end

## Project Structure

```
├── index.html          # Landing page
├── coach.html          # Coach interface
├── client.html         # Client interface
├── coach.js            # Coach logic (WebRTC, Firestore)
├── client.js           # Client logic (WebRTC, Firestore, TTS)
├── style.css           # Styling
├── vite.config.js      # Vite configuration
└── vercel.json         # Vercel deployment config
```

## Browser Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- HTTPS required (automatically provided by Vercel)
- Camera access required for clients

## Notes

- The app uses WebRTC for peer-to-peer video streaming
- Firebase Firestore handles real-time data synchronization
- Text-to-speech requires user interaction to unlock (handled automatically)
- Mobile browsers are supported
