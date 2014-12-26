var fs = require('fs')

module.exports = Track;

// Give each track a unique numeric id per session.
// It's what we'll compare against for equality.
var uniqueId = 0;

var registry = {};

function Track(options) {
  this.uri = options.uri;
  this.title = options.title;
  this.id = options.id;
  this.duration = options.duration;
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
      id: uniqueId++
    });
    registry[track.uri] = newTrack;
    return newTrack;
  }
}
