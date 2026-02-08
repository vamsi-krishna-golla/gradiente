import { useEffect, useState } from 'react';

type Node = { id: string; x: number; y: number; health: number; load: number; capacity: number; requestsPerSecond: number; errorRate: number; latencyP99: number };

type FieldStreamConfig = {
  streamUrl: string;
  wsUrl?: string;
  enableWebSocket?: boolean;
};

export function useFieldStream({ streamUrl, wsUrl, enableWebSocket = false }: FieldStreamConfig) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [fields, setFields] = useState<Map<string, Map<string, number>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let poller: number | undefined;
    const applyData = (data: any) => {
      if (data.type !== 'field_update') return;
      setNodes(data.nodes || []);
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
  }, [streamUrl, wsUrl, enableWebSocket]);

  return { nodes, fields, isConnected };
}
