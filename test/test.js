'use strict';

var asyncstorage = require('../');
var tape   = require('tape');
var testCommon = require('./testCommon');
var testBuffer = new Buffer('hello');

require('abstract-leveldown/abstract/leveldown-test').args(asyncstorage, tape);
require('abstract-leveldown/abstract/open-test').args(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/del-test').all(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/put-test').all(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/get-test').all(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/put-get-del-test').all(asyncstorage, tape, testCommon, testBuffer);
require('abstract-leveldown/abstract/close-test').close(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/iterator-test').all(asyncstorage, tape, testCommon);

require('abstract-leveldown/abstract/chained-batch-test').all(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/approximate-size-test').setUp(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/approximate-size-test').args(asyncstorage, tape, testCommon);

require('abstract-leveldown/abstract/ranges-test').all(asyncstorage, tape, testCommon);
require('abstract-leveldown/abstract/batch-test').all(asyncstorage, tape, testCommon);

require('./custom-tests.js').all(asyncstorage, tape, testCommon);

