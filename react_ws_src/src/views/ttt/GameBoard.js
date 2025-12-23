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
		var cellId = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.cell : null
		if (!cellId && e.currentTarget) {
			cellId = e.currentTarget.getAttribute('data-cell')
		}
		this.props.onCellClick(cellId)
	}

	animateCell(cellId) {
		if (this.refs[cellId]) {
			TweenMax.from(this.refs[cellId], 0.7, { opacity: 0, scaleX: 0, scaleY: 0, ease: Power4.easeOut })
		}
	}

	renderCell(id, extraClass) {
		var onClick = this.props.onCellClick ? this.handleClick.bind(this) : null
		var winCells = this.props.winCells || []
		var cls = extraClass ? extraClass.split(' ') : []
		if (winCells.indexOf(id) !== -1) cls.push('win')
		return (
			<td 
				id={'game_board-' + id} 
				data-cell={id}
				ref={id} 
				onClick={onClick} 
				className={cls.join(' ').trim()}>
				{this.cell_cont(id)}
			</td>
		)
	}

	render() {
		return (
			<div className="game-board-grid">
				<table>
					<tbody>
						<tr>
							{this.renderCell('c1')}
							{this.renderCell('c2', 'vbrd')}
							{this.renderCell('c3')}
						</tr>
						<tr>
							{this.renderCell('c4', 'hbrd')}
							{this.renderCell('c5', 'vbrd hbrd')}
							{this.renderCell('c6', 'hbrd')}
						</tr>
						<tr>
							{this.renderCell('c7')}
							{this.renderCell('c8', 'vbrd')}
							{this.renderCell('c9')}
						</tr>
					</tbody>
				</table>
			</div>
		)
	}
}
