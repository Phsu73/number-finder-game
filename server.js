// Fast Number Finder - Lobby System Server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
const publicPath = path.join(__dirname, 'public');
const fs = require('fs');

console.log('[SERVER] Public files path:', publicPath);

// Check if public directory exists
if (!fs.existsSync(publicPath)) {
    console.error('[SERVER] ERROR: Public directory not found at:', publicPath);
    console.error('[SERVER] Please ensure the public directory exists with your frontend files.');
} else {
    console.log('[SERVER] ✓ Public directory found');

    // Check if index.html exists
    const indexPath = path.join(publicPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.error('[SERVER] ERROR: index.html not found at:', indexPath);
    } else {
        console.log('[SERVER] ✓ index.html found');
    }

    // List files in public directory
    try {
        const files = fs.readdirSync(publicPath);
        console.log('[SERVER] Files in public directory:', files);
    } catch (err) {
        console.error('[SERVER] Error reading public directory:', err);
    }
}

app.use(express.static(publicPath));

// Room management
const rooms = new Map();
const PLAYER_TIMEOUT = 300000; // 5 minutes to reconnect

// Generate unique room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let roomId;
    let attempts = 0;
    do {
        roomId = '';
        for (let i = 0; i < 4; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        attempts++;
        if (attempts > 100) {
            // Fallback if we can't find unique ID
            roomId = Date.now().toString(36).substring(0, 4).toUpperCase();
            break;
        }
    } while (rooms.has(roomId));
    return roomId;
}

// Game board generation (server-side source of truth)
function generateGameBoard() {
    console.log('[SERVER] Generating game board...');
    const numbers = [];
    const ballColors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
        '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'
    ];

    const shapes = [
        { name: 'circle', style: 'border-radius: 50%;' },
        { name: 'square', style: 'border-radius: 0;' },
        { name: 'rounded', style: 'border-radius: 8px;' },
        { name: 'diamond', style: 'clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);' },
        { name: 'triangle', style: 'clip-path: polygon(50% 0%, 0% 100%, 100% 100%);' },
        { name: 'hexagon', style: 'clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);' },
        { name: 'pentagon', style: 'clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%);' },
        { name: 'star', style: 'clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);' }
    ];

    for (let i = 1; i <= 100; i++) {
        const top = Math.random() * 94 + 3;
        const left = Math.random() * 94 + 3;
        const color = ballColors[i % ballColors.length];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const zIndex = Math.floor(Math.random() * 10);

        numbers.push({
            number: i,
            top: top,
            left: left,
            backgroundColor: color,
            shapeStyle: shape.style,
            shapeName: shape.name,
            zIndex: zIndex
        });
    }

    console.log(`[SERVER] Generated ${numbers.length} numbers`);
    return numbers;
}

