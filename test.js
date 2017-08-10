const linkinfo = require('./modules/linkinfo.js');

console.warn('WARNING, THIS FILE CONTAINS NSFW CONTENT');
const client = {
  say(...props) { console.log(...props) }
};

linkinfo({
  from: 'test',
  to: '#test',
  message: 'Hello check http://dm.damcdn.net/pics/wp-content/uploads/2016/08/pov-naked-girl-shower.jpg, http://i3.kym-cdn.com/photos/images/newsfeed/001/217/729/f9a.jpg for more info. cya.info https://www.youtube.com/watch?v=mvTu5R0BafM.',
  client,
})

linkinfo({
  from: 'test',
  to: '#test',
  message: 'This link: http://lifehacker.com/how-to-choose-the-best-mechanical-keyboard-and-why-you-511140347, has a <title></title> in the CSS',
  client,
})
