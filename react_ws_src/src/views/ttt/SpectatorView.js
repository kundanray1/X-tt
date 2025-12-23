import React, { Component } from 'react'
import io from 'socket.io-client'
import GameBoard from './GameBoard'

export default class SpectatorView extends Component {

	constructor(props) {
		super(props)
		this.state = {
			cell_vals: {},
			connected: false,
			gameStatus: 'Connecting...',
			points: 100,
			cooldownRemaining: 0,
			myBet: null,
			bets: { byPlayer: {}, totals: {} }
		}
		this.socket = null
		this.cooldownTimer = null
	}

	componentDidMount() {
		this.connectSocket()
	}

	componentWillUnmount() {
		if (this.socket) this.socket.disconnect()
		if (this.cooldownTimer) clearInterval(this.cooldownTimer)
	}

	connectSocket() {
		this.socket = io(app.settings.ws_conf.loc.SOCKET__io.u)

		this.socket.on('connect', function() {
			this.socket.emit('spectator:join', {
				roomId: this.props.roomId,
				name: app.settings.curr_user ? app.settings.curr_user.name : 'Spectator'
			})
		}.bind(this))

		this.socket.on('spectator:joined', function(data) {
			this.setState({
				connected: true,
				points: data.yourPoints,
				bets: data.bets,
				gameStatus: 'Watching: ' + this.props.players.join(' vs ')
			})
		}.bind(this))

		this.socket.on('game:turn', function(data) {
			var cell_vals = Object.assign({}, this.state.cell_vals)
			cell_vals[data.cell_id] = data.player === this.props.players[0] ? 'x' : 'o'
			this.setState({ cell_vals: cell_vals })
		}.bind(this))

		this.socket.on('game:end', function(data) {
			var msg = data.winner === 'draw' ? 'Draw!' : 'Game Over'
			this.setState({ gameStatus: msg })
		}.bind(this))

		this.socket.on('bet:placed', function(data) {
			this.setState({ myBet: { playerId: data.playerId, amount: data.amount }, points: data.yourPoints })
		}.bind(this))

		this.socket.on('spectator:cooldown', function() {
			this.startCooldown()
		}.bind(this))
	}

	startCooldown() {
		this.setState({ cooldownRemaining: 15 })
		if (this.cooldownTimer) clearInterval(this.cooldownTimer)
		
		this.cooldownTimer = setInterval(function() {
			var remaining = this.state.cooldownRemaining - 1
			if (remaining <= 0) {
				clearInterval(this.cooldownTimer)
				remaining = 0
			}
			this.setState({ cooldownRemaining: remaining })
		}.bind(this), 1000)
	}

	handleDisturb(type) {
		if (this.state.cooldownRemaining > 0) return
		this.socket.emit('spectator:disturb', { type: type })
		this.startCooldown()
	}

	handleBet(playerId, amount) {
		this.socket.emit('spectator:bet', { playerId: playerId, amount: amount })
	}

	render() {
		var self = this
		var cooldown = this.state.cooldownRemaining
		var canDisturb = cooldown === 0

		return (
			<div id="SpectatorView">
				<div className="spectator-header">
					<h2>{this.state.gameStatus}</h2>
					<div className="points-display">
						<span className="fa fa-star"></span> {this.state.points} pts
					</div>
				</div>

				<GameBoard cellVals={this.state.cell_vals} />

				<div className="spectator-controls">
					<div className="betting-section">
						<h3>Bet</h3>
						<div className="bet-options">
							{this.props.players.map(function(player, idx) {
								var playerId = self.props.playerIds[idx]
								return (
									<button 
										key={idx}
										onClick={function() { self.handleBet(playerId, 10) }}
										disabled={self.state.myBet}
										className="button bet-btn"
									>
										{player} (10 pts)
									</button>
								)
							})}
						</div>
						{this.state.myBet && (
							<div className="my-bet">Bet placed: {this.state.myBet.amount} pts</div>
						)}
					</div>

					<div className="disturb-section">
						<h3>Disturb {cooldown > 0 && <span>({cooldown}s)</span>}</h3>
						<div className="disturb-buttons">
							<button onClick={function() { self.handleDisturb('nudge') }} disabled={!canDisturb} className="button">
								Nudge
							</button>
							<button onClick={function() { self.handleDisturb('whisper') }} disabled={!canDisturb} className="button">
								Whisper
							</button>
							<button onClick={function() { self.handleDisturb('fog') }} disabled={!canDisturb} className="button">
								Fog
							</button>
						</div>
					</div>
				</div>

				<button onClick={this.props.onLeave} className="button leave-btn">
					Leave
				</button>
			</div>
		)
	}
}
