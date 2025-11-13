import './style.css';

import firebase from 'firebase/app';
import 'firebase/firestore';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCuAI4m5FNuytnr1EDnOBWGNnhmHwl11fk",
  authDomain: "videostreamingapp-762d0.firebaseapp.com",
  projectId: "videostreamingapp-762d0",
  storageBucket: "videostreamingapp-762d0.firebasestorage.app",
  messagingSenderId: "714396818673",
  appId: "1:714396818673:web:eec312ae942b20d0d45d50",
  measurementId: "G-BXW33D4E3W"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
let pc = null;
let localStream = null;
let remoteStream = null;
let callDoc = null;
let feedbackCollection = null;
let repCount = 0;
let isSetActive = false;
let feedbackQueue = [];

// Exercise-specific feedback
const exerciseFeedback = {
  'shoulder-press': [
    'Keep your core tight',
    'Press straight up, not forward',
    'Control the descent',
    'Full range of motion',
    'Keep your back straight',
    'Engage your shoulders',
    'Breathe out on the press',
    'Keep your elbows in line'
  ],
  'bench-press': [
    'Keep your back flat on the bench',
    'Control the bar on the way down',
    'Drive through your feet',
    'Full range of motion',
    'Keep your shoulders back',
    'Breathe out on the press',
    'Keep your wrists straight',
    'Engage your core'
  ],
  'deadlift': [
    'Keep your back straight',
    'Chest up, shoulders back',
    'Focus on the hip hinge',
    'Keep the bar close to your body',
    'Drive through your heels',
    'Slow down, control the movement',
    'Engage your core',
    'Full extension at the top'
  ],
  'squats': [
    'Keep your knees behind your toes',
    'Chest up, back straight',
    'Go down to parallel or below',
    'Drive through your heels',
    'Keep your core engaged',
    'Control the descent',
    'Full range of motion',
    'Keep your weight balanced'
  ]
};

// HTML elements
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const remoteVideo = document.getElementById('remoteVideo');
const joinKeySection = document.getElementById('joinKeySection');
const joinKeyDisplay = document.getElementById('joinKeyDisplay');
const copyButton = document.getElementById('copyButton');
const copySuccess = document.getElementById('copySuccess');
const statusMessage = document.getElementById('statusMessage');
const sessionHeader = document.getElementById('sessionHeader');
const sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const coachDashboard = document.getElementById('coachDashboard');
const exerciseSelect = document.getElementById('exerciseSelect');
const repCountDisplay = document.getElementById('repCount');
const incrementRep = document.getElementById('incrementRep');
const decrementRep = document.getElementById('decrementRep');
const startSetButton = document.getElementById('startSetButton');
const endSetButton = document.getElementById('endSetButton');
const feedbackButtons = document.getElementById('feedbackButtons');
const hangupButtonHeader = document.getElementById('hangupButtonHeader');
const closeCoachSummaryButton = document.getElementById('closeCoachSummaryButton');

// Initialize rep buttons as disabled
incrementRep.disabled = true;
decrementRep.disabled = true;

// Initialize peer connection
function initPeerConnection() {
  pc = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();

  // Add transceiver for receiving video (coach doesn't send, only receives)
  pc.addTransceiver('video', { direction: 'recvonly' });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
    remoteVideo.srcObject = remoteStream;
    showStatus('Client connected', 'success');
    updateConnectionStatus(true);
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      showStatus('Connection lost', 'error');
      updateConnectionStatus(false);
    } else if (pc.iceConnectionState === 'connected') {
      updateConnectionStatus(true);
    }
  };
}

