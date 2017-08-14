const request = require('request');
const line = require('bresenham');
const Canvas = require('drawille');
const colors = require('irc-colors');
const moment = require('moment');
const padStart = require('lodash/padStart');


const canvas = new Canvas(150, 80);
let lastPrice = 0;

function getPrice(callback) {
  request('https://api.coindesk.com/v1/bpi/currentprice.json', function(error, response, body) {
    if (error) return console.error(error);
    let currentJson;
    try {
      currentJson = JSON.parse(body);
    } catch(e) { console.error(e); }
    if (!currentJson || !currentJson.bpi) return console.error('Invalid Json');
    callback(currentJson.bpi.USD.rate_float);
  });
}

getPrice(price => lastPrice = price)

function getCurrentPrice(data) {
  const { client, to, message } = data;

  if (message !== '!btc') return data;
  getPrice(price => {
    if (lastPrice === price) {
      client.say(to, 'The current BTC price in USD: ' + colors.blue(`$${price.toFixed(2)} (▶ 0%)`));
    } else if (lastPrice > price) {
      const percent = ((lastPrice / price) - 1) * 100;
      client.say(to, 'The current BTC price in USD: ' + colors.red(`$${price.toFixed(2)} (▼ ${percent.toFixed(2)}%)`));
    } else {
      const percent = (1 - (lastPrice / price)) * 100;
      client.say(to, 'The current BTC price in USD: ' + colors.green(`$${price.toFixed(2)} (▲ ${percent.toFixed(2)}%)`));
    }
    lastPrice = price;
  })

}

// https://api.coindesk.com/v1/bpi/historical/close.json
function getChart(data) {
  const { client, to, message } = data;

  if (message !== '!plotBTC') return data;

  request('https://api.coindesk.com/v1/bpi/currentprice.json', function(error, response, body) {
    if (error) return console.error(error);
    let currentJson;
    try {
      currentJson = JSON.parse(body);
    } catch(e) { console.error(e); }
    if (!currentJson || !currentJson.bpi) return console.error('Invalid Json');
    const currentPrice = currentJson.bpi.USD.rate_float;

    request('https://api.coindesk.com/v1/bpi/historical/close.json', function(error, response, body) {
      if (error) return console.error(error);
      let json;
      try {
        json = JSON.parse(body);
      } catch(e) { console.error(e); }
      if (!json || !json.bpi) return console.error('Invalid Json')

      const values = Object.keys(json.bpi).map(o => json.bpi[o]);
      values.push(currentPrice);
      const low = values.reduce((m, k) => Math.min(k, m), 99999999);
      const high = values.reduce((m, k) => Math.max(k, m), 0);
      const initialDate = moment(Object.keys(json.bpi)[0]);

      const draw = canvas.set.bind(canvas);


      let prevX = 0;
      let prevY = 0;
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const x = i * (150/values.length);
        const y = 79 - ((value - low) / (high - low)) * 79;
        prevY = prevY === 0 ? y : prevY;
        line(prevX, prevY, x, y, draw);
        prevY = y;
        prevX = x;
      }

      const lines = canvas.frame(',').split(',');
      let footer = '';
      console.log(initialDate, values[0]);
      for (let i = 0; i < (150/2) + 4; i++) {
        if (i < 5) footer = `${footer} `;
        else if (i === 5) footer = `${footer}⣇`
        else footer = `${footer}⣀`;
      }
      let dates = '';
      for (let i = 0; i < (150/20); i++) {
        const month = padStart(initialDate.month() + 1, 2, '0');
        const day = padStart(initialDate.date(), 2, '0');
        initialDate.add(31/8, 'days');
        initialDate.add(12, 'hours');
        dates = `${dates}     ${day}/${month}`;
      }

      const frame = lines.map((line, i) => {
        const pdown = 1 - (i / (80/4));
        const l = ((high - low) * pdown + low);
        // console.log(l, pdown)
        const n = (i % 3) === 0 ? Math.round(l) : '    ';
        return `${n} ⡇${colors.green(line)}`;
      });

      frame[frame.length - 1] = (footer);
      frame.push(dates);

      // process.stdout.write(frame.join('\n') + '\n');
      client.say(to, frame.join('\n'));
    });
  });

  return data;
}

module.exports = {
  getChart,
  getCurrentPrice,
};
