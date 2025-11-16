# Firebase Data Structure Design

## Firestore Structure

### Collection: `sessions`

**Document Structure:**
```javascript
{
  sessionId: string,              // Auto-generated document ID
  coachId: string,                // Optional placeholder for now
  status: "LIVE" | "ENDED" | "ABORTED",
  startedAt: Timestamp,
  endedAt: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Subcollection: `sessions/{sessionId}/exerciseSets`

**Document Structure:**
```javascript
{
  exerciseSetId: string,          // Auto-generated document ID
  exerciseType: string,           // "shoulder-press", "bench-press", "deadlift", "squats"
  exerciseName: string,           // "Shoulder Press", "Bench Press", etc. (display name)
  actualReps: number,             // Final rep count when set ended
  coachScore: number | null,      // 0-10, null until coach adds score
  coachFeedback: string[],        // Array of all feedback messages during set
  notes: string | null,           // Optional coach notes
  startedAt: Timestamp,           // When "Start Set" was clicked
  completedAt: Timestamp,         // When "End Set" was clicked
  duration: number,               // Duration in seconds (calculated)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Data Flow

### 1. Session Start (Coach)
- Create document in `sessions` collection
- Set `status: "LIVE"`
- Set `startedAt: now()`
- Use document ID as join key

### 2. Set Start (Coach)
- Track start time locally
- Reset rep counter
- Clear feedback queue

### 3. During Set
- Increment/decrement rep count (stored locally, synced to client)
- Queue feedback messages (stored locally)

### 4. Set End (Coach)
- Create document in `sessions/{sessionId}/exerciseSets` subcollection
- Store:
  - `exerciseType` and `exerciseName` (from current selection)
  - `actualReps` (current rep count)
  - `coachFeedback` (array of all queued feedback)
  - `startedAt` (when set started)
  - `completedAt` (now)
  - `duration` (calculated: completedAt - startedAt)
- Show score input modal/prompt
- Wait for coach to enter score (0-10)
- Update `coachScore` and `notes` (if provided)
- Add to session history display

### 5. Session End (Coach)
- Update session document:
  - `status: "ENDED"`
  - `endedAt: now()`
- All exercise sets are already saved in subcollection

## UI Components Needed

### 1. Score Input Modal (after set ends)
- Input field for score (0-10, with validation)
- Optional notes textarea
- "Save" button
- Should appear immediately after "End Set" is clicked

### 2. Session History Panel (Coach side)
- Display all completed sets in current session
- Show: Exercise name, Reps, Score, Duration, Feedback count
- Expandable to see full feedback array
- Update in real-time as sets are completed
- Show at bottom of dashboard or as a collapsible panel

## Implementation Notes

- Use Firestore subcollections for exerciseSets (better organization)
- Use `onSnapshot` to listen for new sets and update history in real-time
- Calculate duration on client side before saving
- Score input should block further actions until saved (or allow skipping)
- Session history should be sorted by `completedAt` (most recent first)

