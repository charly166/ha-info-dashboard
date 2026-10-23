import { useState } from 'preact/hooks';
import { clearCredentials, loadCredentials, saveCredentials, type Credentials } from './config';
import { useHass } from './ha';
import { Setup } from './components/Setup';
import { DashboardView } from './components/DashboardView';

function Dashboard({ creds, onReset }: { creds: Credentials; onReset: () => void }) {
  const { status, error, entities, connection } = useHass(creds);

  if (status === 'error') {
    return (
      <div class="root">
        <Setup initial={creds} error={error} onSave={(c) => { saveCredentials(c); location.reload(); }} />
      </div>
    );
  }

  return (
    <div class="root">
      {status === 'disconnected' && <div class="banner">Verbindung unterbrochen – verbinde neu …</div>}
      {status === 'connecting' ? (
        <p class="muted center">Verbinde mit Home Assistant …</p>
      ) : (
        <DashboardView entities={entities} connection={connection} />
      )}
      <footer class="footer">
        <button class="link" onClick={onReset}>Verbindung ändern</button>
      </footer>
    </div>
  );
}

export function App() {
  const [creds, setCreds] = useState<Credentials | null>(loadCredentials);

  if (!creds) {
    return (
      <div class="root">
        <Setup onSave={(c) => { saveCredentials(c); setCreds(c); }} />
      </div>
    );
  }
  return <Dashboard creds={creds} onReset={() => { clearCredentials(); setCreds(null); }} />;
}
