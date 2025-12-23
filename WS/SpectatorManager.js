
// ----	--------------------------------------------	--------------------------------------------	
// 		SPECTATOR MANAGER - presence, disturbances, betting
// ----	--------------------------------------------	--------------------------------------------	

var CONFIG = {
    DISTURB_COOLDOWN_MS: 15000,
    STARTING_POINTS: 100,
    BET_MULTIPLIER: 2
};

var WHISPER_PRESETS = [
    "hmm... risky",
    "are you sure?",
    "don't miss that corner",
    "interesting...",
    "oh no..."
];

var DISTURB_TYPES = {
    NUDGE: 'nudge',
    FOG: 'fog',
    WHISPER: 'whisper',
    TAP: 'tap'
};

// ----	--------------------------------------------	--------------------------------------------	

function SpectatorManager() {
    this.rooms = new Map();
    this.spectators = new Map();
    this.spectatorPoints = new Map();
}

// ----	--------------------------------------------	--------------------------------------------	

SpectatorManager.prototype.getOrCreateRoom = function(roomId) {
    if (!this.rooms.has(roomId)) {
        this.rooms.set(roomId, {
            id: roomId,
            spectators: new Set(),
            players: { player1: null, player2: null },
            bets: new Map(),
            mutedByPlayers: new Set(),
            activeDisturbance: null,
            gameEnded: false
        });
    }
    return this.rooms.get(roomId);
};

SpectatorManager.prototype.registerPlayers = function(roomId, player1, player2) {
    var room = this.getOrCreateRoom(roomId);
    room.players.player1 = player1;
    room.players.player2 = player2;
    room.gameEnded = false;
};

// ----	--------------------------------------------	--------------------------------------------	

SpectatorManager.prototype.joinRoom = function(socketId, roomId, name) {
    var room = this.getOrCreateRoom(roomId);
    
    this.spectators.set(socketId, {
        socketId: socketId,
        name: name,
        roomId: roomId,
        lastDisturbTime: 0
    });
    
    room.spectators.add(socketId);
    
    if (!this.spectatorPoints.has(socketId)) {
        this.spectatorPoints.set(socketId, CONFIG.STARTING_POINTS);
    }
    
    return {
        success: true,
        spectatorCount: room.spectators.size,
        points: this.spectatorPoints.get(socketId)
    };
};

SpectatorManager.prototype.leaveRoom = function(socketId) {
    var spectator = this.spectators.get(socketId);
    if (!spectator) return null;
    
    var room = this.rooms.get(spectator.roomId);
    if (!room) {
        this.spectators.delete(socketId);
        return null;
    }
    
    room.spectators.delete(socketId);
    room.bets.delete(socketId);
    
    var result = {
        roomId: spectator.roomId,
        spectatorCount: room.spectators.size
    };
    
    this.spectators.delete(socketId);
    return result;
};

// ----	--------------------------------------------	--------------------------------------------	

SpectatorManager.prototype.canDisturb = function(socketId) {
    var spectator = this.spectators.get(socketId);
    if (!spectator) return { allowed: false, reason: 'not_spectating' };
    
    var room = this.rooms.get(spectator.roomId);
    if (!room) return { allowed: false, reason: 'room_not_found' };
    if (room.gameEnded) return { allowed: false, reason: 'game_ended' };
    if (room.mutedByPlayers.size >= 2) return { allowed: false, reason: 'muted_by_players' };
    if (room.activeDisturbance) return { allowed: false, reason: 'disturbance_active' };
    
    var timeSinceLastDisturb = Date.now() - spectator.lastDisturbTime;
    if (timeSinceLastDisturb < CONFIG.DISTURB_COOLDOWN_MS) {
        return { 
            allowed: false, 
            reason: 'cooldown',
            remainingMs: CONFIG.DISTURB_COOLDOWN_MS - timeSinceLastDisturb
        };
    }
    
    return { allowed: true };
};

SpectatorManager.prototype.recordDisturb = function(socketId, type) {
    var spectator = this.spectators.get(socketId);
    if (!spectator) return null;
    
    var room = this.rooms.get(spectator.roomId);
    if (!room) return null;
    
    spectator.lastDisturbTime = Date.now();
    
    var disturbData = {
        type: type,
        side: Math.random() < 0.5 ? 'left' : 'right',
        from: spectator.name,
        whisperText: type === DISTURB_TYPES.WHISPER 
            ? WHISPER_PRESETS[Math.floor(Math.random() * WHISPER_PRESETS.length)] 
            : null,
        intensity: this.calculateIntensity(room.spectators.size),
        roomId: spectator.roomId
    };
    
    room.activeDisturbance = disturbData;
    setTimeout(function() { room.activeDisturbance = null; }, 500);
    
    return disturbData;
};

SpectatorManager.prototype.calculateIntensity = function(count) {
    if (count >= 5) return 3;
    if (count >= 3) return 2;
    return 1;
};

// ----	--------------------------------------------	--------------------------------------------	

