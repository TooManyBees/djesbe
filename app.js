var Jukebox = require('./src/jukebox');
var EventEmitter = require('events').EventEmitter;

var handle = new EventEmitter();

var j = new Jukebox(handle);
j.load("./playlists").then(function() {
  console.log(j.playlists)
});
