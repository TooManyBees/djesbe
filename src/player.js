var Lame = require('lame').Decoder;
var Ogg = require('ogg').Decoder;
var Vorbis = require('vorbis').Decoder;

module.exports = playerFor;

var mapping = {
  mp3: function(cb) {
    var lame = new Lame;
    lame.on('format', cb);
    return lame;
  },
  ogg: function(cb) {
    var ogg = new Ogg;
    ogg.on('stream', function(stream) {
      vorbis = new Vorbis();
      vorbis.on('format', function(format) {
        cb(format, vorbis);
      });
      stream.pipe(vorbis);
    });
    return ogg;
  }
}

function playerFor(extension, callback) {
  var decoder = mapping[extension];
  if (decoder) return decoder(callback);
}
