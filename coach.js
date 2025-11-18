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
let sessionDoc = null; // Session document in 'sessions' collection
let exerciseSetsCollection = null; // Subcollection for exercise sets
let setStartTime = null; // Timestamp when current set started

// Exercise-specific feedback
const exerciseFeedback = {
  'lat-pulldown': {
    'Technique': {
      'Symmetry': [
        'Keep both sides even',
        'Pull evenly on both sides',
        'Avoid leaning to one side',
        'Maintain balanced pull'
      ],
      'Range of Motion': [
        'Pull to your chest',
        'Full extension at the top',
        'Control the full range',
        'Complete the movement'
      ],
      'Speed': [
        'Control the descent',
        'Slow and controlled',
        'Don\'t rush the movement',
        'Maintain steady tempo'
      ]
    },
    'Performance': [
      'Engage your lats',
      'Squeeze at the bottom',
      'Keep your core engaged',
      'Focus on pulling with your back',
      'Retract your shoulder blades'
    ],
    'Safety': [
      'Keep your shoulders back',
      'Don\'t arch your back excessively',
      'Keep your core tight',
      'Maintain proper grip',
      'Keep your head neutral'
    ]
  },
  'deadlift': {
    'Technique': {
      'Symmetry': [
        'Keep the bar balanced',
        'Even weight distribution',
        'Don\'t favor one side',
        'Maintain equal grip'
      ],
      'Range of Motion': [
        'Full extension at the top',
        'Bar to the floor',
        'Complete the movement',
        'Full hip extension'
      ],
      'Speed': [
        'Control the descent',
        'Slow and controlled',
        'Don\'t drop the bar',
        'Maintain control throughout'
      ]
    },
    'Performance': [
      'Drive through your heels',
      'Hip hinge movement',
      'Engage your glutes',
      'Keep the bar close',
      'Push the floor away'
    ],
    'Safety': [
      'Keep your back straight',
      'Chest up, shoulders back',
      'Keep the bar close to your body',
      'Engage your core',
      'Maintain neutral spine'
    ]
  }
};

// HTML elements
const startButton = document.getElementById('startButtonHeader'); // Use header button
const hangupButton = document.getElementById('hangupButtonHeader'); // Use header button for consistency
const hangupButtonHeader = hangupButton; // Alias for consistency
const remoteVideo = document.getElementById('remoteVideo');
const joinKeySection = null; // Removed from UI
const joinKeyDisplay = document.getElementById('sessionCodeDisplay'); // Use session code display instead
const copyButton = null; // Removed from UI
const copySuccess = null; // Removed from UI
const statusMessage = null; // Removed from UI
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
const closeCoachSummaryButton = document.getElementById('closeCoachSummaryButton');
const scoreModalOverlay = document.getElementById('scoreModalOverlay');
const scoreInput = document.getElementById('scoreInput');
const notesInput = document.getElementById('notesInput');
const saveScoreButton = document.getElementById('saveScoreButton');
const skipScoreButton = document.getElementById('skipScoreButton');
const sessionHistoryContent = document.getElementById('sessionHistoryContent');

// Ensure modal is hidden on page load
if (scoreModalOverlay) {
  scoreModalOverlay.classList.add('hidden');
}

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

    // Create Firestore document for this call (WebRTC signaling)
    callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');

    // Create session document for data storage (use same ID as callDoc for linking)
    sessionDoc = firestore.collection('sessions').doc(callDoc.id);
    exerciseSetsCollection = sessionDoc.collection('exerciseSets');
    
    // Initialize session document
    await sessionDoc.set({
      coachId: 'coach', // Placeholder for now
      status: 'LIVE',
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      endedAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Display join key (use callDoc ID for WebRTC, sessionDoc ID could be different)
    const sessionId = callDoc.id;
    sessionCodeDisplay.textContent = sessionId;
    sessionHeader.classList.remove('hidden');
    
    // Initialize feedback collection
    feedbackCollection = callDoc.collection('feedback');
    
          // Show dashboard
          coachDashboard.classList.remove('hidden');
          document.querySelector('.page-title').style.display = 'none';
          
          // Hide start button, show end button
          if (startButton) {
            startButton.classList.add('hidden');
          }
          if (hangupButtonHeader) {
            hangupButtonHeader.classList.remove('hidden');
          }

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

    // Buttons are already handled above
    
    // Load session history
    loadSessionHistory();
  } catch (error) {
    console.error('Error accessing media devices:', error);
    showStatus('Error accessing camera/microphone: ' + error.message, 'error');
  }
};

// Copy join key - functionality moved to session code display if needed
// Can be added later if copy functionality is required

