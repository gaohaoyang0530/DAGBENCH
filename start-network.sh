#!/bin/bash 

function generateConfig() {
  ARCH=$(uname -s | grep Darwin)
    if [ "$ARCH" == "Darwin" ]; then
      OPTS="-it"
    else
      OPTS="-i"
    fi

    echo clean up old data
    rm -rf ./network/hashgraph/config_*

  COUNTER=0
  while [ $COUNTER -lt $NUMBER_OF_NODES ]; do

    touch ./network/hashgraph/config_$COUNTER.txt

    let NICK_NAME=N$COUNTER
    let FULL_NAME=NODE$COUNTER

    let PORT_NUMBER=50204+$COUNTER
    
    let ADD_ACCOUNTID=3+$COUNTER
    ACCOUNT_ID=0.0.$ADD_ACCOUNTID

    echo "swirld, 123" >> ./network/hashgraph/config_$COUNTER.txt
    echo "app, HederaNode.jar" >> ./network/hashgraph/config_$COUNTER.txt
    echo "address, $NICK_NAME,$FULL_NAME, 1, 127.0.0.1, $PORT_NUMBER, 127.0.0.1, $PORT_NUMBER, $ACCOUNT_ID" >> ./network/hashgraph/config_$COUNTER.txt
    echo "TLS, on" >> ./network/hashgraph/config_$COUNTER.txt

    let COUNTER=COUNTER+1
  done

}

function startDocker() {
  COUNTER=0
  
  cd ./network/hashgraph

  while [ $COUNTER -lt $NUMBER_OF_NODES ]; do
    let PORT_NUMBER=50204+$COUNTER

    docker run -d -p ${PORT_NUMBER}:${PORT_NUMBER} -v $(pwd)/config_${COUNTER}.txt:/hashgraph/config.txt --name hashgraph${COUNTER} -v $(pwd)/data:/hashgraph/data services-node:v0.8.0-rc1-325-ga8344bd8

    let COUNTER=COUNTER+1
  done
}

NUMBER_OF_NODES=2

while getopts "h?n:v" opt; do
  case "$opt" in
  n)
    NUMBER_OF_NODES=$OPTARG
    ;;
  esac
done

echo Generating $NUMBER_OF_NODES nodes 
generateConfig
startDocker
