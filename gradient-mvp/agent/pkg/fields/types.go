package fields

import (
	"math"
	"sync"
	"time"
)

type FieldType string

const (
	HealthField   FieldType = "health"
	LoadField     FieldType = "load"
	CapacityField FieldType = "capacity"
)

type FieldValue struct {
	Type      FieldType `json:"type"`
	Source    string    `json:"source"`
	Intensity float64   `json:"intensity"`
	Timestamp time.Time `json:"timestamp"`
}

type LocalFieldState struct {
	NodeID      string    `json:"node_id"`
	Health      float64   `json:"health"`
	Load        float64   `json:"load"`
	Capacity    float64   `json:"capacity"`
	LastUpdated time.Time `json:"last_updated"`
}

type StateStore struct {
	mu            sync.RWMutex
	localNodeID   string
	contributions map[string]map[FieldType]float64
}

func NewStateStore(localNodeID string) *StateStore {
	return &StateStore{localNodeID: localNodeID, contributions: map[string]map[FieldType]float64{}}
}

func (s *StateStore) UpdateContribution(source string, fieldType string, value float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ft := FieldType(fieldType)
	if _, ok := s.contributions[source]; !ok {
		s.contributions[source] = map[FieldType]float64{}
	}
	s.contributions[source][ft] = clamp01(value)
}

func (s *StateStore) SetLocal(fields map[string]FieldValue) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.contributions[s.localNodeID]; !ok {
		s.contributions[s.localNodeID] = map[FieldType]float64{}
	}
	for _, fv := range fields {
		s.contributions[s.localNodeID][fv.Type] = clamp01(fv.Intensity)
	}
}

func (s *StateStore) Snapshot() map[string]LocalFieldState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]LocalFieldState, len(s.contributions))
	now := time.Now()
	for node, c := range s.contributions {
		out[node] = LocalFieldState{NodeID: node, Health: c[HealthField], Load: c[LoadField], Capacity: c[CapacityField], LastUpdated: now}
	}
	return out
}

func (s *StateStore) GetFieldsFor(node string) LocalFieldState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c := s.contributions[node]
	return LocalFieldState{NodeID: node, Health: c[HealthField], Load: c[LoadField], Capacity: c[CapacityField], LastUpdated: time.Now()}
}

func clamp01(v float64) float64 { return math.Max(0, math.Min(1, v)) }
