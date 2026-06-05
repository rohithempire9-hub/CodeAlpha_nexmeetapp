const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users } = require('../config/store');

async function register(req, res) {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });
  if (users.has(username))
    return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  users.set(username, { username, passwordHash });

  const token = signToken({ username });
  res.status(201).json({ token, username });
}

async function login(req, res) {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ username });
  res.json({ token, username });
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { register, login };
