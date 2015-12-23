module.exports = onStorePreAuth

var Boom = require('boom')

/**
 * All requests to /hoodie/store are prefixed by user database names, which
 * are "user/{accountId}". `onStorePreAuth` checks the bearerToken if it is
 * a valid session Id, and if it belongs to the right user. If either fails,
 * it responds with an `unauthorized` error
 */
function onStorePreAuth (request, reply) {
  var server = request.connection.server
  var bearerToken = toBearerToken(request)

  if (!bearerToken) {
    return reply(Boom.unauthorized())
  }

  server.plugins.account.api.sessions.find(bearerToken)

  .then(function (session) {
    var accountId = session.account.id

    if (request.path.indexOf(accountId) === -1) {
      throw new Error('unauthorized')
    }

    delete request.headers.authorization
    request.headers.cookie = 'AuthSession=' + session.id

    reply.continue()
  })

  .catch(function () {
    reply(Boom.unauthorized())
  })
}

function toBearerToken (request) {
  var token
  if (request.headers.authorization) {
    token = request.headers.authorization.substring('Bearer '.length)
  }
  return token
}
