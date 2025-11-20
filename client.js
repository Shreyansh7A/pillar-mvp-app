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
let pc = null; // Primary peer connection (to first coach)
let pc2 = null; // Secondary peer connection (to second coach, if exists)
let localStream = null;
let callDoc = null;
let sessionDoc = null; // Session document reference
let allSessionSummaries = []; // Track all sets' summaries

// HTML elements
const joinButton = document.getElementById('joinButton');
const hangupButton = document.getElementById('hangupButton');
const joinKeyInput = document.getElementById('joinKeyInput');
const localVideo = document.getElementById('localVideo');
const sessionSection = document.getElementById('sessionSection');
const statusMessage = document.getElementById('statusMessage');
const clientRepCount = document.getElementById('clientRepCount');
const clientRepCounter = document.querySelector('.client-rep-counter');
const clientExerciseName = document.getElementById('clientExerciseName');
const clientSummaryPanel = document.getElementById('clientSummaryPanel');
const summaryContent = document.getElementById('summaryContent');
const closeSummaryButton = document.getElementById('closeSummaryButton');
const clientSetNotification = document.getElementById('clientSetNotification');
const notificationText = document.getElementById('notificationText');
const notificationIcon = document.getElementById('notificationIcon');
const setStatusIndicator = document.getElementById('setStatusIndicator');
const seeSummaryButton = document.getElementById('seeSummaryButton');
const summaryModalOverlay = document.getElementById('summaryModalOverlay');
const allSummariesContent = document.getElementById('allSummariesContent');
const closeSummaryModalButton = document.getElementById('closeSummaryModalButton');
const utilityMenuButton = document.getElementById('utilityMenuButton');
const utilityMenuPopup = document.getElementById('utilityMenuPopup');

// Initialize peer connection
function initPeerConnection() {
  pc = new RTCPeerConnection(servers);

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'connected') {
      showStatus('Connected to coach', 'success');
    } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      showStatus('Connection lost', 'error');
    }
  };
}

// Check for join key in URL parameters (when returning from summary)
const urlParams = new URLSearchParams(window.location.search);
const urlJoinKey = urlParams.get('joinKey');
if (urlJoinKey) {
  joinKeyInput.value = urlJoinKey;
  localStorage.setItem('clientJoinKey', urlJoinKey);
  // Auto-join if returning from summary
  setTimeout(() => {
    if (!joinButton.disabled) {
      joinButton.click();
    }
  }, 500);
}

