#!/usr/bin/env node

const lwip = require('lwip');
const async = require('async');

// Create 500x500 test images that have white at the bottom %
[0, 10, 25, 50, 100].forEach(whitePercentage => {
  const blackPercentage = 100 - whitePercentage;
  const whiteLines = Math.round(500*whitePercentage/100);
  const blackLines = 500 - whiteLines;
  console.log(blackPercentage, whitePercentage, whiteLines, blackLines);
  async.waterfall([
    (cb) => {
      // Can't create an image with 0 height
      if (blackLines === 0) {
        lwip.create(500, whiteLines, 'white', cb);
      } else {
        lwip.create(500, blackLines, 'black', cb);
      }
    },
    (image, cb) => {
      if (blackLines === 0) {
        cb(null, image);
      } else {
        image.pad(0, 0, 0, whiteLines, 'white', cb);
      }
    },
    (image, cb) => {
      image.writeFile(`./test_${whitePercentage}.png`, 'png', cb);
    },
  ], (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('done');
    }
  });
});
