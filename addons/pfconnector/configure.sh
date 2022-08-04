#!/bin/bash

function prompt() {
  msg="$1"
  answer=""
  while [ "$answer" != "y" ] && [ "$answer" != "n" ]; do
    echo -n "$msg (y/n): "
    read answer
  done
  
  if [ "$answer" == "y" ]; then
    return 0
  else
    return 1
  fi
}

connector_id=$(cat /dev/urandom | tr -dc '[:alpha:]' | fold -w ${1:-40} | head -n 1)

echo "Connector ID: $connector_id"
echo "=================================================================="

echo -n "Please configure the connector in PacketFence and input the secret here: "
read secret

echo "=================================================================="

echo "Configuring connector with ID '$connector_id' and secret '$secret'"

echo "AUTH=$connector_id:$secret" > /etc/pfconnector-client.env

echo "Please enter the URL of the pfconnector server"
echo "Usually looks like: https://packetfence.example:1443/api/v1/pfconnector/tunnel"
echo -n "Enter URL: "
read connector_server

echo "HOST=$connector_server" >> /etc/pfconnector-client.env

if ! prompt "Should the pfconnector server TLS certificate be validated?"; then
  echo "TLS_SKIP_VERIFY=true" >> /etc/pfconnector-client.env
fi

echo "FETCH_REMOTES_VIA_API=true" >> /etc/pfconnector-client.env
