import React, { useState } from 'react';
import { FieldTopology } from './components/FieldTopology';
import { MetricsPanel } from './components/MetricsPanel';
import { useFieldStream } from './hooks/useFieldStream';

function App() {
  const { nodes, fields, isConnected } = useFieldStream(import.meta.env.VITE_WS_URL || 'ws://localhost:8081/ws');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  return (
    <div className="app">
      <header><h1>Gradient MVP Dashboard</h1><span>{isConnected ? '● Connected' : '○ Disconnected'}</span></header>
      <main>
        <FieldTopology nodes={nodes} fields={fields} selectedNode={selectedNode} onNodeSelect={setSelectedNode} />
        <MetricsPanel selectedNode={selectedNode} nodes={nodes} />
      </main>
    </div>
  );
}

export default App;
