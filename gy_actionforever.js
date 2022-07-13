
'use strict';

			require('dotenv').config();
			
const			fs = require('fs');
const 			forever = require('forever-monitor');

const			MAX_CHILD_EXITS = 10, MAX_LOG_SZ = 30 * 1024 * 1024;

const 			{logrotate} = require('./gyutil.js');

const 			{initGlobalConfig} = require('./gyconfig.js');

if (!process.env.ALERTACTION_CFG) {
	console.error('No Valid Config File specified in ALERTACTION_CFG environment variable or .env file : Please specify a valid file path first');
	process.exit(1);
}

const			gyconfig = initGlobalConfig(process.env.ALERTACTION_CFG, true /* isAlertAction */);

let			nodeexits = 0, logtimer;

process.on('SIGHUP', () => {
	// console.log('Controlling Terminal has exited. But continuing...');
});

process.on('exit', (code) => {
	// console.log('Forever Action Handler exiting now with code : ', code);
});

process.on('uncaughtException', (err, origin) => {
	// fs.writeSync(process.stderr.fd, `[ERROR]: Forever Action Handler Caught Unhandled Exception : ${err}` + ` : Exception origin : ${origin}`);

	// Keep running...
});


const child = new (forever.Monitor)('gy_alertaction.js', {
	max		: MAX_CHILD_EXITS,
	silent		: true,
	args		: [],
	killTree	: true,		// Kill all children on exit

	outFile		: gyconfig.logFile,
	errFile		: gyconfig.logFile,
	append		: true,
});

child.on('restart', function() {
	// console.error('Restarting Gyeeta Alert Action Handler since exit detected');

	if (!logtimer) {
		logtimer = setInterval(logrotate, 10000, gyconfig.logFile, MAX_LOG_SZ);
	}
});

child.on('exit:code', function(code) {
	nodeexits++;
	// console.error('Gyeeta Alert Action Handler exited after with code ' + code + ` : Total exits so far = ${nodeexits}`);

	if (logtimer) {
		clearInterval(logtimer);
		logtimer = null;
	}
});


child.start();

logtimer = setInterval(logrotate, 10000, gyconfig.logFile, MAX_LOG_SZ);

