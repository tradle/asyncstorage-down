'use strict';

const { AsyncStorage } = require('react-native');

/*
 * Adapted from https://github.com/No9/localstorage-down
 */

function AsyncStorageCore(dbname) {
  this._prefix = createPrefix(dbname);
}

const createPrefix = (dbname) => dbname.replace(/!/g, '!!') + '!'; // escape bangs in dbname;
const prepKey = (key, core) => core._prefix + key;
const unprefix = (strings, prefix) => {
  const prefixLen = prefix.length
  return strings
    .filter(str => str.slice(0, prefixLen) === prefix)
    .map(str => str.slice(prefixLen));
}

AsyncStorageCore.prototype.getKeys = function (callback) {
  var keys = [];
  var prefix = this._prefix;
  var prefixSupported = !!AsyncStorage.getAllKeysWithPrefix;
  var getAllKeys = prefixSupported
    ? AsyncStorage.getAllKeysWithPrefix.bind(AsyncStorage, prefix)
    : AsyncStorage.getAllKeys.bind(AsyncStorage);

  getAllKeys((err, allKeys) => {
    if (err) return callback(err);

    if (prefixSupported) {
      keys = allKeys;
    } else {
      keys = unprefix(allKeys, prefix);
    }

    keys.sort();
    callback(null, keys);
  })
};

AsyncStorageCore.prototype.put = function (key, value, callback) {
  key = prepKey(key, this);
  AsyncStorage.setItem(key, value, callback);
};

AsyncStorageCore.prototype.multiPut = function (pairs, callback) {
  var self = this
  pairs.forEach((pair) => {
    pair[0] = prepKey(pair[0], self);
  })

  AsyncStorage.multiSet(pairs, callback);
};

AsyncStorageCore.prototype.get = function (key, callback) {
  key = prepKey(key, this);
  AsyncStorage.getItem(key, callback);
};

AsyncStorageCore.prototype.multiGet = function (keys, callback) {
  var self = this
  keys = keys.map((key) => {
    return prepKey(key, self)
  })

  AsyncStorage.multiGet(keys)
    .then(function (pairs) {
      callback(null, pairs.map(function (pair) {
        return pair[1]
      }))
    })
    .catch(callback)
};

AsyncStorageCore.prototype.remove = function (key, callback) {
  key = prepKey(key, this);
  AsyncStorage.removeItem(key, callback);
};

AsyncStorageCore.prototype.multiRemove = function (keys, callback) {
  keys = keys.map((key) => prepKey(key, this))
  AsyncStorage.multiRemove(keys, callback);
};

AsyncStorageCore.destroy = function (dbname, callback) {
  var prefix = createPrefix(dbname);
  var prefixLen = prefix.length;
  AsyncStorage.getAllKeys(function(err, keys) {
    if (err) return callback(err);

    keys = keys.filter(function(key) {
      return key.slice(0, prefixLen) === prefix;
    })

    if (!keys.length) {
      return callback();
    }

    AsyncStorage.multiRemove(keys, callback);
  })
};

module.exports = AsyncStorageCore;
