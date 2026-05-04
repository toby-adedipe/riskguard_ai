import React from 'react';

const RiskRadar: React.FC = () => {
  const score = 87;
  const timeToBreach = 47;
  const confidence = 'High';

  const getSeverityColor = (score: number) => {
    if (score < 50) return 'text-green-600';
    if (score < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityRing = (score: number) => {
    if (score >= 80) return 'ring-4 ring-red-200';
    return '';
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Risk Radar - Ikeja</h2>
      <div className="text-center mb-6">
        <div className={`inline-block text-7xl font-mono font-bold mb-2 ${getSeverityColor(score)} ${getSeverityRing(score)} p-4 rounded-full bg-gray-50`}>
          {score}
        </div>
        <div className="text-lg text-gray-600">Risk Score</div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-gray-100">
          <span className="text-gray-700 font-medium">Time to Breach:</span>
          <span className="font-bold text-lg">{timeToBreach} min</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-gray-700 font-medium">Confidence:</span>
          <span className="font-bold text-lg">{confidence}</span>
        </div>
      </div>
    </div>
  );
};

export default RiskRadar;