// Join session
joinButton.onclick = async () => {
  const callId = joinKeyInput.value.trim();
  
  if (!callId) {
    showStatus('Please enter a join key', 'error');
    return;
  }
  
  // Unlock speech synthesis on user interaction (required for mobile)
  unlockSpeechSynthesis();
  
  // Store join key in localStorage
  localStorage.setItem('clientJoinKey', callId);

  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const errorMsg = 'getUserMedia is not available. This requires HTTPS when accessing from a non-localhost address.';
    showStatus(errorMsg, 'error');
    console.error(errorMsg);
    return;
  }

  try {
    showStatus('Joining session...', 'info');
    
    // Unlock speech synthesis on user interaction
    unlockSpeechSynthesis();
    
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    
    // Initialize peer connection
    initPeerConnection();
    
    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    localVideo.srcObject = localStream;
    sessionSection.classList.remove('hidden');
    document.body.classList.add('in-session');
    
    // Show utility menu button
    if (utilityMenuButton) {
      utilityMenuButton.classList.remove('hidden');
    }

    // Reference Firestore document
    callDoc = firestore.collection('calls').doc(callId);
    const answerCandidates = callDoc.collection('answerCandidates');
    const offerCandidates = callDoc.collection('offerCandidates');
    const feedbackCollection = callDoc.collection('feedback');
    
    // Find and listen to session document (sessionId = callId for now)
    sessionDoc = firestore.collection('sessions').doc(callId);
    
    // Listen for session status changes
    sessionDoc.onSnapshot((snapshot) => {
      if (!snapshot.exists()) return;
      
      const sessionData = snapshot.data();
      if (sessionData.status === 'ENDED') {
        handleSessionEnded();
      }
    });
    
    // Listen for feedback messages
    // Track processed message IDs to avoid duplicates
    const processedMessages = new Set();
    
    feedbackCollection.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const messageId = change.doc.id;
          // Skip if already processed
          if (processedMessages.has(messageId)) {
            console.log('Skipping duplicate message:', messageId);
            return;
          }
          processedMessages.add(messageId);
          
          const data = change.doc.data();
          if (data.message) {
            console.log('Received feedback message:', data.message);
            // Small delay to ensure everything is ready, especially for mobile
            setTimeout(() => {
              speakFeedback(data.message);
            }, 200);
          }
        }
      });
    });

    // Listen for rep count updates, exercise, and summary
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (data) {
        // Update rep count
        if (typeof data.repCount === 'number') {
          updateClientRepCount(data.repCount);
        } else {
          updateClientRepCount(0);
        }
        
        // Update exercise
        if (data.currentExercise) {
          updateClientExercise(data.currentExercise);
        } else {
          updateClientExercise('Detecting exercise');
        }
        
        // Check for set status changes
        if (data.setStatus && data.setStatusUpdated) {
          handleSetStatusChange(data.setStatus, data.setStatusUpdated, data.setSummary);
        }
      }
    });

    // Check if call exists
    const callData = (await callDoc.get()).data();
    if (!callData || !callData.offer) {
      showStatus('Invalid join key. Please check and try again.', 'error');
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      sessionSection.classList.add('hidden');
      document.body.classList.remove('in-session');
      return;
    }

    // Connect to first coach
    pc.onicecandidate = (event) => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });
    showStatus('Connecting...', 'info');

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
    
    // Listen for second coach joining (transparent to client)
    callDoc.onSnapshot(async (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      
      // If there's a second offer and we haven't connected to second coach yet
      if (data.offer2 && !pc2) {
        // Create second peer connection for second coach
        pc2 = new RTCPeerConnection(servers);
        
        // Add local tracks to second connection
        localStream.getTracks().forEach((track) => {
          pc2.addTrack(track, localStream);
        });
        
        // Handle ICE candidates for second coach
        pc2.onicecandidate = (event) => {
          if (event.candidate) {
            // Use same answerCandidates collection (both coaches listen to it)
            answerCandidates.add(event.candidate.toJSON());
          }
        };
        
        // Set remote description from second coach's offer
        const offer2Description = new RTCSessionDescription(data.offer2);
        await pc2.setRemoteDescription(offer2Description);
        
        // Create answer for second coach
        const answer2Description = await pc2.createAnswer();
        await pc2.setLocalDescription(answer2Description);
        
        // Store answer2 in callDoc
        await callDoc.update({ 
          answer2: {
            type: answer2Description.type,
            sdp: answer2Description.sdp,
          }
        });
        
        // Listen for ICE candidates from second coach
        offerCandidates.onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const candidate = new RTCIceCandidate(change.doc.data());
              if (pc2 && pc2.remoteDescription) {
                pc2.addIceCandidate(candidate);
              }
            }
          });
        });
      }
    });

    joinButton.disabled = true;
    joinKeyInput.disabled = true;
    hangupButton.classList.remove('hidden');
  } catch (error) {
    console.error('Error joining session:', error);
    showStatus('Error joining session: ' + error.message, 'error');
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    sessionSection.classList.add('hidden');
    document.body.classList.remove('in-session');
  }
};

// Allow Enter key to join
joinKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !joinButton.disabled) {
    joinButton.click();
  }
});

// Handle session ended by coach
function handleSessionEnded() {
  showSetNotification('Session Ended', 'Coach has ended the session', 'end');
  speakFeedback('Session ended by coach. Thank you for your workout!');
  showStatus('Session ended by coach', 'info');
  
  // Disable controls but keep video visible
  if (hangupButton) {
    const btnText = hangupButton.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = 'Session Ended';
    }
    hangupButton.disabled = true;
  }
  
  // Show utility menu button if not already visible
  if (utilityMenuButton) {
    utilityMenuButton.classList.remove('hidden');
  }
  
  // Show notification for a longer time
  setTimeout(() => {
    if (clientSetNotification) {
      clientSetNotification.classList.add('hidden');
    }
  }, 5000);
}

