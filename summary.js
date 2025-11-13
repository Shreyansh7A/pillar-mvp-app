import './style.css';

// Get summary data from URL parameters or localStorage
const urlParams = new URLSearchParams(window.location.search);
const summaryData = urlParams.get('summary');
const joinKey = urlParams.get('joinKey') || localStorage.getItem('clientJoinKey');

// Store join key if provided
if (urlParams.get('joinKey')) {
  localStorage.setItem('clientJoinKey', urlParams.get('joinKey'));
}

const summaryContent = document.getElementById('summaryContent');
const returnToSessionButton = document.getElementById('returnToSessionButton');

// Parse and display summary
if (summaryData) {
  try {
    const summary = JSON.parse(decodeURIComponent(summaryData));
    displaySummary(summary);
  } catch (error) {
    console.error('Error parsing summary:', error);
    summaryContent.innerHTML = '<p class="no-summary-message">Error loading summary</p>';
  }
} else {
  summaryContent.innerHTML = '<p class="no-summary-message">No summary available</p>';
}

function displaySummary(summary) {
  if (!summary || !Array.isArray(summary) || summary.length === 0) {
    summaryContent.innerHTML = '<p class="no-summary-message">No feedback for this set</p>';
    return;
  }
  
  const summaryList = document.createElement('ul');
  summaryList.className = 'summary-list-full';
  
  summary.forEach((feedback, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'summary-item-full';
    listItem.textContent = `${index + 1}. ${feedback}`;
    summaryList.appendChild(listItem);
  });
  
  summaryContent.innerHTML = '';
  summaryContent.appendChild(summaryList);
}

// Return to session button
returnToSessionButton.addEventListener('click', () => {
  if (joinKey) {
    // Redirect to client page with join key
    window.location.href = `client.html?joinKey=${encodeURIComponent(joinKey)}`;
  } else {
    // Just go to client page
    window.location.href = 'client.html';
  }
});