// Start session
startButton.onclick = async () => {
  try {
    showStatus('Starting session...', 'info');
    
    // Initialize peer connection (coach doesn't need camera)
    initPeerConnection();

    // Create Firestore document for this call
    callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    // Display join key
    const sessionId = callDoc.id;
    joinKeyDisplay.textContent = sessionId;
    sessionCodeDisplay.textContent = sessionId;
    joinKeySection.classList.remove('hidden');
    sessionHeader.classList.remove('hidden');
    
    // Initialize feedback collection
    feedbackCollection = callDoc.collection('feedback');
    
    // Show dashboard
    coachDashboard.classList.remove('hidden');
    joinKeySection.classList.add('hidden');
    document.querySelector('.page-title').style.display = 'none';

    // Get candidates for caller, save to db
    pc.onicecandidate = (event) => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await callDoc.set({ offer });
    
    showStatus('Waiting for client to join...', 'info');

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
        showStatus('Client joined successfully', 'success');
        updateConnectionStatus(true);
      }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });

    startButton.disabled = true;
    hangupButton.classList.remove('hidden');
    hangupButtonHeader.classList.remove('hidden');
  } catch (error) {
    console.error('Error accessing media devices:', error);
    showStatus('Error accessing camera/microphone: ' + error.message, 'error');
  }
};

// Copy join key
copyButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(joinKeyDisplay.textContent);
    copySuccess.classList.remove('hidden');
    setTimeout(() => {
      copySuccess.classList.add('hidden');
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

// Hangup
hangupButton.onclick = () => {
  if (pc) {
    pc.close();
  }
  if (callDoc) {
    callDoc.delete();
  }
  
  remoteVideo.srcObject = null;
  
  startButton.disabled = false;
  hangupButton.classList.add('hidden');
  hangupButtonHeader.classList.add('hidden');
  joinKeySection.classList.add('hidden');
  sessionHeader.classList.add('hidden');
  coachDashboard.classList.add('hidden');
  document.querySelector('.page-title').style.display = '';
  
  // Reset state
  repCount = 0;
  repCountDisplay.textContent = '0';
  exerciseSelect.value = '';
  feedbackButtons.innerHTML = '<p class="no-exercise-message">Select an exercise to see feedback options</p>';
  isSetActive = false;
  feedbackQueue = [];
  startSetButton.classList.remove('hidden');
  endSetButton.classList.add('hidden');
  // Disable rep buttons
  incrementRep.disabled = true;
  decrementRep.disabled = true;
  // Clear coach summary
  const coachSummaryPanel = document.getElementById('coachSummaryPanel');
  if (coachSummaryPanel) {
    coachSummaryPanel.classList.add('hidden');
  }
  
  showStatus('Session ended', 'info');
};

// Show status message
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 5000);
  }
}

// Display coach summary
function displayCoachSummary(summary) {
  const coachSummaryPanel = document.getElementById('coachSummaryPanel');
  const coachSummaryContent = document.getElementById('coachSummaryContent');
  
  if (!coachSummaryPanel || !coachSummaryContent) return;
  
  if (summary.length === 0) {
    coachSummaryContent.innerHTML = '<p class="no-summary-message">No feedback for this set</p>';
  } else {
    const summaryList = document.createElement('ul');
    summaryList.className = 'summary-list';
    
    summary.forEach((feedback, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'summary-item';
      listItem.textContent = `${index + 1}. ${feedback}`;
      summaryList.appendChild(listItem);
    });
    
    coachSummaryContent.innerHTML = '';
    coachSummaryContent.appendChild(summaryList);
  }
  
  coachSummaryPanel.classList.remove('hidden');
}

// Update connection status
function updateConnectionStatus(connected) {
  if (connected) {
    connectionStatus.textContent = '• Client Connected';
    connectionStatus.className = 'status-indicator connected';
  } else {
    connectionStatus.textContent = '• Waiting for client';
    connectionStatus.className = 'status-indicator';
  }
}

// Update feedback buttons based on exercise
function updateFeedbackButtons(exercise) {
  feedbackButtons.innerHTML = '';
  
  if (!exercise || !exerciseFeedback[exercise]) {
    feedbackButtons.innerHTML = '<p class="no-exercise-message">Select an exercise to see feedback options</p>';
    return;
  }
  
  const feedbacks = exerciseFeedback[exercise];
  feedbacks.forEach((feedback) => {
    const button = document.createElement('button');
    button.className = 'feedback-btn';
    button.textContent = feedback;
    button.onclick = () => sendFeedback(feedback);
    feedbackButtons.appendChild(button);
  });
}

