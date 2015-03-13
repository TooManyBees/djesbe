// An action represents an enqueuing or unqueuing of
// a number of tracks. Basically something which can
// be reversed in order to provide undo levels.

exports.UndoBuffer = UndoBuffer;
exports.Enqueue = Enqueue;
exports.Unqueue = Unqueue;

function Enqueue(options) {
  this.tracks = options.tracks;
}

Enqueue.prototype.execute = function(registry) {
  registry.enqueue.forEach(function(el){
    el(this.tracks);
  }, this);
}

function Unqueue(options) {
  this.index = options.index;
  this.len = options.len;
}

Unqueue.prototype.execute = function(registry) {
  registry.unqueue.forEach(function(el) {
    el(this.index, this.len);
  }, this);
}

function UndoBuffer(limit) {
  this.limit = limit || 5;
  this.buffer = [];
  this.registry = {
    enqueue: [],
    unqueue: [],
  };
}

UndoBuffer.prototype.store = function(undo) {
  this.buffer.push(undo);
  if (this.buffer.length > this.limit) this.buffer.shift();
}

UndoBuffer.prototype.rewind = function() {
  if (this.buffer.length > 0) this.buffer.pop().execute(this.registry);
}

// Pass a callback function in (one or more times) and they will be executed upon enqueuing tracks and unqueuing them
// The most basic unqueuing function is to obviously remove them from the playlist

UndoBuffer.prototype.registerUnqueue = function(cb, thisArg){
  this.registry.unqueue.push(cb.bind(thisArg));
};

UndoBuffer.prototype.registerEnqueue = function(cb, thisArg){
  this.registry.enqueue.push(cb.bind(thisArg));
};