SpectatorManager.prototype.placeBet = function(socketId, playerId, amount) {
    var spectator = this.spectators.get(socketId);
    if (!spectator) return { success: false, reason: 'not_spectating' };
    
    var room = this.rooms.get(spectator.roomId);
    if (!room) return { success: false, reason: 'room_not_found' };
    if (room.gameEnded) return { success: false, reason: 'game_ended' };
    
    var currentPoints = this.spectatorPoints.get(socketId) || CONFIG.STARTING_POINTS;
    
    var existingBet = room.bets.get(socketId);
    if (existingBet) currentPoints += existingBet.amount;
    
    if (amount > currentPoints) return { success: false, reason: 'insufficient_points', available: currentPoints };
    if (amount <= 0) return { success: false, reason: 'invalid_amount' };
    
    room.bets.set(socketId, { name: spectator.name, playerId: playerId, amount: amount });
    this.spectatorPoints.set(socketId, currentPoints - amount);
    
    return {
        success: true,
        bet: room.bets.get(socketId),
        remainingPoints: this.spectatorPoints.get(socketId),
        roomBets: this.getRoomBets(spectator.roomId)
    };
};

SpectatorManager.prototype.changeBet = function(socketId, newPlayerId) {
    var spectator = this.spectators.get(socketId);
    if (!spectator) return { success: false, reason: 'not_spectating' };
    
    var room = this.rooms.get(spectator.roomId);
    if (!room) return { success: false, reason: 'room_not_found' };
    
    var existingBet = room.bets.get(socketId);
    if (!existingBet) return { success: false, reason: 'no_existing_bet' };
    if (room.gameEnded) return { success: false, reason: 'game_ended' };
    
    var oldPlayerId = existingBet.playerId;
    existingBet.playerId = newPlayerId;
    
    return {
        success: true,
        switched: true,
        from: oldPlayerId,
        to: newPlayerId,
        roomBets: this.getRoomBets(spectator.roomId)
    };
};

SpectatorManager.prototype.getRoomBets = function(roomId) {
    var room = this.rooms.get(roomId);
    if (!room) return { byPlayer: {}, totals: {} };
    
    var result = { byPlayer: {}, totals: {} };
    
    room.bets.forEach(function(bet) {
        if (!result.byPlayer[bet.playerId]) {
            result.byPlayer[bet.playerId] = [];
            result.totals[bet.playerId] = 0;
        }
        result.byPlayer[bet.playerId].push({ name: bet.name, amount: bet.amount });
        result.totals[bet.playerId] += bet.amount;
    });
    
    return result;
};

SpectatorManager.prototype.settleBets = function(roomId, winnerId) {
    var room = this.rooms.get(roomId);
    if (!room) return {};
    
    room.gameEnded = true;
    var results = {};
    var self = this;
    
    room.bets.forEach(function(bet, socketId) {
        var currentPoints = self.spectatorPoints.get(socketId) || 0;
        
        if (winnerId === null) {
            self.spectatorPoints.set(socketId, currentPoints + bet.amount);
            results[socketId] = { won: null, payout: bet.amount };
        } else if (bet.playerId === winnerId) {
            var payout = bet.amount * CONFIG.BET_MULTIPLIER;
            self.spectatorPoints.set(socketId, currentPoints + payout);
            results[socketId] = { won: true, payout: payout };
        } else {
            results[socketId] = { won: false, payout: 0 };
        }
    });
    
    return results;
};

// ----	--------------------------------------------	--------------------------------------------	

SpectatorManager.prototype.getSpectatorPoints = function(socketId) {
    return this.spectatorPoints.get(socketId) || CONFIG.STARTING_POINTS;
};

SpectatorManager.prototype.setPlayerMute = function(roomId, playerSocketId, muted) {
    var room = this.rooms.get(roomId);
    if (!room) return;
    
    if (muted) {
        room.mutedByPlayers.add(playerSocketId);
    } else {
        room.mutedByPlayers.delete(playerSocketId);
    }
};

SpectatorManager.prototype.setGameWinningState = function(roomId, isWinning) {
    var room = this.rooms.get(roomId);
    if (room) room.gameEnded = isWinning;
};

SpectatorManager.prototype.isGameWinning = function(roomId) {
    var room = this.rooms.get(roomId);
    return room ? room.gameEnded : false;
};

SpectatorManager.prototype.getRoomSpectators = function(roomId) {
    var room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.spectators);
};

SpectatorManager.prototype.cleanupRoom = function(roomId) {
    var room = this.rooms.get(roomId);
    if (!room) return;
    
    var self = this;
    room.spectators.forEach(function(socketId) {
        self.spectators.delete(socketId);
    });
    this.rooms.delete(roomId);
};

SpectatorManager.prototype.getConfig = function() {
    return {
        disturbCooldownMs: CONFIG.DISTURB_COOLDOWN_MS,
        startingPoints: CONFIG.STARTING_POINTS,
        betMultiplier: CONFIG.BET_MULTIPLIER,
        whisperPresets: WHISPER_PRESETS,
        disturbTypes: Object.values(DISTURB_TYPES)
    };
};

// ----	--------------------------------------------	--------------------------------------------	

module.exports = {
    SpectatorManager: SpectatorManager,
    DISTURB_TYPES: DISTURB_TYPES,
    WHISPER_PRESETS: WHISPER_PRESETS,
    CONFIG: CONFIG
};
