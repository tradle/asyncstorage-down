'use strict';

// require('./platform');
var inherits = require('util').inherits;
var AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
var AbstractIterator = require('abstract-leveldown').AbstractIterator;

var Storage = require('./asyncstorage').Storage;
var StorageCore = require('./asyncstorage-core');
var utils = require('./utils');

// see http://stackoverflow.com/a/15349865/680742
var nextTick = global.setImmediate || process.nextTick;

function ADIterator(db, options) {

  AbstractIterator.call(this, db);

  this._reverse = !!options.reverse;
  this._endkey     = options.end;
  this._startkey   = options.start;
  this._gt      = options.gt;
  this._gte     = options.gte;
  this._lt      = options.lt;
  this._lte     = options.lte;
  this._exclusiveStart = options.exclusiveStart;
  this._limit = options.limit;
  this._keysOnly = options.values === false
  this._count = 0;

  this.onInitCompleteListeners = [];
}

inherits(ADIterator, AbstractIterator);

ADIterator.prototype._init = function (callback) {
  nextTick(function () {
    callback();
  });
};

ADIterator.prototype._next = function (callback) {
  var self = this;
  callback = asyncify(callback)

  function onInitComplete() {
    if (self._pos === self._keys.length || self._pos < 0) { // done reading
      return callback();
    }

    var key = self._keys[self._pos];

    if (!!self._endkey && (self._reverse ? key < self._endkey : key > self._endkey)) {
      return callback();
    }

    if (!!self._limit && self._limit > 0 && self._count++ >= self._limit) {
      return callback();
    }

    if ((self._lt  && key >= self._lt) ||
      (self._lte && key > self._lte) ||
      (self._gt  && key <= self._gt) ||
      (self._gte && key < self._gte)) {
      return callback();
    }

    self._pos += self._reverse ? -1 : 1;
    if (self._keysOnly) return callback(null, key)

    self.db.container.getItem(key, function (err, value) {
      if (err) {
        if (err.message === 'NotFound') {
          return nextTick(function () {
            self._next(callback);
          });
        }
        return callback(err);
      }
      callback(null, key, value);
    });
  }
  if (!self.initStarted) {
    self.initStarted = true;
    self._init(function (err) {
      if (err) {
        return callback(err);
      }
      self.db.container.keys(function (err, keys) {
        if (err) {
          return callback(err);
        }
        self._keys = keys;
        if (self._startkey) {
          var index = utils.sortedIndexOf(self._keys, self._startkey);
          var startkey = (index >= self._keys.length || index < 0) ?
            undefined : self._keys[index];
          self._pos = index;
          if (self._reverse) {
            if (self._exclusiveStart || startkey !== self._startkey) {
              self._pos--;
            }
          } else if (self._exclusiveStart && startkey === self._startkey) {
            self._pos++;
          }
        } else {
          self._pos = self._reverse ? self._keys.length - 1 : 0;
        }
        onInitComplete();

        self.initCompleted = true;
        var i = -1;
        while (++i < self.onInitCompleteListeners) {
          nextTick(self.onInitCompleteListeners[i]);
        }
      });
    });
  } else if (!self.initCompleted) {
    self.onInitCompleteListeners.push(onInitComplete);
  } else {
    onInitComplete();
  }
};

function AD(location) {
  if (!(this instanceof AD)) {
    return new AD(location);
  }
  AbstractLevelDOWN.call(this, location);
  this.container = new Storage(location);
}

inherits(AD, AbstractLevelDOWN);

AD.prototype._open = function (options, callback) {
  this.container.init(callback);
};

AD.prototype._put = function (key, value, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  err = checkKeyValue(value, 'value');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }

  if (typeof value === 'object' && !Buffer.isBuffer(value) && value.buffer === undefined) {
    var obj = {};
    obj.storetype = 'json';
    obj.data = value;
    value = JSON.stringify(obj);
  }

  this.container.setItem(key, value, callback);
};

AD.prototype._get = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
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

AD.prototype._del = function (key, options, callback) {

  var err = checkKeyValue(key, 'key');

  if (err) {
    return nextTick(function () {
      callback(err);
    });
  }
  if (!Buffer.isBuffer(key)) {
    key = String(key);
  }

  this.container.removeItem(key, callback);
};

AD.prototype._batch = function (array, options, callback) {
  var self = this;
  nextTick(function () {
    var err;
    var key;
    var value;

    var numDone = 0;
    var overallErr;
    function checkDone() {
      if (++numDone === array.length) {
        callback(overallErr);
      }
    }

    if (!Array.isArray(array) || !array.length) callback()

    for (var i = 0; i < array.length; i++) {
      var task = array[i];
      if (task) {
        key = Buffer.isBuffer(task.key) ? task.key : String(task.key);
        err = checkKeyValue(key, 'key');
        if (err) {
          overallErr = err;
          checkDone();
        } else if (task.type === 'del') {
          self._del(task.key, options, checkDone);
        } else if (task.type === 'put') {
          value = Buffer.isBuffer(task.value) ? task.value : String(task.value);
          err = checkKeyValue(value, 'value');
          if (err) {
            overallErr = err;
            checkDone();
          } else {
            self._put(key, value, options, checkDone);
          }
        }
      } else {
        checkDone();
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
  if (obj === null || obj === undefined) {
    return new Error(type + ' cannot be `null` or `undefined`');
  }

  if (type === 'key') {

    if (obj instanceof Boolean) {
      return new Error(type + ' cannot be `null` or `undefined`');
    }
    if (obj === '') {
      return new Error(type + ' cannot be empty');
    }
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
