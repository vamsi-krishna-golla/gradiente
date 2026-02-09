# Gradiente MVP (gradient-mvp)

Proof-of-concept morphogenic coordination system showing how scalar field propagation enables preemptive load balancing and cascade prevention.

## Components
- **agent/**: Go gradient agent emitting health/load/capacity fields, UDP gossip propagation, routing API, metrics, and a JSON stream endpoint.
- **simulator/**: Python traffic/failure simulator that compares gradient routing vs traditional threshold/circuit-breaker behavior.
- **dashboard/**: React + D3 topology and metrics dashboard.
- **comparison/**: baseline traditional LB helpers for benchmark narratives.

## Quick start
```bash
make build
make test
```

## How to test this app (recommended)
### 1) Fast local smoke test (no Docker)
This compiles the Go agent, starts 3 local nodes, calls API endpoints, and runs a short simulator scenario.

```bash
make smoke
```

### 2) Run agent tests + simulator syntax checks
```bash
make test
```

### 3) Manual API validation
Start one agent:
```bash
cd agent
NODE_ID=node-1 HTTP_PORT=8081 GOSSIP_PORT=7946 go run ./cmd/gradient-agent
```

In another terminal:
```bash
curl http://localhost:8081/fields
curl "http://localhost:8081/route?candidates=node-1,node-2,node-3"
curl http://localhost:8081/metrics
curl http://localhost:8081/stream
```

### 4) Full stack with Docker
```bash
make run
```

Then open:
- Dashboard: `http://localhost:3000`
- Simulator metrics: `http://localhost:9090`

## API
- `GET /fields`
- `GET /fields/{nodeID}`
- `GET /route?candidates=node1,node2,node3`
- `POST /config`
- `GET /metrics`
- `GET /stream`

## Dashboard transport (local)
The dashboard uses HTTP polling against the agent `GET /stream` endpoint by default.

- Default API base URL: `http://localhost:8081` (set via `VITE_API_BASE_URL`).
- WebSocket is **disabled by default** and should only be enabled when a compatible `/ws` endpoint exists.
- Optional WebSocket settings:
  - `VITE_ENABLE_WS=true`
  - `VITE_WS_URL=ws://localhost:8081/ws`

## Notes
- If `npm install` is blocked by your environment/network policy, you can still validate agent and simulator behavior via `make smoke` and `make test`.

## Cloudflare Pages deploy (with simulator data)
Use this path when you want fast user feedback without running backend services.

1) Build and deploy dashboard in simulator mode:
```bash
cd dashboard
npm install
npm install -g wrangler
wrangler login
npm run cf:deploy:sim
```

If this is your first deploy, ensure `dashboard/wrangler.toml` has a unique `name` for your Cloudflare project before running the deploy command.

2) For repeat deploys:
```bash
npm run cf:deploy:sim
```

3) Optional: deploy with live API instead of simulator mode:
```bash
VITE_API_BASE_URL=https://your-agent-api.example.com npm run build
npm run cf:deploy
```

Simulator mode is controlled by `VITE_USE_SIMULATOR_DATA=true` and renders animated, synthetic node/field metrics suitable for early feedback sessions.
