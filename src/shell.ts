import styles from './style.css?inline';

let sheet: CSSStyleSheet | undefined;

/** Die Styles gelten für alle Karten gemeinsam; ältere Browser bekommen sie pro Element. */
export function adoptStyles(root: ShadowRoot) {
  try {
    sheet ??= new CSSStyleSheet();
    if (sheet.cssRules.length === 0) sheet.replaceSync(styles);
    root.adoptedStyleSheets = [sheet];
  } catch {
    const style = document.createElement('style');
    style.textContent = styles;
    root.append(style);
  }
}
