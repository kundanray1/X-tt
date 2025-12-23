import React, { Component } from 'react'

import SetName from './SetName'
import SetGameType from './SetGameType'
import GameMain from './GameMain'
import GameLobby from './GameLobby'
import SpectatorView from './SpectatorView'

export default class Ttt extends Component {

	constructor(props) {
		super(props)

		this.state = {
			mode: 'lobby',
			game_type: null,
			spectate_room: null
		}
	}

//	------------------------	------------------------	------------------------

	render() {
		var mode = this.state.mode
		var hasName = app.settings.curr_user && app.settings.curr_user.name

		return (
			<section id="TTT_game">
				<div id="page-container">
					{mode === 'lobby' && (
						<GameLobby 
							onSelectPlay={this.handleSelectPlay.bind(this)} 
							onSelectSpectate={this.handleSelectSpectate.bind(this)}
						/>
					)}

					{mode === 'set_name' && (
						<SetName onSetName={this.handleSetName.bind(this)} />
					)}

					{mode === 'set_game_type' && hasName && (
						<div>
							<h2>Welcome, {app.settings.curr_user.name}</h2>
							<SetGameType onSetType={this.handleSetGameType.bind(this)} />
						</div>
					)}

					{mode === 'playing' && hasName && (
						<div>
							<h2>Welcome, {app.settings.curr_user.name}</h2>
							<GameMain
								game_type={this.state.game_type}
								onEndGame={this.handleEndGame.bind(this)}
							/>
						</div>
					)}

					{mode === 'spectating' && this.state.spectate_room && (
						<SpectatorView 
							room={this.state.spectate_room}
							onLeave={this.handleLeaveSpectate.bind(this)}
						/>
					)}
				</div>
			</section>
		)
	}

//	------------------------	------------------------	------------------------

	handleSelectPlay() {
		var hasName = app.settings.curr_user && app.settings.curr_user.name
		if (hasName) {
			this.setState({ mode: 'set_game_type' })
		} else {
			this.setState({ mode: 'set_name' })
		}
	}

//	------------------------	------------------------	------------------------

	handleSetName(name) {
		app.settings.curr_user = { name: name }
		this.setState({ mode: 'set_game_type' })
	}

//	------------------------	------------------------	------------------------

	handleSetGameType(type) {
		this.setState({ mode: 'playing', game_type: type })
	}

//	------------------------	------------------------	------------------------

	handleEndGame() {
		this.setState({ mode: 'lobby', game_type: null })
	}

//	------------------------	------------------------	------------------------

	handleSelectSpectate(room) {
		var name = window.prompt('Enter your name (optional):', app.settings.curr_user ? app.settings.curr_user.name : '') || ''
		app.settings.curr_user = { name: name.trim() || 'Anonymous' }
		this.setState({ mode: 'spectating', spectate_room: room })
	}

	handleLeaveSpectate() {
		this.setState({ mode: 'lobby', spectate_room: null })
	}

}

//	------------------------	------------------------	------------------------

Ttt.propTypes = {
	params: React.PropTypes.any
}

Ttt.contextTypes = {
	router: React.PropTypes.object.isRequired
}
