import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

type Node = { id: string; x: number; y: number; health: number; load: number; capacity: number };

export function FieldTopology({ nodes, fields, selectedNode, onNodeSelect }: { nodes: Node[]; fields: Map<string, Map<string, number>>; selectedNode: string | null; onNodeSelect: (id: string) => void; }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    nodes.forEach((node) => {
      svg.append('circle').attr('cx', node.x).attr('cy', node.y).attr('r', 120 * node.health).attr('fill', d3.interpolateRdYlGn(node.health)).attr('opacity', 0.2);
    });
    nodes.forEach((source) => nodes.forEach((target) => {
      if (source.id === target.id) return;
      const intensity = fields.get(source.id)?.get(target.id) || 0;
      if (intensity < 0.1) return;
      svg.append('line').attr('x1', source.x).attr('y1', source.y).attr('x2', target.x).attr('y2', target.y).attr('stroke', '#888').attr('stroke-width', intensity * 3);
    }));
    const g = svg.selectAll('.node').data(nodes).enter().append('g').attr('transform', (d) => `translate(${d.x},${d.y})`).on('click', (_e, d) => onNodeSelect(d.id));
    g.append('circle').attr('r', 28).attr('fill', (d) => d3.interpolateRdYlGn(d.health)).attr('stroke', (d) => d.id === selectedNode ? '#111' : '#666').attr('stroke-width', 3);
    g.append('text').text((d) => d.id).attr('text-anchor', 'middle').attr('dy', 46);
  }, [nodes, fields, selectedNode, onNodeSelect]);
  return <svg ref={svgRef} width={800} height={600} />;
}
