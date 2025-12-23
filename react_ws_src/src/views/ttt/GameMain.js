import React, {Component} from 'react'

import io from 'socket.io-client'

import TweenMax from 'gsap'

import rand_arr_elem from '../../helpers/rand_arr_elem'
import rand_to_fro from '../../helpers/rand_to_fro'
import GameBoard from './GameBoard'
import reactionSound from '../../../static/sounds/move-self.mp3'
import victorySound from '../../../static/sounds/victory-1-90174.mp3'
import defeatSound from '../../../static/sounds/defeat.mp3'
import loveSound from '../../../static/sounds/love.mp3'
import hahaSound from '../../../static/sounds/haha.mp3'
import whisperSound from '../../../static/sounds/whisper.mp3'
import lighteningSound from '../../../static/sounds/lightening.mp3'


export default class GameMain extends Component {

	constructor (props) {
		super(props)

		this.reactionTimeouts = {}
		this.boardRef = null

		this.win_sets = [
			['c1', 'c2', 'c3'],
			['c4', 'c5', 'c6'],
			['c7', 'c8', 'c9'],

			['c1', 'c4', 'c7'],
			['c2', 'c5', 'c8'],
			['c3', 'c6', 'c9'],

			['c1', 'c5', 'c9'],
			['c3', 'c5', 'c7']
		]


		this.sock_start()

		if (this.props.game_type != 'live')
			this.state = {
				cell_vals: {},
				next_turn_ply: true,
				game_play: true,
				game_stat: 'Start game',
				spectatorReactions: [],
				winCells: [],
				soundEnabled: false
			}
		else {
			this.state = {
				cell_vals: {},
				next_turn_ply: true,
				game_play: false,
				game_stat: 'Connecting',
				spectatorReactions: [],
				winCells: [],
				soundEnabled: false
			}
		}
	}

//	------------------------	------------------------	------------------------

	componentDidMount () {
    	TweenMax.from('#game_stat', 1, {display: 'none', opacity: 0, scaleX:0, scaleY:0, ease: Power4.easeIn})
    	TweenMax.from('#game_board', 1, {display: 'none', opacity: 0, x:-200, y:-200, scaleX:0, scaleY:0, ease: Power4.easeIn})
	}

//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	sock_start () {

		this.socket = io(app.settings.ws_conf.loc.SOCKET__io.u);

		this.socket.on('connect', function(data) { 
			// console.log('socket connected', data)

			if (this.props.game_type == 'live') {
				this.socket.emit('new player', { name: app.settings.curr_user.name });
			} else {
				this.socket.emit('create_room', { 
					name: app.settings.curr_user.name,
					gameType: 'computer'
				});
			}

		}.bind(this));

		this.socket.on('pair_players', function(data) { 
			// console.log('paired with ', data)

			this.setState({
				next_turn_ply: data.mode=='m',
				game_play: true,
				game_stat: 'Playing with ' + data.opp.name
			})

		}.bind(this));

		this.socket.on('room_created', function(data) {
			this.roomId = data.roomId
		}.bind(this));

		this.socket.on('opp_turn', this.turn_opp_live.bind(this));
		this.socket.on('spectator:disturb', this.onSpectatorDisturb.bind(this));

	}

//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	componentWillUnmount () {

		if (this.reactionTimeouts) {
			Object.keys(this.reactionTimeouts).forEach(function(id) {
				clearTimeout(this.reactionTimeouts[id])
			}.bind(this))
		}
		this.socket && this.socket.disconnect();
	}

//	------------------------	------------------------	------------------------

	render () {
		const { cell_vals } = this.state
		// console.log(cell_vals)

		return (
			<div id='GameMain'>

				{!this.state.soundEnabled && (
					<div className="sound-opt">
						<button type="button" className="button" onClick={this.enableSound.bind(this)}>Enable sound</button>
					</div>
				)}

				<h1>Play {this.props.game_type}</h1>

				<div id="game_stat">
					<div id="game_stat_msg">{this.state.game_stat}</div>
					{this.state.game_play && <div id="game_turn_msg">{this.state.next_turn_ply ? 'Your turn' : 'Opponent turn'}</div>}
				</div>

				<div id="game_board" className="has-reactions">
					<GameBoard 
						ref={function(ref) { this.boardRef = ref }.bind(this)}
						cellVals={cell_vals} 
						onCellClick={this.click_cell.bind(this)} 
						winCells={this.state.winCells}
					/>

					{this.state.game_play && (
						<div className="reaction-flyers" aria-live="polite">
							{this.state.spectatorReactions.map(function(reaction) {
								var offset = reaction.offset || 0
								return (
									<div 
										key={reaction.id} 
										className={'reaction-flyer reaction-' + reaction.type}
										style={{ left: offset + '%', animationDelay: (reaction.delay || 0) + 'ms', '--rise': (reaction.rise || 60) + 'px' }}
									>
										<span className="reaction-emoji">{reaction.emoji}</span>
										<span className="reaction-text">{reaction.from}</span>
									</div>
								)
							})}
						</div>
					)}
				</div>

				<button type='submit' onClick={this.end_game.bind(this)} className='button'><span>End Game <span className='fa fa-caret-right'></span></span></button>

			</div>
		)
	}

