import DemoPage from './DemoPage'
import './App.css'

function App() {
  if (window.location.pathname === '/demo') {
    return <DemoPage />
  }

  return (
    <main className="home-shell">
      <section className="home-hero">
        <div>
          <p className="home-eyebrow">RiskGuard AI</p>
          <h1>Operational risk copilot for telecom teams</h1>
          <p>
            Trigger a live Ikeja risk investigation, watch the agent workstream,
            inspect evidence, compare mitigation curves, and ask grounded
            follow-up questions.
          </p>
        </div>
        <a className="home-action" href="/demo">
          Open Copilot Demo
        </a>
      </section>
    </main>
  )
}

export default App
