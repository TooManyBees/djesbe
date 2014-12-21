var Jukebox = require('./src/jukebox');
var EventEmitter = require('events').EventEmitter;
var makeTerminal = require('./src/terminal')

var handle = new EventEmitter();

var j = new Jukebox(handle);
j.load("./playlists").then(function() {
  console.log(j.playlists)
});

var commandTable = {
  enqueue: function(track) { console.log("Enqueuing "+track) },
  cancel: function(track) { console.log("Canceling "+track) },
  play: function() { console.log("Playing") },
  pause: function() { console.log("Pausing") }
};
var terminal = makeTerminal(commandTable)