// Leave session function (used by both hangup button and auto-leave)
function leaveSession() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  if (pc2) {
    pc2.close();
    pc2 = null;
  }
  
  localVideo.srcObject = null;
  
  joinButton.disabled = false;
  joinKeyInput.disabled = false;
  joinKeyInput.value = '';
  if (utilityMenuButton) {
    utilityMenuButton.classList.add('hidden');
  }
  if (utilityMenuPopup) {
    utilityMenuPopup.classList.add('hidden');
  }
  sessionSection.classList.add('hidden');
  document.body.classList.remove('in-session');
  
  // Reset summaries
  allSessionSummaries = [];
  
  showStatus('Left session', 'info');
}

// Hangup
hangupButton.onclick = () => {
  leaveSession();
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

// Track if speech synthesis is unlocked (for mobile browsers)
let speechSynthesisUnlocked = false;

// Unlock speech synthesis on user interaction (required for mobile browsers)
function unlockSpeechSynthesis() {
  if (!('speechSynthesis' in window) || speechSynthesisUnlocked) {
    return;
  }

  try {
    // Create a silent utterance to unlock speech synthesis
    const utterance = new SpeechSynthesisUtterance('');
    utterance.volume = 0;
    utterance.onstart = () => {
      speechSynthesisUnlocked = true;
      console.log('Speech synthesis unlocked');
    };
    utterance.onerror = () => {
      // Even if it errors, we can try to use it
      speechSynthesisUnlocked = true;
    };
    window.speechSynthesis.speak(utterance);
    // Cancel immediately
    setTimeout(() => {
      window.speechSynthesis.cancel();
    }, 10);
  } catch (error) {
    console.log('Error unlocking speech synthesis:', error);
    speechSynthesisUnlocked = true; // Try anyway
  }
}

// Speak feedback using Web Speech API
function speakFeedback(message) {
  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.warn('Invalid message for speech synthesis:', message);
    return;
  }

  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser');
    return;
  }

  // Unlock speech synthesis if not already unlocked
  if (!speechSynthesisUnlocked) {
    unlockSpeechSynthesis();
  }

  try {
    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    // Wait a bit for voices to load (especially on mobile)
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';
      
      // Try to select a good voice
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer English voices
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && voice.localService
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }
      
      utterance.onstart = () => {
        console.log('Speech started:', message);
      };
      
      utterance.onend = () => {
        console.log('Speech completed:', message);
      };
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
      };
      
      window.speechSynthesis.speak(utterance);
      console.log('Speaking feedback:', message);
    };
    
    // If voices are loaded, speak immediately, otherwise wait
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Small delay to ensure everything is ready
      setTimeout(speak, 50);
    } else {
      // Wait for voices to load
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
        window.speechSynthesis.onvoiceschanged = null;
      };
      // Fallback timeout
      setTimeout(speak, 500);
    }
  } catch (error) {
    console.error('Speech synthesis failed:', error);
  }
}

// Update client rep count display
function updateClientRepCount(count) {
  if (clientRepCount) {
    clientRepCount.textContent = count;
  }
}

// Update client exercise display
function updateClientExercise(exerciseName) {
  if (clientExerciseName) {
    clientExerciseName.textContent = exerciseName;
  }
}

// Update client summary display
function updateClientSummary(summary) {
  if (!summaryContent) return;
  
  if (summary.length === 0) {
    summaryContent.innerHTML = '<p class="no-summary-message">No feedback yet</p>';
    clientSummaryPanel.classList.add('hidden');
    return;
  }
  
  // Show summary panel
  clientSummaryPanel.classList.remove('hidden');
  
  // Build summary list
  summaryContent.innerHTML = '';
  const summaryList = document.createElement('ul');
  summaryList.className = 'summary-list';
  
  summary.forEach((feedback, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'summary-item';
    listItem.textContent = `${index + 1}. ${feedback}`;
    summaryList.appendChild(listItem);
  });
  
  summaryContent.appendChild(summaryList);
}

