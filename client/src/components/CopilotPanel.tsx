import React, { useState } from 'react';

const CopilotPanel: React.FC = () => {
  const [role, setRole] = useState('Network Risk');
  const [input, setInput] = useState('');

  const roles = [
    'Network Risk',
    'Revenue Assurance',
    'Customer Experience',
    'Mitigation',
    'Compliance',
  ];

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">AI Copilot</h2>
      <div className="mb-6">
        <label className="block text-lg font-medium mb-3 text-gray-700">Role:</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-6">
        <label className="block text-lg font-medium mb-3 text-gray-700">Query:</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter your query..."
        />
      </div>
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-bold text-lg mb-2 text-blue-800">Facts</h3>
          <p className="text-gray-700">Network congestion detected in Ikeja area affecting 18,420 subscribers.</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-bold text-lg mb-2 text-yellow-800">Inferences</h3>
          <p className="text-gray-700">High risk of service breach within 47 minutes if not mitigated.</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-bold text-lg mb-2 text-green-800">Recommendations</h3>
          <p className="text-gray-700">Increase bandwidth allocation or redirect traffic to backup routes.</p>
        </div>
      </div>
    </div>
  );
};

export default CopilotPanel;