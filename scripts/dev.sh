#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=docker-compose.yml

function up() {
  docker-compose -f ${COMPOSE_FILE} up -d --build
}

function logs() {
  if [ -z "${1-}" ]; then
    docker-compose -f ${COMPOSE_FILE} logs -f
  else
    docker-compose -f ${COMPOSE_FILE} logs -f $1
  fi
}

function down() {
  docker-compose -f ${COMPOSE_FILE} down
}

function reset() {
  echo "Stopping and removing containers and volumes..."
  docker-compose -f ${COMPOSE_FILE} down -v --remove-orphans
  echo "Rebuilding and starting services..."
  docker-compose -f ${COMPOSE_FILE} up -d --build
  echo "Done. Use './scripts/dev.sh logs' to follow logs."
}

case "${1-}" in
  up)
    up
    ;;
  logs)
    logs "$2"
    ;;
  down)
    down
    ;;
  reset)
    reset
    ;;
  *)
    echo "Usage: $0 {up|logs [service]|down|reset}"
    exit 1
    ;;
esac
