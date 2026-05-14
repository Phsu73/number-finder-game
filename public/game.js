// Number Finder Multiplayer - Lobby System Client with Local Offline Mode

// =============================================
// GLOBAL STATE MANAGEMENT
// =============================================

// Game mode flag
const isOfflineMode = false; // Will be set to true when local offline mode is selected

// Socket connection (only used in online mode)
const socket = io();

// Client state
const clientState = {
    playerNumber: null,
    roomId: null,
    isConnected: false,
    isMyTurn: false,
    isOfflineMode: false
};

// Local offline game state
const localGameState = {
    numbers: [],
    foundNumbers: new Set(),
    currentTurn: 1, // Player 1 starts
    targetNumber: null,
    timers: {
        player1: 180,
        player2: 180
    },
    isRunning: false,
    player1History: [],
    player2History: [],
    timerIntervals: {
        player1: null,
        player2: null
    }
};

// Current game state (synced with server in online mode)
let currentGameState = {
    numbers: [],
    foundNumbers: new Set(),
    currentTurn: 1,
    targetNumber: null,
    timers: {
        player1: 180,
        player2: 180
    },
    isRunning: false
};

// DOM Elements
const elements = {
    // Lobby elements
    lobbyScreen: document.getElementById('lobby-screen'),
    gameScreen: document.getElementById('game-screen'),
    connectionText: document.getElementById('connection-text'),
    createRoomBtn: document.getElementById('create-room-btn'),
    localOfflineBtn: document.getElementById('local-offline-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    roomCodeInput: document.getElementById('room-code-input'),
    errorMessage: document.getElementById('error-message'),

    // Game elements
    roomCodeDisplay: document.getElementById('room-code-display'),
    gameStatus: document.getElementById('game-status'),
    numberContainer: document.getElementById('numberContainer'),
    timer1: document.getElementById('timer1'),
    timer2: document.getElementById('timer2'),
    history1: document.getElementById('history1'),
    history2: document.getElementById('history2'),
    input1: document.getElementById('input1'),
    input2: document.getElementById('input2'),
    submit1: document.getElementById('submit1'),
    submit2: document.getElementById('submit2'),
    turn1: document.getElementById('turn1'),
    turn2: document.getElementById('turn2'),
    gameOverModal: document.getElementById('gameOverModal'),
    winnerText: document.getElementById('winnerText'),
    loserText: document.getElementById('loserText'),
    playAgain: document.getElementById('playAgain'),
    foundCount: document.getElementById('foundCount'),
    waitingMessage: document.getElementById('waiting-message'),
    shareCode: document.getElementById('share-code'),
    copyCodeBtn: document.getElementById('copy-code-btn'),
    disconnectModal: document.getElementById('disconnectModal')
};

// =============================================
// SCREEN MANAGEMENT
// =============================================

function showLobbyScreen() {
    console.log('[UI] Showing lobby screen');
    elements.lobbyScreen.classList.remove('hidden');
    elements.gameScreen.classList.add('hidden');
}

function showGameScreen() {
    console.log('[UI] Showing game screen');
    elements.lobbyScreen.classList.add('hidden');
    elements.gameScreen.classList.remove('hidden');
}

// =============================================
// LOCAL OFFLINE MODE FUNCTIONS
// =============================================

function startLocalOfflineMode() {
    console.log('[LOCAL] Starting local offline mode');
    clientState.isOfflineMode = true;
    clientState.playerNumber = 'observer'; // In local mode, we observe both players

    // Generate local game board
    localGameState.numbers = generateLocalGameBoard();
    localGameState.foundNumbers.clear();
    localGameState.currentTurn = 1;
    localGameState.targetNumber = null;
    localGameState.timers = { player1: 180, player2: 180 };
    localGameState.isRunning = true;
    localGameState.player1History = [];
    localGameState.player2History = [];

    // Clear UI
    elements.numberContainer.innerHTML = '';
    elements.history1.innerHTML = '';
    elements.history2.innerHTML = '';
    elements.foundCount.textContent = '0';

    // Switch to game screen
    showGameScreen();

    // Update UI for local mode
    elements.roomCodeDisplay.textContent = 'LOCAL';
    elements.gameStatus.textContent = '(2 Players - Same Screen)';

    // Hide waiting message
    elements.waitingMessage.classList.add('hidden');

    // Display numbers
    displayNumbers(localGameState.numbers);

    // Update displays
    updateLocalTimerDisplay();
    updateLocalTurnIndicators();

    console.log('[LOCAL] Local offline mode started successfully');
}

function generateLocalGameBoard() {
    console.log('[LOCAL] Generating local game board...');
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

    console.log(`[LOCAL] Generated ${numbers.length} numbers`);
    return numbers;
}

function handleLocalNumberSubmit(playerNum) {
    if (!localGameState.isRunning) return;

    const input = playerNum === 1 ? elements.input1 : elements.input2;
    const number = parseInt(input.value);

    // Validation
    if (isNaN(number)) {
        alert('Please enter a valid number!');
        return;
    }

    if (number < 1 || number > 100) {
        alert('Please enter a number between 1 and 100!');
        return;
    }

    if (localGameState.foundNumbers.has(number)) {
        alert('This number has already been found! Choose another number.');
        return;
    }

    // Check if it's this player's turn to challenge
    if (playerNum !== localGameState.currentTurn) {
        alert("It's not your turn!");
        return;
    }

    console.log(`[LOCAL] Player ${playerNum} submitted number ${number}`);

    // Add to challenger's history
    const historyElement = playerNum === 1 ? localGameState.player1History : localGameState.player2History;
    historyElement.push({ number, type: 'challenger' });
    addToHistory(playerNum === 1 ? elements.history1 : elements.history2, number, 'challenger');

    // Set target number
    localGameState.targetNumber = number;

    // Switch turns (finder becomes the other player)
    localGameState.currentTurn = playerNum === 1 ? 2 : 1;

    // Start finder's timer
    startLocalTimer(localGameState.currentTurn);

    // Update displays
    updateLocalTimerDisplay();
    updateLocalTurnIndicators();

    // Clear input
    input.value = '';
}

function handleLocalNumberClick(clickedNumber) {
    if (!localGameState.isRunning) return;

    // Check if there's a target number to find
    if (localGameState.targetNumber === null) return;

    const finder = localGameState.currentTurn;

    console.log(`[LOCAL] Player ${finder} clicked number ${clickedNumber}`);

    // Check if correct number
    if (clickedNumber === localGameState.targetNumber) {
        console.log(`[LOCAL] Player ${finder} found the correct number ${clickedNumber}!`);

        // Add to finder's history
        const historyElement = finder === 1 ? localGameState.player1History : localGameState.player2History;
        historyElement.push({ number: clickedNumber, type: 'finder' });
        addToHistory(finder === 1 ? elements.history1 : elements.history2, clickedNumber, 'finder');

        // Mark as found
        localGameState.foundNumbers.add(clickedNumber);

        // Remove the number from display
        const ballElement = document.querySelector(`[data-number="${clickedNumber}"]`);
        if (ballElement) {
            ballElement.classList.add('found');
        }

        // Update found count
        elements.foundCount.textContent = localGameState.foundNumbers.size;

        // Stop finder's timer
        stopLocalTimer(finder);

        // Finder becomes challenger next - keep turn with finder
        localGameState.targetNumber = null;

        // Update displays
        updateLocalTimerDisplay();
        updateLocalTurnIndicators();

        // Check if all numbers found
        if (localGameState.foundNumbers.size === 100) {
            endLocalGame(null); // All numbers found
        }
    } else {
        // Wrong click - show visual feedback
        const ballElement = document.querySelector(`[data-number="${clickedNumber}"]`);
        if (ballElement) {
            ballElement.classList.add('wrong-click');
            setTimeout(() => {
                ballElement.classList.remove('wrong-click');
            }, 500);
        }
    }
}

function startLocalTimer(player) {
    const timerKey = player === 1 ? 'player1' : 'player2';

    // Clear any existing timer
    if (localGameState.timerIntervals[timerKey]) {
        clearInterval(localGameState.timerIntervals[timerKey]);
    }

    localGameState.timerIntervals[timerKey] = setInterval(() => {
        localGameState.timers[timerKey]--;

        // Update display
        updateLocalTimerDisplay();

        // Check if time ran out
        if (localGameState.timers[timerKey] <= 0) {
            stopLocalTimer(player);
            endLocalGame(player);
        }
    }, 1000);
}

function stopLocalTimer(player) {
    const timerKey = player === 1 ? 'player1' : 'player2';
    if (localGameState.timerIntervals[timerKey]) {
        clearInterval(localGameState.timerIntervals[timerKey]);
        localGameState.timerIntervals[timerKey] = null;
    }
}

function updateLocalTimerDisplay() {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    elements.timer1.textContent = formatTime(localGameState.timers.player1);
    elements.timer2.textContent = formatTime(localGameState.timers.player2);

    // Add warning color when time is low
    if (localGameState.timers.player1 <= 30) {
        elements.timer1.classList.add('text-red-500');
        elements.timer1.classList.remove('text-yellow-400');
    } else {
        elements.timer1.classList.remove('text-red-500');
        elements.timer1.classList.add('text-yellow-400');
    }

    if (localGameState.timers.player2 <= 30) {
        elements.timer2.classList.add('text-red-500');
        elements.timer2.classList.remove('text-yellow-400');
    } else {
        elements.timer2.classList.remove('text-red-500');
        elements.timer2.classList.add('text-yellow-400');
    }
}

function updateLocalTurnIndicators() {
    const isPlayer1Turn = localGameState.currentTurn === 1;
    const isPlayer1Challenger = isPlayer1Turn && localGameState.targetNumber === null;
    const isPlayer2Challenger = !isPlayer1Turn && localGameState.targetNumber === null;

    // Update Player 1 section
    if (isPlayer1Challenger) {
        elements.turn1.textContent = 'Player 1: Your turn to challenge!';
        elements.input1.disabled = false;
        elements.submit1.disabled = false;
    } else if (isPlayer1Turn) {
        elements.turn1.textContent = 'Player 1: Find Player 2\'s number...';
        elements.input1.disabled = true;
        elements.submit1.disabled = true;
    } else {
        elements.turn1.textContent = localGameState.targetNumber ?
            `Player 1: Find number ${localGameState.targetNumber}!` :
            "Player 1: Wait for your turn!";
        elements.input1.disabled = true;
        elements.submit1.disabled = true;
    }

    // Update Player 2 section
    if (isPlayer2Challenger) {
        elements.turn2.textContent = 'Player 2: Your turn to challenge!';
        elements.input2.disabled = false;
        elements.submit2.disabled = false;
    } else if (!isPlayer1Turn) {
        elements.turn2.textContent = 'Player 2: Find Player 1\'s number...';
        elements.input2.disabled = true;
        elements.submit2.disabled = true;
    } else {
        elements.turn2.textContent = localGameState.targetNumber ?
            `Player 2: Find number ${localGameState.targetNumber}!` :
            "Player 2: Wait for your turn!";
        elements.input2.disabled = true;
        elements.submit2.disabled = true;
    }
}

function endLocalGame(loser) {
    console.log(`[LOCAL] Game ended. Loser: Player ${loser}`);

    localGameState.isRunning = false;

    // Stop all timers
    stopLocalTimer(1);
    stopLocalTimer(2);

    // Determine winner
    let winner, winReason;
    if (loser === null) {
        // All numbers found - player with more time remaining wins
        if (localGameState.timers.player1 > localGameState.timers.player2) {
            winner = 1;
            winReason = 'Player 2 spent more time searching!';
        } else if (localGameState.timers.player2 > localGameState.timers.player1) {
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

    // Display both players' history
    displayHistory(elements.history1, localGameState.player1History);
    displayHistory(elements.history2, localGameState.player2History);

    // Format final times
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const p1Time = formatTime(localGameState.timers.player1);
    const p2Time = formatTime(localGameState.timers.player2);

    // Show game over modal
    if (winner === null) {
        // Tie
        elements.winnerText.textContent = "🤝 It's a Tie! 🤝";
        elements.winnerText.className = 'text-4xl font-bold text-green-400 mb-4';
        elements.loserText.innerHTML = `${winReason}<br><br>
            <span class="text-lg">Final Times:<br>
            Player 1: ${p1Time} remaining<br>
            Player 2: ${p2Time} remaining</span>`;
    } else {
        elements.winnerText.textContent = `🏆 Player ${winner} Wins! 🏆`;
        elements.winnerText.className = `text-4xl font-bold ${winner === 1 ? 'text-blue-400' : 'text-red-400'} mb-4`;
        elements.loserText.innerHTML = `${winReason}<br><br>
            <span class="text-lg">Final Times:<br>
            Player 1: ${p1Time} remaining<br>
            Player 2: ${p2Time} remaining</span>`;
    }

    elements.gameOverModal.classList.remove('hidden');
}

function restartLocalGame() {
    console.log('[LOCAL] Restarting local game');

    // Reset game state
    localGameState.numbers = generateLocalGameBoard();
    localGameState.foundNumbers.clear();
    localGameState.currentTurn = 1;
    localGameState.targetNumber = null;
    localGameState.timers = { player1: 180, player2: 180 };
    localGameState.isRunning = true;
    localGameState.player1History = [];
    localGameState.player2History = [];

    // Clear UI
    elements.numberContainer.innerHTML = '';
    elements.history1.innerHTML = '';
    elements.history2.innerHTML = '';
    elements.foundCount.textContent = '0';

    // Hide game over modal
    elements.gameOverModal.classList.add('hidden');

    // Display new numbers
    displayNumbers(localGameState.numbers);

    // Update displays
    updateLocalTimerDisplay();
    updateLocalTurnIndicators();
}

// =============================================
// SOCKET EVENT HANDLERS (ONLINE MODE)
// =============================================

socket.on('connect', () => {
    console.log('[SOCKET] Connected to server with ID:', socket.id);
    elements.connectionText.textContent = '✅ Connected to server';
    elements.connectionText.className = 'text-green-400';
    clientState.isConnected = true;
});

socket.on('disconnect', () => {
    console.log('[SOCKET] Disconnected from server');
    elements.connectionText.textContent = '❌ Disconnected from server';
    elements.connectionText.className = 'text-red-400';
    clientState.isConnected = false;
});

socket.on('reconnect', () => {
    console.log('[SOCKET] Reconnected to server');
    elements.connectionText.textContent = '✅ Reconnected to server';
    elements.connectionText.className = 'text-green-400';
    clientState.isConnected = true;

    // Try to rejoin room if we were in one
    if (clientState.roomId && clientState.playerNumber && !clientState.isOfflineMode) {
        console.log('[LOBBY] Attempting to rejoin room:', clientState.roomId);
        socket.emit('joinRoom', clientState.roomId);
    }
});

// Room created event (Player 1)
socket.on('roomCreated', ({ roomId, playerNumber }) => {
    console.log(`[LOBBY] Room created: ${roomId}, Player: ${playerNumber}`);
    clientState.roomId = roomId;
    clientState.playerNumber = playerNumber;

    // Switch to game screen
    showGameScreen();

    // Update UI
    elements.roomCodeDisplay.textContent = roomId;
    elements.gameStatus.textContent = '(Waiting for Player 2...)';

    // Show waiting message
    elements.waitingMessage.classList.remove('hidden');
    elements.shareCode.textContent = roomId;

    console.log('[LOBBY] Waiting for Player 2 to join room:', roomId);
});

// Room joined event (Player 2)
socket.on('roomJoined', ({ roomId, playerNumber }) => {
    console.log(`[LOBBY] Joined room: ${roomId}, Player: ${playerNumber}`);
    clientState.roomId = roomId;
    clientState.playerNumber = playerNumber;

    // Switch to game screen
    showGameScreen();

    // Update UI
    elements.roomCodeDisplay.textContent = roomId;
    elements.gameStatus.textContent = '(Game Started!)';

    // Hide waiting message (game will start soon)
    elements.waitingMessage.classList.add('hidden');

    console.log('[LOBBY] Successfully joined room:', roomId);
});

// Player rejoined event (reconnection)
socket.on('roomRejoined', ({ roomId, playerNumber, gameState }) => {
    console.log(`[LOBBY] Rejoined room: ${roomId}, Player: ${playerNumber}`);
    clientState.roomId = roomId;
    clientState.playerNumber = playerNumber;

    // Switch to game screen
    showGameScreen();

    // Update UI
    elements.roomCodeDisplay.textContent = roomId;
    elements.gameStatus.textContent = '(Game Running)';

    // Restore game state if available
    if (gameState) {
        console.log('[GAME] Restoring game state');
        currentGameState = {
            ...gameState,
            foundNumbers: new Set(gameState.foundNumbers)
        };

        // Re-display numbers
        displayNumbers(currentGameState.numbers);

        // Restore found numbers
        currentGameState.foundNumbers.forEach(num => {
            const ballElement = document.querySelector(`[data-number="${num}"]`);
            if (ballElement) {
                ballElement.classList.add('found');
            }
        });

        elements.foundCount.textContent = currentGameState.foundNumbers.size;

        // Update displays
        updateTimerDisplay();
        updateTurnIndicators();
    }

    console.log('[LOBBY] Successfully rejoined room:', roomId);
});

// Player joined event (notification to other player)
socket.on('playerJoined', ({ playerNumber, totalPlayers }) => {
    console.log(`[LOBBY] Player ${playerNumber} joined. Total: ${totalPlayers}`);

    if (clientState.playerNumber === 1 && playerNumber === 2) {
        // Player 1 receives this when Player 2 joins
        console.log('[LOBBY] Player 2 joined! Waiting for game to start...');

        // Hide waiting message (game will start soon)
        elements.waitingMessage.classList.add('hidden');

        elements.gameStatus.textContent = '(Game Started!)';
    }
});

// Join error event
socket.on('joinError', ({ message }) => {
    console.error('[LOBBY] Join error:', message);
    showError(message);
});

// Start game event (both players)
socket.on('startGame', ({ numbers, player1Number, player2Number }) => {
    console.log('[GAME] Game started!');
    console.log('[GAME] Numbers received:', numbers.length);
    console.log('[GAME] Player assignments:', { player1Number, player2Number });

    // Update game state
    currentGameState.numbers = numbers;
    currentGameState.foundNumbers.clear();
    currentGameState.currentTurn = 1;
    currentGameState.targetNumber = null;
    currentGameState.timers = { player1: 180, player2: 180 };
    currentGameState.isRunning = true;

    // Clear UI
    elements.numberContainer.innerHTML = '';
    elements.history1.innerHTML = '';
    elements.history2.innerHTML = '';
    elements.foundCount.textContent = '0';

    // Update status
    elements.gameStatus.textContent = '(Game Running)';

    // Display numbers
    console.log('[GAME] Calling displayNumbers with', numbers.length, 'numbers');
    displayNumbers(numbers);
    console.log('[GAME] displayNumbers completed. Container children:', elements.numberContainer.children.length);

    // Update displays
    updateTimerDisplay();
    updateTurnIndicators();

    console.log('[GAME] Game initialization completed!');
});

// Number submitted event
socket.on('numberSubmitted', ({ challenger, finder, targetNumber, currentTurn }) => {
    console.log(`[GAME] Number ${targetNumber} submitted by Player ${challenger}`);

    // Update game state
    currentGameState.targetNumber = targetNumber;
    currentGameState.currentTurn = currentTurn;

    // Add to challenger's history
    const historyElement = challenger === 1 ? elements.history1 : elements.history2;
    addToHistory(historyElement, targetNumber, 'challenger');

    // Update turn indicators
    updateTurnIndicators();
});

// Number found event
socket.on('numberFound', ({ finder, number, foundNumbers, currentTurn }) => {
    console.log(`[GAME] Number ${number} found by Player ${finder}`);

    // Update game state
    currentGameState.foundNumbers = new Set(foundNumbers);
    currentGameState.currentTurn = currentTurn;
    currentGameState.targetNumber = null;

    // Remove the number from display
    const ballElement = document.querySelector(`[data-number="${number}"]`);
    if (ballElement) {
        ballElement.classList.add('found');
    }

    // Update found count
    elements.foundCount.textContent = foundNumbers.length;

    // Add to finder's history
    const historyElement = finder === 1 ? elements.history1 : elements.history2;
    addToHistory(historyElement, number, 'finder');

    // Update turn indicators
    updateTurnIndicators();
});

// Timer update event
socket.on('timerUpdate', ({ player, time }) => {
    const timerKey = player === 1 ? 'player1' : 'player2';
    currentGameState.timers[timerKey] = time;
    updateTimerDisplay();
});

// Wrong click event
socket.on('wrongClick', ({ number }) => {
    const ballElement = document.querySelector(`[data-number="${number}"]`);
    if (ballElement) {
        ballElement.classList.add('wrong-click');
        setTimeout(() => {
            ballElement.classList.remove('wrong-click');
        }, 500);
    }
});

// Invalid number event
socket.on('invalidNumber', ({ message }) => {
    alert(message);
});

// Not your turn event
socket.on('notYourTurn', ({ message }) => {
    alert(message);
});

// Game paused event
socket.on('gamePaused', () => {
    console.log('[GAME] Game paused due to disconnection');
    currentGameState.isRunning = false;
    elements.disconnectModal.classList.remove('hidden');
    disableAllInputs(true);
});

// Player reconnected event
socket.on('playerReconnected', ({ playerNumber }) => {
    console.log(`[GAME] Player ${playerNumber} reconnected`);
    elements.disconnectModal.classList.add('hidden');

    if (currentGameState.numbers.length > 0) {
        currentGameState.isRunning = true;
        updateTurnIndicators();
    }
});

// Game over event
socket.on('gameOver', ({ winner, loser, winReason, finalTimes, player1History, player2History }) => {
    console.log(`[GAME] Game over! Winner: Player ${winner || 'Tie'}`);
    currentGameState.isRunning = false;
    disableAllInputs(true);

    // Display both players' history
    displayHistory(elements.history1, player1History);
    displayHistory(elements.history2, player2History);

    // Format final times
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const p1Time = formatTime(finalTimes.player1);
    const p2Time = formatTime(finalTimes.player2);

    // Show game over modal
    if (winner === null) {
        // Tie
        elements.winnerText.textContent = "🤝 It's a Tie! 🤝";
        elements.winnerText.className = 'text-4xl font-bold text-green-400 mb-4';
        elements.loserText.innerHTML = `${winReason}<br><br>
            <span class="text-lg">Final Times:<br>
            Player 1: ${p1Time} remaining<br>
            Player 2: ${p2Time} remaining</span>`;
    } else {
        elements.winnerText.textContent = `🏆 Player ${winner} Wins! 🏆`;
        elements.winnerText.className = `text-4xl font-bold ${winner === 1 ? 'text-blue-400' : 'text-red-400'} mb-4`;
        elements.loserText.innerHTML = `${winReason}<br><br>
            <span class="text-lg">Final Times:<br>
            Player 1: ${p1Time} remaining<br>
            Player 2: ${p2Time} remaining</span>`;
    }

    elements.gameOverModal.classList.remove('hidden');
});

// Game restart event
socket.on('gameRestart', ({ numbers }) => {
    console.log('[GAME] Game restarted!');

    // Reset game state
    currentGameState.numbers = numbers;
    currentGameState.foundNumbers.clear();
    currentGameState.currentTurn = 1;
    currentGameState.targetNumber = null;
    currentGameState.timers = { player1: 180, player2: 180 };
    currentGameState.isRunning = true;

    // Clear UI
    elements.numberContainer.innerHTML = '';
    elements.history1.innerHTML = '';
    elements.history2.innerHTML = '';
    elements.foundCount.textContent = '0';

    // Hide game over modal
    elements.gameOverModal.classList.add('hidden');

    // Display new numbers
    displayNumbers(numbers);

    // Update displays
    updateTimerDisplay();
    updateTurnIndicators();
});

// =============================================
// LOBBY EVENT HANDLERS
// =============================================

elements.createRoomBtn.addEventListener('click', () => {
    if (!clientState.isConnected) {
        showError('Not connected to server. Please wait...');
        return;
    }

    console.log('[LOBBY] Create room button clicked');
    clearError();
    socket.emit('createRoom');
});

elements.localOfflineBtn.addEventListener('click', () => {
    console.log('[LOBBY] Local offline button clicked');
    clearError();
    startLocalOfflineMode();
});

elements.joinRoomBtn.addEventListener('click', () => {
    if (!clientState.isConnected) {
        showError('Not connected to server. Please wait...');
        return;
    }

    const roomCode = elements.roomCodeInput.value.trim().toUpperCase();

    if (!roomCode) {
        showError('Please enter a room code');
        return;
    }

    if (roomCode.length !== 4) {
        showError('Room code must be 4 characters');
        return;
    }

    console.log('[LOBBY] Join room button clicked:', roomCode);
    clearError();
    socket.emit('joinRoom', roomCode);
});

elements.roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.joinRoomBtn.click();
    }
});

