import lwip from 'lwip';
import async from 'async';
import imageType from 'image-type';

const scaleDownAndBlur = (image, cb) => {
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
      scaleDownAndBlur(image, cb);
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

export { prep, sub };