// Send feedback to client
function sendFeedback(message) {
  if (!feedbackCollection) return;
  
  // Add to queue if set is active
  if (isSetActive) {
    feedbackQueue.push({
      message: message,
      timestamp: Date.now()
    });
  }
  
  // Still send immediately for voice feedback
  feedbackCollection.add({
    message: message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Sync rep count to client
function syncRepCount() {
  if (!callDoc) return;
  
  callDoc.update({
    repCount: repCount,
    repCountUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).catch((error) => {
    console.error('Error syncing rep count:', error);
  });
}

// Exercise selection handler
exerciseSelect.addEventListener('change', (e) => {
  const exercise = e.target.value;
  updateFeedbackButtons(exercise);
  // Reset rep counter when exercise changes
  repCount = 0;
  repCountDisplay.textContent = '0';
  syncRepCount();
  syncExercise(exercise);
});

// Sync exercise to client
function syncExercise(exercise) {
  if (!callDoc) return;
  
  const exerciseNames = {
    'shoulder-press': 'Shoulder Press',
    'bench-press': 'Bench Press',
    'deadlift': 'Deadlift',
    'squats': 'Squats'
  };
  
  const exerciseName = exercise ? exerciseNames[exercise] || 'Not selected' : 'Not selected';
  
  callDoc.update({
    currentExercise: exerciseName,
    exerciseUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).catch((error) => {
    console.error('Error syncing exercise:', error);
  });
}

// Rep counter handlers
incrementRep.addEventListener('click', () => {
  if (!isSetActive) return; // Only allow incrementing when set is active
  repCount++;
  repCountDisplay.textContent = repCount;
  syncRepCount();
});

decrementRep.addEventListener('click', () => {
  if (!isSetActive) return; // Only allow decrementing when set is active
  if (repCount > 0) {
    repCount--;
    repCountDisplay.textContent = repCount;
    syncRepCount();
  }
});

// Start set button
startSetButton.addEventListener('click', () => {
  // Reset rep counter
  repCount = 0;
  repCountDisplay.textContent = '0';
  syncRepCount();
  
  // Clear previous summary and start new set
  feedbackQueue = [];
  isSetActive = true;
  
  // Clear summary on client side and notify set start
  if (callDoc) {
    callDoc.update({
      setSummary: [],
      summaryUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      setStatus: 'started',
      setStatusUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Update button states
  startSetButton.classList.add('hidden');
  endSetButton.classList.remove('hidden');
  // Enable rep buttons when set starts
  incrementRep.disabled = false;
  decrementRep.disabled = false;
  // Hide coach summary when new set starts
  const coachSummaryPanel = document.getElementById('coachSummaryPanel');
  if (coachSummaryPanel) {
    coachSummaryPanel.classList.add('hidden');
  }
});

// End set button
endSetButton.addEventListener('click', () => {
  if (!isSetActive) return;
  
  // Save summary to Firestore (even if empty) and notify set end
  const summary = feedbackQueue.length > 0 
    ? feedbackQueue.map(item => item.message)
    : [];
  
  if (callDoc) {
    callDoc.update({
      setSummary: summary,
      summaryUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      setStatus: 'ended',
      setStatusUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  // Display summary on coach side
  displayCoachSummary(summary);
  
  // Reset set state
  isSetActive = false;
  feedbackQueue = [];
  
  // Reset rep count
  repCount = 0;
  repCountDisplay.textContent = '0';
  syncRepCount();
  
  // Update button states
  startSetButton.classList.remove('hidden');
  endSetButton.classList.add('hidden');
  // Disable rep buttons when set ends
  incrementRep.disabled = true;
  decrementRep.disabled = true;
});

// Hangup button in header
hangupButtonHeader.addEventListener('click', () => {
  hangupButton.click();
});

// Close coach summary button
if (closeCoachSummaryButton) {
  closeCoachSummaryButton.addEventListener('click', () => {
    const coachSummaryPanel = document.getElementById('coachSummaryPanel');
    if (coachSummaryPanel) {
      coachSummaryPanel.classList.add('hidden');
    }
  });
}

