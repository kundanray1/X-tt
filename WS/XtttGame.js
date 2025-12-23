
// ----	--------------------------------------------	--------------------------------------------	
// 		GAME LOGIC
// ----	--------------------------------------------	--------------------------------------------	

var GameStore = require('./GameStore');

var playerSockets = {};

// ----	--------------------------------------------	--------------------------------------------	

function onNewPlayer(data) {

	console.log("New player has joined: "+data.name);

	var newPlayer = new Player(-1, data.name, "looking");
	newPlayer.sockid = this.id;
	this.player = newPlayer;

	players.push(newPlayer);
	players_avail.push(newPlayer);

	pair_avail_players();
};

// ----	--------------------------------------------	--------------------------------------------	

function pair_avail_players() {

	if (players_avail.length < 2) return;

	var p1 = players_avail.shift();
	var p2 = players_avail.shift();

	p1.mode = 'm';
	p2.mode = 's';
	p1.status = 'paired';
	p2.status = 'paired';
	p1.opp = p2;
	p2.opp = p1;

	var roomId = GameStore.createRoom(p1.name, p2.name, p1.sockid, p2.sockid);
	p1.roomId = roomId;
	p2.roomId = roomId;
	
	playerSockets[p1.sockid] = p1;
	playerSockets[p2.sockid] = p2;

	spectatorManager.registerPlayers(roomId, p1.sockid, p2.sockid);

	io.to(p1.sockid).emit("pair_players", {opp: {name:p2.name, uid:p2.uid}, mode:'m', roomId: roomId});
	io.to(p2.sockid).emit("pair_players", {opp: {name:p1.name, uid:p1.uid}, mode:'s', roomId: roomId});

	io.emit("room_available", { roomId: roomId, players: [p1.name, p2.name] });

	console.log("Game started - room: " + roomId + " - " + p1.name + " vs " + p2.name);
};

// ----	--------------------------------------------	--------------------------------------------	

function onCreateRoom(data) {

	var name = data.name;
	var gameType = data.gameType || 'computer';

	var roomId = GameStore.createRoom(name, 'Computer', this.id, 'computer');
	
	this.player = { name: name, sockid: this.id, roomId: roomId };
	playerSockets[this.id] = this.player;

	spectatorManager.registerPlayers(roomId, this.id, 'computer');

	this.emit("room_created", { roomId: roomId });

	io.emit("room_available", { 
		roomId: roomId, 
		players: [name, 'Computer'],
		gameType: gameType
	});

	console.log("Computer game room created - room: " + roomId + " - " + name + " vs Computer");
};

// ----	--------------------------------------------	--------------------------------------------	

function onTurn(data) {

	io.to(this.player.opp.sockid).emit("opp_turn", {cell_id: data.cell_id});

	if (this.player.roomId) {
		var spectators = spectatorManager.getRoomSpectators(this.player.roomId);
		var self = this;
		spectators.forEach(function(specId) {
			io.to(specId).emit("game:turn", { player: self.player.name, cell_id: data.cell_id });
		});
	}

	console.log("turn - " + this.player.name + " - cell: " + data.cell_id);
};

// ----	--------------------------------------------	--------------------------------------------	

function onGameEnd(data) {

	var roomId = this.player.roomId;
	if (!roomId) return;

	spectatorManager.setGameWinningState(roomId, true);

	var winnerId = null;
	if (data.winner === 'self') winnerId = this.player.sockid;
	else if (data.winner === 'opp') winnerId = this.player.opp.sockid;

	var betResults = spectatorManager.settleBets(roomId, winnerId);

	var spectators = spectatorManager.getRoomSpectators(roomId);
	spectators.forEach(function(specId) {
		var result = betResults[specId] || { won: false, payout: 0 };
		io.to(specId).emit("game:end", { winner: data.winner, result: result });
	});

	spectatorManager.cleanupRoom(roomId);
	GameStore.deleteRoom(roomId);
	delete playerSockets[this.player.sockid];
	if (this.player.opp) delete playerSockets[this.player.opp.sockid];
	io.emit("room_closed", { roomId: roomId });

	console.log("Game ended - room: " + roomId);
};

// ----	--------------------------------------------	--------------------------------------------	

function onClientDisconnect() {

	var removePlayer = this.player;
	
	spectatorManager.leaveRoom(this.id);

	if (!removePlayer) return;

	players.splice(players.indexOf(removePlayer), 1);
	players_avail.splice(players_avail.indexOf(removePlayer), 1);

	if (removePlayer.opp) {
		io.to(removePlayer.opp.sockid).emit("opp_disconnected");
	}

	if (removePlayer.roomId) {
		spectatorManager.cleanupRoom(removePlayer.roomId);
		GameStore.deleteRoom(removePlayer.roomId);
		io.emit("room_closed", { roomId: removePlayer.roomId });
	}

	delete playerSockets[this.id];

	console.log("Player disconnected: " + this.id);
};

// ----	--------------------------------------------	--------------------------------------------	

function onGetRooms() {

	var rooms = GameStore.getAllRooms();
	this.emit("rooms:list", rooms);
};

// ----	--------------------------------------------	--------------------------------------------	
// 		SPECTATOR HANDLERS
// ----	--------------------------------------------	--------------------------------------------	