// Initialize game state for a room
function initializeGameState(roomId) {
    console.log(`[SERVER] Initializing game state for room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) {
        console.error(`[SERVER] Room ${roomId} not found!`);
        return;
    }

    const numbers = generateGameBoard();
    console.log(`[SERVER] Generated ${numbers.length} numbers for room ${roomId}`);

    room.gameState = {
        numbers: numbers,
        foundNumbers: new Set(),
        currentTurn: 1, // Player 1 starts
        targetNumber: null,
        timers: {
            player1: 180,
            player2: 180
        },
        isRunning: true,
        player1History: [],
        player2History: []
    };

    console.log(`[SERVER] Game state initialized for room ${roomId}`);
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Handle create room
    socket.on('createRoom', () => {
        console.log('[LOBBY] Player wants to create a room');

        const roomId = generateRoomId();
        console.log(`[LOBBY] Generated room ID: ${roomId}`);

        // Create new room
        rooms.set(roomId, {
            roomId: roomId,
            players: [],
            gameState: null,
            maxPlayers: 2,
            createdAt: Date.now()
        });

        const room = rooms.get(roomId);

        // Add player as Player 1
        room.players.push({
            socketId: socket.id,
            playerNumber: 1,
            disconnected: false,
            disconnectTime: null
        });

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.playerNumber = 1;

        console.log(`[LOBBY] ${socket.id} created room ${roomId} as Player 1`);

        // Send room created event
        socket.emit('roomCreated', {
            roomId: roomId,
            playerNumber: 1
        });

        console.log(`[LOBBY] Sent roomCreated event to ${socket.id}: Room ${roomId}, Player 1`);
    });

    // Handle join room
    socket.on('joinRoom', (roomId) => {
        console.log(`[LOBBY] ${socket.id} wants to join room: ${roomId}`);

        // Validate room ID
        if (!roomId || typeof roomId !== 'string') {
            console.log('[LOBBY] Invalid room ID format');
            socket.emit('joinError', { message: 'Invalid room code. Please enter a 4-character code.' });
            return;
        }

        roomId = roomId.toUpperCase().trim();

        // Check if room exists
        if (!rooms.has(roomId)) {
            console.log(`[LOBBY] Room ${roomId} does not exist`);
            socket.emit('joinError', { message: `Room ${roomId} does not exist.` });
            return;
        }

        const room = rooms.get(roomId);
        console.log(`[LOBBY] Room ${roomId} has ${room.players.length} players`);

        // Check if room is full
        if (room.players.length >= room.maxPlayers) {
            console.log(`[LOBBY] Room ${roomId} is full`);
            socket.emit('joinError', { message: `Room ${roomId} is full. Maximum 2 players allowed.` });
            return;
        }

        // Check if there are disconnected players
        const disconnectedPlayer = room.players.find(p => p.disconnected);
        if (disconnectedPlayer) {
            // Reconnect the disconnected player
            console.log(`[LOBBY] Reconnecting Player ${disconnectedPlayer.playerNumber}`);
            disconnectedPlayer.socketId = socket.id;
            disconnectedPlayer.disconnected = false;
            disconnectedPlayer.disconnectTime = null;

            socket.join(roomId);
            socket.currentRoom = roomId;
            socket.playerNumber = disconnectedPlayer.playerNumber;

            socket.emit('roomRejoined', {
                roomId: roomId,
                playerNumber: disconnectedPlayer.playerNumber,
                gameState: room.gameState ? {
                    ...room.gameState,
                    foundNumbers: Array.from(room.gameState.foundNumbers)
                } : null
            });

            // Notify other player
            socket.to(roomId).emit('playerReconnected', {
                playerNumber: disconnectedPlayer.playerNumber
            });

            console.log(`[LOBBY] ${socket.id} rejoined room ${roomId} as Player ${disconnectedPlayer.playerNumber}`);
            return;
        }

        // Add new player as Player 2
        const playerNumber = room.players.length + 1;
        room.players.push({
            socketId: socket.id,
            playerNumber: playerNumber,
            disconnected: false,
            disconnectTime: null
        });

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.playerNumber = playerNumber;

        console.log(`[LOBBY] ${socket.id} joined room ${roomId} as Player ${playerNumber}`);

        // Send room joined event
        socket.emit('roomJoined', {
            roomId: roomId,
            playerNumber: playerNumber
        });

        // Notify other players in the room
        socket.to(roomId).emit('playerJoined', {
            playerNumber: playerNumber,
            totalPlayers: room.players.length
        });

        console.log(`[LOBBY] Sent roomJoined event to ${socket.id}: Room ${roomId}, Player ${playerNumber}`);

        // If room now has 2 players, start the game
        if (room.players.length === room.maxPlayers) {
            console.log(`[LOBBY] Room ${roomId} is now full with 2 players! Starting game...`);

            // Initialize game state
            initializeGameState(roomId);

            // Broadcast game start to all players
            io.to(roomId).emit('startGame', {
                numbers: room.gameState.numbers,
                player1Number: 1,
                player2Number: 2
            });

            console.log(`[LOBBY] Sent startGame event to room ${roomId} with ${room.gameState.numbers.length} numbers`);
        }
    });

    // Handle number submission (challenger)
    socket.on('submitNumber', ({ roomId, number }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState || !room.gameState.isRunning) return;

        const playerNum = socket.playerNumber;
        const gameState = room.gameState;

        // Validation
        if (typeof number !== 'number' || number < 1 || number > 100) {
            socket.emit('invalidNumber', { message: 'Please enter a number between 1 and 100!' });
            return;
        }

        if (gameState.foundNumbers.has(number)) {
            socket.emit('invalidNumber', { message: 'This number has already been found! Choose another number.' });
            return;
        }

        // Check if it's this player's turn to challenge
        const currentPlayer = gameState.currentTurn;
        if (playerNum !== currentPlayer) {
            socket.emit('notYourTurn', { message: "It's not your turn!" });
            return;
        }

        console.log(`[GAME] Player ${playerNum} submitted number ${number}`);

        // Add to challenger's history
        if (playerNum === 1) {
            gameState.player1History.push({ number, type: 'challenger' });
        } else {
            gameState.player2History.push({ number, type: 'challenger' });
        }

        // Set target number
        gameState.targetNumber = number;

        // Switch turns (finder becomes the other player)
        gameState.currentTurn = playerNum === 1 ? 2 : 1;

        // Broadcast to both players
        io.to(roomId).emit('numberSubmitted', {
            challenger: playerNum,
            finder: gameState.currentTurn,
            targetNumber: number,
            currentTurn: gameState.currentTurn
        });

        // Start finder's timer
        startTimer(roomId, gameState.currentTurn);
    });

    // Handle number click (finder)
    socket.on('numberClick', ({ roomId, clickedNumber }) => {
        const room = rooms.get(roomId);
        if (!room || !room.gameState || !room.gameState.isRunning) return;

        const gameState = room.gameState;
        const playerNum = socket.playerNumber;

        // Check if it's this player's turn to find
        if (playerNum !== gameState.currentTurn) {
            return;
        }

        console.log(`[GAME] Player ${playerNum} clicked number ${clickedNumber}`);

        // Check if correct number
        if (clickedNumber === gameState.targetNumber) {
            console.log(`[GAME] Player ${playerNum} found the correct number ${clickedNumber}!`);

            // Add to finder's history
            if (playerNum === 1) {
                gameState.player1History.push({ number: clickedNumber, type: 'finder' });
            } else {
                gameState.player2History.push({ number: clickedNumber, type: 'finder' });
            }

            // Mark as found
            gameState.foundNumbers.add(clickedNumber);

            // Stop finder's timer
            stopTimer(roomId, playerNum);

            // Finder becomes challenger next - keep turn with finder
            gameState.targetNumber = null;

            // Broadcast number found to both players
            io.to(roomId).emit('numberFound', {
                finder: playerNum,
                number: clickedNumber,
                foundNumbers: Array.from(gameState.foundNumbers),
                currentTurn: playerNum // Finder keeps turn for challenging
            });

            // Check if all numbers found
            if (gameState.foundNumbers.size === 100) {
                endGame(roomId, null); // All numbers found
            }
        } else {
            // Wrong click - notify only the clicking player
            socket.emit('wrongClick', { number: clickedNumber });
        }
    });

    // Handle play again
    socket.on('playAgain', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room) return;

        console.log(`[GAME] Room ${roomId} wants to play again`);

        initializeGameState(roomId);

        io.to(roomId).emit('gameRestart', {
            numbers: room.gameState.numbers
        });

        console.log(`[GAME] Game restarted in room ${roomId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`[SOCKET] Client disconnected: ${socket.id}`);

        const roomId = socket.currentRoom;
        if (!roomId) return;

        const room = rooms.get(roomId);
        if (!room) return;

        // Find player and mark as disconnected
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            player.disconnected = true;
            player.disconnectTime = Date.now();

            console.log(`[LOBBY] Player ${player.playerNumber} disconnected from room ${roomId}`);

            // Notify other player
            socket.to(roomId).emit('playerDisconnected', {
                playerNumber: player.playerNumber
            });

            // Pause game if it was running
            if (room.gameState && room.gameState.isRunning) {
                room.gameState.isRunning = false;
                io.to(roomId).emit('gamePaused');
            }

            // Set timeout to clean up room if player doesn't reconnect
            setTimeout(() => {
                const currentRoom = rooms.get(roomId);
                if (currentRoom && currentRoom.players[playerIndex]?.disconnected) {
                    // Player still disconnected, clean up room
                    rooms.delete(roomId);
                    console.log(`[LOBBY] Room ${roomId} deleted due to player timeout`);
                }
            }, PLAYER_TIMEOUT);
        }
    });
});

