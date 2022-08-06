
'use strict';

const 		process = require('process');
const 		os = require('os');

		require('dotenv').config({ path: process.env.CFG_ENV });

if (process.argv.length === 3 && process.argv[2] === '--version') {
	console.log("Alert Agent Version : ", require('./gyeeta_comm.js').NODE_VERSION_STR);
	process.exit(0);
}

const 		chalk = require('chalk');

		require('console-stamp')(console, { 
			format: ':date(yyyy-mm-dd HH:MM:ss.l)::label:' 
		});

const 		{initGlobalConfig} = require('./gyconfig.js');
const		gyconfig = initGlobalConfig();

const 		{GyeetaHandler, ErrorTypes, setReqEventCallback} = require('./gyeeta_comm.js');
const		{safetypeof, printResourceUsage} = require("./gyutil.js");

const		gEmailHdlr = require('./email_action.js');
const		gSlackHdlr = require('./slack_action.js');
const		gPagerHdlr = require('./pager_action.js');
const		gWebhook = require('./webhook_action.js');	

const		gidentifier = `${os.hostname()} PID ${process.pid} ${os.uptime()}`;

console.log(`Gyeeta Alert Agent Starting now : Identifier used is ${gidentifier}`);

const 		gyeetaHdlr = new GyeetaHandler(gyconfig.ShyamaHostArr, gyconfig.ShyamaPortArr, gidentifier, 1, 2, true /* is_action_conn */);

let gstats = {
	nalerts		: 0,
	ninvalid	: 0,
	nemail		: 0,
	nslack		: 0,
	npager		: 0,
	nwebhook	: 0,
	nnull		: 0,
};	

const gstatproto = {...gstats};

function printStats()
{
	console.info(`Alert Action Stats : Total Alerts ${gstats.nalerts}, Rejected Alerts ${gstats.ninvalid}, Total Emails sent ${gstats.nemail}, Slack Messages ${gstats.nslack}, `,
		`Pagerduty Messages ${gstats.npager}, Webhook Requests ${gstats.nwebhook}, Null Actions ${gstats.nnull}\n`);

	if (gstats.nalerts > Number.MAX_SAFE_INTEGER - 100) {
		console.info('Resetting Alert Action Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}

	printResourceUsage();
}	

setInterval(printStats, 60 * 1000);

function sendActions(actobj)
{
	for (let i = 0; i < actobj.actions.length; ++i) {
		const		action = actobj.actions[i];

		if ((safetypeof(action) !== 'object') || !action.type) {
			return false;
		}	

		if (safetypeof(action.config) === 'object' && safetypeof(action.newconfig) === 'object') {
			Object.assign(action.config, action.newconfig);
		}	
	}

	let			emailsent = false, slacksent = false, pagersent = false, webhooksent = false, nullseen = false;

	for (let i = 0; i < actobj.actions.length; ++i) {
		const		action = actobj.actions[i];

		switch (action.type) {
		
		case 'email' :
			if (emailsent === false) {
				emailsent = true;

				try {
					gEmailHdlr.sendEmailAlert(actobj);
					
					gstats.nemail++;
				}
				catch(e) {
					console.log(`[ERROR]: Exception caught while sending Email Alert Action notification : ${e}\n${e?.stack}\n`);
				}	
			}
			break;

		case 'slack' :
			if (slacksent === false) {
				slacksent = true;

				try {
					gSlackHdlr.sendSlackAlert(actobj);
					
					gstats.nslack++;
				}
				catch(e) {
					console.log(`[ERROR]: Exception caught while sending Slack Alert Action notification : ${e}\n${e?.stack}\n`);
				}	
			}
			break;

		case 'pagerduty' :
			if (pagersent === false) {
				pagersent = true;

				try {
					gPagerHdlr.sendPagerAlert(actobj);
					
					gstats.npager++;
				}
				catch(e) {
					console.log(`[ERROR]: Exception caught while sending Pagerduty Alert Action notification : ${e}\n${e?.stack}\n`);
				}	
			}
			break;


		case 'webhook' :
			if (webhooksent === false) {
				webhooksent = true;

				try {
					gWebhook.sendWebhookAlert(actobj);
					
					gstats.nwebhook++;
				}
				catch(e) {
					console.log(`[ERROR]: Exception caught while sending Webhook Alert Action notification : ${e}\n${e?.stack}\n`);
				}	
			}
			break;


		case 'null' :
			if (nullseen === false) {
				nullseen = true;
				gstats.nnull++;
			}
			break;

		default :
			break;
		}
	}

	return true;
}	

function handleAlertAction(actobj)
{
	try {
		gstats.nalerts++;

		if (!actobj?.etype || actobj.etype !== 'action' || !Array.isArray(actobj.actions) || !actobj.actions.length || 
			!Array.isArray(actobj.alerts) || !actobj.alerts.length || typeof actobj.weburl !== 'string') {

			gstats.ninvalid++;
			return;
		}		

		/*console.debug(`Received new Alert Action : ${JSON.stringify(actobj, null, '\t')}`);*/
		
		let 			bret = sendActions(actobj);

		if (bret === false) {
			gstats.ninvalid++;
			return;
		}	
	}
	catch(e) {
		console.log(`[ERROR]: Exception caught while handling Alert Action notification : ${e}\n${e?.stack}\n`);
	}	
}

setReqEventCallback('action', handleAlertAction);	

module.exports = {
	handleAlertAction,
	gyconfig,
};	


process.on('exit', (code) => {
	console.log('Alert Action Agent exiting now with code : ', code);
});

process.on('uncaughtException', (err, origin) => {
	fs.writeSync(process.stderr.fd, `[ERROR]: Alert Action Agent Caught Unhandled Exception : Exiting now... : ${err}\n` + `Exception origin: ${origin}`);

	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('Alert Action Agent Unhandled Rejection seen at :', promise, ' reason : ', reason);
});

process.on('SIGHUP', () => {
	console.log('Alert Action Agent Controlling Terminal has exited. But continuing...');
});