elements.roomCodeInput.addEventListener('input', (e) => {
    // Auto-uppercase and limit to 4 characters
    e.target.value = e.target.value.toUpperCase().substring(0, 4);
    clearError();
});

// Copy code button
elements.copyCodeBtn.addEventListener('click', () => {
    const roomCode = elements.shareCode.textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        const originalText = elements.copyCodeBtn.textContent;
        elements.copyCodeBtn.textContent = '✅ Copied!';
        setTimeout(() => {
            elements.copyCodeBtn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        showError('Failed to copy to clipboard');
    });
});

// =============================================
// GAME EVENT HANDLERS
// =============================================

elements.submit1.addEventListener('click', () => {
    if (clientState.isOfflineMode) {
        handleLocalNumberSubmit(1);
    } else {
        handleNumberSubmit();
    }
});

elements.submit2.addEventListener('click', () => {
    if (clientState.isOfflineMode) {
        handleLocalNumberSubmit(2);
    } else {
        handleNumberSubmit();
    }
});

elements.input1.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (clientState.isOfflineMode) {
            handleLocalNumberSubmit(1);
        } else {
            handleNumberSubmit();
        }
    }
});

elements.input2.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (clientState.isOfflineMode) {
            handleLocalNumberSubmit(2);
        } else {
            handleNumberSubmit();
        }
    }
});

