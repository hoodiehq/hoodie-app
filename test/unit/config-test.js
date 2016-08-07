var resolvePath = require('path').resolve

var proxyquire = require('proxyquire').noCallThru()
var simple = require('simple-mock')
var test = require('tap').test

require('npmlog').level = 'silent'

test('config', function (group) {
  group.test('defaults', function (t) {
    var accountConfigMock = simple.stub().callbackWith(null)
    var assureFolders = simple.stub().callbackWith(null)
    var couchDbConfigMock = simple.stub().callbackWith(null)
    var getDatabaseFactoryMock = simple.stub().returnWith('getDatabase')
    var appOptionsMock = simple.stub().returnWith('app options')
    var pouchDbConfigMock = simple.stub().callbackWith(null)
    var storeConfigMock = simple.stub().callbackWith(null)

    var getConfig = proxyquire('../../lib/config', {
      './account': accountConfigMock,
      './assure-folders': assureFolders,
      './db/couchdb': couchDbConfigMock,
      './db/factory': getDatabaseFactoryMock,
      './app-options': appOptionsMock,
      './db/pouchdb': pouchDbConfigMock,
      './store': storeConfigMock,
      'fs': {
        statSync: simple.stub().returnWith({
          isDirectory: simple.stub()
        })
      }
    })

    getConfig({}, function (error, config) {
      t.error(error)

      var state = {
        config: config,
        getDatabase: 'getDatabase'
      }

      t.is(couchDbConfigMock.callCount, 0, 'couchdb config not called')
      t.same(pouchDbConfigMock.lastCall.arg, state, 'called pouchdb config')
      t.same(accountConfigMock.lastCall.arg, state, 'called account config')
      t.same(storeConfigMock.lastCall.arg, state, 'called store config')

      t.ok(pouchDbConfigMock.lastCall.k < accountConfigMock.lastCall.k, 'pouch config called before account config')
      t.ok(pouchDbConfigMock.lastCall.k < storeConfigMock.lastCall.k, 'pouch config called before store config')

      t.end()
    })
  })

  group.test('with db.url', function (t) {
    var accountConfigMock = simple.stub().callbackWith(null)
    var assureFolders = simple.stub().callbackWith(null)
    var couchDbConfigMock = simple.stub().callbackWith(null)
    var getDatabaseFactoryMock = simple.stub().returnWith('getDatabase')
    var appOptionsMock = simple.stub().returnWith({})
    var pouchDbConfigMock = simple.stub().callbackWith(null)
    var storeConfigMock = simple.stub().callbackWith(null)

    var getConfig = proxyquire('../../lib/config', {
      './account': accountConfigMock,
      './assure-folders': assureFolders,
      './db/couchdb': couchDbConfigMock,
      './db/factory': getDatabaseFactoryMock,
      './app-options': appOptionsMock,
      './db/pouchdb': pouchDbConfigMock,
      './store': storeConfigMock,
      'fs': {
        statSync: simple.stub().returnWith({
          isDirectory: simple.stub()
        })
      }
    })

    getConfig({
      db: {
        url: 'http://admin:secret@localhost:5984'
      }
    }, function (error, config) {
      t.error(error)

      var state = {
        config: config,
        getDatabase: 'getDatabase'
      }

      t.is(pouchDbConfigMock.callCount, 0, 'PouchDB config not called')
      t.same(couchDbConfigMock.lastCall.arg, state, 'called couchdb config')
      t.same(accountConfigMock.lastCall.arg, state, 'called account config')
      t.same(storeConfigMock.lastCall.arg, state, 'called store config')

      t.end()
    })
  })

  group.test('with db.url lacking auth', function (t) {
    var getConfig = proxyquire('../../lib/config', {})

    getConfig({
      db: {
        url: 'http://localhost:5984'
      }
    }, function (error, config) {
      t.ok(error, 'fails with error')
      t.is(error.message, 'Authentication details missing from database URL: http://localhost:5984')
      t.end()
    })
  })

  group.test('if public path does not exist', function (t) {
    var accountConfigMock = simple.stub().callbackWith(null)
    var assureFolders = simple.stub().callbackWith(null)
    var couchDbConfigMock = simple.stub().callbackWith(null)
    var getDatabaseFactoryMock = simple.stub().returnWith('getDatabase')
    var appOptionsMock = simple.stub().returnWith({})
    var pouchDbConfigMock = simple.stub().callbackWith(null)
    var storeConfigMock = simple.stub().callbackWith(null)

    var getConfig = proxyquire('../../lib/config', {
      './account': accountConfigMock,
      './assure-folders': assureFolders,
      './db/couchdb': couchDbConfigMock,
      './db/factory': getDatabaseFactoryMock,
      './app-options': appOptionsMock,
      './db/pouchdb': pouchDbConfigMock,
      './store': storeConfigMock,
      'fs': {
        statSync: simple.stub().returnWith({
          isDirectory: simple.stub().throwWith(new Error())
        })
      },
      'npmlog': {
        info: simple.stub()
      }
    })

    getConfig({}, function (error, config) {
      t.error(error)

      t.is(config.paths.public, resolvePath(__dirname, '../../lib/public'), 'defaults to hoodie/public')

      t.end()
    })
  })

  group.end()
})
