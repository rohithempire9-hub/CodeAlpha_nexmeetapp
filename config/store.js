// In-memory store (replace with a real DB like MongoDB/PostgreSQL in production)

const users = new Map();   // username -> { username, passwordHash }
const rooms = new Map();   // roomId   -> { id, name, hostId, participants: Map, createdAt }

module.exports = { users, rooms };
