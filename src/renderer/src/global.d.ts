export {};

declare global {
  interface Window {
    api?: {
      window: {
        setView: (payload: { view: 'calendar' | 'todo' }) => Promise<unknown>;
      };
    };
  }
}