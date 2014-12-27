var blessed = require('blessed');

module.exports = TrackList;

function TrackList(options) {
  if (!(this instanceof blessed.Node)) {
    return new TrackList(options);
  }
  this.displayFn = options.displayFn || function(id) {return id};
  blessed.list.call(this, options);
};

TrackList.prototype.__proto__ = blessed.list.prototype;

TrackList.prototype.add =
TrackList.prototype.addItem =
TrackList.prototype.appendItem = function(item) {
  var self = this;

  this.ritems.push(item);

  // Note: Could potentially use Button here.
  var options = {
    screen: this.screen,
    content: item,
    displayFn: this.displayFn,
    align: this.align || 'left',
    top: this.itop + this.items.length,
    left: this.ileft,
    right: this.iright,
    tags: this.parseTags,
    height: 1,
    hoverEffects: this.mouse ? this.style.item.hover : null,
    focusEffects: this.mouse ? this.style.item.focus : null,
    autoFocus: false
  };

  if (this.screen.autoPadding) {
    options.top = this.items.length;
    options.left = 1;
    options.right = 1;
  }

  ['bg', 'fg', 'bold', 'underline',
   'blink', 'inverse', 'invisible'].forEach(function(name) {
    options[name] = function() {
      var attr = self.items[self.selected] === item
        ? self.style.selected[name]
        : self.style.item[name];
      if (typeof attr === 'function') attr = attr(item);
      return attr;
    };
  });

  var item = new TrackBox(options, this.items.length);

  this.items.push(item);
  this.append(item);

  if (this.items.length === 1) {
    this.select(0);
  }

  if (this.mouse) {
    item.on('click', function(data) {
      if (self.items[self.selected] === item) {
        self.emit('action', item, self.selected);
        self.emit('select', item, self.selected);
        return;
      }
      self.select(item);
      self.screen.render();
    });
  }
}

function TrackBox(options, playlistIndex) {
  this.displayFn = options.displayFn || function(id){return id};
  this.playlistIndex = playlistIndex;
  blessed.box.call(this, options);
}

TrackBox.prototype.__proto__ = blessed.box.prototype;

var wideChars = new RegExp('(['
  + '\\uff01-\\uffbe'
  + '\\uffc2-\\uffc7'
  + '\\uffca-\\uffcf'
  + '\\uffd2-\\uffd7'
  + '\\uffda-\\uffdc'
  + '\\uffe0-\\uffe6'
  + '\\uffe8-\\uffee'
  + '])', 'g');

TrackBox.prototype.parseContent = function(noTags) {
  if (this.detached) return false;

  var width = this.width - this.iwidth;
  var displayContent = this.displayFn(this.content, this.playlistIndex);
  if (this._clines == null
      || this._clines.width !== width
      || this._clines.content !== displayContent) {
    var content = displayContent
          .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1a\x1c-\x1f\x7f]/g, '')
          .replace(/\x1b(?!\[[\d;]*m)/g, '')
          .replace(/\r\n|\r/g, '\n')
          .replace(/\t/g, this.screen.tabc)
          .replace(wideChars, '?');

    if (!noTags) {
      content = this._parseTags(content);
    }

    this._clines = this._wrapContent(content, width);
    this._clines.width = width;
    this._clines.content = content;
    this._clines.attr = this._parseAttr(this._clines);
    this._clines.ci = [];
    this._clines.reduce(function(total, line) {
      this._clines.ci.push(total);
      return total + line.length + 1;
    }.bind(this), 0);

    this._pcontent = this._clines.join('\n');
    this.emit('parsed content');

    return true;
  }

  // Need to calculate this every time because the default fg/bg may change.
  this._clines.attr = this._parseAttr(this._clines) || this._clines.attr;
  return false;
}
