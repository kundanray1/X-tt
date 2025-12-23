import React, { Component } from 'react'
import io from 'socket.io-client'

export default class GameLobby extends Component {

	constructor(props) {
		super(props)

		this.state = {
			rooms: [],
			loading: true,
			connected: false
		}
		this.socket = null
	}

//	------------------------	------------------------	------------------------

	componentDidMount() {
		this.connectSocket()
	}

//	------------------------	------------------------	------------------------

	componentWillUnmount() {
		if (this.socket) this.socket.disconnect()
		if (this.refreshInterval) clearInterval(this.refreshInterval)
	}

//	------------------------	------------------------	------------------------

	connectSocket() {
		this.socket = io(app.settings.ws_conf.loc.SOCKET__io.u)

		this.socket.on('connect', function() {
			this.setState({ connected: true, loading: false })
			this.socket.emit('get_rooms')
		}.bind(this))

		this.socket.on('rooms:list', function(rooms) {
			this.setState({ rooms: rooms, loading: false })
		}.bind(this))

		this.socket.on('room_available', function(room) {
			var rooms = this.state.rooms.slice()
			var exists = rooms.some(function(r) { return r.roomId === room.roomId })
			if (!exists) {
				rooms.push({
					roomId: room.roomId,
					players: room.players,
					spectatorCount: 0
				})
				this.setState({ rooms: rooms })
			}
		}.bind(this))

		this.socket.on('disconnect', function() {
			this.setState({ connected: false })
		}.bind(this))

		// Refresh rooms periodically
		this.refreshInterval = setInterval(function() {
			if (this.socket && this.state.connected) {
				this.socket.emit('get_rooms')
			}
		}.bind(this), 5000)
	}

//	------------------------	------------------------	------------------------

	handlePlay() {
		if (this.socket) this.socket.disconnect()
		this.props.onSelectPlay()
	}

//	------------------------	------------------------	------------------------

	render() {
		var rooms = this.state.rooms

		return (
			<div id="GameLobby">
				<h1>Game Lobby</h1>

				<div className="lobby-actions">
					<button 
						type="button" 
						onClick={this.handlePlay.bind(this)} 
						className="button play-btn"
					>
						<span>Play a Game <span className="fa fa-gamepad"></span></span>
					</button>
				</div>

				<div className="ongoing-games">
					<h2>Ongoing Games {rooms.length > 0 && <span className="count">({rooms.length})</span>}</h2>
					
					{this.state.loading && (
						<div className="loading">Loading games...</div>
					)}

					{!this.state.loading && rooms.length === 0 && (
						<div className="no-games">
							<p>No games in progress right now.</p>
							<p>Start a game and invite someone to play!</p>
						</div>
					)}

					{rooms.length > 0 && (
						<div className="games-list">
							{rooms.map(function(room) {
								return (
									<div key={room.roomId} className="game-card">
										<div className="game-info">
											<div className="players">
												<span className="player">{room.players[0]}</span>
												<span className="vs">vs</span>
												<span className="player">{room.players[1]}</span>
											</div>
											<div className="spectators">
												<span className="fa fa-eye"></span> {room.spectatorCount} watching
											</div>
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>

				{!this.state.connected && (
					<div className="connection-status offline">
						<span className="fa fa-exclamation-circle"></span> Connecting to server...
					</div>
				)}
			</div>
		)
	}

}
