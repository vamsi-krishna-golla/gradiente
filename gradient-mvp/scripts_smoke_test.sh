#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

mkdir -p .tmp

pushd agent >/dev/null
go build -o ../.tmp/gradient-agent ./cmd/gradient-agent
popd >/dev/null

NODE1_LOG=.tmp/node1.log
NODE2_LOG=.tmp/node2.log
NODE3_LOG=.tmp/node3.log

NODE_ID=node-1 HTTP_PORT=8081 GOSSIP_PORT=7946 PEERS=127.0.0.1:7947,127.0.0.1:7948 ./.tmp/gradient-agent >"$NODE1_LOG" 2>&1 &
P1=$!
NODE_ID=node-2 HTTP_PORT=8082 GOSSIP_PORT=7947 PEERS=127.0.0.1:7946,127.0.0.1:7948 ./.tmp/gradient-agent >"$NODE2_LOG" 2>&1 &
P2=$!
NODE_ID=node-3 HTTP_PORT=8083 GOSSIP_PORT=7948 PEERS=127.0.0.1:7946,127.0.0.1:7947 ./.tmp/gradient-agent >"$NODE3_LOG" 2>&1 &
P3=$!

cleanup() {
  kill "$P1" "$P2" "$P3" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 2

echo "[smoke] /fields from node-1"
curl -fsS http://127.0.0.1:8081/fields | head -c 250 && echo

echo "[smoke] /route decision"
curl -fsS "http://127.0.0.1:8081/route?candidates=node-1,node-2,node-3" && echo

if python - <<'PY'
import importlib.util, sys
mods = ['yaml', 'aiohttp', 'prometheus_client']
missing = [m for m in mods if importlib.util.find_spec(m) is None]
if missing:
    print('missing:', ', '.join(missing))
    sys.exit(1)
PY
then
  echo "[smoke] run a short simulator scenario"
  python - <<'PY'
import yaml
from pathlib import Path
src = Path('simulator/scenarios/gradual_degradation.yaml')
cfg = yaml.safe_load(src.read_text())
cfg['traffic']['duration_seconds'] = 6
cfg['traffic']['requests_per_second'] = 20
cfg['events'] = [e for e in cfg['events'] if e['at_second'] <= 5]
out = Path('.tmp/smoke_scenario.yaml')
out.write_text(yaml.safe_dump(cfg))
print(out)
PY
  python simulator/simulator.py .tmp/smoke_scenario.yaml
else
  echo "[smoke] simulator dependencies unavailable; skipping simulator pass"
fi

echo "[smoke] success"
