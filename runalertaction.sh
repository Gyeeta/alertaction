#!/bin/bash

PATH=$PATH:/usr/bin:/sbin:/usr/sbin:.
export PATH

print_start()
{
	echo 
	echo ' Option <start> - To start the Gyeeta Alert Agent : 

 ./runalertaction.sh start
'
}

print_stop()
{
	echo 
	echo ' Option <stop> - To stop the Gyeeta Alert Agent components : 

 ./runalertaction.sh stop
'
}

print_restart()
{
	echo 
	echo ' Option <restart> - To restart the Gyeeta Alert Agent components : 

 ./runalertaction.sh restart
'
}


print_ps()
{
	echo
	echo ' Option <ps> -	To check the PID status of Gyeeta Alert Agent components

 ./runalertaction.sh ps
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
echo -e "\n\n		Complete Set of Options : \n"

echo -e "	
	ps 	restart 	start		stop 	version 

	For Help on any option : please type 
	
	$0 help <Option>

	e.g. $0 help start

"

}

printusage()
{
echo -e "\n\n ------------------  Usage  -------------------\n"
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
			echo -e "$IS_FOUND"
		fi	
	fi
}


node_start_validate()
{
	# TODO : Validate config file

	gy_pgrep
	if [ -n "$GLOB_PGREP_PID" ]; then
		echo -e "\nNOTE : Gyeeta Alert Agent component(s) already running : PID(s) $GLOB_PGREP_PID\n\n"
		echo -e "Please run \"$0 restart\" if you need to restart the components...\n\n"

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
	echo -e "\n\nERROR : Binary node not found in dir $PWD. Please run from a proper install...\n\n"
	exit 1
elif [ ! -f ./gy_alertaction.js ] || [ ! -f ./gy_actionforever.js ]; then
	echo -e "\n\nERROR : Required files gy_alertaction.js or gy_actionforever.js not found in dir $PWD. Please run from a proper install...\n\n"
	exit 1
fi

export LD_LIBRARY_PATH=`pwd`/libs:$LD_LIBRARY_PATH

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
					echo -e "\nERROR : Invalid Option $opt...\n\n"
					exit 1
				fi

				shift
			done
		fi

		;;

	start) 

		node_start_validate

		echo -e "\n\tStarting Gyeeta Alert Agent components...\n\n"

		shift 1

		ulimit -c 0

		if [ "x""$NODE_ENV" = "x" ]; then
			export NODE_ENV='production'
		fi	

		if [ -n "$GY_FOREGROUND" ]; then
			echo -e "\nRunning Alert Agent in foreground as GY_FOREGROUND env set...\n"

			exec ./node ./gy_actionforever.js "$@" 

			echo -e "\n\nERROR : Failed to execute Gyeeta Alert Agent node process. Exiting...\n"
			exit 1
		fi

		( ./node ./gy_actionforever.js "$@" &) &

		sleep 5

		./runalertaction.sh ps

		gy_pgrep 
		if [ -z "$GLOB_PGREP_PID" ]; then
			echo -e "\n\tERROR : Gyeeta Alert Agent process not running. Please check log for ERRORs if no errors already printed...\n\n"
			exit 1
		fi

		exit 0

		;;

	
	stop)

		echo -e "\n\tStopping Gyeeta Alert Agent components : "

		gy_pgrep 
		[ -n "$GLOB_PGREP_PID" ] && kill $GLOB_PGREP_PID 2> /dev/null

		gy_pgrep 
		if [ -n "$GLOB_PGREP_PID" ]; then
			sleep 3
			gy_pgrep 
			
			if [ -n "$GLOB_PGREP_PID" ]; then
				echo -e "\n\t[ERROR]: Gyeeta Alert Agent process $GLOB_PGREP_PID not yet exited. Sending SIGKILL...\n\n"
				kill -KILL $GLOB_PGREP_PID
			fi	
		fi	

		echo -e "\n\n\tStopped all components successfully...\n\n"

		exit 0

		;;


	ps)

		echo -e "\n\tPID status of Gyeeta Alert Agent package components : "

		GLOB_PRINT_PID=1

		echo -e "\n\n\tGyeeta Alert Agent PID(s) : "
		gy_pgrep 
		
		if [ -n "$GLOB_PGREP_PID" ]; then
			echo -e "\n\n\n\tAll Components Running : Yes\n\n"
		else
			echo -e "\n\n\n\tAll Components Running : No\n\n"
		fi	

		exit 0

		;;


	printpids)
		shift

		GLOB_PRINT_PID=1
		
		gy_pgrep

		exit 0;
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

