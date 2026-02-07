import React from 'react';

export function NodeCard({ label, value }: { label: string; value: string }) {
  return <div><strong>{label}</strong>: {value}</div>;
}
