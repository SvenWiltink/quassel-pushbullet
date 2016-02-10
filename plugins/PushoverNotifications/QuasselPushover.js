var async = require('async');
var Pushover = require('pushover-notifications');
var BufferType = require('libquassel/lib/buffer').IRCBuffer.Types;
var MessageType = require('libquassel/lib/message').Type;

var QuasselPushover = function(quasselClient) {
	this.quasselClient = quasselClient;
	this.pushover = new Pushover(quasselClient.userConfig.pushover.credentials);
	this.notificationQueue = {}; // {bufferId: [{timestamp: Date, buffer: Buffer, message: Message}, ...], ...}
	this.pushLog = {};
};

QuasselPushover.prototype.sendNotification = function(title, body, sound, bufferId) {
	var self = this;
	this.quasselClient.logDebug('[Pushover]', {
		title: title,
		body: body
	});

	var callback = function(err, response) {
		if (err) return console.log('[PushBullet] [error]', err);
		self.quasselClient.logDebug('[PushBullet]', response);
		if (bufferId) {
			if (!self.pushLog[bufferId]) {
				self.pushLog[bufferId] = [];
			}
			self.pushLog[bufferId].push(response.iden);
			self.quasselClient.logDebug('pushLog', bufferId, self.pushLog[bufferId]);
		}
	};

	self.quasselClient.logDebug('[PushBullet] sound', sound);
	this.pushover.send({'title': title, 'message': body, 'sound': sound}, callback)
};

QuasselPushover.prototype.buildNotification = function(buffer, message) {
	var title, body;

	if (buffer.type == BufferType.QueryBuffer) {
		title = message.getNick() + ':';
	} else if (buffer.type == BufferType.ChannelBuffer && message.isHighlighted()) {
		title = '[' + buffer.name + '] ' + message.getNick() + ':';
	}

	body = message.content;

	console.log("[Pushover] building notification: " + title + " " + body);

	return {
		title: title,
		body: body
	};
};

QuasselPushover.prototype.buildNotificationList = function(notifications) {
	var firstNotification = notifications[0];
	var buffer = firstNotification.buffer;
	var title = '[' + buffer.name + '] (' + notifications.length + ' Messages)';
	var body = firstNotification.message.content;
	for (var i = 1; i < notifications.length; i++) {
		body += '\n' + notifications[i].message.content;
	}

	return {
		title: title,
		body: body
	};
};

QuasselPushover.prototype.sendQueuedNotifications = function(bufferId) {console.log('sendQueuedNotifications', arguments);
	var notifications = this.notificationQueue[bufferId].splice(0); // Move all elements to a new array in case new ones appear.
	if (notifications.length <= 0) return;

	var data;
	if (notifications.length == 1) {
		data = this.buildNotification(notifications[0].buffer, notifications[0].message);
	} else {
		data = this.buildNotificationList(notifications);
	}
	this.sendNotification(data.title, data.body, notifications[0].sound, bufferId);
};

QuasselPushover.prototype.checkNotificationQueue = function(bufferId) {console.log('checkNotificationQueue', arguments);
	var now = Date.now();

	// Check if we should 
	var unloadQueue = false;
	if (this.notificationQueue[bufferId].length > 0) {
		var firstNotification = this.notificationQueue[bufferId][0];
		var lastNotification = this.notificationQueue[bufferId][this.notificationQueue[bufferId].length - 1];
		var hasRecentNotication = (now - lastNotification.timestamp) < (this.quasselClient.userConfig.delayBeforePushing - 100); // The -100ms is in case setTimout fires early.
		var reachedMaxDelay = (now - firstNotification.timestamp) >= this.quasselClient.userConfig.maxDelayBeforePushing;
		if (!hasRecentNotication || reachedMaxDelay) {
			unloadQueue = true;
		}
	}

	if (unloadQueue) {
		this.sendQueuedNotifications(bufferId);
	}
};

QuasselPushover.prototype.queueNotification = function(buffer, message, sound) {console.log('queueNotification');
	var self = this;
	var bufferId = buffer.id;
	if (!this.notificationQueue[bufferId]) {
		this.notificationQueue[bufferId] = [];
	}

	// Queue Notification
	var notification = {
		timestamp: Date.now(),
		buffer: buffer,
		message: message,
		sound: sound
	};
	this.notificationQueue[bufferId].push(notification);

	// Delay sending the notification(s).
	// Probably should clear previous timeout instead of checking when the timeout wakes, but meh.
	setTimeout(function(){
		self.checkNotificationQueue(bufferId);
	}, this.quasselClient.userConfig.delayBeforePushing);
};

QuasselPushover.prototype.clearNotificationQueue = function(bufferId) {
	if (this.notificationQueue[bufferId]) {
		this.quasselClient.logDebug('clearNotificationQueue', bufferId);
		this.notificationQueue[bufferId].splice(0);
	}
};

QuasselPushover.prototype.deleteNotitications = function(bufferId) {
	var self = this;
	var bufferPushes = this.pushLog[bufferId];
	if (!bufferPushes) return;
	bufferPushes = bufferPushes.splice(0);
	this.quasselClient.logDebug('deleteNotitications', bufferId, bufferPushes);
	for (var i = 0; i < bufferPushes.length; i++) {
		var pushIden = bufferPushes[i];
		this.pushbullet.deletePush(pushIden, function(err, response) {
			self.quasselClient.logDebug('deletePush', bufferId, pushIden);
		});
	}
};

module.exports = QuasselPushover;
