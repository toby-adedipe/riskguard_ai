import React, { useState } from 'react';

const SimulationControls: React.FC = () => {
  const [state, setState] = useState<'BASELINE' | 'INCIDENT' | 'RECOVERY'>('BASELINE');

  const handleStartStream = () => {
    // Mock action
  };

  const handleTriggerIncident = () => {
    setState('INCIDENT');
  };

  const handleApproveMitigation = () => {
    setState('RECOVERY');
  };

  const handleReset = () => {
    setState('BASELINE');
  };

  const getStateColor = (state: string) => {
    if (state === 'BASELINE') return 'text-green-700 bg-green-100';
    if (state === 'INCIDENT') return 'text-red-700 bg-red-100';
    return 'text-blue-700 bg-blue-100';
  };

  return (
    <div className="w-full bg-white p-6 rounded-xl shadow-lg border border-gray-200 flex justify-between items-center mb-6">
      <div className="flex items-center space-x-4">
        <span className="text-xl font-semibold text-gray-800">Simulation Controls</span>
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${getStateColor(state)}`}>
          {state}
        </span>
      </div>
      <div className="space-x-3">
        <button
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          onClick={handleStartStream}
        >
          Start Stream
        </button>
        <button
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors"
          onClick={handleTriggerIncident}
        >
          Trigger Ikeja Incident
        </button>
        <button
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
          onClick={handleApproveMitigation}
        >
          Approve Mitigation
        </button>
        <button
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition-colors"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default SimulationControls;