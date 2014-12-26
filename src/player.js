var Lame = require('lame').Decoder;

module.exports = playerFor;

var mapping = {
  mp3: function() { return new Lame; }
}

function playerFor(extension) {
  var decoder = mapping[extension];
  if (decoder) return decoder();
}
