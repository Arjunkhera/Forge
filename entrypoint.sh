#!/bin/bash
set -e

FORGE_PORT="${FORGE_PORT:-8200}"
FORGE_HOST="${FORGE_HOST:-0.0.0.0}"
REGISTRY_PATH="${FORGE_REGISTRY_PATH:-/data/registry}"
WORKSPACES_PATH="${FORGE_WORKSPACES_PATH:-/data/workspaces}"
ANVIL_URL="${FORGE_ANVIL_URL:-http://anvil:8100}"
VAULT_URL="${FORGE_VAULT_URL:-http://vault:8000}"
CONFIG_DIR="${HOME}/.forge"
FORGE_REGISTRY_REPO_URL="${FORGE_REGISTRY_REPO_URL:-}"
FORGE_SYNC_INTERVAL="${FORGE_SYNC_INTERVAL:-300}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
PULL_PID=""
NODE_PID=""

log() {
  echo "{\"level\":\"info\",\"message\":\"$1\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >&2
}

log_err() {
  echo "{\"level\":\"error\",\"message\":\"$1\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >&2
}

# SIGTERM handler right after the log functions
shutdown() {
  log "Shutdown signal received — cleaning up..."
  if [ -n "$PULL_PID" ] && kill -0 "$PULL_PID" 2>/dev/null; then
    kill "$PULL_PID"
    wait "$PULL_PID" 2>/dev/null || true
    log "Pull daemon stopped"
  fi
  if [ -n "$NODE_PID" ] && kill -0 "$NODE_PID" 2>/dev/null; then
    kill "$NODE_PID"
    wait "$NODE_PID" 2>/dev/null || true
  fi
  exit 0
}
trap shutdown SIGTERM SIGINT

# Step 1: Ensure config directory exists
mkdir -p "${CONFIG_DIR}"

# Step 2: Write ~/.forge/config.yaml from environment variables.
# This runs every startup so env var overrides always win (CLI > env > config > defaults).
log "Writing Forge global config to ${CONFIG_DIR}/config.yaml..."
cat > "${CONFIG_DIR}/config.yaml" << EOF
registries:
  - type: filesystem
    name: default
    path: ${REGISTRY_PATH}

workspace:
  mount_path: ${WORKSPACES_PATH}
  default_config: sdlc-default
  retention_days: 30

mcp_endpoints:
  anvil:
    url: ${ANVIL_URL}
    transport: http
  vault:
    url: ${VAULT_URL}
    transport: http

repos:
  scan_paths: []
  index_path: ${CONFIG_DIR}/repos.json
EOF

log "Config written. Registry: ${REGISTRY_PATH}, Anvil: ${ANVIL_URL}, Vault: ${VAULT_URL}"

# Step 3: Clone registry repo if not already present
if [ -z "$FORGE_REGISTRY_REPO_URL" ] && [ ! -d "${REGISTRY_PATH}/.git" ]; then
  log_err "FORGE_REGISTRY_REPO_URL is not set and ${REGISTRY_PATH} has no .git directory. Cannot start."
  exit 1
fi

if [ -n "$FORGE_REGISTRY_REPO_URL" ] && [ ! -d "${REGISTRY_PATH}/.git" ]; then
  log "Cloning Forge registry from $FORGE_REGISTRY_REPO_URL..."
  if [ -n "$GITHUB_TOKEN" ]; then
    CLONE_URL=$(echo "$FORGE_REGISTRY_REPO_URL" | sed "s|https://|https://${GITHUB_TOKEN}@|")
  else
    CLONE_URL="$FORGE_REGISTRY_REPO_URL"
  fi
  git clone "$CLONE_URL" "${REGISTRY_PATH}" || {
    log_err "Failed to clone registry"
    exit 1
  }
  log "Registry cloned successfully"
fi

# Step 4: Verify the registry path exists (volume should be mounted)
if [ ! -d "${REGISTRY_PATH}" ]; then
  log_err "Registry path '${REGISTRY_PATH}' does not exist. Ensure the volume is mounted."
  exit 1
fi

# Step 5: Ensure workspaces directory exists
mkdir -p "${WORKSPACES_PATH}"

# Step 6: Start background pull daemon for registry
if [ -d "${REGISTRY_PATH}/.git" ]; then
  log "Starting registry pull daemon (interval: ${FORGE_SYNC_INTERVAL}s)..."
  (
    while true; do
      sleep "$FORGE_SYNC_INTERVAL"
      log "Running registry git pull..."
      git -C "${REGISTRY_PATH}" pull --ff-only 2>/dev/null || {
        log_err "Registry git pull failed (will retry next cycle)"
      }
    done
  ) &
  PULL_PID=$!
  log "Registry pull daemon started (PID: $PULL_PID)"
fi

# Step 7: Start the Forge MCP server in HTTP mode
log "Starting Forge MCP server in HTTP mode on ${FORGE_HOST}:${FORGE_PORT}..."

node /app/packages/cli/dist/index.js serve \
  --transport http \
  --port "${FORGE_PORT}" \
  --host "${FORGE_HOST}" &

NODE_PID=$!
log "Forge MCP server started (PID: $NODE_PID)"

wait "$NODE_PID"