elements.playAgain.addEventListener('click', () => {
    console.log('[GAME] Play again clicked');
    if (clientState.isOfflineMode) {
        restartLocalGame();
    } else {
        socket.emit('playAgain', { roomId: clientState.roomId });
    }
});

// =============================================
// GAME FUNCTIONS (SHARED)
// =============================================

function displayNumbers(numbers) {
    console.log(`[DISPLAY] Starting to display ${numbers.length} numbers`);
    elements.numberContainer.innerHTML = '';

    let successCount = 0;

    numbers.forEach((numData, index) => {
        try {
            const ball = document.createElement('div');
            ball.className = 'number-item';
            ball.textContent = numData.number;
            ball.dataset.number = numData.number;

            // Use server-provided positions and styles
            ball.style.top = `${numData.top}%`;
            ball.style.left = `${numData.left}%`;
            ball.style.backgroundColor = numData.backgroundColor;
            ball.style.color = 'white';
            ball.style.cssText += numData.shapeStyle;
            ball.style.zIndex = numData.zIndex;
            ball.dataset.shape = numData.shapeName;

            // Add click handler
            ball.addEventListener('click', () => {
                if (clientState.isOfflineMode) {
                    handleLocalNumberClick(numData.number);
                } else {
                    handleNumberClick(numData.number);
                }
            });

            elements.numberContainer.appendChild(ball);
            successCount++;
        } catch (error) {
            console.error(`[DISPLAY] Error creating ball for number ${numData.number}:`, error);
        }
    });

    console.log(`[DISPLAY] Completed: ${successCount} numbers displayed`);
}

