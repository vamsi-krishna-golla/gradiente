package comparison

type TraditionalLB struct{ idx int }

func (t *TraditionalLB) Select(candidates []string) string {
	if len(candidates) == 0 { return "" }
	t.idx = (t.idx + 1) % len(candidates)
	return candidates[t.idx]
}
