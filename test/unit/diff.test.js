import path from 'path';
import fs from 'fs';
import lwip from 'lwip';
import async from 'async';
import imageType from 'image-type';
import expect from 'expect';
import prettyHrtime from 'pretty-hrtime';
import debug from 'debug';


// Only output when ENV has DEBUG=senio-simple-motion:test
const dT = () => {
  let t0 = process.hrtime();
  return (label) => {
    debug('senio-simple-motion:test')(label, prettyHrtime(process.hrtime(t0)));
    t0 = process.hrtime();
  };
};

const downscaleAndBlur = (image, cb) => {
  async.waterfall([
    (cb) => {
      if (image.width() > 320) {
        const aspect = image.width()/image.height();
        image
          .batch()
          .resize(320, Math.ceil(320/aspect))
          .exec(cb);
      } else {
        cb(null, image);
      }
    },
    (image, cb) => {
      image
        .batch()
        // .saturate(-1)
        // .blur(0.2)
        .exec(cb);
    },
  ], cb);
};


const prep = (buffer, cb) => {
  const lwipType = imageType(buffer).ext;
  async.waterfall([
    (cb) => {
      lwip.open(buffer, lwipType, cb);
    },
    (image, cb) => {
      downscaleAndBlur(image, cb);
    },
  ], cb);
};

const sub = (im1, im2, cb) => {
  const w1 = im1.width();
  const h1 = im1.height();
  const w2 = im2.width();
  const h2 = im2.height();
  if (!((w1 === w2) && (h1 === h2))) {
    throw new Error('image dimensions don\'t match');
  }

  const w = w1;
  const h = h1;

  const raw1 = im1.__lwip.buffer();
  const raw2 = im2.__lwip.buffer();

  const pixels = [];
  for (let y = 0; y < h; ++y) {
    for (let x = 0; x < w; ++x) {
      // Regardless of how many channels the image has,
      // as the image is already grayscale, we always look
      // at the first channel:
      //
      // https://github.com/EyalAr/lwip
      // 1 channel is a grayscale image.
      // 2 channels is a grayscale image with an alpha channel.
      // 3 channels is an RGB image.
      // 4 channels is an RGBA image (with an alpha channel).

      // Using the raw buffer is about a thousand times faster
      const p1 = raw1[(x + (y*w))];
      const p2 = raw2[(x + (y*w))];
      // const p1 = im1.getPixel(x, y).r;
      // const p2 = im2.getPixel(x, y).r;
      pixels.push(Math.abs(Math.round(p2 - p1)));
    }
  }

  // The percentage difference is the % of fully white pixels
  const percentage = pixels.reduce((acc, p) => {
    acc += p/255;
    return acc;
  }, 0)/pixels.length*100;

  lwip.open(new Buffer(pixels), {width: w, height: h}, (err, image) => {
    cb(err, {
      image,
      percentage,
    });
  });
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
