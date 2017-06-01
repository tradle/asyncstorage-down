# asyncstorage-down

_borrows **very** heavily and gratefully from localstorage-down_

Implementation of leveldown for React's AsyncStorage

The idea is to be able to use the level stack in React Native

This project is intended for use with the [level eco-system](https://github.com/level/).

## Install

```
npm install asyncstorage-down
```

## Example

At the command prompt in your chosen directory :

```
npm install asyncstorage-down
npm install levelup
```

Create a file called index.js and enter the following:

```js
var asyncstorage = require('asyncstorage-down');
var levelup = require('levelup');
var db = levelup('/does/not/matter', { db: asyncstorage });

db.put('name', 'Yuri Irsenovich Kim');
db.put('dob', '16 February 1941');
db.put('spouse', 'Kim Young-sook');
db.put('occupation', 'Clown');

db.readStream()
   .on('data', function (data) {
      if (typeof data.value !== 'undefined') {
         console.log(data.key, '=', data.value);
      }
   })
   .on('error', function (err) {
      console.log('Oh my!', err);
   })
   .on('close', function () {
      console.log('Stream closed');
   })
   .on('end', function () {
     console.log('Stream ended');
   });
```

## Note

React Native's packager currently doesn't automatically inject browserified core node modules, like util, crypto, process, buffer, etc. Currently this module depends on several shims to mitigate the sadness. The alternative is to use [react-native-webpack-server](https://www.npmjs.org/package/react-native-webpack-server), which allows you to use browserified node core modules out of the box. Once React Native's packager allows the same functionality, this module's dependencies can be heavily pruned.

## Contributors

Tradle, Inc. https://github.com/tradle

Mark Vayngrib https://github.com/mvayngrib

Ellen Katsnelson https://github.com/pgmemk

Andre Staltz https://github.com/staltz

## localstorage-down Contributors

Anton Whalley https://github.com/no9

Adam Shih https://github.com/adamshih

Nolan Lawson https://github.com/nolanlawson
