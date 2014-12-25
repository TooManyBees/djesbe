var blessed = require('blessed');
var TrackList = require('./src/tracklist');

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
  playlistShow.setLabel(" "+playlist.name+" ");
  playlistShow.setItems(playlist);
  playlistShow.height = '100%';
  playlistShow.focus();
}

function playlistViewOut() {
  playlistShow.height = '50%';
  playlistIndex.focus();
}

function indexPlaylists(playlists) {
  if (typeof playlists !== 'object') {
    throw "Trying to read an invalid set of playlists"
  }
  playlistIndex.setItems(playlists);
}

var screen = blessed.screen();
var masterListView = TrackList({
  parent:screen,
  label: ' Queue ',
  width: '50%',
  height: '100%',
  top: 0,
  right: 0,
  align: 'left',
  border: {
    type: 'line'
  },
  displayFn: function(track) {
    return track.title;
  },
});
var playlistIndex = TrackList({
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
  keys: true,
  displayFn: function(pl) {
    var duration = 0;
    pl.forEach(function(track) { duration += track.duration });
    return pl.name + " - " + pl.length + " tracks @ " + fromSeconds(duration);
  },
});
playlistIndex.on('select', function(data, index) {
  j.currentPlaylist = j.playlists[index];
  playlistViewIn(j.currentPlaylist);
  screen.render();
});
playlistIndex.on('cancel', function(data, index) {

});
var playlistShow = TrackList({
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
  displayFn: function(track) {
    return track.title;
  },
});
playlistShow.on('select', function(data, index) {
  j.enqueue(j.currentPlaylist[index]);
  masterListView.addItem(j.currentPlaylist[index])
  screen.render();
});
playlistShow.on('cancel', function(data, index) {
  playlistViewOut();
  screen.render();
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
