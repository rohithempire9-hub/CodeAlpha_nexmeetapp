const { v4: uuidv4 } = require('uuid');
const { rooms } = require('../config/store');

function createRoom(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });

  const id = uuidv4();
  const room = {
    id,
    name,
    hostId: req.user.username,
    participants: new Map(),
    whiteboard: [],         // stores whiteboard draw events
    chat: [],               // stores chat messages
    createdAt: new Date(),
  };
  rooms.set(id, room);
  res.status(201).json(roomSummary(room));
}

function getRoom(req, res) {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(roomSummary(room));
}

function listRooms(req, res) {
  const list = [...rooms.values()].map(roomSummary);
  res.json(list);
}

function roomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    participantCount: room.participants.size,
    createdAt: room.createdAt,
  };
}

module.exports = { createRoom, getRoom, listRooms };
