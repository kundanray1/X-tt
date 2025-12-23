import React, { Component } from 'react'
import io from 'socket.io-client'

function LobbyHeader(props) {
	return (
		<div className="lobby-hero">
			<div className="lobby-title">
				<h1>Game Lobby</h1>
				<p className="lobby-subtitle">Start a new game or watch one in progress.</p>
			</div>
			<button
				type="button"
				onClick={props.onPlay}
				className="button play-btn"
			>
				<span>Play a Game <span className="fa fa-gamepad"></span></span>
			</button>
		</div>
	)
}

function SectionHeading(props) {
	return (
		<div className="section-heading">
			<h2>
				{props.title}
				{typeof props.count === 'number' && <span className="count">({props.count})</span>}
			</h2>
			{props.subtitle && <p className="section-subtitle">{props.subtitle}</p>}
		</div>
	)
}

function LobbyNotice(props) {
	return (
		<div className={'lobby-notice ' + (props.variant || '')}>
			<div className="notice-title">{props.title}</div>
			{props.message && <div className="notice-body">{props.message}</div>}
		</div>
	)
}

function GameCard(props) {
	var room = props.room || {}
	var players = room.players || []
	var left = players[0] || 'Player 1'
	var right = players[1] || 'Player 2'
	var spectators = room.spectatorCount || 0

	return (
		<div className="game-card" onClick={function() { props.onSelect(room) }}>
			<div className="game-info">
				<div className="players">
					<span className="player">{left}</span>
					<span className="vs">vs</span>
					<span className="player">{right}</span>
				</div>
				<div className="spectators">
					<span className="fa fa-eye"></span> {spectators} watching
				</div>
			</div>
			<button
				type="button"
				className="spectate-btn"
				onClick={function(e) { e.stopPropagation(); props.onSelect(room) }}
			>
				<span className="fa fa-eye"></span> Watch
			</button>
		</div>
	)
}

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

		this.socket.on('room_closed', function(data) {
			var rooms = this.state.rooms.filter(function(r) { 
				return r.roomId !== data.roomId 
			})
			this.setState({ rooms: rooms })
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

	handleSpectate(room) {
		if (this.socket) this.socket.disconnect()
		this.props.onSelectSpectate(room)
	}

//	------------------------	------------------------	------------------------

	render() {
		var rooms = this.state.rooms
		var self = this

		return (
			<div id="GameLobby" className="ttt-shell lobby-shell">
				<LobbyHeader onPlay={this.handlePlay.bind(this)} />

				<div className="ongoing-games">
					<SectionHeading title="Ongoing Games" count={rooms.length} />
					
					{this.state.loading && (
						<LobbyNotice title="Loading games..." variant="loading" />
					)}

					{!this.state.loading && rooms.length === 0 && (
						<LobbyNotice
							title="No games in progress right now."
							message="Start a game and invite someone to play."
							variant="empty"
						/>
					)}

					{rooms.length > 0 && (
						<div className="games-list">
							{rooms.map(function(room) {
								return (
									<GameCard key={room.roomId} room={room} onSelect={self.handleSpectate.bind(self)} />
								)
							}.bind(this))}
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
