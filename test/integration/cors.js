var request = require('request')
var test = require('tap').test

var startServerTest = require('../lib/start-server-test')
var config = require('../lib/config')

startServerTest(test, 'setting CORS headers', config, function (t, end) {
  t.test('should respond to OPTIONS with the right CORS headers when no origin is given', function (tt) {
    request.get(config.url + '/_api/_session/', {
      headers: {
        'transfer-encoding': 'chunked'
      }
    }, function (error, res) {
      if (error) throw error
      tt.is(res.headers['access-control-allow-origin'], '*')
      tt.is(res.headers['access-control-allow-headers'], 'authorization, content-length, content-type, if-match, if-none-match, origin, x-requested-with, transfer-encoding, host, connection')
      tt.is(res.headers['access-control-expose-headers'], 'content-type, content-length, etag')
      tt.is(res.headers['access-control-allow-methods'], 'GET, PUT, POST, DELETE')
      tt.is(res.headers['access-control-allow-credentials'], 'true')
      tt.is(res.statusCode, 200)
      tt.end()
    })
  })
  t.test('should echo the origin back if one is given', function (tt) {
    request.get(config.url + '/_api/_session/', {
      headers: {
        origin: 'http://some.app.com/',
        'transfer-encoding': 'chunked'
      }
    }, function (error, res) {
      if (error) throw error
      tt.is(res.headers['access-control-allow-origin'], 'http://some.app.com/')
      tt.is(res.headers['access-control-allow-headers'], 'authorization, content-length, content-type, if-match, if-none-match, origin, x-requested-with, transfer-encoding, host, connection')
      tt.is(res.headers['access-control-expose-headers'], 'content-type, content-length, etag')
      tt.is(res.headers['access-control-allow-methods'], 'GET, PUT, POST, DELETE')
      tt.is(res.headers['access-control-allow-credentials'], 'true')
      tt.is(res.statusCode, 200)
      tt.end()
    })
  })
  t.test('teardown', end)
})
