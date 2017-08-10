const irc = require('irc');
const http = require('http');
const linkinfo = require('./modules/linkinfo.js');
const config = require('./config.json');


const client = new irc.Client(config.server, config.nick, {
    channels: ['#deltion-test'],
    floodProtection: true,

});

client.addListener('message', function (from, to, message) {
  console.log(`[${to}] ${from}: ${message}`);
  const data = { from, to, message, client };

  linkinfo(data);
});
