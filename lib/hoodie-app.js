// Start a Hoodie app
var fs = require("fs");
var npm = require("npm");
var http_proxy = require("http-proxy");
var readline = require("readline");
var request = require("request");
var hoodie_server = require("./hoodie-server");
var MultiCouch = require("multicouch");
var HoodieInstaller = require("./hoodie-installer");
var exec = require('child_process').exec;

var ltld;
try {
  ltld = require("local-tld");
  // TODO: check min version 2.0.0
} catch(e) {
  ltld = null;
}

var host = "0.0.0.0";
var http_port = parseInt(process.env.port, 10) || 8083;
var domain = "dev";

var package_json = JSON.parse(fs.readFileSync("./package.json"));
var name = package_json.name.toLowerCase();
var couch_port;

if(ltld) 
{
  http_port = ltld.getPort(name);
  couch_port = ltld.getPort("couch." + name);
  ltld.setAlias(name, "www");
  ltld.setAlias(name, "admin");
  ltld.setAlias(name, "api");
}
else
{
  couch_port = process.env.COUCH_PORT || 5984;
}

var couch_url = "http://couch." + name + "." + domain + ':' + couch_port;
var hoodie_path = process.env.HOODIE_PATH || process.env.HOME + '/Library/Hoodie';

// if we are on nodejitsu, we require couch_url.
if(process.env.SUBDOMAIN) { // we are on nodejitsu
  domain = "jit.su";
  // TODO: verify couchdb_url is reachable
} else {
  console.log("Start local couch on port: %d", couch_port);
  // prepare hoodir dirs if they don’t exist:
  // mkdir -p $HOME/Application Support/Hoodie/Apps/myapp/
  mkdir_p(hoodie_path);
  mkdir_p(hoodie_path + '/Apps');
  mkdir_p(hoodie_path + '/Apps/' + name);
  // if we are not on nodejitsu, make us a couch
  var couchdb = new MultiCouch({
    prefix: hoodie_path + '/Apps/' + name,
    port: couch_port,
    couchdb_path: '/usr/bin/couchdb',
    default_ini: ''
  });

  couchdb.on("start", function() {
    console.log("CouchDB Started");
    setTimeout(setup, 2000);
  });

  couchdb.on("error", function(error) {
    console.log("CouchDB Error: %j", error);
  });

  process.on("exit", function() {
    couchdb.stop();
    console.log("CouchDB stop triggered by exit");
  });

  // on ctrl-c, stop couchdb first, then exit.
  process.on("SIGINT", function() {
    couchdb.on("stop", function() {
      process.exit(0);
    });
    couchdb.stop();
  });

  couchdb.start();
}


var hoo = new hoodie_server(name, domain, couch_port);
// start frontend proxy
var server = http_proxy.createServer(hoo);
server.listen(http_port, function() {
  console.log("hoodie server started on port '%d'", http_port);
});

function start_workers() {
  var worker_names = [];
  var deps = package_json.dependencies;
  for(var dep in deps) {
    if(dep.substr(0, 7) == "worker-") {
      worker_names.push(dep);
    }
  }

  npm.load(function(error, npm) {
    var password = npm.config.get(name + "_admin_pass");
    // for each package_json/worker*
    var workers = worker_names.map(function(worker_name) {
      console.log("starting: '%s'", worker_name);
      // start worker
      console.log("Trying to require " + "hoodie-" + worker_name);
      var worker = require("hoodie-" + worker_name);
      var config = {
        name: worker_name.replace(/^worker-/, ''),
        server: "http://couch." + name + "." + domain + ":" + couch_port,
        admin: {
          user: "admin",
          pass: password || process.env["HOODIE_ADMIN_PASS"]
        },
        persistent_since_storage: false
      };
      return new worker(config);
    });
    console.log("All workers started.");
    console.log("Your App is ready now.");
  });
}

function setup() {
  var installer = new HoodieInstaller(name, couch_url);

  installer.on("done", function() {

    // setup modules DB
    npm.load(function(error, npm) {
      var password = npm.config.get(name + "_admin_pass");
      request({
        url: couch_url + "/modules",
        method: "PUT",
        auth: "admin:" + password
      }, function(error, response, body) {
        request({
          url: couch_url + "/modules/global_config",
          method: "PUT",
          auth: "admin:" + password,
          body: '{"config":{"email":{"transport":{"host":"","port":465,"auth":{"user":"@gmail.com","pass":""},"secureConnection":true,"service":"Gmail"}}}}'
        }, function(error, response, body) {

          // boom
          console.log("");
          console.log("open http://%s.%s in your browser", name, domain);
          console.log("");
          exec('open http://' + name + '.' + domain)
          
          start_workers();
        });
      });
    });

  });

  installer.on("prompt_pass", function () {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question("Please set an admin password: ", function(password) {
      installer.emit("set_password", password);
      rl.close();
    });
  });

  installer.on("set_password", function(password) {
    request({
      url: couch_url + "/_config/admins/admin",
      method: "PUT",
      body: '"' + password + '"'
    }, function(error) {
      if(error !== null) {
        console.trace("set_password");
        console.log(error);
        throw error;
      }
      npm.load(function(error, npm) {
        if(error !== null) {
          console.log(error)
          throw error;
        }
        var config = {
          key: name + "_admin_pass",
          value: password
        };
        var result = npm.commands.config(["set", config.key, config.value]);
      });
      installer.emit("done");
    });
  });
}

// * * *

function mkdir_p(dir) {
  try {
    fs.mkdirSync(dir);
  } catch(e) {
    // nope
  }
}
