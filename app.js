var blessed = require('blessed');
var TrackList = require('./src/tracklist');

var Jukebox = require('./src/jukebox');

var j = new Jukebox();
j.load("./playlists").then(function() {
  indexPlaylists(j.playlists);
  screen.render();
}).done();

j.on('advance', function(index, track) {
  masterListView.select(index);
  masterListView.setLabel(queueTitle());
  screen.render();
});

j.on('stop', function(index, track) {
  screen.render();
});

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
  parseTags: true,
  keys: true,
  displayFn: function(track, index) {
    var bg = (j._cursor === index) ? '{bold}' : '';
    var fg = (j._cursor > index) ? '{light-black-fg}' : '';
    return (fg || bg) ? fg+bg+track.title+'{/}' : track.title;
  },
});
selectionStyle(masterListView, {bg: 'green', fg: 'light white'});
masterListView.on('select', function(data, index) {

});
masterListView.key('delete, backspace', function() {
  j.unqueue(masterListView.selected);
  screen.render();
});
var playlistIndex = TrackList({
  parent: screen,
  label: ' Playlists ',
  width: '50%',
  height: '50%',
  top: 0,
  left: 0,
  align: 'left',
  style: {
    item: {
      fg: 'blue',
    },
  },
  parseTags: true,
  border: {
    type: 'line'
  },
  keys: true,
  displayFn: function(pl) {
    var duration = fromSeconds(durationOfTracks(pl));
    return pl.name + " - " + pl.length + " tracks @ " + duration;
  },
});
selectionStyle(playlistIndex, {bg: 'green', fg: 'light white'});
playlistIndex.on('select', function(data, index) {
  playlistViewIn(data.content);
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
  style: {
    item: {
      fg: 'blue',
    },
  },
  parseTags: true,
  border: {
    type: 'line'
  },
  keys: true,
  displayFn: function(track) {
    var title = j.isEnqueued(track)
      ? '{light-black-fg}'+track.title+'{/}'
      : track.title;
    return title;
  },
});
selectionStyle(playlistShow, {bg: 'green', fg: 'light white'});
playlistShow.on('select', function(data, index) {
  j.enqueue(data.content);
  masterListView.addItem(data.content);
  masterListView.setLabel(queueTitle());
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
screen.key('space', function(ch, key) {
  j.playPause();
});
screen.key('tab', function(ch, key) {
  if (!masterListView.focused) {
    screen.saveFocus();
    masterListView.focus();
    screen.render();
  }
});
screen.key('S-tab', function(ch, key) {
  if (masterListView.focused) {
    screen.rewindFocus();
    screen.render();
  }
});
screen.key('S-right', function(ch, key) {
  j.advance(1);
});
screen.key('S-left', function(ch, key) {
  j.advance(-1);
});

function durationOfTracks(tracks) {
  var duration = 0;
  tracks.forEach(function(track) {duration += track.duration});
  return duration;
}

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

function queueTitle() {
  var duration = fromSeconds(durationOfTracks(j.pending()));
  return " Queue - "+duration+" remaining";
}

function selectionStyle(list, opts) {
  list.on('focus', function() {
    list.style.selected.bg = opts.bg;
    list.style.selected.fg = opts.fg;
  });
  list.on('blur', function() {
    list.style.selected.bg = undefined;
    list.style.selected.fg = undefined;
  });
}
