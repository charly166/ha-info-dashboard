import { render } from 'preact';
import { DashboardView, type PanelHass } from './components/DashboardView';
import styles from './style.css?inline';

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
    const style = document.createElement('style');
    style.textContent = styles;
    this.root.append(style);
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

  private update() {
    const mount = this.root.querySelector('.root');
    if (mount && this._hass) {
      render(<DashboardView hass={this._hass} narrow={this._narrow} />, mount);
    }
  }
}

if (!customElements.get(TAG)) customElements.define(TAG, HaInfoDashboard);