// Timer functions
function startTimer(roomId, player) {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return;

    const timerKey = player === 1 ? 'player1' : 'player2';

    // Clear any existing timer
    if (room.timerIntervals && room.timerIntervals[timerKey]) {
        clearInterval(room.timerIntervals[timerKey]);
    }

    if (!room.timerIntervals) {
        room.timerIntervals = {};
    }

    room.timerIntervals[timerKey] = setInterval(() => {
        const currentRoom = rooms.get(roomId);
        if (!currentRoom || !currentRoom.gameState) {
            clearInterval(room.timerIntervals[timerKey]);
            return;
        }

        currentRoom.gameState.timers[timerKey]--;

        // Broadcast timer update
        io.to(roomId).emit('timerUpdate', {
            player: player,
            time: currentRoom.gameState.timers[timerKey]
        });

        // Check if time ran out
        if (currentRoom.gameState.timers[timerKey] <= 0) {
            stopTimer(roomId, player);
            endGame(roomId, player);
        }
    }, 1000);
}

function stopTimer(roomId, player) {
    const room = rooms.get(roomId);
    if (!room || !room.timerIntervals) return;

    const timerKey = player === 1 ? 'player1' : 'player2';
    if (room.timerIntervals[timerKey]) {
        clearInterval(room.timerIntervals[timerKey]);
        room.timerIntervals[timerKey] = null;
    }
}

