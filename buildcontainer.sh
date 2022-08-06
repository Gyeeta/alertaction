#!/bin/bash -x

DOCKER_BUILDKIT=1 docker build -t gyeeta/alertagent:latest -f ./Dockerfile --build-arg ALERTAGENT_VERSION="v`./runalertaction.sh --version | grep Version | cut -d " " -f 6`" .

