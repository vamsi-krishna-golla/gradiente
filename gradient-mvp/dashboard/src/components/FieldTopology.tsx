import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { getStateColor, type NodeState } from '../utils/nodeState';

type Node = { id: string; x: number; y: number; health: number; load: number; capacity: number; state: NodeState };

export function FieldTopology({ nodes, fields, selectedNode, onNodeSelect }: { nodes: Node[]; fields: Map<string, Map<string, number>>; selectedNode: string | null; onNodeSelect: (id: string) => void; }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    nodes.forEach((node) => {
      svg
        .append('circle')
        .attr('cx', node.x)
        .attr('cy', node.y)
        .attr('r', 120 * node.health)
        .attr('fill', getStateColor(node.state))
        .attr('opacity', 0.18);
    });

    nodes.forEach((source) =>
      nodes.forEach((target) => {
        if (source.id === target.id) return;
        const intensity = fields.get(source.id)?.get(target.id) || 0;
        if (intensity < 0.1) return;
        svg
          .append('line')
          .attr('x1', source.x)
          .attr('y1', source.y)
          .attr('x2', target.x)
          .attr('y2', target.y)
          .attr('stroke', '#888')
          .attr('stroke-width', intensity * 3);
      })
    );

    const g = svg
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .on('click', (_e, d) => onNodeSelect(d.id));

    g.append('circle')
      .attr('r', 28)
      .attr('fill', (d) => getStateColor(d.state))
      .attr('stroke', (d) => (d.id === selectedNode ? '#111' : '#666'))
      .attr('stroke-width', 3);

    g.append('text').text((d) => d.id).attr('text-anchor', 'middle').attr('dy', 46);
    g.append('text').text((d) => d.state.toUpperCase()).attr('text-anchor', 'middle').attr('dy', 62).attr('font-size', 10).attr('fill', '#334155');
  }, [nodes, fields, selectedNode, onNodeSelect]);

  return <svg ref={svgRef} width={800} height={600} />;
}
