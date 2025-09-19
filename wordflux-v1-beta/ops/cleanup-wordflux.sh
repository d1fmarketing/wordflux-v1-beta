#!/usr/bin/env bash
set -euo pipefail

# WordFlux zero-downtime cleanup helper with dry-run + snapshots.

usage() {
  cat <<'USAGE'
Usage: cleanup-wordflux.sh [--run] [--dry-run] [--no-color] [--keep-snapshots]
       cleanup-wordflux.sh --help

Defaults to dry-run. Use --run to apply changes. --keep-snapshots skips diff cleanup.
USAGE
}

MODE="dry-run"
KEEP_SNAPSHOTS=0
NO_COLOR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run)
      MODE="apply"
      shift
      ;;
    --dry-run)
      MODE="dry-run"
      shift
      ;;
    --keep-snapshots)
      KEEP_SNAPSHOTS=1
      shift
      ;;
    --no-color)
      NO_COLOR=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ $NO_COLOR -eq 0 && -t 1 ]]; then
  BOLD="$(tput bold)"
  RESET="$(tput sgr0)"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  BLUE="\033[34m"
  RED="\033[31m"
else
  BOLD=""
  RESET=""
  GREEN=""
  YELLOW=""
  BLUE=""
  RED=""
fi

log() {
  local level="$1"; shift
  local color="$1"; shift
  printf '%s[%s]%s %s\n' "$color" "$level" "$RESET" "$*"
}

