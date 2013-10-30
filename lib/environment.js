/**
 * This module returns appropriate config values for the provided
 * platform, environment and project. It is used directly by the start
 * script in the bin directory.
 */

var fs = require('fs');
var url = require('url');
var path = require('path');
var ports = require('ports');
var _ = require('underscore');


/**
 * Returns all config values for current environment
 */

exports.getConfig = function (platform, env, project_dir, argv) {
  // location of project's package.json
  var pkgfile = path.resolve(project_dir, 'package.json');

  // default platform-agnostic config
  var cfg = {
    project_dir: project_dir,
    www_root: 'www',
    host: process.env.HOODIE_BIND_ADDRESS || '127.0.0.1',
    app: JSON.parse(fs.readFileSync(pkgfile)),
    domain: 'dev',
    local_tld: false,
    platform: platform
  };

  // set the Hoodie instance ID, this is used to check
  // against the user roles when doing a test for Hoodie admin
  cfg.id = cfg.app.name;
  cfg.www_port = ports.getPort(cfg.id + '-www');
  cfg.admin_port = ports.getPort(cfg.id + '-admin');

  // add CouchDB paths to config
  cfg = _.extend(cfg, exports.getCouch(env));

  // add Hoodie paths to config
  cfg.hoodie = {
    app_path: path.resolve(cfg.project_dir, 'data')
  };

  // do magic firewall stuff for .dev domains on mac
  if (platform === 'darwin') {
    // only if it is installed
    try {
      require('local-tld');
      cfg.local_tld = true;
    } catch (e) {
        // no local-tld, it’s fine, carry on.
    }
  }

  // option to turn on/off local-tld on command-line
  if (argv.hasOwnProperty('local-tld')) {
    cfg.local_tld = argv['local-tld'];
  }

  if (exports.isNodejitsu(env)) {
    // Nodejitsu config
    cfg.host = '0.0.0.0';
    cfg.domain = 'jit.su';
    cfg.couch.run = false;

    // move the www and admin ports and run a nodejitsu server
    // to proxy requests to them based on subdomains (since we don't
    // run local-tld on nodejitsu)
    cfg.www_port = 8180;
    cfg.admin_port = 8190;
    cfg.run_nodejitsu_server = true;

    // turn off fancy terminal stuff where possible
    cfg.boring = true;

    if (!env.COUCH_URL) {
      throw new Error('COUCH_URL environment variable not set');
    }
    if (!env.HOODIE_ADMIN_USER) {
      throw new Error('HOODIE_ADMIN_USER environment variable not set');
    }
    if (!env.HOODIE_ADMIN_PASS) {
      throw new Error('HOODIE_ADMIN_PASS environment variable not set');
    }
  }

  if (!process.env.COUCH_URL) {
    cfg.couch.port = ports.getPort(cfg.id + '-couch');
  }

  if (process.env.CI) {
    cfg.open_browser = false;
  }

  if (!cfg.couch.url) {
    cfg.couch.url = 'http://' + cfg.host + ':' + cfg.couch.port;
  }

  // option to set server root url
  if (argv.hasOwnProperty('www')) {
    cfg.www_root = argv.www;
  }

  // get the host for couchb url
  var parsed = url.parse(cfg.couch.url);

  cfg.couch.host = parsed.hostname;
  cfg.couch.port = parsed.port || 80;

  return cfg;
};

/**
 * Attempts to detect a Nodejitsu environment
 */

exports.isNodejitsu = function (env) {
  return !!(env.SUBDOMAIN);
};

/**
 * Find CouchDB locations
 */

exports.getCouch = function (env) {
  var cfg = {couch: {}};

  // if COUCH_URL is set in the environment,
  // we don't attempt to start our own instance
  // of CouchDB, but just use the one provided
  // to us there.
  if (env.COUCH_URL) {
    cfg.couch.url = env.COUCH_URL;
    cfg.couch.run = false;
    return cfg;
  }

  // start local couch
  cfg.couch.run = true;

  return cfg;
};
