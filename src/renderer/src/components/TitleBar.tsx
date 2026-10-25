import { APP_NAME } from '../../../shared/app-info';
import { WindowButtons } from './WindowButtons';

export interface TitleBarProps {
  maximized: boolean;
  onSettings: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({
  maximized,
  onSettings,
  onMinimize,
  onMaximize,
  onClose,
}: TitleBarProps): JSX.Element {
  return (
    <header className="titlebar">
      <span className="titlebar__app">{APP_NAME}</span>
      <button type="button" className="titlebar__gear" aria-label="设置" onClick={onSettings}>
        ⚙
      </button>
      <WindowButtons
        maximized={maximized}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />
    </header>
  );
}
