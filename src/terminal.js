var readline = require('readline');

module.exports = makeTerminal;

function makeTerminal(__commands) {
  var commands = Object.keys(__commands);

  function completeCommand(word) {
    var hits = commands.filter(function(c) {
      return c.indexOf(word) == 0
    });
    return [hits.length ? hits : commands, word];
  }

  var term = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: completeCommand
  });

  term.on('line', function(line) {
    var args = line.trim().split(/\s+/);
    var cmd = args.splice(0,1);
    if (typeof __commands[cmd] === 'function') __commands[cmd](args);
  });
  return term;
}
