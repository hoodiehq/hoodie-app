var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var crypto = require('crypto');
var _ = require('lodash');

var hoodieUtils = require('../utils/hconsole');

function hashFileSync(p) {
  var data = fs.readFileSync(p).toString();
  return crypto.createHash('md5').update(data).digest('hex');
}

function hashesChanged(as, bs) {
  return _.zip(as, bs).some(function (pair) {
    return pair[0] !== pair[1];
  });
}

function readHashesSync(p) {
  try {
    var data = fs.readFileSync(p).toString();
    return data.split('\n');
  }
  catch (e) {
    return [];
  }
}

function writeHashesSync(p, hashes) {
  return fs.writeFileSync(p, hashes.join('\n'));
}

// Get absolute paths to the files with the frontend javascript for all
// plugins. Plugins are expected to have a file called
// `hoodie.<plugin_name>.js` in their root with javascript that needs to get
// loaded in the the browser.
function getPlugins(config) {
  return Object.keys(config.plugins)
  .map(function (id) {
    var name = id.replace(/^hoodie-plugin-/, '');
    return path.resolve(
      config.plugins[id].path, 'hoodie.' + name + '.js'
    );
  })
  .filter(function (path) {
    return fs.existsSync(path);
  });
}

// Read plugins source files and return concatenated string.
function concatPlugins(plugins) {
  return plugins.map(function (plugin) {
    var src = fs.readFileSync(plugin);
    // `plugin` is an absolute path. Don’t include real file path, use just two
    // last parts in file path.
    var relative = plugin.split('/').slice(-2).join('/');
    var hr = hoodieUtils.hr();
    return hr + '// ' + relative + '\n' + hr + '\n' + src;
  }).join('\n');
}

module.exports = function (config, callback) {
  // If custom hoodie.js is specified in package.json we use that.
  // See: https://github.com/hoodiehq/hoodie-server/issues/247
  if (config.app.hoodie && config.app.hoodie.hoodiejs) {
    hoodiejs = path.join(config.project_dir, config.app.hoodie.hoodiejs);
  }

  // Absolute path to `hoodie` module (hoodie.js) as resolved by `require`.
  var hoodiejs = require.resolve('hoodie');
  var plugins = getPlugins(config);

  var paths = [hoodiejs].concat(plugins);
  var hashes = paths.map(hashFileSync);

  // This template is used to generate the `bundleConcat` (see below).
  var bundleTmpl = fs.readFileSync(path.join(__dirname, 'hoodie_bundle.js'));

  // `bundleConcat` is the absolute path to the file used to build the final
  // bundle including both hoodie.js and the plugins. This file is generated
  // dynamically by concatenating `bundleTmpl` and the plugins code.
  // This file is created in `hoodiePath` to make sure browserify resolves
  // hoodie locally.
  var bundleConcat = path.join(config.hoodie.data_path, 'hoodie_bundle_concat.js');
  var bundle_cache_out = path.resolve(config.hoodie.data_path, 'bundle_cache.js');

  console.log('Reading hoodie.js plugin hashes');

  var hashespath = path.resolve(config.hoodie.data_path, 'plugin_hashes');
  var oldhashes = readHashesSync(hashespath);

  if (hashesChanged(hashes, oldhashes)) {
    console.log('Writing hoodie.js plugin hashes');

    // write new plugin hashes to file
    writeHashesSync(hashespath, hashes);

    // Create the `bundleConcat` that we'll use to create the `browserify` bundle.
    fs.writeFileSync(bundleConcat, bundleTmpl + concatPlugins(plugins));

    var bundler = browserify(bundleConcat, {
      standalone: 'Hoodie',
      debug: config.hoodie.build_debug
    });

    bundler.external(['jquery']);

    bundler.bundle(function (err, buffer) {
      if (err) {
        return callback(err);
      }
      var bundle = buffer.toString();
      config.hoodie.create_date = +new Date();
      // write bundle to cache file
      console.log('Writing hoodie.js bundle to cache file');
      fs.writeFileSync(bundle_cache_out, bundle);
      // Store successful bundle in cache.
      config.hoodiejs = bundle;
      return callback();
    });

  } else {
    // read cached bundle file from file
    config.hoodie.from_cache = true;
    console.log('Reading hoodie.js bundle from cache file');
    config.hoodiejs = fs.readFileSync(bundle_cache_out);
    return callback();
  }

};
