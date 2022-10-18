#!/bin/bash

if [ -z "$1" ]; then
	echo -e "\n\nUsage : $0 <Install Base Dir>\n\n"
	exit 1
fi	

ODIR="$1"/alertaction	

mkdir -p $ODIR 2> /dev/null

if [ ! -d $ODIR ]; then
	echo -e "\n\nERROR : Failed to create install dir $ODIR\n\n"
	exit 1
fi	
	
cp -a . $ODIR

if [ $? -ne 0 ]; then
	echo -e "\n\nERROR : Failed to copy to install dir $ODIR\n\n"
	exit 1
fi

rm -Rf $ODIR/{.git,buildcontainer.sh,Dockerfile,container_alertaction.sh,install.sh}

echo -e "\nInstalled alertaction to $ODIR successfully...\n"

exit 0
