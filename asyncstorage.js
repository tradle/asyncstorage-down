'use strict';

// ArrayBuffer/Uint8Array are old formats that date back to before we
// had a proper browserified buffer type. they may be removed later
var arrayBuffPrefix = 'ArrayBuffer:';
var arrayBuffRegex = new RegExp('^' + arrayBuffPrefix);
var uintPrefix = 'Uint8Array:';
var uintRegex = new RegExp('^' + uintPrefix);

// this is the new encoding format used going forward
var bufferPrefix = 'Buff:';
var bufferRegex = new RegExp('^' + bufferPrefix);

var utils = require('./utils');
var StorageCore = require('./asyncstorage-core');
var TaskQueue = require('./taskqueue');
var d64 = require('d64');

function Storage(dbname) {
  this._store = new StorageCore(dbname);
  this._queue = new TaskQueue();
}

Storage.prototype.sequentialize = function (callback, fun) {
  this._queue.add(fun, callback);
};

Storage.prototype.init = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    self._store.getKeys(function (err, keys) {
      if (err) {
        return callback(err);
      }
      self._keys = keys;
      return callback();
    });
  });
};

Storage.prototype.keys = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, self._keys.slice());
  });
};

Storage.prototype.setItems = function (pairs, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    pairs.forEach((pair) => {
      var value = pair[1]
      if (Buffer.isBuffer(value)) {
        pair[1] = bufferPrefix + d64.encode(value);
      }

      var key = pair[0]
      var idx = utils.sortedIndexOf(self._keys, key);
      if (self._keys[idx] !== key) {
        self._keys.splice(idx, 0, key);
      }
    })

    self._store.multiPut(pairs, callback);
  });
}

//setItem: Saves and item at the key provided.
Storage.prototype.setItem = function (key, value, callback) {
  return this.setItems([[key, value]], callback)
};

//getItem: Returns the item identified by it's key.
Storage.prototype.getItem = function (key, callback) {
  return this.getItems([key], function (errs, values) {
    if (errs && errs[0]) callback(errs[0])
    else callback(null, values[0])
  })
};

Storage.prototype.getItems = function (keys, callback) {
  var self = this
  self.sequentialize(callback, function (callback) {
    self._store.multiGet(keys, function (errs, values) {
      errs = errs || []
      values = values || []
      for (var i = 0; i < keys.length; i++) {
        if (errs[i]) {
          values[i] = undefined
          continue
        }

        var retval = values[i]
        if (typeof retval === 'undefined' || retval === null) {
          // 'NotFound' error, consistent with LevelDOWN API
          // yucky side-effect
          errs[i] = new Error('NotFound')
          values[i] = undefined
          continue
        }

        errs[i] = null
        if (typeof retval !== 'undefined') {
          if (bufferRegex.test(retval)) {
            retval = d64.decode(retval.substring(bufferPrefix.length));
          } else if (arrayBuffRegex.test(retval)) {
            // this type is kept for backwards
            // compatibility with older databases, but may be removed
            // after a major version bump
            retval = retval.substring(arrayBuffPrefix.length);
            retval = new ArrayBuffer(atob(retval).split('').map(function (c) {
              return c.charCodeAt(0);
            }));
          } else if (uintRegex.test(retval)) {
            // ditto
            retval = retval.substring(uintPrefix.length);
            retval = new Uint8Array(atob(retval).split('').map(function (c) {
              return c.charCodeAt(0);
            }));
          }
        }

        values[i] = retval
      }

      callback(errs, values)
    })
  })
}

//removeItem: Removes the item identified by it's key.
Storage.prototype.removeItems = function (keys, callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    keys.forEach((key) => {
      var idx = utils.sortedIndexOf(self._keys, key);
      if (self._keys[idx] === key) {
        self._keys.splice(idx, 1);
      }
    })

    self._store.multiRemove(keys, callback);
  });
};

//removeItem: Removes the item identified by it's key.
Storage.prototype.removeItem = function (key, callback) {
  return this.removeItems([key], callback)
};

Storage.prototype.length = function (callback) {
  var self = this;
  self.sequentialize(callback, function (callback) {
    callback(null, self._keys.length);
  });
};

exports.Storage = Storage;
