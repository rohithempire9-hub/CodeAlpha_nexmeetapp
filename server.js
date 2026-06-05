require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');
const { authenticateSocket } = require('./middleware/auth');
const registerSocketHandlers = require('./socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'nexmeet-app.html')));

io.use(authenticateSocket);
io.on('connection', (socket) => { registerSocketHandlers(io, socket); });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('NexMeet running on port ' + PORT));