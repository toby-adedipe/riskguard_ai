import { useEffect, useMemo, useState } from 'react'
import './DemoPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

type AgentRecommendation = {
  action: string
  requires_approval: boolean
}

type EvidenceReference = {
  evidence_id: string
  summary: string
  domain?: string | null
  kpi?: string | null
  source_system?: string | null
}

type HarnessStep = {
  step_id: string
  kind: string
  title: string
  status: 'passed' | 'failed' | 'skipped'
  role?: string | null
  tools_called: string[]
  evidence_ids: string[]
  recommendations: AgentRecommendation[]
  validation_status?: string | null
  summary: string
  missing_tools: string[]
}

type SimulationAction = {
  action_id: string
  projected_score_curve: number[]
  confidence: number
  time_to_effect_minutes: number
  recommended: boolean
}

type MitigationSimulation = {
  incident_id: string
  do_nothing_curve: number[]
  actions: SimulationAction[]
  recommended_action_id?: string | null
  summary: string
}

type HarnessReport = {
  harness_run_id: string
  playbook_id: string
  lga_id: string
  incident_id?: string | null
  trigger_reason: string
  selected_roles: string[]
  status: 'passed' | 'failed'
  started_at: string
  completed_at: string
  steps: HarnessStep[]
  tools_called: string[]
  evidence_ids: string[]
  evidence: EvidenceReference[]
  recommendations: AgentRecommendation[]
  mitigation_simulation?: MitigationSimulation | null
  approval_required: boolean
  next_actions: string[]
  summary: string
}

type FollowUpType = 'why_this_action' | 'show_evidence' | 'what_if_we_wait'

type FollowUpResponse = {
  harness_run_id: string
  conversation_id: string
  follow_up_type: FollowUpType | 'freeform'
  answer: string
  evidence: EvidenceReference[]
  recommendations: AgentRecommendation[]
  validation_status: string
}

type FollowUpMessage = FollowUpResponse & {
  prompt: string
}

type Phase = {
  id: string
  title: string
  agent: string
  rationale: string
  expectedTools: string[]
}

const phases: Phase[] = [
  {
    id: 'signal',
    title: 'Wake on threshold',
    agent: 'Main investigation agent',
    rationale: 'Confirm the score, confidence, breach window, and anomalous domains before spending agent capacity.',
    expectedTools: ['get_risk_snapshot', 'get_feature_windows'],
  },
  {
    id: 'context',
    title: 'Collect context',
    agent: 'Investigation harness',
    rationale: 'Pull incident state, risk snapshot, and rolling windows so sub-agents reason from shared facts.',
    expectedTools: ['get_incident_context', 'get_risk_snapshot', 'get_feature_windows'],
  },
  {
    id: 'network',
    title: 'Network diagnosis',
    agent: 'Network risk agent',
    rationale: 'Check network and BTS availability, dropped calls, and congestion before declaring a service-risk pattern.',
    expectedTools: ['get_incident_context', 'get_risk_snapshot', 'get_signal_evidence'],
  },
  {
    id: 'mitigation',
    title: 'Mitigation comparison',
    agent: 'Mitigation planning agent',
    rationale: 'Fetch the playbook, simulate every option against do-nothing, and keep only supported recommendations.',
    expectedTools: ['get_mitigation_playbook', 'run_pre_action_simulation', 'write_investigation_note'],
  },
  {
    id: 'compliance',
    title: 'Compliance readiness',
    agent: 'Compliance agent',
    rationale: 'Check audit trail, impact, NCC pack draft, and claim validation before the report is shown.',
    expectedTools: ['estimate_impact', 'get_audit_trail', 'generate_ncc_pack_draft', 'validate_claims_against_context'],
  },
  {
    id: 'report',
    title: 'Compile operator report',
    agent: 'Main investigation agent',
    rationale: 'Merge validated evidence, tool outputs, simulation curves, and approval-ready next actions.',
    expectedTools: ['ClaimValidator', 'HarnessRunReport'],
  },
]

const preparedQuestions: { label: string; type: FollowUpType; prompt: string }[] = [
  {
    label: 'Why this action?',
    type: 'why_this_action',
    prompt: 'Why is this the right mitigation action?',
  },
  {
    label: 'Show evidence',
    type: 'show_evidence',
    prompt: 'Show me the evidence behind this report.',
  },
  {
    label: 'What if we wait?',
    type: 'what_if_we_wait',
    prompt: 'What happens if we wait?',
  },
]

