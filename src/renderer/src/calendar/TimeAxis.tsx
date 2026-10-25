const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimeAxis(): JSX.Element {
  return (
    <div className="cal__axis">
      {HOURS.map((h) => (
        <div key={h} className="cal__hour-label" style={{ top: h * 48 }}>
          {String(h).padStart(2, '0')}:00
        </div>
      ))}
    </div>
  );
}