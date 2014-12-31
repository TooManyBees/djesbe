var fs = require('fs');
var stream = require('stream');
var Speaker = require('speaker');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var playerFor = require('./player');
var Q = require('q');
var qstat = Q.nfbind(fs.stat);

module.exports = Track;

// Give each track a unique numeric id per session.
// It's what we'll compare against for equality.
var uniqueId = 0;

var registry = {};

const chunkSize = 65536;

util.inherits(Track, EventEmitter);
function Track(options) {
  EventEmitter.call(this);

  this.uri = options.uri;
  this.extension = options.extension;
  this.title = options.title;
  this.id = options.id;
  this.duration = options.duration;

  this._speaker = null;
  this.size = null;
  this._progress = 0;
  this._close = function() {
    this._speaker = null;
    this.emit('end');
  }.bind(this);
  this._reset = function() {
    this._progress = 0;
  }.bind(this);
}

Track.prototype.play = function() {
  var self = this;
  return this.readSize().then(function() {
    return Q.Promise(function(resolve, reject) {
      var player = playerFor(self.extension, function(format, pl) {
        // on success (format) callback
        self._speaker = new Speaker(format);
        self._speaker.once('close', self._close);
        self._speaker.once('close', self._reset);
        pl.pipe(self._speaker);
        resolve();
      });
      self.readable().pipe(new ProgressMeter(self)).pipe(player);
    });
  });
}

Track.prototype.pause = function() {
  return this._stop(false);
}

Track.prototype.stop = function() {
  return this._stop(true);
}

Track.prototype._stop = function(reset) {
  var self = this;
  return Q.Promise(function(resolve, reject) {
    if (self._speaker) {
      if (!reset) { self._speaker.removeListener('close', self._reset); }
      self._speaker.end(resolve);
    } else {
      resolve();
    }
  });
}

Track.prototype.timeRemaining = function() {
  if (this.size) {
    // Account for the fact that we'll buffer a chunk or two before
    // the track starts playing.
    var pct = (this._progress - 2 * chunkSize) / this.size;
    return this.duration - Math.floor(pct * this.duration);
  } else {
    return this.duration;
  }
}

Track.prototype.isPlaying = function() {
  return !!this._speaker;
}

Track.prototype.readable = function() {
  return fs.createReadStream(this.uri);
}

Track.prototype.readSize = function() {
  var self = this;
  if (typeof this.size === 'number') {
    return Q();
  } else {
    return qstat(self.uri).then(function(stat) {
      self.size = stat.size;
    });
  }
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

util.inherits(ProgressMeter, stream.Transform);
function ProgressMeter(track) {
  stream.Transform.call(this);
  this.begin = track._progress;
  this.progress = 0;
  this.track = track;
}

ProgressMeter.prototype._transform = function(chunk, enc, cb) {
  // Some sort of buffering by speaker or player means that we
  // need to start passing chunks through to the speaker one
  // chunk before we stopped, lest we'll miss a couple seconds
  // of play time.
  if (this.progress + (chunk.length*2) >= this.begin) {
    this.track._progress = this.progress += chunk.length;
    this.push(chunk);
  } else {
    this.progress += chunk.length;
  }
  cb();
}
