
'use strict';

		require('console-stamp')(console, { 
			format: ':date(yyyy-mm-dd HH:MM:ss.l)::label:' 
		});

const 		nodemailer = require('nodemailer');

const		{getAlertsHTML, getAlertsText} = require('./alerts_html.js');
const		{safetypeof} = require("./gyutil.js");

const		gtranmap = new Map();
const		MaxTranCache = 32;

let gstats = {
	nalerts		: 0,
	nsuccess	: 0,
	nfails		: 0,
	ninvalid	: 0,
	npoolresets	: 0,

	lasterr		: '""',
};	

const gstatproto = {...gstats};

function printStats()
{
	console.info(`Email Action Stats : Total Alerts ${gstats.nalerts}, Success ${gstats.nsuccess}, Email Failures ${gstats.nfails}, Invalid ${gstats.ninvalid}, `,
			`Pooled Transports Active ${gtranmap.size}, Pool Conn Resets ${gstats.npoolresets}, Last Error Message ${gstats.lasterr}\n`);

	if ((gstats.nalerts > Number.MAX_SAFE_INTEGER - 100) || (gstats.ninvalid > Number.MAX_SAFE_INTEGER - 100)) {
		console.info('Resetting Email Action Stats as Stats Overflow likely...\n');
		gstats = {...gstatproto};
	}
}	

function cleanupTranMap()
{
	try {
		const			mintime = Date.now() - 5 * 60 * 1000, maxtime = Date.now() - 30 * 60 * 1000;
		let			ndels = 0;

		for (let [configid, tranobj] of gtranmap) {
			if (!tranobj) {
				if (configid) {
					gtranmap.delete(configid);
				}

				continue;
			}	

			if (tranobj.tlast < mintime || tranobj.tinit < maxtime || tranobj.nerr > 2) {
				tranobj.tran.close();
				gtranmap.delete(configid);

				ndels++;
				gstats.npoolresets++;
			}
		}

		if (ndels > 0) {
			console.info(`Closed ${ndels} Email Action Pooled Connections due to Inactivity or Errors...\n`);
		}	
	}
	catch(e) {
		console.log(`[ERROR]: Exception caught while cleaning up Pooled Email Entries : ${e}\n`);
	}	
}	

setInterval(printStats, 60 * 1000);

setInterval(cleanupTranMap, 300 * 1000);

function getTransport(action)
{
	if (!action) {
		gstats.ninvalid++;
		return null;
	}	

	if (!action.config.connection.pool || !action.configid) {
		action.config.connection.pool = false;	// Set pool to false as we cannot cache this element

		return nodemailer.createTransport(action.config.connection);
	}	

	let			tranobj;

	tranobj = gtranmap.get(action.configid);

	if (!tranobj || !tranobj.tran) {
		if (gtranmap.size >= MaxTranCache) {
			action.config.connection.pool = false;	// Set pool to false as we cannot cache this element
		}	

		const			now = Date.now();

		const tranobj = {
			tran 		: nodemailer.createTransport(action.config.connection),
			tinit		: now,
			tlast	 	: now, 
			nerr 		: 0, 
		};

		if (gtranmap.size < MaxTranCache) {
			gtranmap.set(action.configid, tranobj);
		}	
		
		return tranobj;
	}	

	tranobj.tlast = Date.now();

	return tranobj;
}	

function sendEmailAlert(actobj)
{
	if (!actobj || !Array.isArray(actobj.actions)) {
		gstats.ninvalid++;
		return null;
	}	

	let			htmlobj, textobj;
	let			send_html = false, send_text = false;

	/*
	 * First check if we need to send only html or only text emails
	 */
	for (let i = 0; i < actobj.actions.length; ++i) {
		const		action = actobj.actions[i];

		if (action.type !== 'email') {
			continue;
		}

		if (action.config.message.gy_send_text) {
			send_text = true;
		}	
		else {
			send_html = true;
		}	
	}

	if (send_html) { 
		htmlobj = getAlertsHTML(actobj);
			
		if (safetypeof(htmlobj) !== 'object' || !htmlobj.html) {
			gstats.ninvalid++;
			return null;
		}	
	}

	if (send_text) {
		textobj = getAlertsText(actobj);

		if (safetypeof(textobj) !== 'object' || !textobj.text) {
			gstats.ninvalid++;
			return null;
		}	
	}	
	
	gstats.nalerts++;

	/*
	 * Now send the email(s)
	 */
	for (let i = 0; i < actobj.actions.length; ++i) {
		const			action = actobj.actions[i];

		if (safetypeof(action) !== 'object' || action.type !== 'email') {
			continue;
		}

		const			tranobj = getTransport(action);

		if (!tranobj || !tranobj.tran) {
			continue;
		}	

		const			msg = action.config.message;
		let			talertname = actobj.alerts[0].alertname.slice(0, 64);

		if (actobj.alerts[0].alertname.length > 64) talertname += '...';

		if (!actobj.close) {
			msg.subject = `${msg.gy_subject_prefix} : Active Alert seen for ${talertname}`
		}
		else if (actobj.expired) {
			msg.subject = `${msg.gy_subject_prefix} : Alert Expiry seen for ${talertname}`
		}	
		else {
			msg.subject = `${msg.gy_subject_prefix} : Alert Resolved for ${talertname}`
		}	
		
		if (textobj) {
			msg.text = textobj.text;
		}

		if (htmlobj) {
			msg.html = htmlobj.html;
		}

		tranobj.tran.sendMail(msg, function(err, info) {
			if (err) {
				gstats.nfails++;
				gstats.lasterr = JSON.stringify(err);

				tranobj.nerr++;
			}	
			else {
				gstats.nsuccess++;
			}	
		});	
	}
	 
}	

module.exports = {
	sendEmailAlert,
};