//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	click_cell (cellOrEvent) {

		if (!this.state.next_turn_ply || !this.state.game_play) return

		var cell_id = typeof cellOrEvent === 'string' ? cellOrEvent : null
		if (!cell_id && cellOrEvent && cellOrEvent.currentTarget) {
			var target = cellOrEvent.currentTarget
			cell_id = (target.dataset && target.dataset.cell) || (target.id ? target.id.replace('game_board-', '') : null)
		}
		if (!cell_id || !/^c[1-9]$/.test(cell_id)) return
		if (this.state.cell_vals[cell_id]) return

		if (this.props.game_type != 'live')
			this.turn_ply_comp(cell_id)
		else
			this.turn_ply_live(cell_id)
	}

//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	turn_ply_comp (cell_id) {

		let { cell_vals } = this.state

		cell_vals[cell_id] = 'x'

		this.boardRef && this.boardRef.animateCell(cell_id)

		this.emitSpectatorTurn(cell_id, this.socket && this.socket.id, app.settings.curr_user.name);

		this.state.cell_vals = cell_vals

		this.check_turn()

		this.playMoveSound()
	}

//	------------------------	------------------------	------------------------

	turn_comp () {

		let { cell_vals } = this.state
		let empty_cells_arr = []


		for (let i=1; i<=9; i++) 
			!cell_vals['c'+i] && empty_cells_arr.push('c'+i)
		// console.log(cell_vals, empty_cells_arr, rand_arr_elem(empty_cells_arr))

		const c = rand_arr_elem(empty_cells_arr)
		cell_vals[c] = 'o'

		this.boardRef && this.boardRef.animateCell(c)

		this.emitSpectatorTurn(c, 'computer', 'Computer');


		// this.setState({
		// 	cell_vals: cell_vals,
		// 	next_turn_ply: true
		// })

		this.state.cell_vals = cell_vals

		this.check_turn()

		this.playMoveSound()
	}


//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	turn_ply_live (cell_id) {

		let { cell_vals } = this.state

		cell_vals[cell_id] = 'x'

		this.boardRef && this.boardRef.animateCell(cell_id)

		this.socket.emit('ply_turn', { cell_id: cell_id });

		// this.setState({
		// 	cell_vals: cell_vals,
		// 	next_turn_ply: false
		// })

		// setTimeout(this.turn_comp.bind(this), rand_to_fro(500, 1000));

		this.state.cell_vals = cell_vals

		this.check_turn()

		this.playMoveSound()
	}

//	------------------------	------------------------	------------------------

	turn_opp_live (data) {

		let { cell_vals } = this.state

		const c = data.cell_id
		cell_vals[c] = 'o'

		this.boardRef && this.boardRef.animateCell(c)


		// this.setState({
		// 	cell_vals: cell_vals,
		// 	next_turn_ply: true
		// })

		this.state.cell_vals = cell_vals

		this.check_turn()

		this.playMoveSound()
	}

