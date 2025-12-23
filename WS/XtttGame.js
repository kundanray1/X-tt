
// ----	--------------------------------------------	--------------------------------------------	
// ----	--------------------------------------------	--------------------------------------------	

// Game store for persistence
var GameStore = require('./GameStore');

// In-memory socket mapping (sockId -> player object)
var playerSockets = {};

// ----	--------------------------------------------	--------------------------------------------	

// New player has joined
function onNewPlayer(data) {

	console.log("New player has joined: "+data.name);

	// Create a new player
	var newPlayer = new Player(-1, data.name, "looking");
	newPlayer.sockid = this.id;

	this.player = newPlayer;

	// Add new player to the players array
	players.push(newPlayer);
	players_avail.push(newPlayer);

	pair_avail_players();

};

// ----	--------------------------------------------	--------------------------------------------	

function pair_avail_players() {

	if (players_avail.length < 2)
		return;

	var p1 = players_avail.shift();
	var p2 = players_avail.shift();

	p1.mode = 'm';
	p2.mode = 's';
	p1.status = 'paired';
	p2.status = 'paired';
	p1.opp = p2;
	p2.opp = p1;

	// Create room in store
	var roomId = GameStore.createRoom(p1.name, p2.name, p1.sockid, p2.sockid);
	p1.roomId = roomId;
	p2.roomId = roomId;
	
	// Track socket mappings
	playerSockets[p1.sockid] = p1;
	playerSockets[p2.sockid] = p2;

	io.to(p1.sockid).emit("pair_players", {opp: {name:p2.name, uid:p2.uid}, mode:'m', roomId: roomId});
	io.to(p2.sockid).emit("pair_players", {opp: {name:p1.name, uid:p1.uid}, mode:'s', roomId: roomId});

	// Broadcast available room for spectators
	io.emit("room_available", { roomId: roomId, players: [p1.name, p2.name] });

	console.log("Game started - room: " + roomId + " - " + p1.name + " vs " + p2.name);

};

// ----	--------------------------------------------	--------------------------------------------	

function onTurn(data) {

	io.to(this.player.opp.sockid).emit("opp_turn", {cell_id: data.cell_id});

	console.log("turn - " + this.player.name + " - cell: " + data.cell_id);

};

// ----	--------------------------------------------	--------------------------------------------	
// ----	--------------------------------------------	--------------------------------------------	

// Socket client has disconnected
function onClientDisconnect() {

	var removePlayer = this.player;

	if (!removePlayer) return;

	players.splice(players.indexOf(removePlayer), 1);
	players_avail.splice(players_avail.indexOf(removePlayer), 1);

	// Notify opponent if in game
	if (removePlayer.opp) {
		io.to(removePlayer.opp.sockid).emit("opp_disconnected");
	}

	// Clean up room from store
	if (removePlayer.roomId) {
		GameStore.deleteRoom(removePlayer.roomId);
		io.emit("room_closed", { roomId: removePlayer.roomId });
	}

	delete playerSockets[this.id];

	console.log("Player disconnected: " + this.id);

};

// ----	--------------------------------------------	--------------------------------------------	

// Get list of active game rooms
function onGetRooms() {

	var rooms = GameStore.getAllRooms();
	this.emit("rooms:list", rooms);

};

// ----	--------------------------------------------	--------------------------------------------	
// ----	--------------------------------------------	--------------------------------------------	

set_game_sock_handlers = function (socket) {

	socket.on("new player", onNewPlayer);

	socket.on("ply_turn", onTurn);

	socket.on("get_rooms", onGetRooms);

	socket.on("disconnect", onClientDisconnect);

};
