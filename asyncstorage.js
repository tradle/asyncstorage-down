'use strict';

// this is the new encoding format used going forward
var utils = require('./utils');
var StorageCore = require('./asyncstorage-core');
var TaskQueue = require('./taskqueue');

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
    callback(null, utils.decode(self._keys));
  });
};

Storage.prototype.setItems = function (pairs, callback) {
  var self = this;
  pairs = pairs.map(utils.encode)
  self.sequentialize(callback, function (callback) {
    for (var i = 0 ; i < pairs.length; i++) {
      var key = pairs[i][0]
      var idx = utils.sortedIndexOf(self._keys, key);
      if (utils.keyNeq(self._keys[idx], key)) {
        self._keys.splice(idx, 0, key);
      }
    }

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
  var myKeys = this._keys
  self.sequentialize(callback, function (callback) {
    var allErrs = new Array(keys.length)
    var allValues = new Array(keys.length)
    var encoded = utils.encode(keys)
    var lookup = []
    for (var i = 0; i < encoded.length; i++) {
      var key = encoded[i]
      var idx = utils.sortedIndexOf(myKeys, key)
      if (utils.keyNeq(myKeys[idx], key)) {
        allErrs[i] = new Error('NotFound')
      } else {
        allErrs[i] = undefined
        lookup.push(key)
      }

      allValues[i] = undefined
    }

    if (!lookup.length) return callback(allErrs, allValues)

    self._store.multiGet(lookup, merge)

    function merge (errs, values) {
      errs = errs || []
      values = values || []
      var retIdx = -1
      for (var i = 0; i < keys.length; i++) {
        if (allErrs[i]) continue

        retIdx++
        if (errs[retIdx]) continue

        var retval = values[retIdx]
        if (typeof retval === 'undefined' || retval === null) {
          // 'NotFound' error, consistent with LevelDOWN API
          // yucky side-effect
          allErrs[i] = new Error('NotFound')
          continue
        }

        allErrs[i] = null
        if (typeof retval !== 'undefined') {
          retval = utils.decode(retval)
        }

        allValues[i] = retval
      }

      callback(allErrs, allValues)
    }
  })
}

//removeItem: Removes the item identified by it's key.
Storage.prototype.removeItems = function (keys, callback) {
  var self = this;
  keys = utils.encode(keys)
  self.sequentialize(callback, function (callback) {
    keys.forEach((key) => {
      var idx = utils.sortedIndexOf(self._keys, key);
      if (utils.keyEq(self._keys[idx], key)) {
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
