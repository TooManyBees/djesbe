var blessed = require('blessed');

var Jukebox = require('./src/jukebox');
var makeTerminal = require('./src/terminal')

var j = new Jukebox();
j.load("./playlists").then(function() {
  indexPlaylists(j.playlists);
  screen.render();
}).done();

function Controller(jukebox) {

}

function playlistViewIn(playlist) {
  if (typeof playlist !== "object") {
    throw "Playlist not found"
  }
  var entries = playlist.map(function(track) {
    return track.title;
  });
  playlistShow.setLabel(" "+playlist.name+" ")
  playlistShow.setItems(entries);
  playlistShow.height = '100%';
  playlistShow.focus();
  screen.render();
}

function playlistViewOut() {
  playlistShow.height = '50%';
  playlistIndex.focus();
  screen.render();
}

function indexPlaylists(playlists) {
  if (typeof playlists !== 'object') {
    throw "Trying to read an invalid set of playlists"
  }
  var entries = playlists.map(function(pl) {
    var duration = 0;
    pl.forEach(function(track) { duration += track.duration });
    return pl.name + " - " + pl.length + " tracks @ " + fromSeconds(duration);
  });
  playlistIndex.setItems(entries);
}

var screen = blessed.screen();
var masterListView = blessed.list({
  parent:screen,
  label: ' Queue ',
  width: '50%',
  height: '100%',
  top: 0,
  right: 0,
  align: 'left',
  border: {
    type: 'line'
  }
});
var playlistIndex = blessed.list({
  parent: screen,
  label: ' Playlists ',
  width: '50%',
  height: '50%',
  top: 0,
  left: 0,
  align: 'left',
  fg: 'blue',
  border: {
    type: 'line'
  },
  selectedBg: 'green',
  keys: true
});
playlistIndex.on('select', function(data, index) {
  playlistViewIn(j.playlists[index]);
});
playlistIndex.on('cancel', function(data, index) {

});
var playlistShow = blessed.list({
  parent: screen,
  width: '50%',
  height: '50%',
  bottom: 0,
  left: 0,
  align: 'left',
  fg: 'blue',
  border: {
    type: 'line'
  },
  selectedBg: 'green',
  keys: true,
});
playlistShow.on('select', function(data, index) {

});
playlistShow.on('cancel', function(data, index) {
  playlistViewOut();
});
playlistIndex.focus();

screen.key('C-c', function(ch, key) {
  return process.exit(0);
});

function fromSeconds(seconds) {
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  seconds %= 60;
  minutes %= 60;

  // 0-pad the minutes and seconds
  seconds = seconds < 10 ? "0"+seconds : seconds;
  minutes = (hours && minutes < 10) ? "0"+minutes : minutes;

  if (hours) {
    return [hours, minutes, seconds].join(":");
  } else {
    return [minutes, seconds].join(":");
  }
}
