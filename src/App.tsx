import { useState } from 'preact/hooks';
import { clearCredentials, loadCredentials, saveCredentials, type Credentials } from './config';
import { useHass } from './ha';
import { Setup } from './components/Setup';
import { WeatherCard } from './components/WeatherCard';
import { WarningsCard } from './components/WarningsCard';
import { IndoorCard } from './components/IndoorCard';

function Dashboard({ creds, onReset }: { creds: Credentials; onReset: () => void }) {
  const { status, error, entities, connection } = useHass(creds);

  if (status === 'error') {
    return <Setup initial={creds} error={error} onSave={(c) => { saveCredentials(c); location.reload(); }} />;
  }

  return (
    <>
      {status === 'disconnected' && <div class="banner">Verbindung unterbrochen – verbinde neu …</div>}
      {status === 'connecting' ? (
        <p class="muted center">Verbinde mit Home Assistant …</p>
      ) : (
        <main class="grid">
          <WeatherCard entities={entities} connection={connection} />
          <WarningsCard entities={entities} />
          <IndoorCard entities={entities} />
        </main>
      )}
      <footer class="footer">
        <button class="link" onClick={onReset}>Verbindung ändern</button>
      </footer>
    </>
  );
}

export function App() {
  const [creds, setCreds] = useState<Credentials | null>(loadCredentials);

  if (!creds) {
    return <Setup onSave={(c) => { saveCredentials(c); setCreds(c); }} />;
  }
  return <Dashboard creds={creds} onReset={() => { clearCredentials(); setCreds(null); }} />;
}
