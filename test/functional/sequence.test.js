import path from 'path';
import fs from 'fs';
import async from 'async';

import { prep, sub } from '../../src';

const sequenceInputFile = (i) => {
  return path.join(__dirname, '..', 'resources', 'sequence', `cam1_${i}.jpg`);
};

const sequenceOutputFile = (i) => {
  return path.join(__dirname, '..', 'output', 'sequence', `cam1_${i}.jpg`);
};

describe('sequence', () => {

  it('can reduce a sequence to those with diffs', function(done) {
    this.timeout(50000);

    let threshold = 5;
    const indices = [];
    for (let i = 0; i < 509; ++i) {
      indices.push(i);
    }
    async.reduce(indices, [], (acc, i, cb) => {
      const nextFilename = sequenceInputFile(i);
      async.waterfall([
        (cb) => {
          fs.readFile(nextFilename, cb);
        },
        (file, cb) => {
          prep(file, cb);
        },
      ], (err, image) => {
        if (err) {
          cb(err);
        } else if (!acc.length) {
          acc.push(image);
          cb(null, acc);
        } else {
          const last = acc[acc.length - 1];
          sub(last, image, (err, subResult) => {
            if (err) {
              cb(err);
            } else {
              console.log('%', subResult.percentage);
              if (subResult.percentage > threshold) {
                acc.push(image);
              }
              cb(null, acc);
            }
          });
        }
      });
    }, (err, acc) => {
      if (err) {
        done(err);
      } else {
        const toWrite = acc.map((image, i) => {
          return {
            i,
            image,
          };
        });
        async.each(toWrite, (obj, cb) => {
          obj.image.writeFile(sequenceOutputFile(obj.i), 'jpg', cb);
        }, done);
      }
    });

  });

});