// Close summary button
if (closeSummaryButton) {
  closeSummaryButton.addEventListener('click', () => {
    clientSummaryPanel.classList.add('hidden');
  });
}

// Utility Menu Button
if (utilityMenuButton) {
  utilityMenuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (utilityMenuPopup) {
      utilityMenuPopup.classList.toggle('hidden');
    }
  });
}

// Close utility menu when clicking outside
document.addEventListener('click', (e) => {
  if (utilityMenuPopup && !utilityMenuPopup.contains(e.target) && 
      utilityMenuButton && !utilityMenuButton.contains(e.target)) {
    utilityMenuPopup.classList.add('hidden');
  }
});

// See Summary button
if (seeSummaryButton) {
  seeSummaryButton.addEventListener('click', () => {
    if (utilityMenuPopup) {
      utilityMenuPopup.classList.add('hidden');
    }
    showAllSummaries();
  });
}

// Close summary modal button
if (closeSummaryModalButton) {
  closeSummaryModalButton.addEventListener('click', () => {
    if (summaryModalOverlay) {
      summaryModalOverlay.classList.add('hidden');
    }
  });
}

// Close modal when clicking outside
if (summaryModalOverlay) {
  summaryModalOverlay.addEventListener('click', (e) => {
    if (e.target === summaryModalOverlay) {
      summaryModalOverlay.classList.add('hidden');
    }
  });
}

// Show all summaries in modal - fetch from Firestore
async function showAllSummaries() {
  if (!allSummariesContent || !summaryModalOverlay) return;
  
  // Show loading state
  allSummariesContent.innerHTML = '<p class="no-summary-message">Loading summary...</p>';
  summaryModalOverlay.classList.remove('hidden');
  
  try {
    // Get session ID from sessionDoc (sessionDoc.id should match callDoc.id for now)
    let sessionId = null;
    if (sessionDoc) {
      sessionId = sessionDoc.id;
    } else if (callDoc) {
      // Fallback: use callDoc ID (they should be the same)
      sessionId = callDoc.id;
    }
    
    if (!sessionId) {
      allSummariesContent.innerHTML = '<p class="no-summary-message">No session found. Please join a session first.</p>';
      return;
    }
    
    // Fetch exercise sets from Firestore
    const exerciseSetsCollection = firestore.collection('sessions').doc(sessionId).collection('exerciseSets');
    const snapshot = await exerciseSetsCollection.orderBy('completedAt', 'asc').get();
    
    if (snapshot.empty) {
      allSummariesContent.innerHTML = '<p class="no-summary-message">No sets completed yet</p>';
      return;
    }
    
    // Build summary display
    const summaryContainer = document.createElement('div');
    summaryContainer.className = 'all-summaries-container';
    
    snapshot.docs.forEach((doc, index) => {
      const setData = doc.data();
      const setCard = document.createElement('div');
      setCard.className = 'set-summary-card';
      
      // Format duration
      const duration = setData.duration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      
      // Format score
      const scoreText = setData.coachScore !== null && setData.coachScore !== undefined 
        ? `${setData.coachScore}/10` 
        : 'No score';
      
      const setHeader = document.createElement('div');
      setHeader.className = 'set-summary-header';
      setHeader.innerHTML = `
        <div class="set-number">Set ${index + 1}</div>
        <div class="set-exercise">${setData.exerciseName || 'Unknown Exercise'}</div>
        <div class="set-reps">${setData.actualReps || 0} reps</div>
      `;
      
      const setDetails = document.createElement('div');
      setDetails.className = 'set-summary-details';
      setDetails.innerHTML = `
        <div class="set-detail-item">
          <span class="detail-label">Score:</span>
          <span class="detail-value">${scoreText}</span>
        </div>
        <div class="set-detail-item">
          <span class="detail-label">Duration:</span>
          <span class="detail-value">${durationText}</span>
        </div>
      `;
      
      const feedbackList = document.createElement('ul');
      feedbackList.className = 'set-feedback-list';
      
      if (setData.coachFeedback && Array.isArray(setData.coachFeedback) && setData.coachFeedback.length > 0) {
        setData.coachFeedback.forEach((feedback, fbIndex) => {
          const feedbackItem = document.createElement('li');
          feedbackItem.className = 'set-feedback-item';
          feedbackItem.textContent = `${fbIndex + 1}. ${feedback}`;
          feedbackList.appendChild(feedbackItem);
        });
      } else {
        const noFeedbackItem = document.createElement('li');
        noFeedbackItem.className = 'set-feedback-item no-feedback';
        noFeedbackItem.textContent = 'No feedback provided';
        feedbackList.appendChild(noFeedbackItem);
      }
      
      // Add notes if available
      if (setData.notes && setData.notes.trim()) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'set-notes';
        notesDiv.innerHTML = `
          <div class="notes-label">Notes:</div>
          <div class="notes-text">${setData.notes}</div>
        `;
        setCard.appendChild(setHeader);
        setCard.appendChild(setDetails);
        setCard.appendChild(feedbackList);
        setCard.appendChild(notesDiv);
      } else {
        setCard.appendChild(setHeader);
        setCard.appendChild(setDetails);
        setCard.appendChild(feedbackList);
      }
      
      summaryContainer.appendChild(setCard);
    });
    
    allSummariesContent.innerHTML = '';
    allSummariesContent.appendChild(summaryContainer);
  } catch (error) {
    console.error('Error loading summaries:', error);
    allSummariesContent.innerHTML = '<p class="no-summary-message">Error loading summary. Please try again.</p>';
  }
}

