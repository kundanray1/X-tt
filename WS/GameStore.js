
// ----	--------------------------------------------	--------------------------------------------	
// ----	GAME STORE - JSON file based storage	--------------------------------------------	
// ----	--------------------------------------------	--------------------------------------------	

var fs = require('fs');
var path = require('path');

var DATA_FILE = path.join(__dirname, 'data', 'games.json');

// ----	--------------------------------------------	--------------------------------------------	

function readData() {

	try {
		var data = fs.readFileSync(DATA_FILE, 'utf8');
		return JSON.parse(data);
	} catch (e) {
		return { rooms: {}, roomCounter: 0 };
	}

};

// ----	--------------------------------------------	--------------------------------------------	

function writeData(data) {

	fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

};

// ----	--------------------------------------------	--------------------------------------------	

function createRoom(p1Name, p2Name, p1SockId, p2SockId) {

	var data = readData();
	data.roomCounter++;
	
	var roomId = 'room_' + data.roomCounter;
	
	data.rooms[roomId] = {
		roomId: roomId,
		players: [
			{ name: p1Name, sockId: p1SockId },
			{ name: p2Name, sockId: p2SockId }
		],
		spectatorCount: 0,
		started: Date.now()
	};

	writeData(data);

	return roomId;

};

// ----	--------------------------------------------	--------------------------------------------	

function getRoom(roomId) {

	var data = readData();
	return data.rooms[roomId] || null;

};

// ----	--------------------------------------------	--------------------------------------------	

function getAllRooms() {

	var data = readData();
	var rooms = [];
	
	for (var roomId in data.rooms) {
		var room = data.rooms[roomId];
		rooms.push({
			roomId: room.roomId,
			players: [room.players[0].name, room.players[1].name],
			spectatorCount: room.spectatorCount || 0
		});
	}

	return rooms;

};

// ----	--------------------------------------------	--------------------------------------------	

function updateSpectatorCount(roomId, count) {

	var data = readData();
	
	if (data.rooms[roomId]) {
		data.rooms[roomId].spectatorCount = count;
		writeData(data);
	}

};

// ----	--------------------------------------------	--------------------------------------------	

function deleteRoom(roomId) {

	var data = readData();
	delete data.rooms[roomId];
	writeData(data);

};

// ----	--------------------------------------------	--------------------------------------------	

function clearAllRooms() {

	writeData({ rooms: {}, roomCounter: 0 });

};

// ----	--------------------------------------------	--------------------------------------------	

module.exports = {
	createRoom: createRoom,
	getRoom: getRoom,
	getAllRooms: getAllRooms,
	updateSpectatorCount: updateSpectatorCount,
	deleteRoom: deleteRoom,
	clearAllRooms: clearAllRooms
};

