var Q = require('q');
var fs = require('fs');
var _m3u8parse = require('m3u8parse');
var m3u8parse = Q.nfbind(_m3u8parse);
var readdir = Q.nfbind(fs.readdir);

var Track = require('./track');
var Player = require('./player')

module.exports = Jukebox;

function Jukebox() {
  this.playlists = {};
  this.played = [];
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
    self.playlists[name] = makePlaylist(name, results.value.segments);
  });
}

Jukebox.prototype.enqueue = function(id) {
  return null;
};

function loadPlaylist(filename) {
  var stream = fs.createReadStream(filename);
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
