document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    setupEventListeners();
});

// Game Data
let currentGame = null;
let gameInterval = null;
let score = 0;
let timeLeft = 120;

// Load Games from Supabase
async function loadGames() {
    try {
        const { data: games, error } = await supabase
            .from('games')
            .select('*');
        
        const lobby = document.getElementById('gameLobby');
        games.forEach(game => {
            lobby.innerHTML += `
                <div class="game-card" data-id="${game.id}">
                    <div class="game-preview" style="background-image: url('${game.thumbnail}')">
                        <div class="game-overlay">
                            <button class="btn primary" data-game="${game.id}">Play</button>
                        </div>
                    </div>
                    <h3>${game.name}</h3>
                    <div class="game-meta">
                        <span>${game.difficulty}</span>
                        <span>🏆 ${game.high_score || 0}</span>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        showError('Failed to load games');
    }
}

// Formation Game Logic
function initializeFormationGame() {
    const positions = [
        { top: 20, left: 30, number: 1 },
        { top: 40, left: 20, number: 2 },
        { top: 40, left: 80, number: 3 }
    ];

    const builder = document.getElementById('formationBuilder');
    builder.innerHTML = '';
    
    positions.forEach(pos => {
        const dot = document.createElement('div');
        dot.className = 'player-dot';
        dot.style.top = `${pos.top}%`;
        dot.style.left = `${pos.left}%`;
        dot.textContent = pos.number;
        dot.draggable = true;
        
        dot.addEventListener('dragstart', handleDragStart);
        dot.addEventListener('dragover', handleDragOver);
        dot.addEventListener('drop', handleDrop);
        
        builder.appendChild(dot);
    });

    startTimer();
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.id);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text');
    const draggable = document.getElementById(id);
    const dropzone = e.target;
    
    if(dropzone.classList.contains('player-dot')) {
        const temp = {
            top: draggable.style.top,
            left: draggable.style.left
        };
        
        draggable.style.top = dropzone.style.top;
        draggable.style.left = dropzone.style.left;
        dropzone.style.top = temp.top;
        dropzone.style.left = temp.left;
        score += 10;
        updateScore();
    }
}

// Transfer Quiz Logic
async function initializeTransferQuiz() {
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('*')
            .limit(2);
        
        const container = document.getElementById('transferQuizContainer');
        container.innerHTML = players.map(player => `
            <div class="player-card">
                <img src="${player.image}" alt="${player.name}">
                <h4>${player.name}</h4>
                <ul class="player-stats">
                    <li>Age: ${player.age}</li>
                    <li>Goals: ${player.goals}</li>
                    <li>Assists: ${player.assists}</li>
                </ul>
                <input type="number" class="value-input" placeholder="Value in €">
                <button class="btn primary" onclick="checkValue(${player.actual_value}, this)">
                    Submit
                </button>
            </div>
        `).join('');
    } catch (error) {
        showError('Failed to load players');
    }
}

function checkValue(actualValue, button) {
    const input = button.previousElementSibling;
    const guess = parseInt(input.value);
    const difference = Math.abs(actualValue - guess);
    
    if(difference < 5000000) {
        score += 100;
        button.style.backgroundColor = '#2ecc71';
    } else {
        score += Math.max(0, 100 - Math.floor(difference/1000000));
        button.style.backgroundColor = '#e74c3c';
    }
    
    setTimeout(() => {
        button.style.backgroundColor = '';
    }, 1000);
    
    updateScore();
    input.value = '';
}

// Game Management
function startGame(gameId) {
    currentGame = gameId;
    document.querySelectorAll('.game-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${gameId}Game`).classList.remove('hidden');
    
    switch(gameId) {
        case 'formation':
            initializeFormationGame();
            break;
        case 'transfer':
            initializeTransferQuiz();
            break;
    }
}

function exitGame() {
    currentGame = null;
    clearInterval(gameInterval);
    document.querySelectorAll('.game-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('gameLobby').classList.remove('hidden');
    submitScore();
    resetGame();
}

function startTimer() {
    timeLeft = 120;
    gameInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('formationTimer').textContent = 
            `${Math.floor(timeLeft/60).toString().padStart(2,'0')}:${(timeLeft%60).toString().padStart(2,'0')}`;
        
        if(timeLeft <= 0) exitGame();
    }, 1000);
}

async function submitScore() {
    try {
        const { error } = await supabase
            .from('scores')
            .insert([{
                game_id: currentGame,
                score: score,
                user_id: (await supabase.auth.getUser()).data.user?.id
            }]);
        
        if(!error) updateLeaderboards();
    } catch (error) {
        showError('Failed to submit score');
    }
}

// Leaderboards
async function updateLeaderboards() {
    try {
        const { data: scores, error } = await supabase
            .from('scores')
            .select('*, profiles(username)')
            .order('score', { ascending: false })
            .limit(10);
        
        const boards = document.querySelectorAll('.leaderboard');
        boards.forEach(board => {
            board.innerHTML = scores.map((score, index) => `
                <div class="leaderboard-item">
                    <span>#${index+1} ${score.profiles.username}</span>
                    <span>${score.score} pts</span>
                </div>
            `).join('');
        });
    } catch (error) {
        showError('Failed to load leaderboards');
    }
}

// Helpers
function updateScore() {
    document.getElementById(`${currentGame}Score`).textContent = `Score: ${score}`;
}

function resetGame() {
    score = 0;
    timeLeft = 120;
    updateScore();
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Event Listeners
function setupEventListeners() {
    document.querySelectorAll('.game-card button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameId = e.target.dataset.game;
            startGame(gameId);
        });
    });
}
