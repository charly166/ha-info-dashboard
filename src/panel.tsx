import { render } from 'preact';
import { DashboardView, type PanelHass } from './components/DashboardView';
import { registerCards } from './cards';
import { adoptStyles } from './shell';

const TAG = 'ha-info-dashboard';

/**
 * Wird von Home Assistant als Panel eingebunden (die Integration registriert es)
 * und bekommt `hass` von HA gereicht.
 */
class HaInfoDashboard extends HTMLElement {
  private root = this.attachShadow({ mode: 'open' });
  private _hass?: PanelHass;
  private _narrow = false;

  constructor() {
    super();
    adoptStyles(this.root);
    const mount = document.createElement('div');
    mount.className = 'root';
    this.root.append(mount);
  }

  set hass(hass: PanelHass) {
    this._hass = hass;
    this.update();
  }

  /** HA meldet, ob die Seitenleiste ausgeblendet ist (Smartphone, schmales Fenster). */
  set narrow(narrow: boolean) {
    this._narrow = narrow;
    this.update();
  }

  connectedCallback() {
    this.update();
  }

  /** Beendet die Abonnements, wenn das Panel verlassen wird. */
  disconnectedCallback() {
    const mount = this.root.querySelector('.root');
    if (mount) render(null, mount);
  }

  private update() {
    const mount = this.root.querySelector('.root');
    if (mount && this._hass && this.isConnected) {
      render(<DashboardView hass={this._hass} narrow={this._narrow} />, mount);
    }
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, HaInfoDashboard);
registerCards();
