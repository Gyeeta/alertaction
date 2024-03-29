
'use strict';

const			fs = require('fs');
const 			process = require('process');

			require('dotenv').config({ path: process.env.CFG_ENV });

const 			forever = require('forever-monitor');

const			MAX_CHILD_EXITS = 10, MAX_LOG_SZ = 30 * 1024 * 1024;

const 			{logrotate} = require('./gyutil.js');

const 			{initGlobalConfig} = require('./gyconfig.js');
const			gyconfig = initGlobalConfig(false);

let			nodeexits = 0, logtimer;

process.on('SIGHUP', () => {
	// console.log('Controlling Terminal has exited. But continuing...');
});

process.on('exit', (code) => {
	// console.log('Forever Alert Agent exiting now with code : ', code);
});

process.on('uncaughtException', (err, origin) => {
	// fs.writeSync(process.stderr.fd, `[ERROR]: Forever Alert Agent Caught Unhandled Exception : ${err}` + ` : Exception origin : ${origin}`);

	// Keep running...
});


const child = new (forever.Monitor)('gy_alertaction.js', {
	max		: MAX_CHILD_EXITS,
	silent		: gyconfig.logFile ? true : false,
	args		: [],
	killTree	: true,		// Kill all children on exit

	outFile		: gyconfig.logFile,
	errFile		: gyconfig.logFile,
	append		: true,
});

child.on('restart', function() {
	// console.error('Restarting Gyeeta Alert Agent since exit detected');

	if (!logtimer && gyconfig.logFile) {
		logtimer = setInterval(logrotate, 10000, gyconfig.logFile, MAX_LOG_SZ);
	}
});

child.on('exit:code', function(code) {
	nodeexits++;
	// console.error('Gyeeta Alert Agent exited after with code ' + code + ` : Total exits so far = ${nodeexits}`);

	if (logtimer && gyconfig.logFile) {
		clearInterval(logtimer);
		logtimer = null;
	}
});


child.start();

if (gyconfig.logFile) {
	logtimer = setInterval(logrotate, 10000, gyconfig.logFile, MAX_LOG_SZ);
}

