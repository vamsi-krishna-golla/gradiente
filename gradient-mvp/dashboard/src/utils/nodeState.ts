export type NodeState = 'healthy' | 'degraded' | 'critical' | 'recovering';

export function getNodeState(node: { health: number; load: number; errorRate: number }): NodeState {
  if (node.health < 0.5 || node.errorRate > 0.1 || node.load > 0.9) return 'critical';
  if (node.health < 0.72 || node.errorRate > 0.05 || node.load > 0.78) return 'degraded';
  if (node.health < 0.82 || node.errorRate > 0.025) return 'recovering';
  return 'healthy';
}

export function getStateColor(state: NodeState) {
  switch (state) {
    case 'healthy':
      return '#22c55e';
    case 'recovering':
      return '#38bdf8';
    case 'degraded':
      return '#f59e0b';
    case 'critical':
      return '#ef4444';
    default:
      return '#64748b';
  }
}
