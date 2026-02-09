import { useEffect, useState } from 'react';
import { getNodeState, type NodeState } from '../utils/nodeState';

type Node = { id: string; x: number; y: number; health: number; load: number; capacity: number; requestsPerSecond: number; errorRate: number; latencyP99: number; state: NodeState };

type FieldStreamConfig = {
  streamUrl: string;
  wsUrl?: string;
  enableWebSocket?: boolean;
  useSimulatorData?: boolean;
};

const SIMULATOR_NODE_IDS = ['edge-a', 'edge-b', 'edge-c', 'edge-d'];

function createSimulatorSnapshot(tick: number) {
  const nodes = SIMULATOR_NODE_IDS.map((id, index) => {
    const phase = tick / 5 + index;
    const health = Math.max(0.3, Math.min(1, 0.78 + Math.sin(phase) * 0.35));
    const load = Math.max(0.15, Math.min(0.98, 0.52 + Math.cos(phase * 1.15) * 0.4));
    const capacity = Math.max(load + 0.05, Math.min(1, 0.82 + Math.sin(phase * 0.75) * 0.12));
    const requestsPerSecond = 120 + Math.round(load * 220);
    const errorRate = Math.max(0.002, (1 - health) * 0.14 + Math.max(0, load - 0.7) * 0.12);
    const latencyP99 = 90 + Math.round(load * 240 + errorRate * 1000);
    const state = getNodeState({ health, load, errorRate });

    return {
      id,
      x: 110 + index * 140,
      y: index % 2 === 0 ? 130 : 250,
      health,
      load,
      capacity,
      requestsPerSecond,
      errorRate,
      latencyP99,
      state,
    };
  });

  const fields = new Map<string, Map<string, number>>();
  nodes.forEach((source) => {
    const targets = new Map<string, number>();
    nodes.forEach((target) => {
      if (source.id === target.id) {
        targets.set(target.id, 0);
        return;
      }

      const headroom = target.capacity - target.load;
      const stress = source.load * (1 - source.health);
      const score = Number((headroom - stress).toFixed(3));
      targets.set(target.id, score);
    });
    fields.set(source.id, targets);
  });

  return { nodes, fields };
}

function normalizeNodes(data: any): Node[] {
  if (Array.isArray(data?.nodes)) {
    return data.nodes.map((node: any) => ({
      ...node,
      state: node.state ?? getNodeState({
        health: Number(node.health ?? 0),
        load: Number(node.load ?? 0),
        errorRate: Number(node.errorRate ?? Math.max(0, 1 - Number(node.health ?? 0))),
      }),
    }));
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data as Record<string, any>);
    if (entries.length && entries.every(([, value]) => value && typeof value === 'object' && 'health' in value)) {
      return entries.map(([id, value], index) => ({
        id,
        x: 150 + index * 220,
        y: 220,
        health: Number(value.health ?? 0),
        load: Number(value.load ?? 0),
        capacity: Number(value.capacity ?? 0),
        requestsPerSecond: Number(value.requestsPerSecond ?? 80),
        errorRate: Number(value.errorRate ?? Math.max(0, 1 - Number(value.health ?? 0))),
        latencyP99: Number(value.latencyP99 ?? 1000 * Math.max(0, 1 - Number(value.health ?? 0))),
        state: getNodeState({
          health: Number(value.health ?? 0),
          load: Number(value.load ?? 0),
          errorRate: Number(value.errorRate ?? Math.max(0, 1 - Number(value.health ?? 0))),
        }),
      }));
    }
  }

  return [];
}

function normalizeFields(data: any) {
  const out = new Map<string, Map<string, number>>();
  Object.entries(data?.fields || {}).forEach(([source, targets]) => out.set(source, new Map(Object.entries(targets as Record<string, number>))));
  return out;
}

export function useFieldStream({ streamUrl, wsUrl, enableWebSocket = false, useSimulatorData = false }: FieldStreamConfig) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [fields, setFields] = useState<Map<string, Map<string, number>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (useSimulatorData) {
      let tick = 0;
      const generate = () => {
        const snapshot = createSimulatorSnapshot(tick);
        tick += 1;
        setNodes(snapshot.nodes);
        setFields(snapshot.fields);
        setIsConnected(true);
      };

      generate();
      const interval = window.setInterval(generate, 1000);

      return () => clearInterval(interval);
    }

    let ws: WebSocket | null = null;
    let poller: number | undefined;
    const applyData = (data: any) => {
      if (data?.type && data.type !== 'field_update') return;
      const normalizedNodes = normalizeNodes(data);
      if (normalizedNodes.length === 0) {
        setIsConnected(false);
        return;
      }

      setNodes(normalizedNodes);
      setFields(normalizeFields(data));
      setIsConnected(true);
    };

    if (enableWebSocket && wsUrl) {
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setIsConnected(true);
        ws.onerror = () => setIsConnected(false);
        ws.onclose = () => setIsConnected(false);
        ws.onmessage = (event) => applyData(JSON.parse(event.data));
      } catch {
        setIsConnected(false);
      }
    }

    const poll = async () => {
      try {
        const streamResp = await fetch(streamUrl);
        if (streamResp.ok) {
          applyData(await streamResp.json());
          return;
        }

        const fieldsUrl = streamUrl.replace(/\/stream$/, '/fields');
        const fallbackResp = await fetch(fieldsUrl);
        if (!fallbackResp.ok) {
          setIsConnected(false);
          return;
        }
        applyData(await fallbackResp.json());
      } catch {
        setIsConnected(false);
      }
    };

    poll();
    poller = window.setInterval(poll, 1000);

    return () => {
      if (ws) ws.close();
      if (poller) clearInterval(poller);
    };
  }, [streamUrl, wsUrl, enableWebSocket, useSimulatorData]);

  return { nodes, fields, isConnected };
}
