package gossip

import "testing"

func TestDecay(t *testing.T) {
	v := DecayedIntensity(1.0, 1, 1.0)
	if v < 0.36 || v > 0.38 {
		t.Fatalf("unexpected %v", v)
	}
}
