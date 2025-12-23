import React, {Component} from 'react'

export default class SetName extends Component {

constructor (props) {
	super(props)

	this.state = { error: null }
}

//	------------------------	------------------------	------------------------

	render () {
		return (
			<div id='SetName'>

				<h1>Set Name</h1>

				<div ref='nameHolder' className={'input_holder left' + (this.state.error ? ' error' : '')}>
					<label>Name </label>
					<input ref='name' type='text' className='input name' placeholder='Name' />
					{this.state.error && <div className="error_text">{this.state.error}</div>}
				</div>


				<button type='submit' onClick={this.saveName.bind(this)} className='button'><span>SAVE <span className='fa fa-caret-right'></span></span></button>

			</div>
		)
	}

//	------------------------	------------------------	------------------------

	saveName (e) {
		var name = (this.refs.name && this.refs.name.value || '').trim()
		if (!name) {
			this.setState({ error: 'Please enter your name' })
			this.refs.name && this.refs.name.focus()
			return
		}
		this.setState({ error: null })
		this.props.onSetName(name)
	}

}
