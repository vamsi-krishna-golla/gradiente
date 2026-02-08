package fields

import (
	"math"
	"time"
)

type MetricSource interface {
	GetErrorRate(window time.Duration) float64
	GetLatencyP99(window time.Duration) float64
	GetCPUUtilization() float64
	GetMemoryUtilization() float64
	GetActiveConnections() int
}

type EmitterConfig struct{ MaxConnections int }

type Emitter struct {
	nodeID  string
	metrics MetricSource
	config  EmitterConfig
}

func NewEmitter(nodeID string, metrics MetricSource, cfg EmitterConfig) *Emitter {
	if cfg.MaxConnections == 0 {
		cfg.MaxConnections = 100
	}
	return &Emitter{nodeID: nodeID, metrics: metrics, config: cfg}
}

func (e *Emitter) EmitHealthField() float64 {
	if e.metrics == nil {
		return 0
	}
	errorRate := e.metrics.GetErrorRate(time.Minute)
	latencyP99 := e.metrics.GetLatencyP99(time.Minute)
	errorComponent := 1.0 - math.Min(errorRate/0.1, 1.0)
	latencyComponent := 1.0 - math.Min(latencyP99/1000.0, 1.0)
	return clamp01(0.6*errorComponent + 0.4*latencyComponent)
}

func (e *Emitter) EmitLoadField() float64 {
	if e.metrics == nil {
		return 0
	}
	cpuUtil := e.metrics.GetCPUUtilization()
	memUtil := e.metrics.GetMemoryUtilization()
	activeConns := e.metrics.GetActiveConnections()
	connPressure := float64(activeConns) / float64(e.config.MaxConnections)
	return clamp01(0.4*cpuUtil + 0.3*memUtil + 0.3*connPressure)
}

func (e *Emitter) EmitCapacityField() float64 { return clamp01(1.0 - e.EmitLoadField()) }

func (e *Emitter) EmitAll() map[string]FieldValue {
	now := time.Now()
	if e.metrics == nil {
		return map[string]FieldValue{}
	}
	return map[string]FieldValue{
		string(HealthField):   {Type: HealthField, Source: e.nodeID, Intensity: e.EmitHealthField(), Timestamp: now},
		string(LoadField):     {Type: LoadField, Source: e.nodeID, Intensity: e.EmitLoadField(), Timestamp: now},
		string(CapacityField): {Type: CapacityField, Source: e.nodeID, Intensity: e.EmitCapacityField(), Timestamp: now},
	}
}
