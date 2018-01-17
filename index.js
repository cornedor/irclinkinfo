const irc = require('funsocietyirc-client');
const http = require('http');
const prompt = require('prompt');
const linkinfo = require('./modules/linkinfo.js');
const assistant = require('./modules/assistant.js');
const bitcoin = require('./modules/bitcoin.js');
const config = require('./config.json');

const client = new irc.Client(config.server, config.nick, {
  channels: config.channels,
  floodProtection: true,
});

client.addListener('error', function(message) {
  console.error(message);
});

client.addListener('message', function (from, to, message) {
  console.log(`[${to}] ${from}: ${message}`);
  const data = { from, to, message, client };

  assistant.parse(data);
  bitcoin.getCurrentPrice(bitcoin.getChart(linkinfo(data)));
});

client.addListener('pm', function (from, message) {
  console.log(`${from}: ${message}`);
  const data = { from, to: from, message, client };

  bitcoin.getCurrentPrice(bitcoin.getChart(linkinfo(data)));
});

client.addListener('notice', function (nick, to, message) {
  console.log(`!${to}! ${nick}: ${message}`);
  if (message.match(/This nickname is registered\./)) {
    client.say('nickserv', `identify ${config.nick} ${config.nickservPassword}`);
  }
});

// TODO: make this cleaner
prompt.start();
function showPrompt() {
  prompt.get(['command'], (err, result) => {
    if (err) return showPrompt();
    // console.log(result.command);
    if (result.command === 'say') {
      prompt.get(['to', 'message'], (err, result) => {
        if (err) return showPrompt();
        client.say(result.to, result.message);
        showPrompt();
      });
    } else if (result.command === 'login') {
      prompt.get({ properties: { nick: {},  password: { hidden: true }}}, (err, result) => {
        if (err) return showPrompt();
        client.say('nickserv', `identify ${result.nick} ${result.password}`);
        showPrompt();
      });
    } else if (result.command === 'join') {
      prompt.get(['channel'], (err, result) => {
        if (err) return showPrompt();
        client.join(result.channel);
        showPrompt();
      });
    } else if (result.command === 'exit') {
      client.disconnect();
      console.log('Bye!');
      prompt.stop();
    } else {
      showPrompt();
    }
  });
}

showPrompt();
