import React, { Component } from 'react'
import io from 'socket.io-client'
import GameBoard from './GameBoard'
import { REACTION_ITEMS } from './reactions'

function SpectatorHeader(props) {
	return (
		<div className="spectator-header">
			<div className="spectator-title">
				<h2>{props.status}</h2>
			</div>
			<button type="button" onClick={props.onLeave} className="button ghost leave-btn">
				Leave
			</button>
		</div>
	)
}

function ReactionDock(props) {
	if (props.hidden) return null
	return (
		<div className="floating-reactions" aria-label="Reactions">
			{props.items.map(function(item) {
				return (
					<button
						key={item.type}
						type="button"
						aria-label={item.label}
						onClick={function() { props.onReact(item.type) }}
						className="reaction-icon"
					>
						{item.emoji}
					</button>
				)
			})}
		</div>
	)
}

export default class SpectatorView extends Component {

	constructor(props) {
		super(props)
		var initialPlayers = (props.room && props.room.players) ? props.room.players.map(function(name) {
			return { name: name, id: name }
		}) : []
		this.state = {
			cell_vals: {},
			gameStatus: 'Connecting...',
			gameEnded: false,
			players: initialPlayers
		}
		this.socket = null
		this.redirectTimer = null
	}

	componentDidMount() {
		this.connectSocket()
	}

	componentWillUnmount() {
		if (this.socket) this.socket.disconnect()
		if (this.redirectTimer) clearTimeout(this.redirectTimer)
	}

	connectSocket() {
		var room = this.props.room || {}
		this.socket = io(app.settings.ws_conf.loc.SOCKET__io.u)

		this.socket.on('connect', function() {
			this.socket.emit('spectator:join', {
				roomId: room.roomId,
				name: app.settings.curr_user ? app.settings.curr_user.name : 'Spectator'
			})
		}.bind(this))

		this.socket.on('spectator:joined', function(data) {
			var players = data.players && data.players.length ? data.players : this.state.players
			var names = players.map(function(p) { return p.name })
			var cellVals = data.cellVals || this.buildBoardFromMoves(data.moves || [], players)
			this.setState({
				players: players,
				gameStatus: 'Watching: ' + names.join(' vs '),
				cell_vals: cellVals
			})
		}.bind(this))

		this.socket.on('game:turn', function(data) {
			var cell_vals = data.cellVals ? data.cellVals : Object.assign({}, this.state.cell_vals)
			if (!data.cellVals) {
				var mark = data.mark || 'x'
				cell_vals[data.cell_id] = mark
			}
			this.setState({ cell_vals: cell_vals })
		}.bind(this))

		this.socket.on('game:end', function(data) {
			var players = this.state.players.length ? this.state.players : (room.players || []).map(function(name) { return { name: name, id: name } })
			var winnerName = data.winnerName || (data.winner === 'draw' ? 'Draw' : (players[0] && data.winner === 'self' ? players[0].name : players[1] && data.winner === 'opp' ? players[1].name : data.winner))
			var msg = data.winner === 'draw' ? 'Game ended in a draw' : (winnerName + ' won the game')
			this.setState({ gameStatus: msg, gameEnded: true })
			if (this.redirectTimer) clearTimeout(this.redirectTimer)
			this.redirectTimer = setTimeout(function() {
				window.location.href = 'http://localhost:3000/ttt'
			}, 5000)
		}.bind(this))
	}

	handleDisturb(type) {
		this.socket.emit('spectator:disturb', { type: type })
	}

	buildBoardFromMoves(moves, players) {
		var cell_vals = {}
		if (!moves || !moves.length) return cell_vals
		var roster = players && players.length ? players : []
		moves.forEach(function(move) {
			var idx = roster.findIndex(function(p) { return move.playerId ? p.id === move.playerId : false })
			if (idx === -1 && move.playerName) idx = roster.findIndex(function(p) { return p.name === move.playerName })
			if (idx === -1) idx = 0
			var mark = move.mark || (idx === 0 ? 'x' : 'o')
			cell_vals[move.cell_id] = mark
		})
		return cell_vals
	}

	render() {
		var self = this
		var gameEnded = this.state.gameEnded

		return (
			<div id="SpectatorView" className="ttt-shell spectator-shell">
				<SpectatorHeader status={this.state.gameStatus} onLeave={this.props.onLeave} />

				<div className="board-area board-frame" id="game_board">
					<GameBoard cellVals={this.state.cell_vals} />

					<ReactionDock
						items={REACTION_ITEMS}
						hidden={gameEnded}
						onReact={function(type) { self.handleDisturb(type) }}
					/>
				</div>
			</div>
		)
	}
}
