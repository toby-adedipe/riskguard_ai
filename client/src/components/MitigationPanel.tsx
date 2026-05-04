import React from 'react';

const MitigationPanel: React.FC = () => {
  const actions = [
    {
      name: 'Increase bandwidth allocation',
      projectedRisk: 45,
      timeToEffect: '10 minutes',
      confidence: 'High',
    },
    {
      name: 'Redirect traffic to backup routes',
      projectedRisk: 30,
      timeToEffect: '5 minutes',
      confidence: 'Medium',
    },
    {
      name: 'Deploy emergency maintenance team',
      projectedRisk: 20,
      timeToEffect: '30 minutes',
      confidence: 'High',
    },
  ];

  const getConfidenceColor = (confidence: string) => {
    if (confidence === 'High') return 'text-green-700 bg-green-100';
    if (confidence === 'Medium') return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Mitigation Panel</h2>
      <div className="space-y-4 mb-8">
        {actions.map((action, index) => (
          <div key={index} className="border border-gray-200 p-6 rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-bold text-lg mb-3 text-gray-800">{action.name}</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600">Projected Risk</div>
                <div className="text-xl font-bold text-red-600">{action.projectedRisk}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Time to Effect</div>
                <div className="text-xl font-bold text-blue-600">{action.timeToEffect}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Confidence</div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getConfidenceColor(action.confidence)}`}>
                  {action.confidence}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Risk Projection Graph</h3>
        <div className="h-32 bg-gray-200 rounded flex items-center justify-center">
          <span className="text-gray-500">[Interactive Chart Placeholder]</span>
        </div>
      </div>
    </div>
  );
};

export default MitigationPanel;