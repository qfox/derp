
var cp = require('child_process');

console.log(Date.now(), 'eto start');
var sleep = cp.spawn('sleep', [2]);
console.log(Date.now(), 'a eto spawn');

sleep.on('exit', function(){
	console.log(Date.now(), 'a eto wakeup');
});
console.log(Date.now(), 'eto konec');



setTimeout(function(){
	console.log(Date.now(), 'eto start cp.exec');
	cp.exec('sleep 3 && echo "123"', function(out, a, b){
		console.log(Date.now(), 'nu i callback', out, a, b);
	});
	console.log(Date.now(), 'a eto posle cp.exec');
}, 3500);