function endGame(roomId, loser) {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return;

    const gameState = room.gameState;
    gameState.isRunning = false;

    // Stop all timers
    stopTimer(roomId, 1);
    stopTimer(roomId, 2);

    // Determine winner
    let winner, winReason;
    if (loser === null) {
        // All numbers found - player with more time remaining wins
        if (gameState.timers.player1 > gameState.timers.player2) {
            winner = 1;
            winReason = 'Player 2 spent more time searching!';
        } else if (gameState.timers.player2 > gameState.timers.player1) {
            winner = 2;
            winReason = 'Player 1 spent more time searching!';
        } else {
            winner = null; // Tie
            winReason = 'Both players have the same time remaining!';
        }
    } else {
        // A player ran out of time
        winner = loser === 1 ? 2 : 1;
        winReason = `Player ${loser} ran out of time!`;
    }

    console.log(`[GAME] Game ended in room ${roomId}. Winner: Player ${winner || 'Tie'}`);

    // Broadcast game over
    io.to(roomId).emit('gameOver', {
        winner: winner,
        loser: loser,
        winReason: winReason,
        finalTimes: {
            player1: gameState.timers.player1,
            player2: gameState.timers.player2
        },
        player1History: gameState.player1History,
        player2History: gameState.player2History
    });
}

// Health check endpoint (must be before fallback route)
app.get('/health', (req, res) => {
    const roomInfo = [];
    rooms.forEach((room, roomId) => {
        roomInfo.push({
            roomId: roomId,
            playerCount: room.players.length,
            players: room.players.map(p => ({
                playerNumber: p.playerNumber,
                connected: !p.disconnected
            })),
            gameRunning: room.gameState?.isRunning || false
        });
    });

    res.json({
        status: 'ok',
        activeRooms: roomInfo.length,
        rooms: roomInfo,
        timestamp: new Date().toISOString()
    });
});

// Serve main page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('[SERVER] Serving index.html from:', indexPath);

    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('[SERVER] Error serving index.html:', err);
            res.status(404).send('Error loading page. Please check if the files are correctly deployed.');
        } else {
            console.log('[SERVER] Successfully served index.html');
        }
    });
});

// Fallback route for SPA (Single Page Application) support
app.get('*', (req, res) => {
    console.log('[SERVER] Fallback route for:', req.originalUrl);
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('[SERVER] Error serving fallback index.html:', err);
            res.status(404).send('Page not found');
        }
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🎮 Number Finder Multiplayer Server Started`);
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🔧 Health check endpoint: /health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`==================================================`);
});