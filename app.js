var blessed = require('blessed');

var Jukebox = require('./src/jukebox');
var makeTerminal = require('./src/terminal')

var j = new Jukebox();
j.load("./playlists").then(function() {
  // console.log(j.playlists)
  // var terminal = makeTerminal(commandTable)
  viewPlaylist(j.playlists["Cookie"]);
  indexPlaylists(j.playlists);
  screen.render();
}).done();

var commandTable = {
  enqueue: function(track) { console.log("Enqueuing "+track) },
  cancel: function(track) { console.log("Canceling "+track) },
  play: function() { console.log("Playing") },
  pause: function() { console.log("Pausing") }
};

var currentPlaylist;

function viewPlaylist(playlist) {
  if (typeof playlist !== "object") {
    throw "Playlist not found"
  }
  var entries = playlist.map(function(track) {
    return track.title + " ("+fromSeconds(track.duration)+")";
  });
  playlistShow.prepend(blessed.text({
    left: 2,
    content: " "+playlist.name+" "
  }));
  playlistShow.setItems(entries);
}

function indexPlaylists(playlists) {
  if (typeof playlists !== 'object') {
    throw "Playlists are not valid"
  }
  var entries = Object.keys(playlists).map(function(name) {
    return name + " (" + playlists[name].length + ")";
  });
  playlistIndex.prepend(blessed.text({
    left: 2,
    content: " Playlists... "
  }));
  playlistIndex.setItems(entries);
}

var screen = blessed.screen();
var masterListView = blessed.list({
  parent:screen,
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
playlistIndex.focus();
// playlistShow.focus();

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
