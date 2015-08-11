var zlib = require('zlib')

var bl = require('bl')
var request = require('request')
var test = require('tap').test

var startServerTest = require('../lib/start-server-test')
var config = require('../lib/config')

startServerTest(test, 'handle forced gzip', config, function (t, end) {
  t.test('should receive gzip when gzip accept header sent', function (tt) {
    tt.plan(3)
    request.get(config.url + '/_api/', {
      headers: {
        'Accept-Encoding': 'gzip, deflate'
      }
    })
    .on('response', function (res) {
      tt.is(res.headers['content-encoding'], 'gzip')
    })
    .pipe(bl(function (error, data) {
      if (error) throw error
      zlib.gunzip(data, function (error, udat) {
        tt.error(error)
        tt.ok(/couchdb/.test(udat.toString()))
      })
    }))
  })
  t.test('should receive no gzip when no gzip accept header sent', function (tt) {
    request.get(config.url + '/_api/')
    .on('response', function (res) {
      tt.notOk(res.headers['content-encoding'])
      tt.end()
    })
  })
  t.test('should receive gzip when no gzip accept header sent but force query param', function (tt) {
    tt.plan(3)
    request.get(config.url + '/_api/?force_gzip=true')
    .on('response', function (res) {
      tt.is(res.headers['content-encoding'], 'gzip')
    })
    .pipe(bl(function (error, data) {
      if (error) throw error
      zlib.gunzip(data, function (error, udat) {
        tt.error(error)
        tt.ok(/couchdb/.test(udat.toString()))
      })
    }))
  })
  t.test('teardown', end)
})
