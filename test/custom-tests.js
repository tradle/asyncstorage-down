'use strict';

var levelup = require('levelup');
var Storage = require('../asyncstorage').Storage

module.exports.setUp = function (leveldown, test, testCommon) {
  test('setUp common', testCommon.setUp);
  test('setUp db', function (t) {
    var db = leveldown(testCommon.location());
    db.open(t.end.bind(t));
  });
};

module.exports.all = function (leveldown, tape, testCommon) {

  module.exports.setUp(leveldown, tape, testCommon);

  tape('test .destroy', function (t) {
    var db = levelup('destroy-test', {db: leveldown});
    var db2 = levelup('other-db', {db: leveldown});
    db2.put('key2', 'value2', function (err) {
      t.notOk(err, 'no error');
      db.put('key', 'value', function (err) {
        t.notOk(err, 'no error');
        db.get('key', function (err, value) {
          t.notOk(err, 'no error');
          t.equal(value, 'value', 'should have value');
          db.close(function (err) {
            t.notOk(err, 'no error');
            leveldown.destroy('destroy-test', function (err) {
              t.notOk(err, 'no error');
              var db3 = levelup('destroy-test', {db: leveldown});
              db3.get('key', function (err) {
                t.ok(err, 'key is not there');
                db2.get('key2', function (err, value) {
                  t.notOk(err, 'no error');
                  t.equal(value, 'value2', 'should have value2');
                  t.end();
                });
              });
            });
          });
        });
      });
    });
  });

  tape('test escaped db name', function (t) {
    var db = levelup('bang!', {db: leveldown});
    var db2 = levelup('bang!!', {db: leveldown});
    db.put('!db1', '!db1', function (err) {
      t.notOk(err, 'no error');
      db2.put('db2', 'db2', function (err) {
        t.notOk(err, 'no error');
        db.close(function (err) {
          t.notOk(err, 'no error');
          db2.close(function (err) {
            t.notOk(err, 'no error');
            db = levelup('bang!', {db: leveldown});
            db.get('!db2', function (err, key, value) {
              t.ok(err, 'got error');
              t.equal(key, undefined, 'key should be null');
              t.equal(value, undefined, 'value should be null');
              t.end();
            });
          });
        });
      });
    });
  });

  tape('delete while iterating', function (t) {
    var db = leveldown(testCommon.location());
    var noerr = function (err) {
      t.error(err, 'opens crrectly');
    };
    var noop = function () {};
    var iterator;
    db.open(noerr);
    db.put('a', 'A', noop);
    db.put('b', 'B', noop);
    db.put('c', 'C', noop);
    iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false, start: 'a' });
    iterator.next(function (err, key, value) {
      t.error(err);
      t.equal(key, 'a');
      t.equal(value, 'A');
      db.del('b', function (err) {
        t.notOk(err, 'no error');
        iterator.next(function (err, key, value) {
          t.notOk(err, 'no error');
          t.ok(key, 'key exists');
          t.ok(value, 'value exists');
          t.end();
        });
      });
    });
  });

  tape('add many while iterating', function (t) {
    var db = leveldown(testCommon.location());
    var noerr = function (err) {
      t.error(err, 'opens crrectly');
    };
    var noop = function () {};
    var iterator;
    db.open(noerr);
    db.put('c', 'C', noop);
    db.put('d', 'D', noop);
    db.put('e', 'E', noop);
    iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false, start: 'c' });
    iterator.next(function (err, key, value) {
      t.error(err);
      t.equal(key, 'c');
      t.equal(value, 'C');
      db.del('c', function (err) {
        t.notOk(err, 'no error');
        db.put('a', 'A', function (err) {
          t.notOk(err, 'no error');
          db.put('b', 'B', function (err) {
            t.notOk(err, 'no error');
            iterator.next(function (err, key, value) {
              t.notOk(err, 'no error');
              t.ok(key, 'key exists');
              t.ok(value, 'value exists');
              t.ok(key >= 'c', 'key "' + key + '" should be greater than c');
              t.end();
            });
          });
        });
      });
    });
  });

  tape('concurrent batch delete while iterating', function (t) {
    var db = leveldown(testCommon.location());
    var noerr = function (err) {
      t.error(err, 'opens crrectly');
    };
    var noop = function () {};
    var iterator;
    db.open(noerr);
    db.put('a', 'A', noop);
    db.put('b', 'B', noop);
    db.put('c', 'C', noop);
    iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false, start: 'a' });
    iterator.next(function (err, key, value) {
      t.error(err);
      t.equal(key, 'a');
      t.equal(value, 'A');
      db.batch([{
        type: 'del',
        key: 'b'
      }], noerr);
      iterator.next(function (err, key, value) {
        t.notOk(err, 'no error');
        // on backends that support snapshots, it will be 'b'.
        // else it will be 'c'
        t.ok(key, 'key should exist');
        t.ok(value, 'value should exist');
        t.end();
      });
    });
  });

  tape('iterate past end of db', function (t) {
    var db = leveldown('aaaaaa');
    var db2 = leveldown('bbbbbb');
    var noerr = function (err) {
      t.error(err, 'opens crrectly');
    };
    var noop = function () {};
    var iterator;
    db.open(noerr);
    db2.open(noerr);
    db.put('1', '1', noop);
    db.put('2', '2', noop);
    db2.put('3', '3', noop);
    iterator = db.iterator({ keyAsBuffer: false, valueAsBuffer: false, start: '1' });
    iterator.next(function (err, key, value) {
      t.equal(key, '1');
      t.equal(value, '1');
      t.notOk(err, 'no error');
      iterator.next(function (err, key, value) {
        t.notOk(err, 'no error');
        t.equals(key, '2');
        t.equal(value, '2');
        iterator.next(function (err, key) {
          t.error(err);
          t.notOk(key, 'should not actually have a key');
          t.end();
        });
      });
    });
  });

  tape('bypasses getItem for keys-only db streams', function (t) {
    var origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function () {
      throw new Error('shouldn\'t get called for keys-only db streams');
    };

    var db = levelup('ooga', { db: leveldown });
    var batch = [
      {
        key: 'a',
        value: '1',
        type: 'put'
      },
      {
        key: 'b',
        value: '2',
        type: 'put'
      },
      {
        key: 'c',
        value: '3',
        type: 'put'
      },
    ];

    db.batch(batch, function () {
      db.createKeyStream({
          start: 'c'
        })
        .on('data', function (key) {
          t.equals(key, 'c');
        })
        .on('end', function () {
          // unhack getItem
          Storage.prototype.getItem = origGetItem;
          t.end();
        });
    });
  });

  tape('destroy() with custom AsyncStorage implementation', function(t) {
    t.plan(2);
    const keys = ['abc!1', 'abc!2'];
    leveldown.destroy(
      {
        location: 'abc',
        AsyncStorage: {
          getAllKeys: (callback) => {
            process.nextTick(() => callback(null, keys));
          },
          multiRemove: (actual, callback) => {
            t.same(actual, keys);
            process.nextTick(callback);
          },
        },
      },
      (err) => {
        t.error(err);
      }
    );
  });
};
