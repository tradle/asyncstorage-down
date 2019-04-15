'use strict';

// require('./platform');
var inherits = require('util').inherits;
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var AbstractIterator = require('abstract-leveldown').AbstractIterator;

var Storage = require('./asyncstorage').Storage;
var StorageCore = require('./asyncstorage-core');
var utils = require('./utils');
var ltgt = require('ltgt');

// see http://stackoverflow.com/a/15349865/680742
var nextTick = global.setImmediate || process.nextTick;
var batchSize = 20

function ADIterator(db, options) {

  AbstractIterator.call(this, db);

  this._reverse = !!options.reverse;
  this._endkey     = options.end;
  this._startkey   = options.start;
  this._gt      = options.gt;
  this._gte     = options.gte;
  this._lt      = options.lt;
  this._lte     = options.lte;
  this._keyAsBuffer = options.keyAsBuffer;
  this._valueAsBuffer = options.valueAsBuffer;
  this._limit = options.limit;
  this._keysOnly = options.values === false
  this._count = 0;
  this._cache = [];
  this._cacheExtinguished = false;

  this.onInitCompleteListeners = [];

  this.initStarted = true;
  var self = this;
  this.db.container.keys(function (err, keys) {
    if (err) {
      self.initError = err;
    }

    self._keys = keys;

    if (keys.length === 0) {
      self._pos = 0;
    } else {
      if (!self._reverse) {
        self._startkey = ltgt.lowerBound(options)
        self._endkey = ltgt.upperBound(options)
      } else {
        self._startkey = ltgt.upperBound(options)
        self._endkey = ltgt.lowerBound(options)
      }

      if (self._startkey) {
        self._pos = utils.sortedIndexOf(self._keys, self._startkey);
        if (self._reverse) {
          if (self._pos === self._keys.length) {
            self._pos--;
          }
          else if (self._lt && utils.keyGte(self._keys[self._pos], self._lt)) {
            self._pos--;
          }
          else if (self._lte && utils.keyGt(self._keys[self._pos], self._lte)) {
            self._pos--;
          }
          else if (!self._lt && utils.keyGt(self._keys[self._pos], self._startkey)) {
            self._pos--;
          }
        }
        else {
          if (self._pos < 0) {
            self._pos = 0;
          }
          else if (self._gt && utils.keyLte(self._keys[self._pos], self._gt)) {
            self._pos++;
          }
          else if (self._gte && utils.keyLt(self._keys[self._pos], self._gt)) {
            self._pos++;
          }
          else if (!self._gt && utils.keyLt(self._keys[self._pos], self._startkey)) {
            self._pos++;
          }
        }
      } else {
        self._pos = self._reverse ? self._keys.length - 1 : 0;
      }

      if (self._endkey) {
        self._endIndex = utils.sortedIndexOf(self._keys, self._endkey);
        if (self._reverse && utils.keyLt(self._keys[self._endIndex], self._endkey)) {
          self._endIndex++;
        }
        else if (!self._reverse && utils.keyGt(self._keys[self._endIndex], self._endkey)) {
          self._endIndex--;
        }
      }
    }

    self._fillCache(function () {
      self.initCompleted = true;

      var i = -1;
      while (++i < self.onInitCompleteListeners.length) {
        nextTick(self.onInitCompleteListeners[i]);
      }
    })
  });
}

inherits(ADIterator, AbstractIterator);

ADIterator.prototype._fillCache = function fillCache(callback) {
  var batch = []
  for (var i = 0; i < batchSize; i++) {
    if (this._limit === 0) {
      break;
    }
    if (this._pos >= this._keys.length || this._pos < 0) { // done reading
      break;
    }

    var key = this._keys[this._pos];

    if (!!this._limit && this._limit > 0 && this._count++ >= this._limit) {
      break;
    }

    if (typeof this._endIndex === 'number'
    && (this._reverse ? this._pos < this._endIndex : this._pos > this._endIndex)) {
      break;
    }

    if ((this._lt && utils.keyGte(key, this._lt))
    || (this._lte && utils.keyGt(key, this._lte))
    || (this._gt  && utils.keyLte(key, this._gt))
    || (this._gte && utils.keyLt(key, this._gte))) {
      break;
    }

    this._pos += this._reverse ? -1 : 1;
    batch.push(key)
  }

  if (!batch.length) {
    this._cache = []
    this._cacheExtinguished = true;
    return callback()
  }

  if (this._keysOnly) {
    this._cache = batch
    return callback()
  }

  var self = this;
  this.db.container.getItems(batch, function (errs, values) {
    self._cache = values.map(function (v, idx) {
      return {
        key: batch[idx],
        value: v,
        error: errs[idx]
      }
    })
    callback()
  });
}

ADIterator.prototype._next = function (callback) {
  var self = this;
  callback = asyncify(callback)

  if (self.initError) {
    callback(self.initError);
    return;
  }

  if (self.initStarted) {
    if (self.initCompleted) {
      getFromCache();
    } else {
      self.onInitCompleteListeners.push(getFromCache);
    }
    return;
  }

  function getFromCache() {
    if (self._cacheExtinguished) {
      return callback()
    }

    if (self._cache.length) {
      var cached = self._cache.shift()
      if (self._keysOnly) {
        return callback(null, self._keyAsBuffer ? new Buffer(cached) : cached)
      }

      if (cached.error) {
        if (cached.error.message == 'NotFound') {
          return nextTick(function () {
            self._next(callback)
          })
        } else {
          return callback(cached.error)
        }
      }

      callback(null,
        self._keyAsBuffer ? new Buffer(cached.key) : cached.key,
        self._valueAsBuffer ? new Buffer(cached.value) : cached.value)
      return
    } else {
      self._fillCache(getFromCache)
    }
  }
};

