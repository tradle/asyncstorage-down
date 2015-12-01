'use strict';

var AsyncStorage = require('react-native').AsyncStorage;

/*
 * Adapted from https://github.com/No9/localstorage-down
 */

function createPrefix(dbname) {
  return dbname.replace(/!/g, '!!') + '!'; // escape bangs in dbname;
}

function prepKey(key, core) {
  return core._prefix + key;
}

function AsyncStorageCore(dbname) {
  this._prefix = createPrefix(dbname);
}

AsyncStorageCore.prototype.getKeys = function (callback) {
  var keys = [];
  var prefix = this._prefix;
  var prefixLen = prefix.length;

  AsyncStorage.getAllKeys(function(err, allKeys) {
    if (err) return callback(err);

    allKeys.forEach(function(fullKey) {
      if (fullKey.slice(0, prefixLen) === prefix) {
        keys.push(fullKey.slice(prefixLen));
      }
    })

    keys.sort();
    callback(null, keys);
  })
};

AsyncStorageCore.prototype.put = function (key, value, callback) {
  key = prepKey(key, this);
  AsyncStorage.setItem(key, value, callback);
};

AsyncStorageCore.prototype.get = function (key, callback) {
  key = prepKey(key, this);
  AsyncStorage.getItem(key, callback);
};

AsyncStorageCore.prototype.remove = function (key, callback) {
  key = prepKey(key, this);
  AsyncStorage.removeItem(key, callback);
};

AsyncStorageCore.destroy = function (dbname, callback) {
  var prefix = createPrefix(dbname);
  var prefixLen = prefix.length;
  AsyncStorage.getAllKeys(function(err, keys) {
    if (err) return callback(err);

    keys = keys.filter(function(key) {
      return key.slice(0, prefixLen) === prefix;
    })

    AsyncStorage.multiRemove(keys, callback);
  })
};

module.exports = AsyncStorageCore;
