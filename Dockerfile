# syntax=docker/dockerfile:1

FROM ubuntu:18.04

LABEL org.opencontainers.image.description="This container provides the Gyeeta Alert Action Agent"

LABEL usage="docker run -td --rm --name gyeetaAlertAction --read-only --env CFG_SHYAMA_HOSTS='[ \"shyama1.local\", \"shyama2.local\" ]' --env CFG_SHYAMA_PORTS='[ 10037, 10037 ]' <Alert Action Image>"

# LABEL for github repository link
LABEL org.opencontainers.image.source="https://github.com/gyeeta/alertaction"

LABEL org.opencontainers.image.authors="https://github.com/gyeeta"


ARG ALERTACTION_VERSION
ENV ALERTACTION_VERSION=${ALERTACTION_VERSION}

RUN apt-get update && rm -rf /var/lib/apt/lists/*

# tini handling...
ARG TINI_VERSION=v0.19.0
ARG TINI_SHA256="93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c"
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod 0755 /tini
RUN if [ `sha256sum /tini | awk '{print $1}'` != "$TINI_SHA256" ]; then echo -e "ERROR : SHA256 of tini is different from expected value. Binary has changed. Please contact on Github.\n\n"; return 1; else return 0; fi

RUN addgroup --gid 1001 gyeeta && adduser --system --no-create-home --uid 1001 --gid 1001 gyeeta

COPY --chown=gyeeta:gyeeta . /alertaction/

USER gyeeta:gyeeta

ENTRYPOINT ["/tini", "-s", "-g", "--", "/alertaction/container_alertaction.sh" ]

CMD ["start"]

