#!/bin/bash -x

DOCKER_BUILDKIT=1 docker build -t gyeeta/alertaction:latest -f ./Dockerfile --build-arg ALERTACTION_VERSION="v`./runalertaction.sh --version | grep Version | cut -d " " -f 6`" .