function onSpectatorJoin(data) {

	var roomId = data.roomId;
	var name = data.name || 'Spectator';

	var room = GameStore.getRoom(roomId);
	if (!room) {
		this.emit("spectator:error", { message: "Room not found" });
		return;
	}

	spectatorManager.joinRoom(this.id, roomId, name);
	this.spectatorRoom = roomId;
	this.spectatorName = name;

	var bets = spectatorManager.getRoomBets(roomId);
	var points = spectatorManager.getSpectatorPoints(this.id);
	
	this.emit("spectator:joined", {
		roomId: roomId,
		players: [
			{ name: room.players[0].name, id: room.players[0].sockId },
			{ name: room.players[1].name, id: room.players[1].sockId }
		],
		bets: bets,
		yourPoints: points
	});

	var spectators = spectatorManager.getRoomSpectators(roomId);
	GameStore.updateSpectatorCount(roomId, spectators.length);
	notifySpectatorCount(roomId);
};

// ----	--------------------------------------------	--------------------------------------------	

function onSpectatorDisturb(data) {

	var roomId = this.spectatorRoom;
	if (!roomId) return;

	if (!spectatorManager.canDisturb(this.id).allowed) {
		this.emit("spectator:cooldown", { remaining: 15 });
		return;
	}

	if (spectatorManager.isGameWinning(roomId)) return;

	var room = GameStore.getRoom(roomId);
	if (!room) return;

	spectatorManager.recordDisturb(this.id);

	var disturbData = {
		type: data.type || 'nudge',
		side: Math.random() > 0.5 ? 'left' : 'right',
		from: this.spectatorName
	};

	io.to(room.players[0].sockId).emit("spectator:disturb", disturbData);
	io.to(room.players[1].sockId).emit("spectator:disturb", disturbData);
};

// ----	--------------------------------------------	--------------------------------------------	

function onSpectatorBet(data) {

	var roomId = this.spectatorRoom;
	if (!roomId) return;

	var result = spectatorManager.placeBet(this.id, data.playerId, data.amount);
	
	if (result.success) {
		this.emit("bet:placed", { playerId: data.playerId, amount: data.amount, yourPoints: result.remainingPoints });
		notifyBetUpdate(roomId);
	} else {
		this.emit("bet:error", { message: result.reason });
	}
};

// ----	--------------------------------------------	--------------------------------------------	

function onSpectatorChangeBet(data) {

	var roomId = this.spectatorRoom;
	if (!roomId) return;

	var result = spectatorManager.changeBet(this.id, data.playerId);
	
	if (result.success) {
		this.emit("bet:changed", { playerId: data.playerId });
		notifyBetSwitch(roomId, this.spectatorName, data.playerId);
		notifyBetUpdate(roomId);
	} else {
		this.emit("bet:error", { message: result.reason });
	}
};

// ----	--------------------------------------------	--------------------------------------------	

function onPlayerMute(data) {

	var roomId = this.player.roomId;
	if (!roomId) return;

	spectatorManager.setPlayerMute(roomId, this.player.sockid, data.muted);
};

// ----	--------------------------------------------	--------------------------------------------	
// 		HELPERS
// ----	--------------------------------------------	--------------------------------------------	

function notifySpectatorCount(roomId) {
	var room = GameStore.getRoom(roomId);
	if (!room) return;

	var spectators = spectatorManager.getRoomSpectators(roomId);
	var count = spectators.length;

	io.to(room.players[0].sockId).emit("spectator:count", { count: count });
	io.to(room.players[1].sockId).emit("spectator:count", { count: count });
}

function notifyBetUpdate(roomId) {
	var room = GameStore.getRoom(roomId);
	if (!room) return;

	var bets = spectatorManager.getRoomBets(roomId);
	var p1Id = room.players[0].sockId;
	var p2Id = room.players[1].sockId;

	io.to(p1Id).emit("bet:update", { supporters: bets.byPlayer[p1Id] || [], total: bets.totals[p1Id] || 0 });
	io.to(p2Id).emit("bet:update", { supporters: bets.byPlayer[p2Id] || [], total: bets.totals[p2Id] || 0 });
}

function notifyBetSwitch(roomId, spectatorName, newPlayerId) {
	var room = GameStore.getRoom(roomId);
	if (!room) return;

	io.to(room.players[0].sockId).emit("bet:switch", { name: spectatorName, to: newPlayerId });
	io.to(room.players[1].sockId).emit("bet:switch", { name: spectatorName, to: newPlayerId });
}

// ----	--------------------------------------------	--------------------------------------------	
// 		SOCKET WIRING
// ----	--------------------------------------------	--------------------------------------------	

set_game_sock_handlers = function (socket) {

	socket.on("new player", onNewPlayer);
	socket.on("create_room", onCreateRoom);
	socket.on("ply_turn", onTurn);
	socket.on("game_end", onGameEnd);
	socket.on("get_rooms", onGetRooms);

	socket.on("spectator:join", onSpectatorJoin);
	socket.on("spectator:disturb", onSpectatorDisturb);
	socket.on("spectator:bet", onSpectatorBet);
	socket.on("spectator:change_bet", onSpectatorChangeBet);

	socket.on("player:mute", onPlayerMute);

	socket.on("disconnect", onClientDisconnect);
};