function handleNumberClick(clickedNumber) {
    if (!currentGameState.isRunning) return;

    // Check if it's our turn to find
    if (!clientState.isMyTurn) return;

    // Check if we're the finder (not challenger)
    if (currentGameState.targetNumber === null) return;

    console.log(`[GAME] Clicking number ${clickedNumber}`);

    // Send click to server
    socket.emit('numberClick', {
        roomId: clientState.roomId,
        clickedNumber: clickedNumber
    });
}

function handleNumberSubmit() {
    if (!currentGameState.isRunning) return;

    // Determine which input to use based on our player number
    const input = clientState.playerNumber === 1 ? elements.input1 : elements.input2;
    const number = parseInt(input.value);

    // Client-side validation
    if (isNaN(number)) {
        alert('Please enter a valid number!');
        return;
    }

    if (number < 1 || number > 100) {
        alert('Please enter a number between 1 and 100!');
        return;
    }

    console.log(`[GAME] Submitting number ${number}`);

    // Send to server for validation and processing
    socket.emit('submitNumber', {
        roomId: clientState.roomId,
        number: number
    });

    // Clear input
    input.value = '';
}

function addToHistory(historyElement, number, type) {
    const li = document.createElement('li');
    if (type === 'challenger') {
        li.innerHTML = `<span class="text-yellow-300">Challenged:</span> ${number}`;
    } else {
        li.innerHTML = `<span class="text-green-300">Found:</span> ${number}`;
    }
    historyElement.appendChild(li);
    historyElement.scrollTop = historyElement.scrollHeight;
}

