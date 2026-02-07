import React from 'react';

type Node = { id: string; health: number; load: number; capacity: number; requestsPerSecond: number; errorRate: number; latencyP99: number };

export function MetricsPanel({ selectedNode, nodes }: { selectedNode: string | null; nodes: Node[] }) {
  const selected = nodes.find((n) => n.id === selectedNode);
  if (selected) {
    return <aside><h2>{selected.id}</h2><p>Health {(selected.health * 100).toFixed(1)}%</p><p>Load {(selected.load * 100).toFixed(1)}%</p></aside>;
  }
  return <aside><h2>Cluster Overview</h2><table><thead><tr><th>Node</th><th>Health</th><th>Load</th></tr></thead><tbody>{nodes.map((n) => <tr key={n.id}><td>{n.id}</td><td>{(n.health * 100).toFixed(1)}%</td><td>{(n.load * 100).toFixed(1)}%</td></tr>)}</tbody></table></aside>;
}
