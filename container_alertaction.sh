#!/usr/bin/env bash

PATH=$PATH:/usr/bin:/sbin:/usr/sbin:.
export PATH

if [ ! -f /alertaction/gy_alertaction.js ]; then
	echo -e "\n\nERROR : Invalid Alert Agent container image as /alertaction/gy_alertaction.js file not found...\n\n"
	exit 1
fi

cd /alertaction

trap 'echo "	Exiting now... Cleaning up..."; ./runalertaction.sh stop; exit 0' SIGINT SIGQUIT SIGTERM

CMD=${1:-"start"}

shift

./runalertaction.sh "$CMD" "$@" < /dev/null

if [ "$CMD" = "start" ] || [ "$CMD" = "restart" ]; then
	sleep 10

	if [ "x""`./runalertaction.sh printpids`" = "x" ]; then
		echo -e "\n\nERROR : Alert Agent not running currently. Exiting...\n\n"
		exit 1
	fi	

	while true; do
		sleep 30

		./runalertaction.sh ps

		if [ "x""`./runalertaction.sh printpids`" = "x" ]; then
			echo -e "\n\nERROR : Alert Agent not running currently. Exiting...\n\n"
			exit 1
		fi	
	done	
fi

exit $?

