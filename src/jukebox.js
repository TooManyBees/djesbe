var Q = require('q');
var fs = require('fs');
var m3u8parse = Q.nfbind(require('m3u8parse'));
var readdir = Q.nfbind(fs.readdir);
var Speaker = require('speaker');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Track = require('./track');
var playerFor = require('./player');
var newlineAgnosticStream = require('./newline_agnostic_stream');

module.exports = Jukebox;

util.inherits(Jukebox, EventEmitter);
function Jukebox() {
  EventEmitter.call(this);
  this.playlists = [];

  this.queue = [];
  this._cursor = 0; // NEXT track to play, not current track
  this._playing = false;
  this._speaker = null;

  this._autoAdvance = function() {
    this._speaker = null;
    this.advance(1);
  }.bind(this);
};

Jukebox.prototype.load = function(dirname) {
  var self = this;
  return readdir(dirname).then(function(files) {
    return self.loadPlaylists(dirname, files)
  });
}

Jukebox.prototype.loadPlaylists = function(dirname, files) {
  var self = this;
  var toParse = files.map(function(f) {
    return loadPlaylist([dirname,f].join('/'));
  });

  return Q.allSettled(toParse).then(function(results) {
    results.forEach(function(result) {
      var name = nameFromFilename(result.value.filename);
      self.playlists.push(makePlaylist(name, result.value.segments));
    });
  });
}

Jukebox.prototype.hasPlayed = function(track) {
  var i = this.queue.indexOf(track);
  return i > -1 && i < this._cursor;
}

Jukebox.prototype.isEnqueued = function(track) {
  return this.queue.indexOf(track) > -1;
}

Jukebox.prototype.pending = function() {
  return this.queue.slice(this._cursor, this.queue.length);
}

Jukebox.prototype.enqueue = function(track) {
  this.queue.push(track);
};

Jukebox.prototype.unqueue = function(index) {
  // Assume that a track can/will be enqueued multiple times.
  // We can't just indexOf to find it, we have to use the index.
  if (index === this._cursor && this._playing) this.advance(1);
  if (index <= this._cursor && this._cursor > 0) this._cursor--;
  // Attempt a splice, but only return the changed queue if
  // something got spliced out. (i.e. index out of bounds
  // harmlessly fizzles)
  if (this.queue.splice(index, 1)[0]) return this.queue;
}

Jukebox.prototype._stopAnd = function(cb) {
  var self = this;
  cb = cb || function(){ self._speaker = null; };
  if (this._speaker) {
    this._speaker.removeListener('close', this._autoAdvance);
    this._speaker.end(cb);
  } else {
    cb();
  }
}

Jukebox.prototype.playPause = function() {
  if (this._playing) {
    this.stop();
  } else if (this.currentTrack()) {
    this.play(this.currentTrack());
  }
}

Jukebox.prototype.stop = function() {
  var self = this;
  if (this._playing) {
    this._playing = false;
    this._stopAnd(function() {
      self._speaker = null;
      self.emit('stop', this._cursor);
    });
  }
}

Jukebox.prototype.play = function(track) {
  var self = this;
  var playTrack = function() {
    var player = playerFor('mp3')
    player.on('format', function(format) {
      self._playing = true;
      self._speaker = new Speaker(format);
      self._speaker.on('close', self._autoAdvance);
      self.emit('advance', self._cursor);
      player.pipe(self._speaker);
    });
    track.readable().pipe(player);
  }
  this._stopAnd(playTrack);
}

Jukebox.prototype.advance = function(dir) {
  this._cursor += dir;
  var next = this.currentTrack();
  if (next !== undefined && this._playing) {
    this.play(next);
  } else {
    this.emit('advance');
  }
}

Jukebox.prototype.currentTrack = function() {
  return this.queue[this._cursor] || null;
}

function loadPlaylist(filename) {
  var stream = newlineAgnosticStream(filename);
  return m3u8parse(stream).then(function(res) {
    res.filename = filename;
    return res;
  });
}

function makePlaylist(name, ts) {
  var tracks = [];
  ts.filter(function(track) {
    // We can't play non-mp3 files just yet!
    var len = track.uri.length;
    return track.uri.slice(len-4,len) === ".mp3";
  }).forEach(function(track) {
    tracks.push(Track.unique(track));
  });
  tracks.name = name;
  return tracks;
}

function nameFromFilename(filename) {
  var i = filename.lastIndexOf('/'),
      j = filename.lastIndexOf('.');
  return filename.slice(i+1, j);
}
