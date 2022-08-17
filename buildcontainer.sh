#!/bin/bash -x

ALERTACTION_VERSION="`./runalertaction.sh --version | grep Version | cut -d " " -f 6`"

DOCKER_BUILDKIT=1 docker build -t ghcr.io/gyeeta/alertaction:latest -t ghcr.io/gyeeta/alertaction:"$ALERTACTION_VERSION" -f ./Dockerfile --build-arg ALERTACTION_VERSION=v"${ALERTACTION_VERSION}"  .

