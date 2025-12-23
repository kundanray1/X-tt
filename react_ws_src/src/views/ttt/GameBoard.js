import React, { Component } from 'react'
import TweenMax from 'gsap'

export default class GameBoard extends Component {

	cell_cont(c) {
		var val = this.props.cellVals[c]
		return (
			<div>
				{val === 'x' && <i className="fa fa-times fa-5x"></i>}
				{val === 'o' && <i className="fa fa-circle-o fa-5x"></i>}
			</div>
		)
	}

	handleClick(e) {
		if (!this.props.onCellClick) return
		var cellId = e.currentTarget.id.substr(11)
		this.props.onCellClick(cellId)
	}

	animateCell(cellId) {
		if (this.refs[cellId]) {
			TweenMax.from(this.refs[cellId], 0.7, { opacity: 0, scaleX: 0, scaleY: 0, ease: Power4.easeOut })
		}
	}

	render() {
		var onClick = this.props.onCellClick ? this.handleClick.bind(this) : null

		return (
			<div id="game_board">
				<table>
					<tbody>
						<tr>
							<td id="game_board-c1" ref="c1" onClick={onClick}>{this.cell_cont('c1')}</td>
							<td id="game_board-c2" ref="c2" onClick={onClick} className="vbrd">{this.cell_cont('c2')}</td>
							<td id="game_board-c3" ref="c3" onClick={onClick}>{this.cell_cont('c3')}</td>
						</tr>
						<tr>
							<td id="game_board-c4" ref="c4" onClick={onClick} className="hbrd">{this.cell_cont('c4')}</td>
							<td id="game_board-c5" ref="c5" onClick={onClick} className="vbrd hbrd">{this.cell_cont('c5')}</td>
							<td id="game_board-c6" ref="c6" onClick={onClick} className="hbrd">{this.cell_cont('c6')}</td>
						</tr>
						<tr>
							<td id="game_board-c7" ref="c7" onClick={onClick}>{this.cell_cont('c7')}</td>
							<td id="game_board-c8" ref="c8" onClick={onClick} className="vbrd">{this.cell_cont('c8')}</td>
							<td id="game_board-c9" ref="c9" onClick={onClick}>{this.cell_cont('c9')}</td>
						</tr>
					</tbody>
				</table>
			</div>
		)
	}
}

