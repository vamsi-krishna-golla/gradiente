import { useEffect, useState } from 'react';

type Node = { id: string; x: number; y: number; health: number; load: number; capacity: number; requestsPerSecond: number; errorRate: number; latencyP99: number };

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
    const health = Math.max(0.65, Math.min(1, 0.88 + Math.sin(phase) * 0.1));
    const load = Math.max(0.1, Math.min(0.95, 0.45 + Math.cos(phase * 1.15) * 0.28));
    const capacity = Math.max(load + 0.05, Math.min(1, 0.8 + Math.sin(phase * 0.75) * 0.12));
    const requestsPerSecond = 120 + Math.round(load * 220);
    const errorRate = Math.max(0.002, (1 - health) * 0.08);
    const latencyP99 = 90 + Math.round(load * 220 + errorRate * 900);

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
      if (!Array.isArray(data?.nodes)) return;

      setNodes(data.nodes);
      const f = new Map<string, Map<string, number>>();
      Object.entries(data.fields || {}).forEach(([source, targets]) => f.set(source, new Map(Object.entries(targets as Record<string, number>))));
      setFields(f);
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

    poller = window.setInterval(async () => {
      try {
        const resp = await fetch(streamUrl);
        applyData(await resp.json());
      } catch {
        setIsConnected(false);
      }
    }, 1000);

    return () => {
      if (ws) ws.close();
      if (poller) clearInterval(poller);
    };
  }, [streamUrl, wsUrl, enableWebSocket, useSimulatorData]);

  return { nodes, fields, isConnected };
}
