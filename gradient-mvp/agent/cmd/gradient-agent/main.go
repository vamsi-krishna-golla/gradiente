package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"gradient-mvp/agent/pkg/decision"
	"gradient-mvp/agent/pkg/fields"
	"gradient-mvp/agent/pkg/gossip"
	"gradient-mvp/agent/pkg/metrics"
)

type authoritativeStateUpdate struct {
	NodeID   string  `json:"node_id"`
	Health   float64 `json:"health"`
	Load     float64 `json:"load"`
	Capacity float64 `json:"capacity"`
}

func main() {
	nodeID := env("NODE_ID", "node-1")
	httpPort := env("HTTP_PORT", "8081")
	gossipPort := env("GOSSIP_PORT", "7946")
	bind := ":" + gossipPort
	peers := strings.Split(env("PEERS", ""), ",")

	metrics.Register()
	store := fields.NewStateStore(nodeID)
	emitter := fields.NewEmitter(nodeID, nil, fields.EmitterConfig{MaxConnections: 100})
	router := decision.NewRouter(store)
	protocol, err := gossip.NewProtocol(gossip.Config{NodeID: nodeID, Peers: peers, BindAddr: bind, MaxHops: 3, DecayRate: 1.0}, emitter, store)
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go protocol.PropagateFields(ctx)

	http.HandleFunc("/fields", withCORS(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(store.Snapshot())
	}))
	http.HandleFunc("/fields/", withCORS(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(store.GetFieldsFor(strings.TrimPrefix(r.URL.Path, "/fields/")))
	}))
	http.HandleFunc("/state", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var state authoritativeStateUpdate
		if err := json.NewDecoder(r.Body).Decode(&state); err != nil || state.NodeID == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		store.UpdateContribution(state.NodeID, string(fields.HealthField), state.Health)
		store.UpdateContribution(state.NodeID, string(fields.LoadField), state.Load)
		store.UpdateContribution(state.NodeID, string(fields.CapacityField), state.Capacity)
		w.WriteHeader(http.StatusNoContent)
	}))
	http.HandleFunc("/route", withCORS(func(w http.ResponseWriter, r *http.Request) {
		candidates := strings.Split(r.URL.Query().Get("candidates"), ",")
		selected := router.SelectNode(candidates)
		metrics.RoutingDecisionCounter.Inc(selected, "field_score")
		_ = json.NewEncoder(w).Encode(map[string]string{"selected_node": selected})
	}))
	http.HandleFunc("/config", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var cfg decision.RouterConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		router.UpdateConfig(cfg)
		_ = json.NewEncoder(w).Encode(cfg)
	}))
	http.HandleFunc("/metrics", withCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte(metrics.RoutingDecisionCounter.Dump()))
	}))
	http.HandleFunc("/stream", withCORS(func(w http.ResponseWriter, r *http.Request) {
		snap := store.Snapshot()
		nodes := make([]map[string]any, 0, len(snap))
		for _, n := range snap {
			nodes = append(nodes, map[string]any{"id": n.NodeID, "x": 150 + len(nodes)*220, "y": 220, "health": n.Health, "load": n.Load, "capacity": n.Capacity, "requestsPerSecond": 80.0, "errorRate": 1 - n.Health, "latencyP99": 1000 * (1 - n.Health)})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"type": "field_update", "nodes": nodes, "fields": map[string]map[string]float64{}})
	}))

	log.Printf("gradient-agent %s listening on :%s", nodeID, httpPort)
	log.Fatal(http.ListenAndServe(":"+httpPort, nil))
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
