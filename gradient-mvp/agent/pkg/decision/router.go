package decision

import (
	"math"
	"math/rand"

	"gradient-mvp/agent/pkg/fields"
)

type RouterConfig struct {
	HealthWeight   float64 `json:"health_weight"`
	CapacityWeight float64 `json:"capacity_weight"`
	LoadPenalty    float64 `json:"load_penalty"`
	Temperature    float64 `json:"temperature"`
}

type Router struct {
	state  *fields.StateStore
	config RouterConfig
}

func NewRouter(state *fields.StateStore) *Router {
	return &Router{state: state, config: RouterConfig{HealthWeight: 0.5, CapacityWeight: 0.3, LoadPenalty: 0.2, Temperature: 0.2}}
}

func (r *Router) UpdateConfig(cfg RouterConfig) { r.config = cfg }
func (r *Router) Config() RouterConfig          { return r.config }

func (r *Router) SelectNode(candidates []string) string {
	scores := map[string]float64{}
	for _, id := range candidates {
		f := r.state.GetFieldsFor(id)
		scores[id] = r.config.HealthWeight*f.Health + r.config.CapacityWeight*f.Capacity - r.config.LoadPenalty*f.Load
	}
	return softmaxSelect(scores, r.config.Temperature)
}

func softmaxSelect(scores map[string]float64, temp float64) string {
	if len(scores) == 0 {
		return ""
	}
	if temp == 0 {
		return maxKey(scores)
	}
	total := 0.0
	weights := map[string]float64{}
	for n, s := range scores {
		w := math.Exp(s / temp)
		weights[n] = w
		total += w
	}
	rv := rand.Float64() * total
	cum := 0.0
	for n, w := range weights {
		cum += w
		if rv <= cum {
			return n
		}
	}
	return maxKey(scores)
}

func maxKey(scores map[string]float64) string {
	var best string
	bestV := math.Inf(-1)
	for n, v := range scores {
		if v > bestV {
			bestV = v
			best = n
		}
	}
	return best
}
