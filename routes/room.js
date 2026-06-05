const express = require('express');
const { createRoom, getRoom, listRooms } = require('../controllers/roomController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', listRooms);
router.post('/', createRoom);
router.get('/:id', getRoom);

module.exports = router;
