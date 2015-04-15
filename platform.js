if (typeof __dirname === 'undefined') global.__dirname = '/'
if (typeof process === 'undefined') {
  global.process = require('process')
  process.browser = false;
}
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer
