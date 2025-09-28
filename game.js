// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.avatarImages = {}; // Cache for loaded avatar images
        
        // Camera/viewport
        this.cameraX = 0;
        this.cameraY = 0;
        this.avatarSize = 48; // Size for rendering avatars
        
        // WebSocket
        this.socket = null;
        
        // Movement
        this.keysPressed = {};
        this.movementInterval = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
        this.updateUI();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window (accounting for status bar)
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight - 40; // Subtract status bar height
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight - 40;
            this.updateCamera();
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.updateConnectionStatus('connected');
            this.joinGame();
        };
        
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
            this.updateConnectionStatus('disconnected');
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'May'
        };
        
        this.socket.send(JSON.stringify(joinMessage));
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.keysPressed[event.code] = true;
            this.handleMovement();
        });
        
        document.addEventListener('keyup', (event) => {
            this.keysPressed[event.code] = false;
            this.handleMovement();
        });
    }
    
    handleMovement() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        
        let direction = null;
        
        if (this.keysPressed['ArrowUp']) {
            direction = 'up';
        } else if (this.keysPressed['ArrowDown']) {
            direction = 'down';
        } else if (this.keysPressed['ArrowLeft']) {
            direction = 'left';
        } else if (this.keysPressed['ArrowRight']) {
            direction = 'right';
        }
        
        if (direction) {
            const moveMessage = {
                action: 'move',
                direction: direction
            };
            this.socket.send(JSON.stringify(moveMessage));
        } else {
            // No keys pressed, send stop message
            const stopMessage = {
                action: 'stop'
            };
            this.socket.send(JSON.stringify(stopMessage));
        }
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.loadAvatarImages();
                    this.updateCamera();
                    this.updateUI();
                    this.draw();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImage(message.avatar);
                this.updateUI();
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateCamera();
                this.updateUI();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.updateUI();
                this.draw();
                break;
        }
    }
    
    loadAvatarImages() {
        Object.values(this.avatars).forEach(avatar => {
            this.loadAvatarImage(avatar);
        });
    }
    
    loadAvatarImage(avatar) {
        const avatarKey = avatar.name;
        if (this.avatarImages[avatarKey]) return; // Already loaded
        
        this.avatarImages[avatarKey] = {};
        
        // Load all frames for each direction
        ['north', 'south', 'east'].forEach(direction => {
            this.avatarImages[avatarKey][direction] = [];
            avatar.frames[direction].forEach((frameData, index) => {
                const img = new Image();
                img.onload = () => {
                    this.avatarImages[avatarKey][direction][index] = img;
                    this.draw(); // Redraw when new image loads
                };
                img.src = frameData;
            });
        });
    }
    
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status;
        statusElement.className = status;
    }
    
    updateUI() {
        // Update world info
        document.getElementById('worldInfo').textContent = `${this.worldWidth}×${this.worldHeight}`;
        
        // Update player count
        const playerCount = Object.keys(this.players).length;
        document.getElementById('playerCount').textContent = playerCount;
        
        // Update player position
        if (this.myPlayerId && this.players[this.myPlayerId]) {
            const myPlayer = this.players[this.myPlayerId];
            document.getElementById('playerPosition').textContent = `(${Math.round(myPlayer.x)}, ${Math.round(myPlayer.y)})`;
        } else {
            document.getElementById('playerPosition').textContent = '(0, 0)';
        }
    }
    
    updateCamera() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        
        // Center camera on player
        this.cameraX = myPlayer.x - this.canvas.width / 2;
        this.cameraY = myPlayer.y - this.canvas.height / 2;
        
        // Clamp camera to world bounds
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - this.canvas.width));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - this.canvas.height));
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }
    
    isVisible(worldX, worldY) {
        const screen = this.worldToScreen(worldX, worldY);
        return screen.x >= -this.avatarSize && 
               screen.x <= this.canvas.width + this.avatarSize &&
               screen.y >= -this.avatarSize && 
               screen.y <= this.canvas.height + this.avatarSize;
    }
    
    drawAvatar(player) {
        if (!this.isVisible(player.x, player.y)) return;
        
        const screen = this.worldToScreen(player.x, player.y);
        const avatar = this.avatars[player.avatar];
        if (!avatar || !this.avatarImages[player.avatar]) return;
        
        // Get the appropriate frame based on facing direction and animation frame
        let direction = player.facing;
        let frameIndex = player.animationFrame || 0;
        
        // Handle west direction by flipping east frames
        let flipHorizontal = false;
        if (direction === 'west') {
            direction = 'east';
            flipHorizontal = true;
        }
        
        const frames = this.avatarImages[player.avatar][direction];
        if (!frames || !frames[frameIndex]) return;
        
        const img = frames[frameIndex];
        
        // Calculate avatar size maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        const avatarWidth = this.avatarSize;
        const avatarHeight = this.avatarSize / aspectRatio;
        
        // Center avatar on player position
        const x = screen.x - avatarWidth / 2;
        const y = screen.y - avatarHeight;
        
        this.ctx.save();
        
        if (flipHorizontal) {
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(img, -x - avatarWidth, y, avatarWidth, avatarHeight);
        } else {
            this.ctx.drawImage(img, x, y, avatarWidth, avatarHeight);
        }
        
        this.ctx.restore();
        
        // Draw username label
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        
        const textX = screen.x;
        const textY = y - 5;
        
        // Draw text outline
        this.ctx.strokeText(player.username, textX, textY);
        // Draw text fill
        this.ctx.fillText(player.username, textX, textY);
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.canvas.width, this.canvas.height,  // Source rectangle
            0, 0, this.canvas.width, this.canvas.height   // Destination rectangle
        );
        
        // Draw all players
        Object.values(this.players).forEach(player => {
            this.drawAvatar(player);
        });
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
