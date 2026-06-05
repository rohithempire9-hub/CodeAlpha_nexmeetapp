# NexMeet Backend

Node.js + Socket.io backend for the NexMeet video conferencing app.

## Stack
- **Express** — REST API (auth, rooms)
- **Socket.io** — real-time signaling and collaboration
- **WebRTC** — peer-to-peer media (signaled through this server)
- **JWT** — stateless authentication
- **bcryptjs** — password hashing

---

## Setup

```bash
npm install
cp .env.example .env   # fill in your JWT_SECRET
npm run dev            # development (nodemon)
npm start              # production
```

Server runs on **http://localhost:5000**

---

## REST API

### Auth

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | `{ username, password }` | Register new user, returns JWT |
| POST | `/api/auth/login` | `{ username, password }` | Login, returns JWT |

### Rooms *(requires `Authorization: Bearer <token>` header)*

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/rooms` | — | List all active rooms |
| POST | `/api/rooms` | `{ name }` | Create a room |
| GET | `/api/rooms/:id` | — | Get room details |

---

## Socket.io Events

Connect with JWT:
```js
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});
```

### Room
| Event (emit) | Payload | Description |
|---|---|---|
| `room:join` | `roomId` | Join a room |
| `room:leave` | — | Leave current room |

| Event (listen) | Payload | Description |
|---|---|---|
| `room:joined` | `{ roomId, participants, chat, whiteboard }` | Confirms join, sends room state |
| `room:peer-joined` | `{ socketId, username }` | A new peer joined |
| `room:peer-left` | `{ socketId }` | A peer left |

### WebRTC Signaling
| Event (emit) | Payload | Description |
|---|---|---|
| `webrtc:offer` | `{ targetId, sdp }` | Send SDP offer to a peer |
| `webrtc:answer` | `{ targetId, sdp }` | Send SDP answer |
| `webrtc:ice-candidate` | `{ targetId, candidate }` | Relay ICE candidate |

| Event (listen) | Payload | Description |
|---|---|---|
| `webrtc:offer` | `{ sdp, callerId, callerUsername }` | Incoming offer |
| `webrtc:answer` | `{ sdp, answererId }` | Incoming answer |
| `webrtc:ice-candidate` | `{ candidate, fromId }` | Incoming ICE candidate |

### Chat
| Emit | `chat:message` | `{ text }` |
| Listen | `chat:message` | `{ id, username, text, timestamp }` |

### Whiteboard
| Emit | `whiteboard:draw` | `{ tool, x, y, color, size, type }` |
| Emit | `whiteboard:clear` | — |
| Listen | `whiteboard:draw` | draw event + `{ socketId, username }` |
| Listen | `whiteboard:clear` | `{ by }` |

### File Sharing
| Emit | `file:share` | `{ name, type, size, data }` (base64, max 10MB) |
| Listen | `file:incoming` | `{ name, type, size, data, from, timestamp }` |

### Media Controls
| Emit/Listen | `media:toggle` | `{ socketId, audio, video }` |

### Screen Share
| Emit | `screenshare:start` / `screenshare:stop` | — |
| Listen | `screenshare:start` | `{ socketId, username }` |
| Listen | `screenshare:stop` | `{ socketId }` |

---

## WebRTC Signaling Flow

```
Peer A joins room
      │
      ▼
Server sends Peer A the list of existing peers
      │
      ▼
Peer A creates RTCPeerConnection for each existing peer
Peer A sends  webrtc:offer  →  Server relays  →  Peer B
Peer B sends  webrtc:answer →  Server relays  →  Peer A
Both sides exchange  webrtc:ice-candidate  via server
      │
      ▼
P2P media connection established (audio/video flows directly)
```

---

## Production Notes

- Replace the in-memory store (`config/store.js`) with MongoDB or PostgreSQL
- Use a TURN server (e.g. Twilio, Coturn) for clients behind strict NATs
- Move file sharing to S3 or Firebase Storage for files > 1 MB
- Add rate limiting (`express-rate-limit`) on auth endpoints
- Use `helmet` for HTTP security headers
