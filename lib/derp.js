/*jshint laxbreak:true, laxcomma:true, boss:true, strict:false, devel:true, smarttabs:true, onecase:true */
var Q = require('q')
  , FS = require('fs')
  , QFS = require('q-fs')
  , HTTP = require("http")
  , QHTTP = require("q-http")
  , FOREVER = require('forever-monitor')
  , JSYAML = require('js-yaml')
  , xtend = require('xtend')

  , crypto = require('crypto')
  , config

  , proxy
  , overlord
  , die;

JSYAML.addConstructor('!include', function(node){
	var out = {}, glob = require("glob");
	glob.sync(node.value).forEach(function(el) {
		xtend(out, require(el) || {});
	});
	return out;
});

die = function () {
	console.dir.apply(null, arguments);
	process.exit();
};

process.on('SIGHUP', function(){
	config = require('../derp.yml');
	console.log('new config loaded', config);
});

config = require('../derp.yml');
config.vhosts = config.vhosts || {};
(function(){
	for (var k in config) {
		/\-hosts$/.test(k) && xtend(config.vhosts, config[k]);
	};
})();

// simple reverse-proxy realisation. lazy loading any child processes
overlord = {
	swarm: {},
	larvas: config.vhosts,
	selectLarvaToMutate: function (req) {
		//var name =
		console.log(req.headers);
		req.end();
	},
	mutate: function (larva, options) {
		var drone = null,
			deferred = Q.defer();

		options = xtend(options || {}, {

		});

		if (true) { // node-file
			drone = this.swarm[larva.name] = new (forever.Monitor)(larva.index, options);

		} else if (false) { // external command
			drone = this.swarm[larva.name] = forever.start([larva.command].concat(larva.args), options);

		} else { // something unexpectedly
			// .reject()
		}

		drone
			.on('start', function (process, data) { // Raised when the target script is first started.
				console.log('Drone ' + larva.name + ' #[' + process.pid + '] started');
				deferred.resolve(drone);
			})
			.on('stop', function (process) { // Raised when the target script is stopped by the user
				console.log('Drone ' + larva.name + ' #[' + process.pid + '] stopped');
			})
			.on('error', function (err) { // Raised when an error occurs
				console.error('Drone ' + larva.name + ' made a booboo', err);
			})
			.on('restart', function (forever) { // Raised each time the target script is restarted
				console.error('Drone ' + larva.name + ' restarted', forever);
			})
			.on('exit', function (forever) { // Raised when the target script actually exits (permenantly).
				console.error('Drone ' + larva.name + ' is dead ;-(', forever);
				delete _this.swarm[larva.name];
			})
			.on('stdout', function (data) { // Raised when data is received from the child process
				console.log('Drone ' + larva.name + ' #[' + process.pid + '] said: ', data);
			})
			.on('stderr', function (data) { // Raised when data is received from the child process
				console.error('Drone ' + larva.name + ' #[' + process.pid + '] claimed: ', data);
			});

		drone.larva = larva;

		return deferred.promise;
	},
	spawn: function (req) {
		var deferred,
			drone,
			larva;

		larva = this.selectLarvaToMutate(req);

		if (drone = this.swarm[larva.name]) {
			return (function () {
				return function (drone) {
					return drone;
				};
			}(drone));
		}

		return this.swarm[larva.name] = this.mutate(larva, req);
	},
	fill_params: function (req) {
		// 
		//req.headers;
	},
	harvest: function (req) {
		// set headers and so on
		this.fill_params(req);

		var deferred = Q.defer();

		Q.when(this.spawn(req), function (drone) {
			console.log('Drone fetched', drone);
			var data = config[req.path] || config.default;
			if (typeof data !== 'function') {
				data = QHTTP.request(data);
			}
			deferred.resolve();

			var opts = {
				socketPath: './greeter.socket',
				//host: 'ya.ru',
				//port: 80,
				path:       '/',
				method:     'GET'
			};
			var proxyRequest = HTTP.get(opts, function (response) {
				var key = crypto.createHash('md5').update('' + (Date.now())).digest("base64").replace(/[\+\/]/g, '').substr(0, 8);
				response.on('data', function (chunk) {
					console.log(key + ' data comes:', chunk);
					res.write(chunk);
				});
				response.on('end', function () {
					console.log(key + ' end');
					res.end()
				});
			});

		});

		return deferred.promise;
	}
};

var nydus = QHTTP.Server(function (req, resp) {
	req.key = crypto.createHash('md5').update('' + (Date.now())).digest("base64").replace(/[\+\/]/g, '').substr(0, 8);

	console.info(req.key, req.method + ' ' + req.url);

	return Q.when(overlord.harvest(req),function (subresp) {
		console.log(req.key, subresp.status, subresp.headers.location ? '>' + subresp.headers.location : '');

		resp.status = subresp.status;
		resp.charset = subresp.charset;
		resp.headers = subresp.headers;
		resp.body = subresp.body;

		return resp;

	}).fail(function (err) {
		console.error(req.key, err);

		resp.status = 500;
		resp.charset = 'utf8';
		resp.headers = {'content-type': 'text/html'};
		resp.body = ['<h1>HTTP error 500</h1>'].concat(err ? ['<pre>', '' + (err.stack || err), '</pre>'] : []);

		return resp;
	});
});

Q.when(nydus.listen(config.server.listen || 49080), function (listener) {
	// initialised
	console.log('Server listening on port ' + (config.server.listen || 49080));
});
