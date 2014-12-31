var blessed = require('blessed');
var TrackList = require('./tracklist');

module.exports = makeView;

function makeView(jukebox) {
  return new View(jukebox);
}

function View(jukebox) {
  var self = this;

  this.screen = blessed.screen();
  var instructions = blessed.Box({
    width: '100%',
    height: 2,
    bottom: 0,
    left: 0,
    align: 'left',
    parseTags: true,
  });
  var instructionLines = {
    specific: blessed.Box({
      height: 1,
      top: 0,
      align: 'left',
      parseTags: true,
    }),
    global: blessed.Box({
      height: 1,
      bottom: 0,
      align: 'right',
      parseTags: true,
    }),
  };
  instructions.append(instructionLines.specific);
  instructions.append(instructionLines.global);
  var interactivePanes = blessed.Box({
    top: 0,
    left: 0,
    right: 0,
    bottom: 2
  });

  this.jukebox = jukebox;

  this.masterListView = makeMasterListView(this.jukebox);
  this.playlistIndex = makePlaylistIndex(this.jukebox);
  this.playlistShow = makePlaylistShow(this.jukebox);

  interactivePanes.append(this.masterListView);
  interactivePanes.append(this.playlistIndex);
  interactivePanes.append(this.playlistShow);

  this.setHandlers(instructionLines);
  this.playlistIndex.setItems(this.jukebox.playlists);
  this.playlistIndex.focus();

  this.screen.append(interactivePanes);
  this.screen.append(instructions);
  this.screen.render();
}

var constantKeys = {
  space: 'play/pause',
  'S-right': 'skip forward',
  'S-left': 'skip backward',
  'Tab': 'focus/unfocus queue',
};

View.prototype.setHandlers = function(i) {
  var self = this;

  this.screen.key('C-c', function(ch, key) {
    return process.exit(0);
  });
  this.screen.key('space', function(ch, key) {
    self.jukebox
      .playPause()
      .done();
  });
  this.screen.key('tab, S-tab', function(ch, key) {
    if (self.masterListView.focused) {
      self.screen.rewindFocus();
    } else {
      self.screen.saveFocus();
      self.masterListView.focus();
    }
    self.screen.render();
  });
  this.screen.key('S-right', function(ch, key) {
    self.jukebox
      .advance(1)
      .done();
  });
  this.screen.key('S-left', function(ch, key) {
    self.jukebox
      .advance(-1)
      .done();
  });

  this.jukebox.on('advance', function(index) {
    self.masterListView.select(index);
    setQueueLabel();
    self.screen.render();
  });
  this.jukebox.on('force-pull', function(track, index) {
    self.masterListView.addItem(track);
    self.masterListView.select(index);
  });

  this.masterListView.on('select', function(data, index) {
    if (!data) return;
    self.jukebox
      .play(data.content, index)
      .done();
  });
  this.masterListView.key('delete, backspace', function() {
    self.jukebox.unqueue(self.masterListView.selected)
      .then(function(queue) {
        if (queue) {
          self.masterListView.setItems(queue);
          self.screen.render();
        }
      }).done();
  });
  instructions(this.masterListView, i, {
    'Enter': 'skip directly to track',
    'Del/Backspace': 'remove track from queue',
  });

  this.playlistIndex.on('select', function(data, index) {
    var playlist = data.content;
    self.playlistShow.setLabel(" "+playlist.name+" ");
    self.playlistShow.setItems(playlist);
    self.playlistShow.height = '100%';
    self.playlistShow.focus();
    self.screen.render();
  });
  this.playlistIndex.key('a', function(ch, key) {
    var playlist = getSelectedPlaylist(self.playlistIndex);
    if (playlist) {
      if (playlist.autoPull) playlist.autoPull = false;
      else playlist.autoPull = true;
      self.screen.render()
    }
  });
  this.playlistIndex.key('e', function(ch, key) {
    var playlist = getSelectedPlaylist(self.playlistIndex);
    if (playlist) {
      enqueueAllTracks(playlist);
      setQueueLabel();
      self.screen.render();
    }
  });
  instructions(this.playlistIndex, i, {
    Enter: 'browse selected playlist',
    A: 'toggle autoplay (queue draws from here if empty)',
    E: 'enqueue all tracks at once',
  });

  this.playlistShow.on('select', function(data, index) {
    enqueueTrack(data.content);
    setQueueLabel();
    self.screen.render();
  });
  this.playlistShow.on('cancel', function(data, index) {
    self.playlistShow.height = '50%';
    self.playlistIndex.focus();
    self.screen.render();
  });
  instructions(this.playlistShow, i, {
    Enter: 'enqueue track',
    Esc: 'return to playlist selection'
  });

  function getSelectedPlaylist(list) {
    var i = self.playlistIndex.selected,
        data = self.playlistIndex.getItem(i),
        playlist;
    if (data) return data.content;
  }

  function setQueueLabel() {
    self.masterListView.setLabel(queueTitle(self.jukebox.pending()));
  }

  function enqueueTrack(track) {
    self.jukebox.enqueue(track);
    self.masterListView.addItem(track);
  }

  function enqueueAllTracks(playlist, includeEnqueued) {
    playlist.filter(function(track) {
      return true || includeEnqueued || self.jukebox.isNotEnqueued(track);
    }).forEach(function(track) {
      enqueueTrack(track);
    });
  }
}

function makeMasterListView(j) {
  var tl = TrackList({
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
  selectionStyle(tl, {bg: 'green', fg: 'light white'});
  return tl
}

function makePlaylistIndex(j) {
  var tl = TrackList({
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
      var autoPull = pl.autoPull ? " {light-red-fg}(auto){/}" : ""
      return pl.name + " - " + pl.length + " tracks @ " + duration + autoPull;
    },
  });
  selectionStyle(tl, {bg: 'green', fg: 'light white'});
  return tl;
}

function makePlaylistShow(j) {
  var tl = TrackList({
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
  selectionStyle(tl, {bg: 'green', fg: 'light white'});
  return tl;
}

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

function queueTitle(pending) {
  var duration = fromSeconds(durationOfTracks(pending));
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

function instructions(list, lines, keys) {
  var focusSpecificHelp = [];
  var globalHelp = [];
  Object.keys(keys).forEach(function(key) {
    focusSpecificHelp.push("{light-magenta-fg}"+key+":{/} "+keys[key]);
  });
  Object.keys(constantKeys).forEach(function(key) {
    globalHelp.push("{cyan-fg}"+key+":{/} "+constantKeys[key]);
  });
  list.on('focus', function() {
    lines.specific.setContent(focusSpecificHelp.join(" "));
    lines.global.setContent(globalHelp.join(" "));
  });
}
