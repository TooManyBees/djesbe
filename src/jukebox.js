var Q = require('q');
var fs = require('fs');
var m3u8parse = Q.nfbind(require('m3u8parse'));
var readdir = Q.nfbind(fs.readdir);
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Track = require('./track');
var playerFor = require('./player');
var newlineAgnosticStream = require('./newline_agnostic_stream');

const ALLOWED_EXTENSIONS = {
  mp3: true,
  ogg: true,
};

module.exports = Jukebox;

util.inherits(Jukebox, EventEmitter);
function Jukebox() {
  EventEmitter.call(this);
  this.playlists = [];

  this.queue = [];
  this._cursor = 0; // NEXT track to play, not current track
  this._playing = false;

  this._autoAdvance = function() {
    this._advance(1);
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
  var self = this;
  function snipSnip() {
    // Assume that a track can/will be enqueued multiple times.
    // We can't just indexOf to find it, we have to use the index.
    if (index <= self._cursor && self._cursor > 0) self._cursor--;
    // Attempt a splice, but only return the changed queue if
    // something got spliced out. (i.e. index out of bounds
    // harmlessly fizzles)
    if (self.queue.splice(index, 1)[0]) return self.queue;
  }

  if (this.queue[index] === this.currentTrack()) {
    return this.advance(1).then(snipSnip);
  } else {
    return Q(snipSnip());
  }
}

/*
 * General theme here: methods starting with _ do exactly what
 * they say. The associated method without a _ does cleanup,
 * validity checks, etc. before calling its _method.
 */

// Play a track, and (optionally) set cursor to index
Jukebox.prototype._play = function(track, index) {
  if (typeof index === 'number') self._cursor = index;
  track.once('end', this._autoAdvance);
  return track.play();
}

// Play a track, after interrupting the current track
Jukebox.prototype.play = function(track, index) {
  var self = this;
  this.currentTrack().removeListener('end', this._autoAdvance);
  return this.currentTrack().stop()
  .then(function() {
    return self._play(track, index);
  });
}

Jukebox.prototype.playPause = function() {
  if (!(this.currentTrack() instanceof Track)) return Q(false);
  if (this.currentTrack().isPlaying()) {
    return this.currentTrack().stop();
  } else {
    return this.currentTrack().play();
  }
}

Jukebox.prototype.advance = function(dir) {
  var self = this;
  var currentTrack = this.currentTrack();
  if (!currentTrack) return Q();
  currentTrack.removeListener('end', this._autoAdvance);
  var autoAdvance = currentTrack.isPlaying();
  return currentTrack.stop()
    .then(function() {
      if (autoAdvance) return self._advance(dir);
      else return true;
    });
}

// Plays the next track. Assumes we've already cleaned up
// previous track and checked for autoplay status, etc.
Jukebox.prototype._advance = function(dir) {
  var nextTrack = this.nextTrack(dir);
  if (nextTrack) return this._play(nextTrack);
  else return Q();
}

Jukebox.prototype.currentTrack = function() {
  return this.queue[this._cursor] || null;
}

// I'm a terrible person. This has a return value
// AND mutates internal state. Yeah, you heard me.
// Go fuck yourselves, FP snobs.
Jukebox.prototype.nextTrack = function(dir) {
  var nextTrack = this.queue[this._cursor + dir];
  if (nextTrack) {
    this._cursor += dir;
    return nextTrack;
  } else {
    return null;
  }
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
  ts.map(function(track){
    var extMarker = track.uri.lastIndexOf('.');
    track.extension = extMarker ? track.uri.slice(extMarker+1) : null;
    return track;
  }).filter(function(track) {
    return ALLOWED_EXTENSIONS.hasOwnProperty(track.extension);
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
