// Number Finder Multiplayer - Lobby System Client

// Socket connection
const socket = io();

// Client state
const clientState = {
    playerNumber: null,
    roomId: null,
    isConnected: false,
    isMyTurn: false
};

// DOM Elements
const elements = {
    // Lobby elements
    lobbyScreen: document.getElementById('lobby-screen'),
    gameScreen: document.getElementById('game-screen'),
    connectionText: document.getElementById('connection-text'),
    createRoomBtn: document.getElementById('create-room-btn'),
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

// Current game state (synced with server)
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
// SOCKET EVENT HANDLERS
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
    if (clientState.roomId && clientState.playerNumber) {
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

elements.submit1.addEventListener('click', () => handleNumberSubmit());
elements.submit2.addEventListener('click', () => handleNumberSubmit());

elements.input1.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNumberSubmit();
});

elements.input2.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNumberSubmit();
});

elements.playAgain.addEventListener('click', () => {
    console.log('[GAME] Play again clicked');
    socket.emit('playAgain', { roomId: clientState.roomId });
});

// =============================================
// GAME FUNCTIONS
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
            ball.addEventListener('click', () => handleNumberClick(numData.number));

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
console.log('[CLIENT] Waiting for user action in lobby...');