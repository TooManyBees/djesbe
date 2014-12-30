if (process.mainModule && process.mainModule.filename === process.argv[1]) {
  require('./app')
} else {
  exports.Jukebox = require('./src/jukebox');
  exports.Track = require('./src/track');
}
