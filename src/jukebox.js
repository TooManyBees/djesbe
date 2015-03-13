var Q = require('q');
var fs = require('fs');
var path = require('path');
var m3u8parse = Q.nfbind(require('m3u8parse'));
var readdir = Q.nfbind(fs.readdir);
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Track = require('./track');
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

  this._autoAdvance = function() {
    this._advance(1, true);
  }.bind(this);
  this._endHeartbeat = function() {
    if (this._heartbeat !== undefined) {
      clearInterval(this._heartbeat);
      delete this._heartbeat;
    }
  }.bind(this);
};

Jukebox.prototype._beginHeartbeat = function() {
  if (this._heartbeat !== undefined) return;
  this._heartbeat = setInterval(function(self) {
    // console.log('♥');
    self.emit('heartbeat');
  }, 1500, this);
}

Jukebox.prototype.load = function(dirname) {
  var self = this;
  return readdir(dirname)
    .catch(function(err) {
      throw "Can't read directory named '"+dirname+"'";
    }).then(function(files) {
      var m3u8s = files.filter(function(f) {
        return path.extname(f) === ".m3u8";
      });
      return self.loadPlaylists(dirname, m3u8s);
    });
}

Jukebox.prototype.loadPlaylists = function(dirname, files) {
  var self = this;
  var toParse = files.map(function(f) {
    return loadPlaylist([dirname,f].join(path.sep));
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

Jukebox.prototype.isNotEnqueued = function(track) {
  return !this.isEnqueued(track);
}

Jukebox.prototype.pending = function() {
  return this.queue.slice(this._cursor, this.queue.length);
}

Jukebox.prototype.enqueue = function(tracks) {
  if (!Array.isArray(tracks)) tracks = [tracks];
  this.queue.push.apply(this.queue, tracks);
};

Jukebox.prototype.unqueue = function(index, len) {
  len = len || 1;

  var self = this,
      // Were we playing a track, and is it going to be removed?
      // Note it so we know whether or not to stop the track beforehand
      // and restart the next one afterward.
      activeTrackRemoved = this._cursor >= index
                        && this._cursor < (index + len)
                        && this.currentTrack()
                        && this.currentTrack().isPlaying();

  var p;
  if (activeTrackRemoved) p = this.stop(this.currentTrack());
  else p = Q();

  return p.then(function() {
    if (self._cursor >= (index + len)) self._cursor -= len;
    else if (self._cursor >= index) self._cursor = index;

    self.queue.splice(index, len);
    self._cursor = Math.min(self._cursor, self.queue.length-1);
    self._cursor = Math.max(0, self._cursor);

    if (activeTrackRemoved && self.currentTrack()) return self.play(self.currentTrack()).then(function() {
      return self.queue;
    });
    else return Q(self.queue);
  });
}

/*
 * General theme here: methods starting with _ do exactly what
 * they say. The associated method without a _ does cleanup,
 * validity checks, etc. before calling its _method.
 */

// Play a track, and (optionally) set cursor to index
Jukebox.prototype._play = function(track, index) {
  var self = this;
  if (typeof index === 'number') this._cursor = index;
  track.once('end', this._endHeartbeat);
  track.once('end', this._autoAdvance);
  return track.play().then(function() {
    self._beginHeartbeat();
    self.emit('advance', self._cursor);
  });
}

// Play a track, after interrupting the current track
Jukebox.prototype.play = function(track, index) {
  var self = this;
  return this.stop(this.currentTrack())
  .then(function() {
    return self._play(track, index);
  });
}

Jukebox.prototype.playPause = function() {
  if (!(this.currentTrack() instanceof Track)) return Q(false);
  if (this.currentTrack().isPlaying()) {
    return this.pause(this.currentTrack());
  } else {
    return this._play(this.currentTrack());
  }
}

Jukebox.prototype.advance = function(dir) {
  var self = this;
  var currentTrack = this.currentTrack();
  if (!currentTrack) return Q();
  var autoAdvance = currentTrack.isPlaying();
  return this.stop(currentTrack)
    .then(function() {
      return self._advance(dir, autoAdvance);
    });
}

// Plays the next track. Assumes we've already cleaned up
// previous track and checked for autoplay status, etc.
Jukebox.prototype._advance = function(dir, autoAdvance) {
  var nextTrack = this.nextTrack(dir);
  if (!nextTrack) return Q();
  if (autoAdvance) {
    return this._play(nextTrack)
  } else {
    this.emit('advance', this._cursor);
    return Q();
  }
}

Jukebox.prototype.pause = function(track) {
  track.removeListener('end', this._autoAdvance);
  return track.pause();
}

Jukebox.prototype.stop = function(track) {
  if (!track) return Q();
  track.removeListener('end', this._autoAdvance);
  return track.stop();
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
  } else if (this.autoPullPlaylists().length && (nextTrack = this._randomSelect())) {
    this._cursor = this.queue.length;
    this.enqueue([nextTrack]);
    this.emit('force-pull', nextTrack, this._cursor); // View must detect this and add track to master list
    return nextTrack;
  } else {
    return null;
  }
}

Jukebox.prototype.autoPullPlaylists = function() {
  return this.playlists.filter(function(list) {
    return list.autoPull === true;
  });
}

Jukebox.prototype._randomSelect = function() {
  var pool = [];
  this.autoPullPlaylists().forEach(function(list) {
    pool = pool.concat(list.filter(this.isNotEnqueued, this));
  }, this);
  return pool[Math.floor(pool.length * Math.random())];
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
    track.extension = path.extname(track.uri).slice(1);
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
