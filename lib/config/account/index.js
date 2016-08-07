module.exports = accountConfig

var defaultsDeep = require('lodash').defaultsDeep

function accountConfig (state, callback) {
  var usersDb = state.getDatabase(state.config.db.authenticationDb)
  usersDb.constructor.plugin(require('pouchdb-users'))

  usersDb.installUsersBehavior()

  .then(function () {
    defaultsDeep(state.config.account, {
      admins: state.config.db.admins,
      secret: state.config.db.secret,
      usersDb: usersDb
    })

    callback(null, state.config)
  })

  .catch(callback, state.config)
}
