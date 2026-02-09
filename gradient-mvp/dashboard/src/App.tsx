import React, { useState } from 'react';
import { FieldTopology } from './components/FieldTopology';
import { MetricsPanel } from './components/MetricsPanel';
import { useFieldStream } from './hooks/useFieldStream';

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
  const wsUrl = import.meta.env.VITE_WS_URL;
  const enableWebSocket = import.meta.env.VITE_ENABLE_WS === 'true';
  const useSimulatorData = import.meta.env.VITE_USE_SIMULATOR_DATA === 'true';
  const { nodes, fields, isConnected } = useFieldStream({
    streamUrl: `${apiBaseUrl}/stream`,
    wsUrl,
    enableWebSocket,
    useSimulatorData,
  });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  return (
    <div className="app">
      <header>
        <h1>Gradient MVP Dashboard</h1>
        <span>
          {isConnected ? '● Connected' : '○ Disconnected'}
          {useSimulatorData ? ' (Simulator Mode)' : ''}
        </span>
      </header>
      <main>
        <FieldTopology nodes={nodes} fields={fields} selectedNode={selectedNode} onNodeSelect={setSelectedNode} />
        <MetricsPanel selectedNode={selectedNode} nodes={nodes} />
      </main>
    </div>
  );
}

export default App;
