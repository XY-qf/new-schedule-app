import { useState, type JSX } from 'react';
import { TitleBar } from './components/TitleBar';
import { TabBar, type ViewName } from './components/TabBar';

export function App(): JSX.Element {
  const [view, setView] = useState<ViewName>('calendar');

  const changeView = (next: ViewName): void => {
    setView(next);
    void window.api?.window.setView({ view: next });
  };

  return (
    <div className="app">
      <TitleBar onMinimize={() => {}} onMaximize={() => {}} onClose={() => {}} />
      <TabBar active={view} onChange={changeView} />
      <main className="app__body">{view === 'calendar' ? '日历' : '待办'}</main>
    </div>
  );
}