export var REACTION_ITEMS = [
	{ type: 'laugh', label: 'Laugh', emoji: '😂' },
	{ type: 'love', label: 'Love', emoji: '❤️' },
	{ type: 'lightning', label: 'Lightning', emoji: '⚡' },
	{ type: 'whisper', label: 'Whisper', emoji: '🤫' }
]

var REACTION_ALIAS = {
	nudge: 'lightning'
}

export function normalizeReactionType(type) {
	if (!type) return ''
	return REACTION_ALIAS[type] || type
}

export function getReactionEmoji(type) {
	var normalized = normalizeReactionType(type)
	for (var i = 0; i < REACTION_ITEMS.length; i++) {
		if (REACTION_ITEMS[i].type === normalized) return REACTION_ITEMS[i].emoji
	}
	return '✨'
}
