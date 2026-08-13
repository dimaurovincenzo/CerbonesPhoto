import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Ultima barriera del renderer: un errore inatteso non deve lasciare una finestra vuota. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[renderer-fatal]', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    return (
      <main className="fatal-state" role="alert">
        <div className="fatal-state__icon"><AlertTriangle size={24} /></div>
        <h1>CerbonesPhoto non è riuscito a mostrare la finestra</h1>
        <p>Ricarica l’interfaccia. Le cartelle e i file sul Mac non vengono modificati.</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>
          <RotateCcw size={14} /> Ricarica CerbonesPhoto
        </button>
      </main>
    )
  }
}