// Hangup
hangupButton.onclick = async () => {
  // End session in Firestore
  if (sessionDoc) {
    await sessionDoc.update({
      status: 'ENDED',
      endedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  
  if (pc) {
    pc.close();
  }
  if (callDoc) {
    callDoc.delete();
  }
  
  remoteVideo.srcObject = null;
  
  // Show start button, hide end button
  if (startButton) {
    startButton.classList.remove('hidden');
  }
  if (hangupButtonHeader) {
    hangupButtonHeader.classList.add('hidden');
  }
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
  setStartTime = null;
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
  // Clear session history
  if (sessionHistoryContent) {
    sessionHistoryContent.innerHTML = '<p class="no-summary-message">No sets completed yet</p>';
  }
  
  // Reset session references
  sessionDoc = null;
  exerciseSetsCollection = null;
  
  showStatus('Session ended', 'info');
};

// Show status message - removed, using header status indicator instead
function showStatus(message, type = 'info') {
  // Status messages are now shown in the header connection status
  // Only log errors to console
  if (type === 'error') {
    console.error('Error:', message);
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
  const categories = ['Technique', 'Performance', 'Safety'];
  
  categories.forEach((category) => {
    if (!feedbacks[category]) return;
    
    // Create category container
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'feedback-category';
    
    // Create category header
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'feedback-category-header';
    categoryHeader.textContent = category;
    categoryContainer.appendChild(categoryHeader);
    
    // Create category buttons container
    const categoryButtons = document.createElement('div');
    categoryButtons.className = 'feedback-category-buttons';
    
    // Check if this is Technique category with subcategories
    if (category === 'Technique' && typeof feedbacks[category] === 'object' && !Array.isArray(feedbacks[category])) {
      // Handle Technique subcategories (Symmetry, Range of Motion, Speed)
      const subcategories = ['Symmetry', 'Range of Motion', 'Speed'];
      
      subcategories.forEach((subcategory) => {
        if (!feedbacks[category][subcategory] || feedbacks[category][subcategory].length === 0) return;
        
        // Create subcategory container
        const subcategoryContainer = document.createElement('div');
        subcategoryContainer.className = 'feedback-subcategory';
        
        // Create subcategory header
        const subcategoryHeader = document.createElement('div');
        subcategoryHeader.className = 'feedback-subcategory-header';
        subcategoryHeader.textContent = subcategory;
        subcategoryContainer.appendChild(subcategoryHeader);
        
        // Create subcategory buttons
        const subcategoryButtons = document.createElement('div');
        subcategoryButtons.className = 'feedback-subcategory-buttons';
        
        feedbacks[category][subcategory].forEach((feedback) => {
          const button = document.createElement('button');
          button.className = 'feedback-btn';
          button.textContent = feedback;
          button.onclick = () => sendFeedback(feedback);
          subcategoryButtons.appendChild(button);
        });
        
        subcategoryContainer.appendChild(subcategoryButtons);
        categoryButtons.appendChild(subcategoryContainer);
      });
    } else {
      // Handle regular categories (Performance, Safety) - simple arrays
      feedbacks[category].forEach((feedback) => {
        const button = document.createElement('button');
        button.className = 'feedback-btn';
        button.textContent = feedback;
        button.onclick = () => sendFeedback(feedback);
        categoryButtons.appendChild(button);
      });
    }
    
    categoryContainer.appendChild(categoryButtons);
    feedbackButtons.appendChild(categoryContainer);
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
    'lat-pulldown': 'Lat Pulldown',
    'deadlift': 'Deadlift'
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
  setStartTime = new Date(); // Track when set started
  
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
endSetButton.addEventListener('click', async () => {
  if (!isSetActive) return;
  
  // Calculate set duration
  const setEndTime = new Date();
  const duration = setStartTime ? Math.round((setEndTime - setStartTime) / 1000) : 0; // Duration in seconds
  
  // Get current exercise info
  const exerciseType = exerciseSelect.value;
  const exerciseNames = {
    'lat-pulldown': 'Lat Pulldown',
    'deadlift': 'Deadlift'
  };
  const exerciseName = exerciseNames[exerciseType] || 'Unknown';
  
  // Prepare feedback array
  const coachFeedback = feedbackQueue.map(item => item.message);
  
  // Save summary to Firestore (even if empty) and notify set end
  const summary = coachFeedback;
  
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
  const finalRepCount = repCount;
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
  
  // Show score input modal
  showScoreModal(exerciseType, exerciseName, finalRepCount, coachFeedback, setStartTime, setEndTime, duration);
});

// Hangup button in header - both hangupButton and hangupButtonHeader point to the same element

// Close coach summary button
if (closeCoachSummaryButton) {
  closeCoachSummaryButton.addEventListener('click', () => {
    const coachSummaryPanel = document.getElementById('coachSummaryPanel');
    if (coachSummaryPanel) {
      coachSummaryPanel.classList.add('hidden');
    }
  });
}

// Score Modal Functions
let currentSetData = null; // Store set data while waiting for score input

function showScoreModal(exerciseType, exerciseName, actualReps, coachFeedback, startedAt, completedAt, duration) {
  if (!scoreModalOverlay || !scoreInput || !notesInput) {
    console.error('Score modal elements not found');
    return;
  }
  
  currentSetData = {
    exerciseType,
    exerciseName,
    actualReps,
    coachFeedback,
    startedAt,
    completedAt,
    duration
  };
  
  scoreInput.value = '';
  notesInput.value = '';
  scoreModalOverlay.classList.remove('hidden');
  scoreInput.focus();
}

function hideScoreModal() {
  if (scoreModalOverlay) {
    scoreModalOverlay.classList.add('hidden');
  }
  currentSetData = null;
}

async function saveExerciseSet(score, notes) {
  if (!sessionDoc || !exerciseSetsCollection || !currentSetData) return;
  
  try {
    const exerciseSetData = {
      exerciseType: currentSetData.exerciseType,
      exerciseName: currentSetData.exerciseName,
      actualReps: currentSetData.actualReps,
      coachScore: score !== null && score !== '' ? parseFloat(score) : null,
      coachFeedback: currentSetData.coachFeedback,
      notes: notes && notes.trim() ? notes.trim() : null,
      startedAt: firebase.firestore.Timestamp.fromDate(currentSetData.startedAt),
      completedAt: firebase.firestore.Timestamp.fromDate(currentSetData.completedAt),
      duration: currentSetData.duration,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await exerciseSetsCollection.add(exerciseSetData);
    console.log('Exercise set saved successfully');
    
    // Refresh session history
    loadSessionHistory();
  } catch (error) {
    console.error('Error saving exercise set:', error);
    showStatus('Error saving set data', 'error');
  }
}

// Score modal button handlers
if (saveScoreButton) {
  saveScoreButton.addEventListener('click', async () => {
    if (!scoreInput) return;
    const score = scoreInput.value;
    const notes = notesInput ? notesInput.value : '';
    
    // Validate score
    if (score !== '' && (parseFloat(score) < 0 || parseFloat(score) > 10)) {
      showStatus('Score must be between 0 and 10', 'error');
      return;
    }
    
    await saveExerciseSet(score, notes);
    hideScoreModal();
    showStatus('Set saved successfully', 'success');
  });
}

if (skipScoreButton) {
  skipScoreButton.addEventListener('click', async () => {
    await saveExerciseSet(null, null);
    hideScoreModal();
    showStatus('Set saved (no score)', 'info');
  });
}

// Close modal when clicking outside
if (scoreModalOverlay) {
  scoreModalOverlay.addEventListener('click', (e) => {
    if (e.target === scoreModalOverlay) {
      // Don't close on outside click - require explicit save/skip
    }
  });
}

// Load and display session history
function loadSessionHistory() {
  if (!exerciseSetsCollection) return;
  
  exerciseSetsCollection
    .orderBy('completedAt', 'desc')
    .onSnapshot((snapshot) => {
      const sets = [];
      snapshot.forEach((doc) => {
        sets.push({ id: doc.id, ...doc.data() });
      });
      
      displaySessionHistory(sets);
    }, (error) => {
      console.error('Error loading session history:', error);
    });
}

function displaySessionHistory(sets) {
  if (!sessionHistoryContent) return;
  
  if (sets.length === 0) {
    sessionHistoryContent.innerHTML = '<p class="no-summary-message">No sets completed yet</p>';
    return;
  }
  
  const historyList = document.createElement('div');
  historyList.className = 'history-list';
  
  sets.forEach((set, index) => {
    const setItem = document.createElement('div');
    setItem.className = 'history-item';
    
    const scoreDisplay = set.coachScore !== null ? `${set.coachScore}/10` : 'No score';
    const durationDisplay = set.duration ? `${set.duration}s` : 'N/A';
    const feedbackCount = set.coachFeedback ? set.coachFeedback.length : 0;
    
    setItem.innerHTML = `
      <div class="history-item-header">
        <span class="history-exercise">${set.exerciseName || 'Unknown'}</span>
        <span class="history-reps">${set.actualReps} reps</span>
      </div>
      <div class="history-item-details">
        <span class="history-score">Score: ${scoreDisplay}</span>
        <span class="history-duration">Duration: ${durationDisplay}</span>
        <span class="history-feedback">Feedback: ${feedbackCount} messages</span>
      </div>
    `;
    
    historyList.appendChild(setItem);
  });
  
  sessionHistoryContent.innerHTML = '';
  sessionHistoryContent.appendChild(historyList);
}

