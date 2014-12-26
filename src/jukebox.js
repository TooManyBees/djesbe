var Q = require('q');
var fs = require('fs');
var _m3u8parse = require('m3u8parse');
var m3u8parse = Q.nfbind(_m3u8parse);
var readdir = Q.nfbind(fs.readdir);
var Speaker = require('speaker');

var Track = require('./track');
var playerFor = require('./player');
var newlineAgnosticStream = require('./newline_agnostic_stream');

module.exports = Jukebox;

function Jukebox() {
  this.playlists = [];
  this.currentPlaylist = null;

  this.queue = [];
  this._cursor = 0;
  this._playing = false;
  this._speaker = null;
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

  // TODO: is .spread() safe for concurrency?
  return Q.allSettled(toParse).spread(function(results) {
    var name = nameFromFilename(results.value.filename);
    self.playlists.push(makePlaylist(name, results.value.segments));
  });
}

Jukebox.prototype.hasPlayed = function(track) {
  var i = this.queue.indexOf(track);
  return i > 0 && i <= this._cursor;
}

Jukebox.prototype.enqueue = function(track) {
  this.queue.push(track);
};

Jukebox.prototype.playPause = function() {
  if (this._playing) {
    this._speaker.end();
    this._playing = false;
  } else {
    this.play(this.queue[this._cursor]);
    this._playing = true;
  }
}

Jukebox.prototype.play = function(track) {
  var self = this;
  var player = playerFor('mp3')
  player.on('format', function(format) {
    self._speaker = new Speaker(format);
    player.pipe(self._speaker);
  });
  track.readable().pipe(player);
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
  ts.forEach(function(track) {
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
