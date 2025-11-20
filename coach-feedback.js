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

// Global State
let callDoc = null;
let feedbackCollection = null;
let isSetActive = false;
let feedbackQueue = [];
let coachId = null;
let coachesCollection = null;

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
    ],
    'Motivation': [
      'Great job!',
      'Keep it up!',
      'You\'re doing well',
      'Stay focused',
      'Push through!'
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
    ],
    'Motivation': [
      'Great job!',
      'Keep it up!',
      'You\'re doing well',
      'Stay focused',
      'Push through!'
    ]
  }
};

// HTML elements
const coachModeSelection = document.getElementById('coachModeSelection');
const joinSessionCard = document.getElementById('joinSessionCard');
const joinSessionButton = document.getElementById('joinSessionButton');
const coachJoinKeyInput = document.getElementById('coachJoinKeyInput');
const sessionHeader = document.getElementById('sessionHeader');
const sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const coachDashboard = document.getElementById('coachDashboard');
const feedbackButtons = document.getElementById('feedbackButtons');

// Join existing session
async function joinExistingSession(joinKey) {
  try {
    showStatus('Joining session...', 'info');
    
    // Generate unique coach ID
    coachId = `coach_feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Reference existing call document
    callDoc = firestore.collection('calls').doc(joinKey);
    
    // Check if session exists
    const callData = await callDoc.get();
    if (!callData.exists) {
      showStatus('Session not found. Please check the session code.', 'error');
      return;
    }
    
    // Get collections
    coachesCollection = callDoc.collection('coaches');
    feedbackCollection = callDoc.collection('feedback');
    
    // Add this coach to the coaches collection
    await coachesCollection.doc(coachId).set({
      coachId: coachId,
      role: 'feedback',
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      isActive: true
    });
    
    // Display session code
    if (sessionCodeDisplay) sessionCodeDisplay.textContent = joinKey;
    if (sessionHeader) sessionHeader.classList.remove('hidden');
    
    // Hide mode selection, show dashboard
    if (coachModeSelection) coachModeSelection.classList.add('hidden');
    if (coachDashboard) coachDashboard.classList.remove('hidden');
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) pageTitle.style.display = 'none';
    
    // Listen for session data (exercise, set status)
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      
      // Update exercise and show feedback buttons
      if (data.currentExercise) {
        const exerciseNames = {
          'Lat Pulldown': 'lat-pulldown',
          'Deadlift': 'deadlift'
        };
        const exerciseValue = exerciseNames[data.currentExercise] || 
          Object.keys(exerciseNames).find(key => exerciseNames[key] === data.currentExercise);
        
        if (exerciseValue) {
          updateFeedbackButtons(exerciseValue);
        } else {
          // Try direct match
          if (data.currentExercise.toLowerCase().includes('lat')) {
            updateFeedbackButtons('lat-pulldown');
          } else if (data.currentExercise.toLowerCase().includes('deadlift')) {
            updateFeedbackButtons('deadlift');
          } else {
            if (feedbackButtons) {
              feedbackButtons.innerHTML = '<p class="no-exercise-message">Waiting for exercise to be selected...</p>';
            }
          }
        }
      } else {
        if (feedbackButtons) {
          feedbackButtons.innerHTML = '<p class="no-exercise-message">Waiting for exercise to be selected...</p>';
        }
      }
      
      // Update set status
      if (data.setStatus) {
        if (data.setStatus === 'started' && !isSetActive) {
          console.log('Set started, enabling feedback');
          isSetActive = true;
          feedbackQueue = []; // Clear queue when set starts
        } else if (data.setStatus === 'ended' && isSetActive) {
          console.log('Set ended, saving feedback');
          isSetActive = false;
          
          // Save feedback to Firestore
          if (callDoc && feedbackQueue.length > 0) {
            const feedbackMessages = feedbackQueue.map(item => item.message);
            callDoc.set({
              setSummary: feedbackMessages,
              summaryUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }
          
          feedbackQueue = [];
        }
      }
    });
    
    updateConnectionStatus(true);
    showStatus('Connected to session', 'success');
    
  } catch (error) {
    console.error('Error joining session:', error);
    showStatus('Failed to join session', 'error');
  }
}

// Update feedback buttons based on exercise
function updateFeedbackButtons(exercise) {
  if (!feedbackButtons) return;
  
  feedbackButtons.innerHTML = '';
  
  if (!exercise || !exerciseFeedback[exercise]) {
    feedbackButtons.innerHTML = '<p class="no-exercise-message">Waiting for exercise to be selected...</p>';
    return;
  }
  
  const feedbacks = exerciseFeedback[exercise];
  const categories = ['Technique', 'Performance', 'Safety', 'Motivation'];
  
  // Create a container for all categories in a horizontal grid
  const categoriesContainer = document.createElement('div');
  categoriesContainer.className = 'feedback-categories-grid';
  
  categories.forEach((category) => {
    // Create category column container
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'feedback-category-column';
    
    // Create category header (at top of column)
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'feedback-category-header';
    categoryHeader.textContent = category;
    categoryContainer.appendChild(categoryHeader);
    
    // Create category buttons container (vertical stack)
    const categoryButtons = document.createElement('div');
    categoryButtons.className = 'feedback-category-buttons';
    
    // Check if this is Technique category with subcategories
    if (category === 'Technique' && typeof feedbacks[category] === 'object' && !Array.isArray(feedbacks[category])) {
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
        
        // Create subcategory buttons (vertical stack)
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
    } else if (feedbacks[category] && Array.isArray(feedbacks[category])) {
      // Handle regular categories (Performance, Safety, Motivation) - simple arrays
      feedbacks[category].forEach((feedback) => {
        const button = document.createElement('button');
        button.className = 'feedback-btn';
        button.textContent = feedback;
        button.onclick = () => sendFeedback(feedback);
        categoryButtons.appendChild(button);
      });
    }
    
    categoryContainer.appendChild(categoryButtons);
    categoriesContainer.appendChild(categoryContainer);
  });
  
  feedbackButtons.appendChild(categoriesContainer);
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
  
  // Send immediately for voice feedback
  feedbackCollection.add({
    message: message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// Show status message
function showStatus(message, type = 'info') {
  if (type === 'error') {
    console.error('Error:', message);
  } else {
    console.log(message);
  }
}

// Update connection status
function updateConnectionStatus(connected) {
  if (connectionStatus) {
    if (connected) {
      connectionStatus.textContent = '• Connected';
      connectionStatus.className = 'status-indicator connected';
    } else {
      connectionStatus.textContent = '• Disconnected';
      connectionStatus.className = 'status-indicator';
    }
  }
}

// Set up button click handlers
if (joinSessionButton) {
  joinSessionButton.onclick = async () => {
    const joinKey = coachJoinKeyInput ? coachJoinKeyInput.value.trim() : '';
    if (!joinKey) {
      showStatus('Please enter a session code', 'error');
      return;
    }
    await joinExistingSession(joinKey);
  };
}

// Allow Enter key to join session
if (coachJoinKeyInput) {
  coachJoinKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && joinSessionButton) {
      joinSessionButton.click();
    }
  });
}