info() { log "INFO" "$BLUE" "$*"; }
success() { log "OK" "$GREEN" "$*"; }
warn() { log "WARN" "$YELLOW" "$*"; }
error() { log "ERR" "$RED" "$*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SNAPSHOT_DIR="$SCRIPT_DIR/snapshots"
mkdir -p "$SNAPSHOT_DIR"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
PRE_SNAPSHOT="$SNAPSHOT_DIR/${RUN_ID}-pre.log"
POST_SNAPSHOT="$SNAPSHOT_DIR/${RUN_ID}-post.log"

ss_ports() {
  if command -v sudo >/dev/null 2>&1; then
    sudo -n ss -ltnp "$@" 2>/dev/null || ss -ltnp "$@"
  else
    ss -ltnp "$@"
  fi
}

safe_lsof() {
  if command -v sudo >/dev/null 2>&1; then
    sudo -n lsof "$@" 2>/dev/null || lsof "$@"
  else
    lsof "$@"
  fi
}

send_signal() {
  local signal="$1"
  local pid="$2"
  kill "-$signal" "$pid" 2>/dev/null || {
    if command -v sudo >/dev/null 2>&1; then
      sudo kill "-$signal" "$pid" 2>/dev/null || true
    else
      true
    fi
  }
}

collect_snapshot() {
  local label="$1"
  local file="$2"
  info "Capturing ${label} snapshot -> ${file}"
  {
    echo "### WordFlux cleanup snapshot: ${label} ($(date -Is))"
    echo
    echo "## pm2 status"
    pm2 status --no-color 2>&1 || true
    echo
    echo "## listening ports :3000/:3200/:37869"
    ss_ports 'sport = :3000' 2>/dev/null || true
    ss_ports 'sport = :3200' 2>/dev/null || true
    ss_ports 'sport = :37869' 2>/dev/null || true
    echo
    echo "## targeted processes"
    ps -eo pid,ppid,stat,etime,pcpu,pmem,cmd \
      | egrep 'playwright|pm2 logs|server\\.js|next start|taskcafe|redis|nginx|grafana' || true
  } >"$file"
}

port_pid() {
  local port="$1"
  ss_ports "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -1 || true
}

kill_pattern() {
  local pattern="$1"
  local label="$2"
  mapfile -t matches < <(pgrep -af "$pattern" 2>/dev/null || true)
  if [[ ${#matches[@]} -eq 0 ]]; then
    success "${label}: nothing running"
    return
  fi
  info "${label}: found ${#matches[@]} process(es)"
  for entry in "${matches[@]}"; do
    info "  ${entry}"
  done
  if [[ $MODE == "dry-run" ]]; then
    return
  fi
  for entry in "${matches[@]}"; do
    local pid="${entry%% *}"
    send_signal TERM "$pid"
  done
  sleep 1
  for entry in "${matches[@]}"; do
    local pid="${entry%% *}"
    if kill -0 "$pid" 2>/dev/null; then
      send_signal KILL "$pid"
    fi
  done
}

kill_port() {
  local port="$1"
  local label="$2"
  mapfile -t pids < <(safe_lsof -ti :"$port" 2>/dev/null || true)
  if [[ ${#pids[@]} -eq 0 ]]; then
    success "${label}: port :${port} already free"
    return
  fi
  info "${label}: freeing port :${port} (PIDs: ${pids[*]})"
  if [[ $MODE == "dry-run" ]]; then
    return
  fi
  for pid in "${pids[@]}"; do
    send_signal TERM "$pid"
  done
  sleep 1
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      send_signal KILL "$pid"
    fi
  done
}

kill_server_js() {
  local keep_pid="$1"
  local keep_parent="$2"
  mapfile -t matches < <(pgrep -af "node .*server\\.js" 2>/dev/null || true)
  if [[ ${#matches[@]} -eq 0 ]]; then
    success "server.js orphans: none detected"
    return
  fi
  local actionable=()
  for entry in "${matches[@]}"; do
    local pid="${entry%% *}"
    if [[ -n "$keep_pid" && "$pid" == "$keep_pid" ]]; then
      continue
    fi
    if [[ -n "$keep_parent" && "$pid" == "$keep_parent" ]]; then
      continue
    fi
    if [[ "$entry" == *".cursor-server"* ]]; then
      continue
    fi
    actionable+=("$entry")
  done
  if [[ ${#actionable[@]} -eq 0 ]]; then
    success "server.js orphans: only keep-listed entries remain"
    return
  fi
  info "server.js orphans: targeting ${#actionable[@]} process(es)"
  for entry in "${actionable[@]}"; do
    info "  ${entry}"
  done
  if [[ $MODE == "dry-run" ]]; then
    return
  fi
  for entry in "${actionable[@]}"; do
    local pid="${entry%% *}"
    send_signal TERM "$pid"
  done
  sleep 1
  for entry in "${actionable[@]}"; do
    local pid="${entry%% *}"
    if kill -0 "$pid" 2>/dev/null; then
      send_signal KILL "$pid"
    fi
  done
}

handle_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [[ ! -f "$pid_file" ]]; then
    warn "${label}: ${pid_file} not found"
    return 1
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    warn "${label}: ${pid_file} empty"
    return 1
  fi
  info "${label}: stopping PID ${pid} from ${pid_file}"
  if [[ $MODE == "dry-run" ]]; then
    return 0
  fi
  send_signal TERM "$pid"
  sleep 0.5
  if kill -0 "$pid" 2>/dev/null; then
    send_signal KILL "$pid"
  fi
  rm -f "$pid_file"
}

collect_snapshot "pre" "$PRE_SNAPSHOT"

if [[ $MODE == "dry-run" ]]; then
  warn "Dry-run mode: showing intended actions only"
else
  info "Running in APPLY mode: actions will be executed"
fi

KEEP_PID="$(port_pid 3000 || true)"
if [[ -n "$KEEP_PID" ]]; then
  success "Keep Next.js PID on :3000 => ${KEEP_PID}"
else
  warn "No listener detected on :3000; server.js keep PID unset"
fi

kill_pattern "playwright test" "Playwright test runners"
kill_pattern "playwright.*web[- ]server" "Playwright web helpers"
kill_port 37869 "Playwright helper port"
kill_pattern "pm2 logs .*wordflux-v1-beta" "pm2 log tailers"
KEEP_PARENT=""
if [[ -n "$KEEP_PID" ]]; then
  KEEP_PARENT="$(ps -o ppid= -p "$KEEP_PID" 2>/dev/null | tr -d ' ')"
fi
kill_server_js "$KEEP_PID" "$KEEP_PARENT"
handle_pid_file /tmp/next3200.pid "Alternate Next (PID file)" || true
kill_port 3200 "Alternate Next port"

collect_snapshot "post" "$POST_SNAPSHOT"

info "Diffing snapshots"
if ! diff -u "$PRE_SNAPSHOT" "$POST_SNAPSHOT" >"$SNAPSHOT_DIR/${RUN_ID}-diff.log"; then
  info "Changes captured in $SNAPSHOT_DIR/${RUN_ID}-diff.log"
  cat "$SNAPSHOT_DIR/${RUN_ID}-diff.log"
else
  success "No differences between snapshots"
fi

if [[ $KEEP_SNAPSHOTS -eq 0 ]]; then
  info "Cleaning temporary diff output"
  rm -f "$SNAPSHOT_DIR/${RUN_ID}-diff.log"
fi

if [[ $MODE == "apply" ]]; then
  info "Persisting pm2 state"
  pm2 save
fi

success "Cleanup routine complete"
info "Snapshots saved at:\n  pre -> ${PRE_SNAPSHOT}\n  post -> ${POST_SNAPSHOT}"