function AD(location, opts) {
  if (!(this instanceof AD)) {
    return new AD(location, opts);
  }
  AbstractLevelDOWN.call(this, location);
  this.container = new Storage(location, opts);
}

inherits(AD, AbstractLevelDOWN);

AD.prototype._open = function (options, callback) {
  this.container.init(callback);
};

AD.prototype._multiPut = function (pairs, options, callback) {
  var normalized = []
  var err
  pairs.every(([key, value]) => {
    err = checkKeyValue(key, 'key');
    if (err) return

    if (checkKeyValue(value, 'value')) {
      normalized.push([key, ''])
      return true
    }

    if (value !== null
    && typeof value === 'object'
    && !Buffer.isBuffer(value)
    && value.buffer === undefined) {
      var obj = {};
      obj.storetype = 'json';
      obj.data = value;
      value = JSON.stringify(obj);
    }

    normalized.push([key, value])
    return true
  })

  if (err) {
    nextTick(() => callback(err))
  } else {
    this.container.setItems(normalized, callback)
  }
}

AD.prototype._put = function (key, value, options, callback) {
  return this._multiPut([[key, value]], options, callback)
};

AD.prototype._get = function (key, options, callback) {
  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(() => callback(err));
  }

  if (!Buffer.isBuffer(key)) {
    key = String(key);
  }

  this.container.getItem(key, function (err, value) {
    if (err) {
      return callback(err);
    }

    if (options.asBuffer !== false && !Buffer.isBuffer(value)) {
      value = new Buffer(value);
    }

    if (options.asBuffer === false) {
      if (value.indexOf('{"storetype":"json","data"') > -1) {
        var res = JSON.parse(value);
        value = res.data;
      }
    }
    callback(null, value);
  });
};

AD.prototype._multiDel = function (keys, options, callback) {
  // Next tick so that any ADIterator has had enough time to make a snapshot.
  // This is for sure a crappy solution, but neither iterator snapshot nor
  // delete seem to be timely/urgent features. PRs welcomed :D
  nextTick(() => {
    var normalized = []
    var err
    keys.every((key) => {
      err = checkKeyValue(key, 'key');
      if (err) return

      if (!Buffer.isBuffer(key)) {
        key = String(key);
      }

      normalized.push(key)
      return true
    })

    if (err) {
      nextTick(() => callback(err))
    } else {
      this.container.removeItems(keys, callback)
    }
  })
}

AD.prototype._del = function (key, options, callback) {
  return this._multiDel([key], options, callback)
};

AD.prototype._batch = function (array, options, callback) {
  var self = this;
  nextTick(function () {
    var err;
    var key;
    var value;

    if (!Array.isArray(array) || !array.length) return callback()

    var toPut = []
    var toDel = []
    var deleted = {}

    for (var i = 0; i < array.length; i++) {
      var task = array[i];
      if (!task) continue

      key = Buffer.isBuffer(task.key) ? task.key : String(task.key);
      err = checkKeyValue(key, 'key');
      if (err) return callback(err)

      if (task.type === 'del') {
        deleted[task.key] = true
        toDel.push(task.key)
      } else if (task.type === 'put') {
        value = Buffer.isBuffer(task.value) ? task.value : String(task.value);
        if (checkKeyValue(value, 'value')) {
          toPut.push([key, ''])
        } else {
          toPut.push([key, value])
        }
      }
    }

    var togo = 0
    if (toDel.length) {
      togo++
      self._multiDel(toDel, null, checkDone)
    }

    if (toPut.length) {
      toPut = toPut.filter(([key]) => !(key in deleted))
    }

    if (toPut.length) {
      togo++
      self._multiPut(toPut, null, checkDone)
    }

    togo++
    checkDone() // kick things off

    function checkDone (err) {
      if (err) {
        togo = 0
        callback(err)
      } else if (--togo === 0) {
        callback()
      }
    }
  });
};

AD.prototype._iterator = function (options) {
  return new ADIterator(this, options);
};

AD.destroy = function (name, callback) {
  StorageCore.destroy(name, callback);
};

function checkKeyValue(obj, type) {
  if (obj === null || obj === undefined) {
    return new Error(type + ' cannot be `null` or `undefined`');
  }
  if (obj instanceof Boolean) {
    return new Error(type + ' cannot be a boolean');
  }
  if (obj === '') {
    return new Error(type + ' cannot be an empty string');
  }
  if (obj.toString().indexOf('[object ArrayBuffer]') === 0) {
    if (obj.byteLength === 0 || obj.byteLength === undefined) {
      return new Error(type + ' cannot be an empty Buffer');
    }
  }
  if (Buffer.isBuffer(obj)) {
    if (obj.length === 0) {
      return new Error(type + ' cannot be an empty Buffer');
    }
  } else if (String(obj) === '') {
    return new Error(type + ' cannot be an empty String');
  }
}

function asyncify (fn) {
  if (fn._isAsync) {
    return fn
  }

  var sync = true
  nextTick(() => sync = false)
  var ret = function () {
    var ctx = this
    var args = arguments
    if (sync) {
      nextTick(function () {
        fn.apply(ctx, args)
      })
    } else {
      fn.apply(ctx, args)
    }
  }

  ret._isAsync = true
  return ret
}

module.exports = AD;
