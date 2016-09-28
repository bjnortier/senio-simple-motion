import path from 'path';
import fs from 'fs';
import async from 'async';
import expect from 'expect';
import prettyHrtime from 'pretty-hrtime';
import debug from 'debug';

import { prep, sub } from '../../src';

// Only output when ENV has DEBUG=senio-simple-motion:test
const dT = () => {
  let t0 = process.hrtime();
  return (label) => {
    debug('senio-simple-motion:test')(label, prettyHrtime(process.hrtime(t0)));
    t0 = process.hrtime();
  };
};

const testResource = (filename) => {
  return path.join(__dirname, '..', 'resources', filename);
};

const testOutput = (filename) => {
  return path.join(__dirname, '..', 'output', filename);
};

describe('diff', () => {

  it('calculates percentage', function(done) {
    this.timeout(10000);

    const whites = [0, 10, 25, 50, 100];
    const combos = [];
    for (let i = 0; i < whites.length; ++i) {
      for (let j = 0; j < whites.length; ++j) {
        if (i !== j) {
          combos.push([i, j]);
        }
      }
    }
    const t0 = dT();
    async.waterfall([
      (cb) => {
        async.map(whites, (white, cb) => {
          fs.readFile(testResource(`test_${white}.png`), cb);
        }, cb);
      },
      (buffers, cb) => {
        t0('read:');
        async.map(buffers, (buf, cb) => {
          prep(buf, cb);
        }, cb);
      },
      (images, cb) => {
        t0('prep:');
        async.map(combos, (combo, cb) => {
          const [i1, i2] = combo;
          sub(images[i1], images[i2], cb);
        }, cb);
      },
    ], (err, diffs) => {
      t0('diff:');
      if (err) {
        done(err);
      } else {
        diffs.forEach((diff, i) => {
          const w1 = whites[combos[i][0]];
          const w2 = whites[combos[i][1]];
          const expectedDiff = Math.abs(w2 - w1);
          expect(diff.percentage).toEqual(expectedDiff);
        });

        done();
      }
    });

  });

  it('can create grayscale & diff images', (done) => {
    const b1 = fs.readFileSync(testResource('m200_a.jpg'));
    const b2 = fs.readFileSync(testResource('m200_b.jpg'));

    async.parallel([
      (cb) => {
        prep(b1, cb);
      },
      (cb) => {
        prep(b2, cb);
      },
    ], (err, results) => {
      if (err) {
        done(err);
      } else {
        async.parallel([
          (cb) => {
            async.map(results.map((r, i) => ({image: r, i})), (obj, cb) => {
              obj.image.writeFile(testOutput(`tmp${obj.i}.png`), 'png', cb);
            }, cb);
          },
          (cb) => {
            async.waterfall([
              (cb) => {
                sub(results[0], results[1], cb);
              },
              (result, cb) => {
                result.image.writeFile(testOutput(`diff.png`), 'png', cb);
              },
            ], cb);
          },
        ], done);
      }
    });

  });

});
