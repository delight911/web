// Import character data from JSON
const response = await fetch('characters.json');
const characterData = await response.json();

// Game state
const gameState = {
    player1: {
        character: null,
        health: 100,
        position: 200,
        state: 'idle',
        lastMove: null,
        moveTimer: 0,
        comboCount: 0,
        comboSequence: [],
        lastComboTime: 0
    },
    player2: {
        character: null,
        health: 100,
        position: 200,
        state: 'idle',
        lastMove: null,
        moveTimer: 0,
        comboCount: 0,
        comboSequence: [],
        lastComboTime: 0
    },
    selectedCharacter: null,
    gameActive: false,
    round: 1,
    time: 99,
    gameLoopId: null,
    audioContext: new (window.AudioContext || window.webkitAudioContext)()
};

// DOM Elements
const player1Element = document.getElementById('player1');
const player2Element = document.getElementById('player2');
const p1HealthElement = document.getElementById('p1-health');
const p2HealthElement = document.getElementById('p2-health');
const p1HealthValue = document.getElementById('p1-health-value');
const p2HealthValue = document.getElementById('p2-health-value');
const roundElement = document.getElementById('round');
const timeElement = document.getElementById('time');
const startButton = document.getElementById('start-btn');
const comboDisplay = document.getElementById('combo-display');
const characterGrid = document.getElementById('character-grid');

// Sound buffers cache
const soundBuffers = {};

