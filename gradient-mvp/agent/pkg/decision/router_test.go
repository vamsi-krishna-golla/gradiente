package decision

import (
	"testing"

	"gradient-mvp/agent/pkg/fields"
)

func TestSelectNodeDeterministic(t *testing.T) {
	s := fields.NewStateStore("node-a")
	s.UpdateContribution("node-a", "health", 0.9)
	s.UpdateContribution("node-a", "capacity", 0.8)
	s.UpdateContribution("node-a", "load", 0.2)
	s.UpdateContribution("node-b", "health", 0.2)
	s.UpdateContribution("node-b", "capacity", 0.2)
	s.UpdateContribution("node-b", "load", 0.8)
	r := NewRouter(s)
	r.UpdateConfig(RouterConfig{HealthWeight: 0.5, CapacityWeight: 0.3, LoadPenalty: 0.2, Temperature: 0})
	if got := r.SelectNode([]string{"node-a", "node-b"}); got != "node-a" {
		t.Fatalf("got %s", got)
	}
}
