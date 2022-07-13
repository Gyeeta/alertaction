#!/bin/bash

PATH=$PATH:/usr/bin:/sbin:/usr/sbin:.
export PATH

print_start()
{
	echo 
	echo ' Option <start> - To start the Gyeeta Alert Action Handler : 

 ./runalertaction.sh start
'
}

print_stop()
{
	echo 
	echo ' Option <stop> - To stop the Gyeeta Alert Action Handler components : 

 ./runalertaction.sh stop
'
}

print_restart()
{
	echo 
	echo ' Option <restart> - To restart the Gyeeta Alert Action Handler components : 

 ./runalertaction.sh restart
'
}


print_ps()
{
	echo
	echo ' Option <ps> -	To check the PID status of Gyeeta Alert Action Handler components

 ./runalertaction.sh ps
'
}

print_configure()
{
	echo 
	echo ' Option <configure> - To configure Gyeeta Alert Action Handler settings : 

 ./runalertaction.sh configure
'
}

print_version()
{
	echo
	echo ' Option <version OR -v OR --version> - To get the Version information :

 ./runalertaction.sh version OR ./runalertaction.sh -v OR ./runalertaction.sh --version
'
}

print_complete_set()
{
printf "\n\n		Complete Set of Options : \n"

printf "	
	configure 	ps 	restart 	start		stop 	version 

	For Help on any option : please type 
	
	$0 help <Option>

	e.g. $0 help start

"

}

printusage()
{
printf "\n\n ------------------  Usage  -------------------\n"
print_start
print_stop
print_ps
print_configure
print_version

print_complete_set

}

# ----------------  Help functions end for commands available ------------------------


GLOB_PRINT_PID=0

gy_pgrep()
{
	GLOB_PGREP_PID=""
	
	PIDCMD='for i in `pgrep -x node`; do if [ `egrep -c "gy_actionforever.js|gy_alertaction.js" /proc/$i/cmdline 2> /dev/null` -gt 0 2> /dev/null ]; then echo $i;fi; done'

	IS_FOUND=`
		for i in $( eval $PIDCMD ); do	
			CDIR=$( readlink /proc/self/cwd )
			IDIR=$( readlink /proc/${i}/cwd 2> /dev/null )

			echo $i $CDIR $IDIR  | awk '{if (match($3, $2) == 1) printf("%d ", $1)}'	
		done 
		`


	if [ -n "$IS_FOUND" ]; then
		GLOB_PGREP_PID="$IS_FOUND"
		if [ $GLOB_PRINT_PID -eq 1 ]; then
			printf "$IS_FOUND"
		fi	
	fi
}


node_start_validate()
{
	# TODO : Validate config file

	gy_pgrep
	if [ -n "$GLOB_PGREP_PID" ]; then
		printf "\nNOTE : Gyeeta Alert Action component(s) already running : PID(s) $GLOB_PGREP_PID\n\n"
		printf "Please run \"$0 restart\" if you need to restart the components...\n\n"

		exit 1
	fi
}

if [ $# -lt 1 ]; then
	printusage
	exit 1
fi

umask 0006

DNAME=`dirname $0 2> /dev/null`

if [ $? -eq 0 ]; then
	cd $DNAME
	CURRDIR=`pwd`
fi

if [ ! -f ./node ]; then 
	printf "\n\nERROR : Binary node not found in dir $PWD. Please run from a proper install...\n\n"
	exit 1
elif [ ! -f ./gy_alertaction.js ] || [ ! -f ./gy_actionforever.js ]; then
	printf "\n\nERROR : Required files gy_alertaction.js or gy_actionforever.js not found in dir $PWD. Please run from a proper install...\n\n"
	exit 1
fi

ARGV_ARRAY=("$@") 
ARGC_CNT=${#ARGV_ARRAY[@]} 
 

case "$1" in 

	help | -h | --help | \?)
		if [ $# -eq 1 ]; then	

			printusage
		else 
			shift

			for opt in $*;
			do	
				print_"$opt" 2> /dev/null
				if [ $? -ne 0 ]; then
					printf "\nERROR : Invalid Option $opt...\n\n"
					exit 1
				fi

				shift
			done
		fi

		;;

	start) 

		node_start_validate

		printf "\n\tStarting Gyeeta Alert Action Handler components...\n\n"

		shift 1

		( ./node ./gy_actionforever.js "$@" &) &

		sleep 5

		./runalertaction.sh ps

		gy_pgrep 
		if [ -z "$GLOB_PGREP_PID" ]; then
			printf "\n\tERROR : Gyeeta Alert Action Handler process not running. Please check log for ERRORs if no errors already printed...\n\n"
			exit 1
		fi

		exit 0

		;;

	
	stop)

		printf "\n\tStopping Gyeeta Alert Action Handler components : "

		gy_pgrep 
		[ -n "$GLOB_PGREP_PID" ] && kill $GLOB_PGREP_PID 2> /dev/null

		gy_pgrep 
		if [ -n "$GLOB_PGREP_PID" ]; then
			sleep 3
			gy_pgrep 
			
			if [ -n "$GLOB_PGREP_PID" ]; then
				printf "\n\t[ERROR]: Gyeeta Alert Action Handler process $GLOB_PGREP_PID not yet exited. Sending SIGKILL...\n\n"
				kill -KILL $GLOB_PGREP_PID
			fi	
		fi	

		printf "\n\n\tStopped all components successfully...\n\n"

		exit 0

		;;

	configure)

		exit 0
		;;


	ps)

		printf "\n\tPID status of Gyeeta Alert Action Handler package components : "

		GLOB_PRINT_PID=1

		printf "\n\n\tGyeeta Alert Action Handler PID(s) : "
		gy_pgrep 
		
		if [ -n "$GLOB_PGREP_PID" ]; then
			printf "\n\n\n\tAll Components Running : Yes\n\n"
		else
			printf "\n\n\n\tAll Components Running : No\n\n"
		fi	

		exit 0

		;;

	restart)
	
		shift 

		./runalertaction.sh stop && sleep 1 && ./runalertaction.sh start "$@"

		exit $?
		;;

	-v | --version)

		./node ./gy_alertaction.js --version
		
		;;

	*)
		printusage
		exit 1

		;;
esac

exit 0

