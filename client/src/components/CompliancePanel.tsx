import React from 'react';

const CompliancePanel: React.FC = () => {
  const sections = [
    { title: 'Timeline', content: 'Incident timeline from detection to resolution.' },
    { title: 'Affected services', content: 'Voice, data, and SMS services impacted.' },
    { title: 'KPIs', content: 'Downtime: 45 min, Affected: 18,420 users.' },
    { title: 'Impacted subscribers', content: 'Residential and enterprise customers.' },
    { title: 'Root cause', content: 'Network congestion due to high traffic.' },
    { title: 'Corrective actions', content: 'Bandwidth increase and traffic redirection.' },
    { title: 'Evidence logs', content: 'System logs and monitoring data.' },
  ];

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">NCC Pack View</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sections.map((section, index) => (
          <div key={index} className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <h3 className="font-bold text-lg mb-3 text-gray-800">{section.title}</h3>
            <p className="text-gray-700">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CompliancePanel;