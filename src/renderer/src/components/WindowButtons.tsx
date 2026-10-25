export interface WindowButtonsProps {
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function WindowButtons({ onMinimize, onMaximize, onClose }: WindowButtonsProps): JSX.Element {
  return (
    <div className="winbtns">
      <button type="button" className="winbtn" aria-label="最小化" onClick={onMinimize}>
        <span className="ico-min" />
      </button>
      <button type="button" className="winbtn" aria-label="最大化" onClick={onMaximize}>
        <span className="ico-max" />
      </button>
      <button type="button" className="winbtn winbtn--close" aria-label="关闭" onClick={onClose}>
        <span className="ico-close" />
      </button>
    </div>
  );
}