function displayHistory(historyElement, history) {
    historyElement.innerHTML = '';
    history.forEach(entry => {
        addToHistory(historyElement, entry.number, entry.type);
    });
}

function updateTurnIndicators() {
    const amIPlayer1 = clientState.playerNumber === 1;
    const isPlayer1Turn = currentGameState.currentTurn === 1;
    const isMyTurn = (amIPlayer1 && isPlayer1Turn) || (!amIPlayer1 && !isPlayer1Turn);
    const amIChallenger = isMyTurn && currentGameState.targetNumber === null;

    clientState.isMyTurn = isMyTurn;

    // Update Player 1 section
    if (amIPlayer1) {
        if (amIChallenger) {
            elements.turn1.textContent = 'Your turn to challenge!';
            elements.input1.disabled = false;
            elements.submit1.disabled = false;
        } else if (isMyTurn) {
            elements.turn1.textContent = "Find Player 2's number...";
            elements.input1.disabled = true;
            elements.submit1.disabled = true;
        } else {
            elements.turn1.textContent = currentGameState.targetNumber ?
                `Find number ${currentGameState.targetNumber}!` :
                "Wait for your turn!";
            elements.input1.disabled = true;
            elements.submit1.disabled = true;
        }
    } else {
        // I'm Player 2, show Player 1's status
        if (currentGameState.targetNumber) {
            elements.turn1.textContent = `Finding number ${currentGameState.targetNumber}...`;
        } else {
            elements.turn1.textContent = isPlayer1Turn ? "Challenging..." : "Wait for turn...";
        }
        elements.input1.disabled = true;
        elements.submit1.disabled = true;
    }

    // Update Player 2 section
    if (!amIPlayer1) {
        if (amIChallenger) {
            elements.turn2.textContent = 'Your turn to challenge!';
            elements.input2.disabled = false;
            elements.submit2.disabled = false;
        } else if (isMyTurn) {
            elements.turn2.textContent = "Find Player 1's number...";
            elements.input2.disabled = true;
            elements.submit2.disabled = true;
        } else {
            elements.turn2.textContent = currentGameState.targetNumber ?
                `Find number ${currentGameState.targetNumber}!` :
                "Wait for your turn!";
            elements.input2.disabled = true;
            elements.submit2.disabled = true;
        }
    } else {
        // I'm Player 1, show Player 2's status
        if (currentGameState.targetNumber) {
            elements.turn2.textContent = `Finding number ${currentGameState.targetNumber}...`;
        } else {
            elements.turn2.textContent = !isPlayer1Turn ? "Challenging..." : "Wait for turn...";
        }
        elements.input2.disabled = true;
        elements.submit2.disabled = true;
    }
}

