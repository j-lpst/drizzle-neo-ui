# Drizzle NEO UI

## Setup

Open `public/pages/chat.html` in your browser. Ensure the backend API is running
(default: `http://127.0.0.1:5000`).

## Configuration

Configuration is stored in `localStorage`:

- `apiBase` - Backend API URL (default: `http://127.0.0.1:5000`)
- `chatHistory` - Array of `{role, text}` messages (default: `[]`)
- `darkMode` - Theme preference (`enabled`/`disabled`, default: `disabled`)
- `customSound` - Path to custom notification sound (default: `""`)

Settings UI accessible via gear icon in sidebar.

## Backend API Endpoints

### `POST /chat`

Primary endpoint for chat messages. Returns JSON response.

**Request:**
```json
{
  "text": "User message",
  "args": ["-notts"]
}
```

**Response:**
```json
{
  "reply": "AI response"
}
```

**Usage in frontend**
```javascript
const res = await fetch(`${apiBase}/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text, args: ["-notts"] }),
});
const data = await res.json();
```

## Data Flow

1. User enters message → `sendChat()` function
2. Message appended to UI and localStorage
3. POST request to `${apiBase}/chat` with `{text, args}`
4. Backend processes via `prompt.py`
5. JSON response received → AI message appended to UI
6. Notification sound played

## Storage Schema

**chatHistory:**
```json
[
  {"role": "user", "text": "Hello"},
  {"role": "ai", "text": "Hi there!"}
]
```
