var blessed = require('blessed');
var Jukebox = require('./src/jukebox');
var View = require('./src/view');

var playlistDir = process.argv[2] || "./playlists";

var j = new Jukebox();

j.load(playlistDir).then(function() {
  View(j);
}).done();