// Handle set status changes (start/end)
let lastSetStatusTimestamp = null;
let hasNavigatedToSummary = false;
function handleSetStatusChange(status, timestamp, summary) {
  // Prevent duplicate notifications by tracking Firestore timestamp
  if (lastSetStatusTimestamp && timestamp && timestamp.toMillis) {
    const timestampMs = timestamp.toMillis();
    if (lastSetStatusTimestamp === timestampMs) {
      return; // Already processed this notification
    }
    lastSetStatusTimestamp = timestampMs;
  } else if (timestamp && timestamp.toMillis) {
    lastSetStatusTimestamp = timestamp.toMillis();
  }
  
  if (status === 'started') {
    // Show green dot indicator instead of popup
    if (setStatusIndicator) {
      setStatusIndicator.classList.remove('hidden');
    }
    // Make rep counter light green
    if (clientRepCounter) {
      clientRepCounter.classList.add('set-active');
    }
    // Voice announcement
    speakFeedback('Set started. Begin your exercise.');
  } else if (status === 'ended') {
    // Hide green dot indicator
    if (setStatusIndicator) {
      setStatusIndicator.classList.add('hidden');
    }
    // Make rep counter white again
    if (clientRepCounter) {
      clientRepCounter.classList.remove('set-active');
    }
    // No popup, just voice announcement
    speakFeedback('Set ended. Great work!');
    
    // Store summary for this set
    if (summary && Array.isArray(summary) && summary.length > 0) {
      const currentExercise = clientExerciseName ? clientExerciseName.textContent : 'Unknown Exercise';
      const currentReps = clientRepCount ? parseInt(clientRepCount.textContent) || 0 : 0;
      
      allSessionSummaries.push({
        exercise: currentExercise,
        reps: currentReps,
        feedback: summary,
        timestamp: new Date()
      });
    }
  }
}

// Show set notification
function showSetNotification(message, icon, type) {
  if (!clientSetNotification || !notificationText || !notificationIcon) return;
  
  notificationText.textContent = message;
  notificationIcon.textContent = icon;
  
  // Add type class for styling
  clientSetNotification.className = `client-set-notification ${type}`;
  clientSetNotification.classList.remove('hidden');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    clientSetNotification.classList.add('hidden');
  }, 3000);
}