function updateTimerDisplay() {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    elements.timer1.textContent = formatTime(currentGameState.timers.player1);
    elements.timer2.textContent = formatTime(currentGameState.timers.player2);

    // Add warning color when time is low
    if (currentGameState.timers.player1 <= 30) {
        elements.timer1.classList.add('text-red-500');
        elements.timer1.classList.remove('text-yellow-400');
    } else {
        elements.timer1.classList.remove('text-red-500');
        elements.timer1.classList.add('text-yellow-400');
    }

    if (currentGameState.timers.player2 <= 30) {
        elements.timer2.classList.add('text-red-500');
        elements.timer2.classList.remove('text-yellow-400');
    } else {
        elements.timer2.classList.remove('text-red-500');
        elements.timer2.classList.add('text-yellow-400');
    }
}

function disableAllInputs(disabled) {
    elements.input1.disabled = disabled;
    elements.input2.disabled = disabled;
    elements.submit1.disabled = disabled;
    elements.submit2.disabled = disabled;
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

function showError(message) {
    elements.errorMessage.classList.remove('hidden');
    elements.errorMessage.querySelector('p').textContent = message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        clearError();
    }, 5000);
}

function clearError() {
    elements.errorMessage.classList.add('hidden');
}

// =============================================
// INITIALIZATION
// =============================================

console.log('[CLIENT] Number Finder Multiplayer - Lobby System Loaded');
console.log('[CLIENT] Both Online and Local Offline modes available');
console.log('[CLIENT] Waiting for user action in lobby...');