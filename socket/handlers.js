const { rooms } = require('../config/store');

/**
 * Registers all Socket.io event handlers for a connected socket.
 *
 * WebRTC signaling flow:
 *   1. Peer A joins room  → server notifies existing peers
 *   2. Existing peer sends 'offer' to Peer A via server relay
 *   3. Peer A replies with 'answer'
 *   4. Both sides exchange 'ice-candidate' until P2P connection forms
 *   All media then flows directly peer-to-peer (WebRTC).
 */
module.exports = function registerSocketHandlers(io, socket) {
  const { username } = socket.user;

  // ─── ROOM ───────────────────────────────────────────────────────────────────

  socket.on('room:join', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    // Add participant
    room.participants.set(socket.id, { socketId: socket.id, username });
    socket.join(roomId);
    socket.data.roomId = roomId;

    // Send existing participants list to the new joiner
    const others = [...room.participants.values()].filter(p => p.socketId !== socket.id);
    socket.emit('room:joined', {
      roomId,
      participants: others,
      chat: room.chat,
      whiteboard: room.whiteboard,
    });

    // Notify everyone else that a new peer joined
    socket.to(roomId).emit('room:peer-joined', { socketId: socket.id, username });

    console.log(`[room] ${username} joined ${roomId} (${room.participants.size} total)`);
  });

  socket.on('room:leave', () => leaveRoom(socket, io));

  // ─── WEBRTC SIGNALING ────────────────────────────────────────────────────────
  // All events are relayed to the target peer's socketId (1-to-1 relay)

  // Caller → Callee: send SDP offer
  socket.on('webrtc:offer', ({ targetId, sdp }) => {
    io.to(targetId).emit('webrtc:offer', {
      sdp,
      callerId: socket.id,
      callerUsername: username,
    });
  });

  // Callee → Caller: send SDP answer
  socket.on('webrtc:answer', ({ targetId, sdp }) => {
    io.to(targetId).emit('webrtc:answer', {
      sdp,
      answererId: socket.id,
    });
  });

  // ICE candidate relay (both directions)
  socket.on('webrtc:ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('webrtc:ice-candidate', {
      candidate,
      fromId: socket.id,
    });
  });

  // ─── SCREEN SHARE ────────────────────────────────────────────────────────────

  socket.on('screenshare:start', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('screenshare:start', { socketId: socket.id, username });
  });

  socket.on('screenshare:stop', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('screenshare:stop', { socketId: socket.id });
  });

  // ─── CHAT ─────────────────────────────────────────────────────────────────────

  socket.on('chat:message', ({ text }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !text?.trim()) return;

    const message = {
      id: Date.now(),
      username,
      text: text.trim(),
      timestamp: new Date(),
    };

    room.chat.push(message);
    // Broadcast to everyone in room including sender
    io.to(roomId).emit('chat:message', message);
  });

  // ─── WHITEBOARD ───────────────────────────────────────────────────────────────

  // Draw events: { tool, x, y, color, size, type: 'start'|'draw'|'end' }
  socket.on('whiteboard:draw', (event) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    const drawEvent = { ...event, socketId: socket.id, username };
    room.whiteboard.push(drawEvent);
    // Relay to other peers only
    socket.to(roomId).emit('whiteboard:draw', drawEvent);
  });

  socket.on('whiteboard:clear', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    room.whiteboard = [];
    io.to(roomId).emit('whiteboard:clear', { by: username });
  });

  // ─── FILE SHARING ─────────────────────────────────────────────────────────────
  // Files are shared as base64 chunks to avoid large payloads crashing sockets.
  // For production, use a dedicated file upload service (S3, Firebase Storage).

  socket.on('file:share', ({ name, type, size, data }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB limit
    if (size > MAX_SIZE) {
      socket.emit('error', { message: 'File too large (max 10 MB)' });
      return;
    }

    socket.to(roomId).emit('file:incoming', {
      name,
      type,
      size,
      data,
      from: username,
      timestamp: new Date(),
    });
  });

  // ─── MEDIA CONTROLS ───────────────────────────────────────────────────────────

  socket.on('media:toggle', ({ audio, video }) => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('media:toggle', { socketId: socket.id, audio, video });
    }
  });

  // ─── DISCONNECT ───────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id} | user: ${username}`);
    leaveRoom(socket, io);
  });
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function leaveRoom(socket, io) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.participants.delete(socket.id);
    // Clean up empty rooms
    if (room.participants.size === 0) rooms.delete(roomId);
  }

  socket.to(roomId).emit('room:peer-left', { socketId: socket.id });
  socket.leave(roomId);
  socket.data.roomId = null;
}
