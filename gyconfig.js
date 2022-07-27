'use strict';

			require('console-stamp')(console, { 
				format: ':date(yyyy-mm-dd HH:MM:ss.l)::label:' 
			});

const			fs = require('fs');
const 			moment = require('moment');

const			{safetypeof} = require("./gyutil.js");


let			gyconfig;

function initGlobalConfig(printcfg = true)
{
	const			env = process.env;
	let			cstr = '{\n\t';

	gyconfig = {};

	if (!env.CFG_SHYAMA_HOSTS) {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config  'CFG_SHYAMA_HOSTS' not found : Please set CFG_SHYAMA_HOSTS value in .env file`);
		process.exit(1);
	}	
	
	if (env.CFG_SHYAMA_HOSTS[0] !== '[') {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config CFG_SHYAMA_HOSTS=${env.CFG_SHYAMA_HOSTS} not of JSON Array format`);
		process.exit(1);
	}	

	cstr += `"ShyamaHostArr" : ${env.CFG_SHYAMA_HOSTS},\n\t`;

	if (!env.CFG_SHYAMA_PORTS) {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config  'CFG_SHYAMA_PORTS' not found : Please set CFG_SHYAMA_PORTS value in .env file`);
		process.exit(1);
	}	

	if (env.CFG_SHYAMA_PORTS[0] !== '[') {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config  CFG_SHYAMA_PORTS=${env.CFG_SHYAMA_PORTS} not of JSON Array format`);
		process.exit(1);
	}	

	cstr += `"ShyamaPortArr" : ${env.CFG_SHYAMA_PORTS},\n\t`;

	if (env.CFG_LOGFILE) {
		if (env.CFG_LOGFILE[0] !== '"') {
			cstr += `"logFile" : "${env.CFG_LOGFILE}",\n\t`;
		}
		else {
			cstr += `"logFile" : ${env.CFG_LOGFILE},\n\t`;
		}	
	}	

	cstr += `"tinit" : "${moment().format()}"\n}`;

	if (printcfg) {
		console.info(`Alert Action Config options : \n${cstr}`);
	}

	try {
		gyconfig = JSON.parse(cstr);
	}
	catch(e) {
		if (!printcfg) {
			console.info(`Alert Action Config options : \n${cstr}`);
		}	
		console.error(`[ERROR]: Alert Action Config not in JSON format : ${e}\n`);
		process.exit(1);
	}	

	if (!Array.isArray(gyconfig.ShyamaHostArr)) {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config CFG_SHYAMA_HOSTS=${env.CFG_SHYAMA_HOSTS} not in JSON Array format`);
		process.exit(1);
	}	

	if (!Array.isArray(gyconfig.ShyamaPortArr)) {
		console.error(`Invalid Alert Action Config : Mandatory Environment Config  CFG_SHYAMA_PORTS=${env.CFG_SHYAMA_PORTS} not in JSON Array format`);
		process.exit(1);
	}	

	if (gyconfig.ShyamaHostArr.length !== gyconfig.ShyamaPortArr.length) {
		console.error(`Invalid Alert Action Config : CFG_SHYAMA_HOSTS and CFG_SHYAMA_PORTS Array lengths differ in size`);
		process.exit(1);
	}	

	gyconfig.projectName 	= 'Gyeeta';
	gyconfig.NodeHostname 	= require('os').hostname();

	if (process.env.NODE_ENV !== "production") {
		console.log('NOTE : Using Development Node Settings. Please set .env NODE_ENV=production if Production settings needed');
	}

	return gyconfig;
}

function getGlobalConfig()
{
	return gyconfig;
}	

module.exports = {
	initGlobalConfig,
	getGlobalConfig,
};	

