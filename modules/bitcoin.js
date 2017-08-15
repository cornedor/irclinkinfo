const request = require('request');
const line = require('bresenham');
const Canvas = require('drawille');
const colors = require('irc-colors');
const moment = require('moment');
const padStart = require('lodash/padStart');


const canvas = new Canvas(150, 80);
let lastUSDPrice = 0;
let lastEURPrice = 0;

function getPrice(callback, type) {
  request('https://api.coindesk.com/v1/bpi/currentprice.json', function(error, response, body) {
    if (error) return console.error(error);
    let currentJson;
    try {
      currentJson = JSON.parse(body);
    } catch(e) { console.error(e); }
    if (!currentJson || !currentJson.bpi) return console.error('Invalid Json');
    callback(currentJson.bpi[type].rate_float);
  });
}

getPrice(price => lastUSDPrice = price, 'USD');
getPrice(price => lastEURPrice = price, 'EUR');

function getCurrentPrice(data) {
  const { client, to, message } = data;

  if (message !== '!btc' && message !== '!btceur') return data;
  const type = message  === '!btceur' ? 'EUR' : 'USD';
  const prefix = `The current BTC price in ${type}: `;
  const sign = type === 'EUR' ? '€ ' : '$';
  const last = type === 'EUR' ? lastEURPrice : lastUSDPrice;

  getPrice(price => {
    if (last === price) {
      client.say(to, prefix + colors.blue(`${sign}${price.toFixed(2)} (▶ 0%)`));
    } else if (last > price) {
      const percent = ((last / price) - 1) * 100;
      client.say(to, prefix + colors.red(`${sign}${price.toFixed(2)} (▼ ${percent.toFixed(2)}%)`));
    } else {
      const percent = (1 - (last / price)) * 100;
      client.say(to, prefix + colors.green(`${sign}${price.toFixed(2)} (▲ ${percent.toFixed(2)}%)`));
    }
    if (type === 'EUR') {
      lastEURPrice = price;
    } else {
      lastUSDPrice = price;
    }
  }, type);

  return data;
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
        const value = values[i] - 1; // -1 to prevent a negative coordinate.
        const x = i * (150/values.length);
        const y = 79 - ((value - low) / (high - low)) * 79;
        prevY = prevY === 0 ? y : prevY;
        line(prevX, prevY, x, y, draw);
        prevY = y;
        prevX = x;
      }

      const lines = canvas.frame(',').split(',');
      let footer = '';
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

      client.say(to, frame.join('\n'));
    });
  });

  return data;
}

module.exports = {
  getChart,
  getCurrentPrice,
};
