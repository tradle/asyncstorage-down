'use strict';

var d64 = require('d64');
var nonBufferPrefix = 'n:'
var bufferPrefix = 'b:'

function keyEq(k1, k2) {
  return (k1 || '').toString('hex') === (k2 || '').toString('hex');
}

function keyNeq(k1, k2) {
  return (k1 || '').toString('hex') !== (k2 || '').toString('hex');
}

function keyGt(k1, k2) {
  return (k1 || '').toString('hex') > (k2 || '').toString('hex');
}

function keyGte(k1, k2) {
  return (k1 || '').toString('hex') >= (k2 || '').toString('hex');
}

function keyLt(k1, k2) {
  return (k1 || '').toString('hex') < (k2 || '').toString('hex');
}

function keyLte(k1, k2) {
  return (k1 || '').toString('hex') <= (k2 || '').toString('hex');
}

exports.keyEq = keyEq;
exports.keyNeq = keyNeq;
exports.keyGt = keyGt;
exports.keyGte = keyGte;
exports.keyLt = keyLt;
exports.keyLte = keyLte;

// taken from rvagg/memdown commit 2078b40
exports.sortedIndexOf = function(arr, item) {
  var low = 0;
  var high = arr.length;
  var mid;
  while (low < high) {
    mid = (low + high) >>> 1;
    if (keyLt(arr[mid], item)) {
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
  }

  return str.slice(nonBufferPrefix.length)
}