const triggerPayload = {
  lga_id: 'ikeja',
  incident_id: 'INC-2025-IKEJA-001',
  score: 81,
  confidence: 0.88,
  time_to_breach_minutes: 55,
  triggered_domains: ['network', 'bts'],
  reason: 'Network and BTS domains crossed anomaly threshold with breach time under one hour.',
}

function DemoPage() {
  const [report, setReport] = useState<HarnessReport | null>(null)
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [error, setError] = useState('')
  const [activePhase, setActivePhase] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [runCompletedAt, setRunCompletedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [followUps, setFollowUps] = useState<FollowUpMessage[]>([])
  const [followUpInput, setFollowUpInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [followUpBusy, setFollowUpBusy] = useState('')
  const [selectedEvidenceDomain, setSelectedEvidenceDomain] = useState('all')
  const [rawOpen, setRawOpen] = useState(false)

  useEffect(() => {
    if (status !== 'running') {
      return
    }
    const clock = window.setInterval(() => setNow(Date.now()), 500)
    const progress = window.setInterval(() => {
      setActivePhase((value) => Math.min(value + 1, phases.length - 1))
    }, 4200)
    return () => {
      window.clearInterval(clock)
      window.clearInterval(progress)
    }
  }, [status])

  const observedDuration = useMemo(() => {
    if (!runStartedAt) return 0
    return ((runCompletedAt ?? now) - runStartedAt) / 1000
  }, [now, runCompletedAt, runStartedAt])

  const backendDuration = useMemo(() => {
    if (!report) return null
    return Math.max(0, (new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()) / 1000)
  }, [report])

  const recommendedAction = report?.recommendations[0]?.action ?? 'No recommendation yet'
  const recommendedCurve = useMemo(() => {
    return report?.mitigation_simulation?.actions.find((action) => action.recommended)
  }, [report])

  const evidenceDomains = useMemo(() => {
    const domains = new Set(report?.evidence.map((item) => item.domain).filter(Boolean) as string[])
    return ['all', ...Array.from(domains)]
  }, [report])

  const filteredEvidence = useMemo(() => {
    if (!report) return []
    if (selectedEvidenceDomain === 'all') return report.evidence
    return report.evidence.filter((item) => item.domain === selectedEvidenceDomain)
  }, [report, selectedEvidenceDomain])

  async function runInvestigation() {
    setStatus('running')
    setError('')
    setReport(null)
    setFollowUps([])
    setConversationId(null)
    setRawOpen(false)
    setActivePhase(0)
    setRunStartedAt(Date.now())
    setRunCompletedAt(null)
    try {
      const response = await fetch(`${API_BASE}/copilot/investigate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-operator-role': 'admin',
        },
        body: JSON.stringify(triggerPayload),
      })
      if (!response.ok) {
        throw new Error(`Investigation failed with HTTP ${response.status}`)
      }
      const payload = (await response.json()) as HarnessReport
      setReport(payload)
      setStatus('complete')
      setRunCompletedAt(Date.now())
      setActivePhase(phases.length - 1)
    } catch (caught) {
      setStatus('error')
      setRunCompletedAt(Date.now())
      setError(caught instanceof Error ? caught.message : 'Investigation failed')
    }
  }

  async function askFollowUp(prompt: string, followUpType?: FollowUpType) {
    if (!report) return
    setFollowUpBusy(followUpType ?? 'freeform')
    setError('')
    try {
      const response = await fetch(`${API_BASE}/copilot/investigations/${report.harness_run_id}/follow-up`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-operator-role': 'admin',
        },
        body: JSON.stringify({
          message: prompt,
          follow_up_type: followUpType,
          conversation_id: conversationId,
        }),
      })
      if (!response.ok) {
        throw new Error(`Follow-up failed with HTTP ${response.status}`)
      }
      const payload = (await response.json()) as FollowUpResponse
      setConversationId(payload.conversation_id)
      setFollowUps((current) => [...current, { ...payload, prompt }])
      setFollowUpInput('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Follow-up failed')
    } finally {
      setFollowUpBusy('')
    }
  }

  return (
    <main className="demo-shell">
      <header className="demo-topbar">
        <a className="back-link" href="/">RiskGuard AI</a>
        <div className="demo-status">
          <span className={`status-dot ${status}`} />
          <span>{status === 'running' ? 'Investigation running' : status === 'complete' ? 'Report ready' : 'Copilot ready'}</span>
        </div>
        <div className="operator-pill">
          <span>Demo Operator</span>
          <strong>Admin</strong>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-copy">
          <p className="eyebrow">Wake-on-signal copilot</p>
          <h1>Ikeja network risk investigation</h1>
          <p>{triggerPayload.reason}</p>
        </div>
        <div className="signal-matrix" aria-label="Current risk signal">
          <Metric label="Risk score" value={`${triggerPayload.score}`} tone="red" />
          <Metric label="Confidence" value={`${Math.round(triggerPayload.confidence * 100)}%`} tone="blue" />
          <Metric label="Time to breach" value={`${triggerPayload.time_to_breach_minutes}m`} tone="amber" />
          <Metric label="Domains" value={triggerPayload.triggered_domains.join(' / ')} tone="neutral" />
        </div>
        <div className="run-card">
          <button className="primary-button" type="button" onClick={runInvestigation} disabled={status === 'running'}>
            <RunIcon />
            {status === 'running' ? 'Running agents' : 'Run live investigation'}
          </button>
          <dl>
            <div>
              <dt>Observed runtime</dt>
              <dd>{formatSeconds(observedDuration)}</dd>
            </div>
            <div>
              <dt>Backend runtime</dt>
              <dd>{backendDuration === null ? '--' : formatSeconds(backendDuration)}</dd>
            </div>
          </dl>
          {error ? <p className="error" role="alert">{error}</p> : null}
        </div>
      </section>

      <section className="ops-grid">
        <section className="process-panel" aria-label="Agent process">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Process</p>
              <h2>What the agents are doing</h2>
            </div>
            <span>{status === 'running' ? `Phase ${activePhase + 1}/${phases.length}` : `${report?.steps.length ?? 0} harness steps`}</span>
          </div>
          <ProcessTimeline
            report={report}
            activePhase={activePhase}
            status={status}
            observedDuration={observedDuration}
          />
        </section>

        <section className="report-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Report</p>
              <h2>Operator summary</h2>
            </div>
            <span>{report?.status ?? 'waiting'}</span>
          </div>
          <ReportView report={report} recommendedAction={recommendedAction} />
        </section>

        <section className="tool-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Tool Calls</p>
              <h2>Grounding trail</h2>
            </div>
            <span>{report?.tools_called.length ?? 0} calls</span>
          </div>
          <ToolCallMap report={report} />
        </section>

        <section className="simulation-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Simulation</p>
              <h2>Do nothing vs mitigation</h2>
            </div>
            <span>{recommendedCurve ? `${recommendedCurve.time_to_effect_minutes}m effect` : 'waiting'}</span>
          </div>
          <SimulationView simulation={report?.mitigation_simulation ?? null} recommendedCurve={recommendedCurve} />
        </section>

        <section className="evidence-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Evidence</p>
              <h2>Referenced records</h2>
            </div>
            <span>{filteredEvidence.length} shown</span>
          </div>
          <div className="filter-row" role="group" aria-label="Filter evidence domain">
            {evidenceDomains.map((domain) => (
              <button
                className={domain === selectedEvidenceDomain ? 'is-selected' : ''}
                key={domain}
                type="button"
                onClick={() => setSelectedEvidenceDomain(domain)}
              >
                {domain}
              </button>
            ))}
          </div>
          <EvidenceList evidence={filteredEvidence} />
        </section>

        <section className="follow-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Follow-up</p>
              <h2>Ask the report</h2>
            </div>
            <span>{conversationId ? 'multi-turn' : 'prepared'}</span>
          </div>
          <div className="prepared-grid">
            {preparedQuestions.map((question) => (
              <button
                className="prepared-button"
                type="button"
                key={question.type}
                disabled={!report || followUpBusy !== ''}
                onClick={() => askFollowUp(question.prompt, question.type)}
              >
                {followUpBusy === question.type ? 'Asking...' : question.label}
              </button>
            ))}
          </div>
          <form
            className="follow-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (followUpInput.trim()) askFollowUp(followUpInput.trim())
            }}
          >
            <label htmlFor="follow-up-input">Natural follow-up</label>
            <div>
              <input
                id="follow-up-input"
                value={followUpInput}
                disabled={!report || followUpBusy !== ''}
                onChange={(event) => setFollowUpInput(event.target.value)}
                placeholder="Ask what else the report supports..."
              />
              <button type="submit" disabled={!report || !followUpInput.trim() || followUpBusy !== ''}>
                {followUpBusy === 'freeform' ? 'Asking' : 'Ask'}
              </button>
            </div>
          </form>
          <FollowUpThread messages={followUps} />
        </section>
      </section>

      <section className="raw-strip">
        <button className="raw-toggle" type="button" onClick={() => setRawOpen((open) => !open)} disabled={!report}>
          {rawOpen ? 'Hide raw HarnessRunReport' : 'Inspect raw HarnessRunReport'}
        </button>
        {rawOpen && report ? <pre>{JSON.stringify(report, null, 2)}</pre> : null}
      </section>
    </main>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'red' | 'blue' | 'amber' | 'neutral' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ProcessTimeline({
  report,
  activePhase,
  status,
  observedDuration,
}: {
  report: HarnessReport | null
  activePhase: number
  status: 'idle' | 'running' | 'complete' | 'error'
  observedDuration: number
}) {
  return (
    <ol className="timeline">
      {phases.map((phase, index) => {
        const matchingStep = findMatchingStep(report, phase.id)
        const phaseStatus = report
          ? matchingStep?.status === 'failed'
            ? 'failed'
            : 'complete'
          : status === 'running' && index === activePhase
            ? 'running'
            : status === 'running' && index < activePhase
              ? 'complete'
              : 'waiting'
        const duration = report
          ? estimatePhaseDuration(report, index)
          : status === 'running' && index <= activePhase
            ? estimateLiveDuration(observedDuration, index, activePhase)
            : null
        const tools = matchingStep?.tools_called.length ? matchingStep.tools_called : phase.expectedTools
        return (
          <li className={phaseStatus} key={phase.id}>
            <div className="timeline-marker">
              <span />
            </div>
            <article>
              <div className="phase-head">
                <div>
                  <h3>{phase.title}</h3>
                  <p>{phase.agent}</p>
                </div>
                <time>{duration === null ? '--' : formatSeconds(duration)}</time>
              </div>
              <p className="phase-rationale">{matchingStep?.summary ?? phase.rationale}</p>
              <div className="tool-chips">
                {tools.map((tool) => (
                  <span key={`${phase.id}-${tool}`}>{tool}</span>
                ))}
              </div>
              {matchingStep?.validation_status ? (
                <p className="validation-line">Validation: {matchingStep.validation_status}</p>
              ) : null}
            </article>
          </li>
        )
      })}
    </ol>
  )
}

function ReportView({ report, recommendedAction }: { report: HarnessReport | null; recommendedAction: string }) {
  if (!report) {
    return <EmptyState text="Run the investigation to generate the operator-facing report." />
  }
  return (
    <div className="report-view">
      <p className="summary-copy">{report.summary}</p>
      <div className="report-kpis">
        <Metric label="Recommendation" value={recommendedAction} tone="blue" />
        <Metric label="Approval" value={report.approval_required ? 'Required' : 'None'} tone="amber" />
        <Metric label="Agents" value={`${report.selected_roles.length}`} tone="neutral" />
        <Metric label="Evidence" value={`${report.evidence.length}`} tone="neutral" />
      </div>
      <div className="run-id">
        <span>Run ID</span>
        <code>{report.harness_run_id}</code>
      </div>
      <div className="next-actions">
        {report.next_actions.map((action) => <span key={action}>{action}</span>)}
      </div>
    </div>
  )
}

function ToolCallMap({ report }: { report: HarnessReport | null }) {
  if (!report) {
    return <EmptyState text="Tool calls appear here after the run starts returning results." />
  }
  return (
    <div className="tool-map">
      {report.steps.map((step) => (
        <article key={step.step_id}>
          <div>
            <strong>{step.role ?? step.kind}</strong>
            <span>{step.status}</span>
          </div>
          <p>{step.title}</p>
          <div className="tool-chips">
            {step.tools_called.map((tool) => <span key={`${step.step_id}-${tool}`}>{tool}</span>)}
          </div>
        </article>
      ))}
    </div>
  )
}

function EvidenceList({ evidence }: { evidence: EvidenceReference[] }) {
  if (!evidence.length) {
    return <EmptyState text="Evidence references will appear after the report is generated." />
  }
  return (
    <div className="evidence-list">
      {evidence.map((item) => (
        <article key={item.evidence_id}>
          <div>
            <code>{item.evidence_id}</code>
            {item.domain ? <span>{item.domain}</span> : null}
          </div>
          <p>{item.summary}</p>
          {item.kpi ? <small>{item.kpi}</small> : null}
        </article>
      ))}
    </div>
  )
}

function SimulationView({ simulation, recommendedCurve }: { simulation: MitigationSimulation | null; recommendedCurve?: SimulationAction }) {
  if (!simulation) {
    return <EmptyState text="Mitigation curves will appear here once the planning agent compares options." />
  }
  const allValues = [
    ...simulation.do_nothing_curve,
    ...simulation.actions.flatMap((action) => action.projected_score_curve),
  ]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  return (
    <div className="simulation-view">
      <p>{simulation.summary}</p>
      <Curve label="Do nothing" values={simulation.do_nothing_curve} min={min} max={max} tone="danger" />
      {simulation.actions.map((action) => (
        <Curve
          key={action.action_id}
          label={`${action.action_id}${action.recommended ? ' · recommended' : ''}`}
          values={action.projected_score_curve}
          min={min}
          max={max}
          tone={action.recommended ? 'good' : 'neutral'}
        />
      ))}
      {recommendedCurve ? (
        <div className="simulation-callout">
          <strong>{recommendedCurve.action_id}</strong>
          <span>{recommendedCurve.time_to_effect_minutes} min effect · {Math.round(recommendedCurve.confidence * 100)}% confidence</span>
        </div>
      ) : null}
    </div>
  )
}

function Curve({
  label,
  values,
  min,
  max,
  tone,
}: {
  label: string
  values: number[]
  min: number
  max: number
  tone: 'danger' | 'good' | 'neutral'
}) {
  return (
    <div className="curve">
      <div>
        <strong>{label}</strong>
        <span>{values.join(' -> ')}</span>
      </div>
      <div className={`curve-bars ${tone}`} aria-label={`${label}: ${values.join(', ')}`}>
        {values.map((value, index) => {
          const height = max === min ? 50 : 22 + ((value - min) / (max - min)) * 72
          return <span key={`${label}-${index}`} style={{ height: `${height}%` }} title={`${value}`} />
        })}
      </div>
    </div>
  )
}

function FollowUpThread({ messages }: { messages: FollowUpMessage[] }) {
  if (!messages.length) {
    return <EmptyState text="Prepared answers and natural follow-ups will appear here." />
  }
  return (
    <div className="thread">
      {messages.map((message, index) => (
        <article key={`${message.conversation_id}-${index}`}>
          <div>
            <span>{message.follow_up_type}</span>
            <strong>{message.prompt}</strong>
          </div>
          <p>{message.answer}</p>
          <div className="tool-chips">
            {message.evidence.slice(0, 5).map((evidence) => <span key={`${index}-${evidence.evidence_id}`}>{evidence.evidence_id}</span>)}
          </div>
        </article>
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>
}

function RunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
      <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
    </svg>
  )
}

function findMatchingStep(report: HarnessReport | null, phaseId: string) {
  if (!report) return undefined
  if (phaseId === 'signal') return report.steps.find((step) => step.step_id === 'collect_context')
  if (phaseId === 'context') return report.steps.find((step) => step.step_id === 'collect_context')
  if (phaseId === 'network') return report.steps.find((step) => step.role === 'network_risk')
  if (phaseId === 'mitigation') return report.steps.find((step) => step.role === 'mitigation')
  if (phaseId === 'compliance') return report.steps.find((step) => step.role === 'compliance')
  return report.steps.find((step) => step.kind === 'compile_report')
}

function estimatePhaseDuration(report: HarnessReport, index: number) {
  const total = Math.max(1, (new Date(report.completed_at).getTime() - new Date(report.started_at).getTime()) / 1000)
  const weights = [0.08, 0.12, 0.22, 0.28, 0.2, 0.1]
  return total * weights[index]
}

function estimateLiveDuration(observedDuration: number, index: number, activePhase: number) {
  if (index < activePhase) return Math.max(1, observedDuration / Math.max(activePhase + 1, 1))
  if (index === activePhase) return observedDuration % 4.2
  return 0
}

function formatSeconds(value: number) {
  if (value < 1) return `${Math.max(0, value).toFixed(1)}s`
  if (value < 60) return `${value.toFixed(1)}s`
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  return `${minutes}m ${seconds}s`
}

export default DemoPage
