package fields

type Sampler struct{ store *StateStore }

func NewSampler(store *StateStore) *Sampler { return &Sampler{store: store} }

func (s *Sampler) CurrentState() map[string]LocalFieldState { return s.store.Snapshot() }
func (s *Sampler) NodeState(id string) LocalFieldState      { return s.store.GetFieldsFor(id) }
