package metrics

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

type counter struct {
	mu sync.Mutex
	v  map[string]int
}

var RoutingDecisionCounter = &counter{v: map[string]int{}}

func (c *counter) Inc(selected, reason string) {
	c.mu.Lock()
	c.v[selected+":"+reason]++
	c.mu.Unlock()
}
func (c *counter) Dump() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := ""
	for k, v := range c.v {
		out += fmt.Sprintf("gradient_routing_decisions_total{label=\"%s\"} %d\n", k, v)
	}
	return out
}

func Register() {}

type LocalMetrics struct {
	mu                              sync.RWMutex
	errorRate, latencyP99, cpu, mem float64
	conns                           int
}

func NewLocalMetrics() *LocalMetrics {
	m := &LocalMetrics{errorRate: 0.01, latencyP99: 20, cpu: 0.3, mem: 0.35, conns: 20}
	return m
}
func (m *LocalMetrics) jitterLoop() {
	t := time.NewTicker(time.Second)
	for range t.C {
		m.mu.Lock()
		m.errorRate = clamp(m.errorRate+rand.Float64()*0.01-0.005, 0, 0.3)
		m.latencyP99 = clamp(m.latencyP99+rand.Float64()*20-10, 10, 1200)
		m.cpu = clamp(m.cpu+rand.Float64()*0.1-0.05, 0.1, 0.99)
		m.mem = clamp(m.mem+rand.Float64()*0.08-0.04, 0.1, 0.99)
		m.conns = int(clamp(float64(m.conns)+rand.Float64()*10-5, 1, 200))
		m.mu.Unlock()
	}
}
func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
func (m *LocalMetrics) GetErrorRate(time.Duration) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.errorRate
}
func (m *LocalMetrics) GetLatencyP99(time.Duration) float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.latencyP99
}
func (m *LocalMetrics) GetCPUUtilization() float64 { m.mu.RLock(); defer m.mu.RUnlock(); return m.cpu }
func (m *LocalMetrics) GetMemoryUtilization() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.mem
}
func (m *LocalMetrics) GetActiveConnections() int { m.mu.RLock(); defer m.mu.RUnlock(); return m.conns }
