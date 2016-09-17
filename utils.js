'use strict';

var d64 = require('d64');
var nonBufferPrefix = 'n:'
var bufferPrefix = 'b:'

// taken from rvagg/memdown commit 2078b40
exports.sortedIndexOf = function(arr, item) {
  var low = 0;
  var high = arr.length;
  var mid;
  while (low < high) {
    mid = (low + high) >>> 1;
    if (arr[mid] < item) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};


exports.encode = function encode (vals) {
  return Array.isArray(vals) ? vals.map(encodeOne) : encodeOne(vals)
}

exports.decode = function decode (strings) {
  return Array.isArray(strings) ? strings.map(decodeOne) : decodeOne(strings)
}

function encodeOne (val) {
  return Buffer.isBuffer(val)
    ? bufferPrefix + d64.encode(val)
    : nonBufferPrefix + val
}


function decodeOne (str) {
  if (str.slice(0, bufferPrefix.length) === bufferPrefix) {
    return d64.decode(str.slice(bufferPrefix.length))
  } else {
    return str.slice(nonBufferPrefix.length)
  }

  return str
}
