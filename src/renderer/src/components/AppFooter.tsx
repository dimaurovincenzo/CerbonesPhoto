import { PhotoPipelineStatus } from './PhotoPipelineStatus'

export function AppFooter(): React.JSX.Element {
  return (
    <footer className="app-footer">
      <PhotoPipelineStatus />
      <span className="app-footer__signature">Powered by VDM with love — Cerbone Antonio</span>
    </footer>
  )
}
