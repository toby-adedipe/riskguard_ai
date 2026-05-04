import React from 'react';

const IncidentPanel: React.FC = () => {
  const data = {
    rootCause: 'Network congestion in Ikeja area',
    timeToBreach: 47,
    subscribers: 18420,
    enterpriseLines: 312,
    revenueAtRisk: '₦8.7m',
    compensationExposure: '₦2.1m',
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Incident Panel</h2>
      <div className="space-y-4">
        <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
          <div className="text-sm text-gray-600 mb-1">Root Cause</div>
          <div className="font-semibold text-gray-800">{data.rootCause}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Time to Breach</div>
            <div className="text-2xl font-bold text-yellow-700">{data.timeToBreach} min</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Subscribers</div>
            <div className="text-2xl font-bold text-blue-700">{data.subscribers.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Enterprise Lines</div>
            <div className="text-2xl font-bold text-purple-700">{data.enterpriseLines}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Revenue at Risk</div>
            <div className="text-2xl font-bold text-green-700">{data.revenueAtRisk}</div>
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Compensation Exposure</div>
          <div className="text-2xl font-bold text-orange-700">{data.compensationExposure}</div>
        </div>
      </div>
    </div>
  );
};

export default IncidentPanel;