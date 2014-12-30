var fs = require('fs');
var Speaker = require('speaker');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var playerFor = require('./player');
var Q = require('q');

module.exports = Track;

// Give each track a unique numeric id per session.
// It's what we'll compare against for equality.
var uniqueId = 0;

var registry = {};

util.inherits(Track, EventEmitter);
function Track(options) {
  EventEmitter.call(this);

  this.uri = options.uri;
  this.extension = options.extension;
  this.title = options.title;
  this.id = options.id;
  this.duration = options.duration;

  this._speaker = null;
  this._stop = function() {
    this._speaker = null;
    this.emit('end');
  }.bind(this);
}

Track.prototype.play = function() {
  var self = this;
  return Q.Promise(function(resolve, reject) {
    var player = playerFor(self.extension, function(format, pl) {
      // on success (format) callback
      self._speaker = new Speaker(format);
      self._speaker.on('close', self._stop);
      pl.pipe(self._speaker);
      resolve();
    });
    self.readable().pipe(player);
  });
}

Track.prototype.stop = function() {
  var self = this;
  return Q.Promise(function(resolve, reject) {
    if (self._speaker) {
      self._speaker.end(resolve);
    } else {
      resolve();
    }
  });
}

Track.prototype.isPlaying = function() {
  return !!this._speaker;
}

Track.prototype.readable = function() {
  return fs.createReadStream(this.uri);
}

Track.unique = function(track) {
  if (registry.hasOwnProperty(track.uri)) {
    return registry[track.uri];
  } else {
    var newTrack = new Track({
      uri: track.uri,
      title: track.title,
      duration: track.duration,
      extension: track.extension,
      id: uniqueId++
    });
    registry[track.uri] = newTrack;
    return newTrack;
  }
}
