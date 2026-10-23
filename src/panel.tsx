import { render } from 'preact';
import type { Connection, HassEntities } from 'home-assistant-js-websocket';
import { DashboardView } from './components/DashboardView';
import styles from './style.css?inline';

/** Der Teil des `hass`-Objekts, den das Dashboard braucht. */
interface Hass {
  states: HassEntities;
  connection: Connection;
}

const TAG = 'ha-info-dashboard';

/**
 * Wird von Home Assistant als Panel eingebunden (die Integration registriert es)
 * und bekommt `hass` von HA gereicht.
 */
class HaInfoDashboard extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  private _hass?: Hass;

  constructor() {
    super();
    const style = document.createElement('style');
    style.textContent = styles;
    this.root.append(style);
    const mount = document.createElement('div');
    mount.className = 'root';
    this.root.append(mount);
  }

  set hass(hass: Hass) {
    this._hass = hass;
    this.update();
  }

  private update() {
    const mount = this.root.querySelector('.root');
    if (mount && this._hass) {
      render(<DashboardView entities={this._hass.states} connection={this._hass.connection} />, mount);
    }
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, HaInfoDashboard);
