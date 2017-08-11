const getUrls = require('get-urls');
const baseRequest = require('request');
const htmlparser = require('htmlparser2');
const colors = require('irc-colors');
const config = require('../config.json');
const imageBase64 = require('image-base64');
const noEncodingRequest = require('request').defaults({ encoding: null });
const tmp = require('tmp');
const exiftool = require('node-exiftool');
const fs = require('fs');
const moment = require('moment');

const request = baseRequest.defaults({
  timeout: 2000,
  strictSSL: false,
});

function sanitizeContent(content, length = 250) {
  let affix = '';
  if (content.length > length) affix = '...';

  return content.replace(/(?:\r\n|\r|\n)/g, ' ')
    .slice(0, length) + affix;
}

function parseHtml(url, data) {
  const { client, to } = data;
  request.get(url, function onRequestGetResponse(error, response, body) {
    if (error) return;
    let isTitle = false;
    let title = '';
    let contentType;
    let contentWidth;
    let contentHeight;
    let twitterHandle;
    const parser = new htmlparser.Parser({
      onopentag(name, tagInfo) {
        if (name === 'meta') {
          if (tagInfo.property === 'og:type') contentType = sanitizeContent(tagInfo.content, 80);
          if (tagInfo.itemprop === 'width') contentWidth = sanitizeContent(tagInfo.content, 80);
          if (tagInfo.itemprop === 'height') contentHeight = sanitizeContent(tagInfo.content, 80);
          if (tagInfo.name === 'twitter:site') twitterHandle = sanitizeContent(tagInfo.content, 80);
        }
        if (name === 'title') isTitle = true;
      },
      onclosetag(name) {
        if (name === 'title') isTitle = false;
      },
      ontext(text) {
        if (isTitle) title = title + text;
      },
      onend() {
        let message = [];
        if (title && contentType) message.push(colors.blue.bold(`Title (${contentType}): `) + colors.underline.green(title));
        else if (title) message.push(colors.blue.bold('Title: ') + colors.underline.green(sanitizeContent(title)));
        if (contentWidth && contentWidth) message.push(`${contentWidth}x${contentHeight}`);
        if (twitterHandle) message.push(`${twitterHandle}`);
        client.say(to, message.join(colors.bold(' | ')));
      }
    }, { decodeEntities: true });

    parser.write(body);
    parser.end();
  });
}

function formatArray(arr){
  let outStr = "";
  if (arr.length === 1) {
    outStr = arr[0];
  } else if (arr.length === 2) {
    outStr = arr.join(' and ');
  } else if (arr.length > 2) {
    outStr = arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1);
  }
  return outStr;
}

function imageVision(url, data) {
  if (!config.googleVisionKey) return;
  const { client, to } = data;
  console.log('Checking image')
  noEncodingRequest.get(url, function(error, response, body) {
    const base64 = new Buffer(body).toString('base64');

    request.post(`https://vision.googleapis.com/v1/images:annotate?key=${config.googleVisionKey}`, {
      body: JSON.stringify({
        requests: [{
          image: {
            content: base64,
          },
          features: [{
            type: 'LABEL_DETECTION',
          }, {
            type: 'SAFE_SEARCH_DETECTION',
          }]
        }]
      }),
    }, function(error, response, body) {
      if (error) return console.log(error);
      const json = JSON.parse(body);
      const data = json.responses[0];
      let message = [];
      if (!data || !data.labelAnnotations) return;
      const descs = data.labelAnnotations.map(o => o.description);
      let nsfw = '';

      if (data.labelAnnotations.length > 0) {
        message.push(`I see ${formatArray(descs)}`);
      }

      switch(data.safeSearchAnnotation.adult) {
        case 'POSSIBLE':
          message.push(colors.yellow('Might be NSFW'));
          break;
        case 'LIKELY':
        case 'VERY_LIKELY':
          message.push(colors.red.bold('NSFW!'));
          break;
      }
      switch(data.safeSearchAnnotation.spoof) {
        case 'LIKELY':
        case 'VERY_LIKELY':
          message.push(colors.green.bold('MEME!'));
          break;
      }

      client.say(to, message.join(colors.bold(' | ')));
    });

  });
}

function parsePdf(url, data) {
  const { client, to } = data;
  const filename = tmp.tmpNameSync({ postfix: '.txt' });
  request(url).pipe(fs.createWriteStream(filename)).on('finish', function() {
    const ep = new exiftool.ExiftoolProcess()

    ep
      .open()
      .then((pid) => console.log('Started exiftool process %s', pid))
      .then(() => ep.readMetadata(filename, ['-File:all']))
      .then((res) => {
        if (!res.data || !res.data[0]) return;
        const data = res.data[0];
        let message = [];
        if (data.Title) message.push(colors.underline.green(sanitizeContent(data.Title)));
        else message.push(colors.underline.green('PDF file'));
        if (data.Author) message.push(`By ${sanitizeContent(data.Author)}`);
        if (data.ModifyDate) {
          const date = moment(data.ModifyDate, 'YYYY:MM:DD HH:mm:ss');
          if (date.isValid()) message.push(`Last modified ${date.fromNow()}`);
        }
        else if (data.CreateDate) {
          const date = moment(data.CreateDate, 'YYYY:MM:DD HH:mm:ss');
          if (date.isValid()) message.push(`Created ${date.fromNow()}`);
        }
        client.say(to, message.join(colors.bold(' | ')));
      }, console.error)
      .then(() => ep.close())
      .then(() => console.log('Closed exiftool'), console.error)
  });
}

function checkContentType(url, data) {
  request.head(url, function(error, response) {
    if (error) return console.log(error);
    const headers = response.headers;
    if (headers['content-type'].match(/text\/html/)) {
      parseHtml(url, data);
    }
    else if (headers['content-type'].match(/image/)) {
      imageVision(url, data);
    }
    else if (headers['content-type'].match(/\/pdf/)) {
      parsePdf(url, data);
    }
  })
}

function linkinfo(data) {
  const urls = getUrls(data.message);
  console.log('Checking', urls);
  if (urls.length === 0) {
    return data;
  }

  for (const url of urls) {
    checkContentType(url.replace(/,$/, ''), data);
  }

  return data;
}

module.exports = linkinfo;
