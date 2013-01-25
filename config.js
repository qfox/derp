exports.server = {
	listen: 80,
};
exports.vhosts = {
	// server { location {}, location {} }
	'google.com': {
		
	},
	'js.dev.qfox.ru': { // server
		'/': { // location
			proxy_pass: 'http://ya.ru/'
		},
		'/yeah': {
			socketPath: '/home/alex/derp/greeter.socket',
			worker: {
				command: 'node',
				args: ['greeter.js']
			}
		}
	}
};
