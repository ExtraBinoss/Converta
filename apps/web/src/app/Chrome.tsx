import { Preferences } from "@/features/converter/Settings";
export function Wordmark() {
  return (
    <div className="brand" aria-hidden="true">
      <img
        src="/converta-light.svg"
        className="wordmark wordmark-light"
        width="156"
        height="32"
        alt=""
      />
      <img
        src="/converta-dark.svg"
        className="wordmark wordmark-dark"
        width="156"
        height="32"
        alt=""
      />
    </div>
  );
}
export function AppFooter() {
  return (
    <footer className="app-footer">
      <a
        className="plinka-signature"
        href="https://plinka.eu"
        aria-label="Plinka"
        target="_blank"
        rel="noreferrer"
      >
        <span className="plinka-mark" aria-hidden="true" />
      </a>
      <Preferences />
    </footer>
  );
}
