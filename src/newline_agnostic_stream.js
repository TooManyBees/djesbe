var util = require('util');
var stream = require('stream');
var fs = require('fs');

module.exports = makeStream;

function makeStream(filename) {
  return fs.createReadStream(filename, {
    encoding: 'utf8'
  }).pipe(new LineBreak)
}

util.inherits(LineBreak, stream.Transform);
function LineBreak() {
  stream.Transform.call(this);
  this.setEncoding('utf8');
}

LineBreak.prototype._transform = function(chunk, enc, cb) {
  if (Buffer.isBuffer(chunk)) {
    chunk = chunk.toString('utf8');
  }
  this.push(chunk.replace(/\r\n?/gm,"\n"));
  cb();
}
