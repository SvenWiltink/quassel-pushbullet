var async = require('async');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;
var QuasselPushover = require('./QuasselPushover');



exports.load = function(quasselClient, cb) {
	quasselClient.pluginData.PushoverNotifications = {};
	var pusher = new QuasselPushover(quasselClient);

	var getRegexHighlight = function(buffer, message) {
		var highlights = quasselClient.userConfig.highlights;
		for( var index in highlights) {
			var highlight = highlights[index];
			if(highlight.buffername != null) {
				if(highlight.buffername != buffer.name) {
					continue;
				}
			}
			var regex = highlight.regex;
			var matches = message.content.match(regex);
			if(matches && matches.length > 0) {
				return highlight;
			}
		}

		return null;
	};

	async.series([
		function(cb) {
			// When a new message arrives, check if it's highlighted message, or if it's from a query buffer.
			// If so, queue the message, and set a timeout before sending it in case we need to group them.
			quasselClient.on('buffer.message', function(bufferId, messageId) {
				var buffer = quasselClient.getNetworks().findBuffer(bufferId);
				var message = buffer.messages.get(messageId);

				if (message.type == MessageType.Plain || message.type == MessageType.Action) {
					// logger.debug('buffer.message', buffer.name, message.getNick(), message.content);

					if (message.isSelf())
						return;

					if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
						// var data = buildNotification(buffer, message);
						// sendNotification(data.type, data.title, data.body);
						//pusher.queueNotification(buffer, message, quasselClient.userConfig.pushover.sound);
					} else if ((highlight = getRegexHighlight(buffer, message)) !== null) {
						pusher.queueNotification(buffer, message, highlight.sound);
					}
				}
			});

			quasselClient.pluginData.PushoverNotifications.pusher = pusher;
			cb();
		}
	], cb);

};
