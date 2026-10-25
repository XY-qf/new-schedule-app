import { APP_NAME } from '../../../shared/app-info';
import { WindowButtons } from './WindowButtons';

export interface TitleBarProps {
  maximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({
  maximized,
  onMinimize,
  onMaximize,
  onClose,
}: TitleBarProps): JSX.Element {
  return (
    <header className="titlebar">
      <span className="titlebar__app">{APP_NAME}</span>
      <WindowButtons
        maximized={maximized}
        onMinimize={onMinimize}
        onMaximize={onMaximize}
        onClose={onClose}
      />
    </header>
  );
}
