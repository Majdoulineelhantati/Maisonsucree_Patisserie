#!/bin/bash
set -e
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js / npm n'est pas installé. Installe Node.js puis relance ce fichier."
  read -r -p "Appuie sur Entrée pour fermer..."
  exit 1
fi

if [ ! -d backend/node_modules ]; then
  echo "Installation des dépendances backend..."
  (cd backend && npm install)
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installation des dépendances frontend..."
  (cd frontend && npm install)
fi

echo "Lancement du backend sur http://localhost:4000"
(cd backend && npm start) &
BACKEND_PID=$!

sleep 2

echo "Lancement du frontend sur http://localhost:5173"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

open "http://localhost:5173" 2>/dev/null || true
wait
