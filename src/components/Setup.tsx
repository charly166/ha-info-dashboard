import { useState } from 'preact/hooks';
import type { Credentials } from '../config';

interface Props {
  initial?: Credentials | null;
  error?: string;
  onSave: (c: Credentials) => void;
}

export function Setup({ initial, error, onSave }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [token, setToken] = useState(initial?.token ?? '');

  const submit = (e: Event) => {
    e.preventDefault();
    onSave({ url: url.trim().replace(/\/+$/, ''), token: token.trim() });
  };

  return (
    <form class="setup card" onSubmit={submit}>
      <img src="./logo.webp" alt="HA Info Dashboard" class="setup-logo" />
      <h1>Mit Home Assistant verbinden</h1>
      {error && <p class="error">{error}</p>}
      <label>
        Adresse
        <input
          type="url"
          required
          placeholder="http://homeassistant.local:8123"
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
      </label>
      <label>
        Langlebiger Zugriffstoken
        <input type="password" required value={token} onInput={(e) => setToken(e.currentTarget.value)} />
      </label>
      <p class="hint">Das Token erstellst du in HA unter Profil → Sicherheit. Es wird nur in diesem Browser gespeichert.</p>
      <button type="submit">Verbinden</button>
    </form>
  );
}
