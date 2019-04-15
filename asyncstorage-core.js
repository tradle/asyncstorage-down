'use strict';

const DEFAULT_OPTS = require('./default-opts');

/*
 * Adapted from https://github.com/No9/localstorage-down
 */

function AsyncStorageCore(dbname, opts = DEFAULT_OPTS) {
  this._prefix = createPrefix(dbname);
  this._asyncStorageImpl = opts.AsyncStorage
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
  var prefixSupported = !!this._asyncStorageImpl.getAllKeysWithPrefix;
  var getAllKeys = prefixSupported
    ? this._asyncStorageImpl.getAllKeysWithPrefix.bind(this._asyncStorageImpl, prefix)
    : this._asyncStorageImpl.getAllKeys.bind(this._asyncStorageImpl);

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
  this._asyncStorageImpl.setItem(key, value, callback);
};

AsyncStorageCore.prototype.multiPut = function (pairs, callback) {
  var self = this
  pairs.forEach((pair) => {
    pair[0] = prepKey(pair[0], self);
  })

  this._asyncStorageImpl.multiSet(pairs, callback);
};

AsyncStorageCore.prototype.get = function (key, callback) {
  key = prepKey(key, this);
  this._asyncStorageImpl.getItem(key, callback);
};

AsyncStorageCore.prototype.multiGet = function (keys, callback) {
  var self = this
  keys = keys.map((key) => {
    return prepKey(key, self)
  })

  this._asyncStorageImpl.multiGet(keys)
    .then(function (pairs) {
      callback(null, pairs.map(function (pair) {
        return pair[1]
      }))
    })
    .catch(callback)
};

AsyncStorageCore.prototype.remove = function (key, callback) {
  key = prepKey(key, this);
  this._asyncStorageImpl.removeItem(key, callback);
};

AsyncStorageCore.prototype.multiRemove = function (keys, callback) {
  keys = keys.map((key) => prepKey(key, this))
  this._asyncStorageImpl.multiRemove(keys, callback);
};

AsyncStorageCore.destroy = function (opts, callback) {
  if (typeof opts === 'string') {
    opts = { location: opts }
  }

  var { location } = opts
  var AsyncStorage = opts.AsyncStorage || DEFAULT_OPTS.AsyncStorage
  var prefix = createPrefix(location);
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
