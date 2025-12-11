//VERSION=3
// Author: Marcin Spiralski (https://www.linkedin.com/in/marcin-spiralski-19086783)
// License: CC BY 4.0 International 

function setup() {
  return {
    input: ["VH"],
    output: {
      bands: 3,
      sampleType: "AUTO"
    }
  };
}

function evaluatePixel(sample) {
  var VH = sample.VH;

  var VH_dB = 10 * Math.log10(VH);

  var floodThreshold = -12;

  if (VH_dB < floodThreshold) {
    return [0, 0, 1];
  } else {
    var min_dB = -25;
    var max_dB = -5;

    var normVal = (VH_dB - min_dB) / (max_dB - min_dB);
    normVal = Math.max(0, Math.min(1, normVal));

    return [normVal, normVal, normVal];
  }
}