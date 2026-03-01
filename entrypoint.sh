#!/bin/bash
set -e

FORGE_PORT="${FORGE_PORT:-8200}"
FORGE_HOST="${FORGE_HOST:-0.0.0.0}"
REGISTRY_PATH="${FORGE_REGISTRY_PATH:-/data/registry}"
WORKSPACES_PATH="${FORGE_WORKSPACES_PATH:-/data/workspaces}"
ANVIL_URL="${FORGE_ANVIL_URL:-http://anvil:8100}"
VAULT_URL="${FORGE_VAULT_URL:-http://vault:8000}"
CONFIG_DIR="${HOME}/.forge"

log() {
  echo "{\"level\":\"info\",\"message\":\"$1\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >&2
}

log_err() {
  echo "{\"level\":\"error\",\"message\":\"$1\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" >&2
}

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

# Step 3: Verify the registry path exists (volume should be mounted)
if [ ! -d "${REGISTRY_PATH}" ]; then
  log_err "Registry path '${REGISTRY_PATH}' does not exist. Ensure the volume is mounted."
  exit 1
fi

# Step 4: Ensure workspaces directory exists
mkdir -p "${WORKSPACES_PATH}"

# Step 5: Start the Forge MCP server in HTTP mode
log "Starting Forge MCP server in HTTP mode on ${FORGE_HOST}:${FORGE_PORT}..."

exec node /app/packages/cli/dist/index.js serve \
  --transport http \
  --port "${FORGE_PORT}" \
  --host "${FORGE_HOST}"
