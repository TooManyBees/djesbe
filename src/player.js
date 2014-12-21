var Lame = require('lame').Decoder;

var mapping = {
  mp3: function() { return new Lame; }
}

function playerFor(extension) {
  var decoder = mapping[extension];
  if (decoder) return decoder();
}