//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------
//	------------------------	------------------------	------------------------

	check_turn () {

		const { cell_vals } = this.state

		let win = false
		let set
		let fin = true

		if (this.props.game_type!='live')
			this.state.game_stat = 'Play'


		for (let i=0; !win && i<this.win_sets.length; i++) {
			set = this.win_sets[i]
			if (cell_vals[set[0]] && cell_vals[set[0]]==cell_vals[set[1]] && cell_vals[set[0]]==cell_vals[set[2]])
				win = true
		}


		for (let i=1; i<=9; i++) 
			!cell_vals['c'+i] && (fin = false)

		// win && console.log('win set: ', set)

		if (win) {
		
			var winnerIsSelf = cell_vals[set[0]]=='x'
			this.setState({
				game_stat: (winnerIsSelf?'You':'Opponent')+' win',
				game_play: false,
				winCells: set
			})

			this.socket && this.socket.emit('game_end', { winner: winnerIsSelf ? 'self' : 'opp' })
			this.socket && this.socket.disconnect();
			if (winnerIsSelf) this.playVictorySound()
			else this.playDefeatSound()

		} else if (fin) {
		
			this.setState({
				game_stat: 'Draw',
				game_play: false
			})

			this.socket && this.socket.emit('game_end', { winner: 'draw' })
			this.socket && this.socket.disconnect();
			this.playVictorySound()
			this.setState({ winCells: [] })

		} else {
			this.props.game_type!='live' && this.state.next_turn_ply && setTimeout(this.turn_comp.bind(this), rand_to_fro(500, 1000));

			this.setState({
				next_turn_ply: !this.state.next_turn_ply
			})
		}
		
	}

//	------------------------	------------------------	------------------------

	end_game () {
		this.socket && this.socket.disconnect();

		this.props.onEndGame()
	}

//	------------------------	------------------------	------------------------

	emitSpectatorTurn(cell_id, playerId, playerName) {
		if (!this.socket || !cell_id) return
		var payload = { cell_id: cell_id }
		if (playerId) payload.playerId = playerId
		if (playerName) payload.playerName = playerName
		this.socket.emit('game:turn:spectator', payload)
	}

	enableSound () {
		try {
			var testAudio = this.reactionAudio || new Audio(reactionSound)
			this.reactionAudio = testAudio
			testAudio.currentTime = 0
			testAudio.play()
			this.setState({ soundEnabled: true })
		} catch (e) {
			this.setState({ soundEnabled: true })
		}
	}

	playMoveSound () {
		if (!this.state.soundEnabled) return
		try {
			var audio = this.reactionAudio || new Audio(reactionSound)
			this.reactionAudio = audio
			audio.currentTime = 0
			audio.play()
		} catch (e) {}
	}

	playVictorySound () {
		if (!this.state.soundEnabled) return
		try {
			var audio = this.victoryAudio || new Audio(victorySound)
			this.victoryAudio = audio
			audio.currentTime = 0
			audio.play()
		} catch (e) {}
	}

	playDefeatSound () {
		if (!this.state.soundEnabled) return
		try {
			var audio = this.defeatAudio || new Audio(defeatSound)
			this.defeatAudio = audio
			audio.currentTime = 0
			audio.play()
		} catch (e) {}
	}

	playReactionSound (type) {
		if (!this.state.soundEnabled) return
		var soundMap = {
			laugh: hahaSound,
			love: loveSound,
			whisper: whisperSound,
			lightning: lighteningSound
		}
		var src = soundMap[type] || reactionSound
		try {
			var audio = new Audio(src)
			audio.currentTime = 0
			audio.play()
		} catch (e) {}
	}

	onSpectatorDisturb (data) {
		var emojiMap = {
			laugh: '😂',
			love: '❤️',
			lightning: '⚡',
			whisper: '🤫',
			nudge: '⚡',
			default: '✨'
		}
		var baseEmoji = emojiMap[data.type] || emojiMap.default
		var name = data.from || 'Spectator'
		this.playReactionSound(data.type)

		var particles = []
		for (var i = 0; i < 10; i++) {
			particles.push({
				id: Date.now() + Math.random(),
				type: data.type || 'reaction',
				from: name,
				emoji: baseEmoji,
				offset: Math.max(5, Math.min(90, Math.round(Math.random() * 100))),
				delay: i * 40,
				rise: 40 + Math.random() * 40
			})
		}

		this.setState(function(prev) {
			var nextList = (prev.spectatorReactions || []).concat(particles)
			if (nextList.length > 40) nextList = nextList.slice(nextList.length - 40)
			return { spectatorReactions: nextList }
		})

		particles.forEach(function(p) {
			this.reactionTimeouts[p.id] = setTimeout(function() {
				this.setState(function(prev) {
					return { spectatorReactions: (prev.spectatorReactions || []).filter(function(r) { return r.id !== p.id }) }
				})
				delete this.reactionTimeouts[p.id]
			}.bind(this), 2600 + p.delay)
		}.bind(this))
	}



}