// Initialize game
function initGame() {
    // Create character cards from JSON data
    for (const [key, character] of Object.entries(characterData.characters)) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.character = key;
        
        card.innerHTML = `
            <div class="character-icon ${character.colorClass}">
                <i class="fas fa-user"></i>
            </div>
            <h3>${character.name}</h3>
            <p>Health: ${character.health} | Speed: ${character.speed}</p>
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.character-card').forEach(c => 
                c.classList.remove('selected'));
            card.classList.add('selected');
            gameState.selectedCharacter = key;
        });
        
        characterGrid.appendChild(card);
    }

    // Start button
    startButton.addEventListener('click', startGame);

    // Pre-select first character
    if (characterGrid.children.length > 0) {
        characterGrid.children[0].click();
    }
    
    // Preload sounds
    preloadSounds();
}

// Preload sound effects
async function preloadSounds() {
    const sounds = new Set();
    
    for (const character of Object.values(characterData.characters)) {
        for (const move of Object.values(character.moves)) {
            sounds.add(move.sound);
        }
    }
    
    for (const sound of sounds) {
        try {
            const response = await fetch(`sounds/${sound}`);
            const arrayBuffer = await response.arrayBuffer();
            soundBuffers[sound] = await gameState.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`Error loading sound: ${sound}`, error);
        }
    }
}

// Play sound effect
function playSound(soundName) {
    if (!soundBuffers[soundName]) return;
    
    const source = gameState.audioContext.createBufferSource();
    source.buffer = soundBuffers[soundName];
    source.connect(gameState.audioContext.destination);
    source.start();
}

// Start the game
function startGame() {
    if (!gameState.selectedCharacter) return;
    
    gameState.gameActive = true;
    gameState.player1.character = characterData.characters[gameState.selectedCharacter];
    gameState.player2.character = characterData.characters.blue; // Default opponent
    
    // Set player colors
    player1Element.querySelector('.stickman').className = `stickman ${gameState.player1.character.colorClass}`;
    player2Element.querySelector('.stickman').className = `stickman ${gameState.player2.character.colorClass}`;
    
    // Reset health
    gameState.player1.health = gameState.player1.character.health;
    gameState.player2.health = gameState.player2.character.health;
    updateHealthBars();
    
    // Set up controls
    document.addEventListener('keydown', handleKeyDown);
    
    // Start game loop
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
    
    // Update UI
    startButton.textContent = 'RESTART FIGHT';
    startButton.classList.add('fight-btn');
}

// Game loop using requestAnimationFrame
function gameLoop(timestamp) {
    if (!gameState.gameActive) return;
    
    // Update game state
    updateGameState();
    
    // Render game
    renderGame();
    
    // Continue game loop
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

// Update game state
function updateGameState() {
    // Update move timers
    if (gameState.player1.moveTimer > 0) gameState.player1.moveTimer--;
    if (gameState.player2.moveTimer > 0) gameState.player2.moveTimer--;
    
    // Reset state if move timer is done
    if (gameState.player1.moveTimer === 0 && gameState.player1.state !== 'idle') {
        gameState.player1.state = 'idle';
    }
    if (gameState.player2.moveTimer === 0 && gameState.player2.state !== 'idle') {
        gameState.player2.state = 'idle';
    }
    
    // Check combos
    checkCombos();
    
    // Update timer
    gameState.time = Math.max(0, gameState.time - 0.016);
    timeElement.textContent = Math.floor(gameState.time);
    
    if (gameState.time <= 0) {
        endGame();
    }
}

// Render game
function renderGame() {
    // Update positions
    player1Element.style.left = `${gameState.player1.position}px`;
    player2Element.style.right = `${gameState.player2.position}px`;
    
    // Apply animations based on state
    const p1Stickman = player1Element.querySelector('.stickman');
    const p2Stickman = player2Element.querySelector('.stickman');
    
    resetAnimations(p1Stickman);
    resetAnimations(p2Stickman);
    
    if (gameState.player1.state === 'punch') {
        p1Stickman.querySelector('.left-arm').style.animation = 'punch-arm 0.3s forwards';
    } else if (gameState.player1.state === 'kick') {
        p1Stickman.querySelector('.left-leg').style.animation = 'kick-leg 0.3s forwards';
    }
    
    if (gameState.player2.state === 'punch') {
        p2Stickman.querySelector('.left-arm').style.animation = 'punch-arm 0.3s forwards';
    } else if (gameState.player2.state === 'kick') {
        p2Stickman.querySelector('.left-leg').style.animation = 'kick-leg 0.3s forwards';
    }
}

// Reset all animations
function resetAnimations(stickman) {
    stickman.querySelectorAll('.left-arm, .left-leg').forEach(part => {
        part.style.animation = '';
    });
}

// Handle keyboard input
function handleKeyDown(e) {
    if (!gameState.gameActive) return;
    
    // Player 1 controls
    if (e.key === 'a' || e.key === 'A') {
        gameState.player1.position = Math.max(50, gameState.player1.position - 10);
    } else if (e.key === 'd' || e.key === 'D') {
        gameState.player1.position = Math.min(500, gameState.player1.position + 10);
    } else if (e.key === 'j' || e.key === 'J') {
        executeMove(gameState.player1, 'punch', gameState.player2);
    } else if (e.key === 'k' || e.key === 'K') {
        executeMove(gameState.player1, 'kick', gameState.player2);
    } else if (e.key === 'l' || e.key === 'L') {
        executeMove(gameState.player1, 'special', gameState.player2);
    }
    
    // Player 2 controls
    if (e.key === 'ArrowLeft') {
        gameState.player2.position = Math.max(50, gameState.player2.position - 10);
    } else if (e.key === 'ArrowRight') {
        gameState.player2.position = Math.min(500, gameState.player2.position + 10);
    } else if (e.key === '1') {
        executeMove(gameState.player2, 'punch', gameState.player1);
    } else if (e.key === '2') {
        executeMove(gameState.player2, 'kick', gameState.player1);
    } else if (e.key === '3') {
        executeMove(gameState.player2, 'special', gameState.player1);
    }
}

// Execute a move
function executeMove(player, moveType, opponent) {
    if (player.moveTimer > 0) return; // Can't move while in recovery
    
    const move = player.character.moves[moveType];
    player.state = moveType;
    player.lastMove = moveType;
    player.moveTimer = move.startup + move.recovery;
    
    // Play sound effect
    playSound(move.sound);
    
    // Record move for combo
    player.comboSequence.push(moveType);
    player.lastComboTime = Date.now();
    
    // Check for hit
    const distance = Math.abs(gameState.player1.position - (800 - gameState.player2.position));
    if (distance < 150) {
        // Hit detected
        let damage = move.damage;
        
        // Apply combo multiplier
        if (player.comboCount > 0) {
            damage *= (1 + player.comboCount * 0.1);
        }
        
        opponent.health = Math.max(0, opponent.health - damage);
        
        // Create hit effect
        createHitEffect(opponent === gameState.player1 ? player1Element : player2Element);
        
        // Add to combo count
        player.comboCount++;
        
        // Update combo display
        if (player.comboCount > 1) {
            comboDisplay.textContent = `COMBO ${player.comboCount}x!`;
            comboDisplay.classList.add('active');
            
            // Hide combo display after delay
            setTimeout(() => {
                comboDisplay.classList.remove('active');
            }, 1500);
        }
        
        // Shake effect on hit
        const opponentElement = opponent === gameState.player1 ? player1Element : player2Element;
        opponentElement.style.animation = 'shake 0.5s';
        setTimeout(() => {
            opponentElement.style.animation = '';
        }, 500);
    } else {
        // Reset combo if miss
        player.comboCount = 0;
    }
    
    // Special effect for special moves
    if (moveType === 'special') {
        createSpecialEffect(player === gameState.player1 ? player1Element : player2Element);
    }
    
    updateHealthBars();
}

// Check for combos
function checkCombos() {
    const now = Date.now();
    
    // Check player 1 combos
    if (gameState.player1.comboSequence.length > 0 && 
        (now - gameState.player1.lastComboTime) > 2000) {
        // Timeout for combo
        gameState.player1.comboSequence = [];
        gameState.player1.comboCount = 0;
    }
    
    // Check player 2 combos
    if (gameState.player2.comboSequence.length > 0 && 
        (now - gameState.player2.lastComboTime) > 2000) {
        // Timeout for combo
        gameState.player2.comboSequence = [];
        gameState.player2.comboCount = 0;
    }
}

// Create hit effect
function createHitEffect(element) {
    const rect = element.getBoundingClientRect();
    const effect = document.createElement('div');
    effect.className = 'hit-effect';
    effect.style.left = `${rect.left + rect.width / 2 - 50}px`;
    effect.style.top = `${rect.top + rect.height / 2 - 50}px`;
    document.querySelector('.stage').appendChild(effect);
    
    // Animate
    effect.style.animation = 'hit 0.5s forwards';
    
    // Remove after animation
    setTimeout(() => {
        effect.remove();
    }, 500);
}

// Create special effect
function createSpecialEffect(element) {
    const rect = element.getBoundingClientRect();
    const fireball = document.createElement('div');
    fireball.className = 'fireball';
    
    if (element === player1Element) {
        fireball.style.left = `${rect.right}px`;
    } else {
        fireball.style.right = `${rect.left}px`;
    }
    
    fireball.style.top = `${rect.top + rect.height / 2 - 20}px`;
    document.querySelector('.stage').appendChild(fireball);
    
    // Animate
    fireball.style.animation = 'fireball 1s forwards';
    
    // Remove after animation
    setTimeout(() => {
        fireball.remove();
    }, 1000);
}

// Update health bars
function updateHealthBars() {
    const p1HealthPercent = (gameState.player1.health / gameState.player1.character.health) * 100;
    const p2HealthPercent = (gameState.player2.health / gameState.player2.character.health) * 100;
    
    p1HealthElement.style.width = `${p1HealthPercent}%`;
    p2HealthElement.style.width = `${p2HealthPercent}%`;
    
    p1HealthValue.textContent = Math.floor(gameState.player1.health);
    p2HealthValue.textContent = Math.floor(gameState.player2.health);
    
    // Check for winner
    if (gameState.player1.health <= 0 || gameState.player2.health <= 0) {
        endGame();
    }
}

// End the game
function endGame() {
    gameState.gameActive = false;
    cancelAnimationFrame(gameState.gameLoopId);
    
    const winner = gameState.player1.health > 0 ? 
        gameState.player1.character.name : 
        gameState.player2.character.name;
    
    setTimeout(() => {
        alert(`Game Over! ${winner} wins!`);
    }, 500);
}

// Initialize the game when loaded
window.addEventListener('DOMContentLoaded', initGame);