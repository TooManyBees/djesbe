#!/usr/bin/env node
var Jukebox = require('./src/jukebox');
var View = require('./src/view');
var path = require('path');

var playlistDir = path.resolve(process.argv[2] || ".");

var j = new Jukebox();

j.load(playlistDir)
  .then(function() {
    View(j);
  })
  .catch(function(err) {
    console.error("Error: "+err);
  })
  .done();
