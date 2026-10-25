import { APP_NAME } from '../../../shared/app-info';
import { WindowButtons } from './WindowButtons';

export interface TitleBarProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ onMinimize, onMaximize, onClose }: TitleBarProps): JSX.Element {
  return (
    <header className="titlebar">
      <span className="titlebar__app">{APP_NAME}</span>
      <WindowButtons onMinimize={onMinimize} onMaximize={onMaximize} onClose={onClose} />
    </header>
  );
}