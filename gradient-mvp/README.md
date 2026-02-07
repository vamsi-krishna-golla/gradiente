# Gradiente MVP (gradient-mvp)

Proof-of-concept morphogenic coordination system showing how scalar field propagation enables preemptive load balancing and cascade prevention.

## Components
- **agent/**: Go gradient agent emitting health/load/capacity fields, gossip propagation over UDP, routing API, metrics, and websocket stream.
- **simulator/**: Python traffic/failure simulator that compares gradient routing vs traditional circuit-breaker routing.
- **dashboard/**: React + D3 topology and metrics dashboard.
- **comparison/**: baseline traditional LB helpers for benchmark narratives.

## Quick start
```bash
make build
make test
make run
```

## API
- `GET /fields`
- `GET /fields/{nodeID}`
- `GET /route?candidates=node1,node2,node3`
- `POST /config`
- `GET /metrics`
- `GET /ws`
