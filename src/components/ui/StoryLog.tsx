import React, { useEffect, useState, useRef } from 'react';

export interface LogEntry {
  id: number;
  type: 'event' | 'dialogue' | 'combat' | 'system' | 'narrative';
  text: string;
  timestamp: string;
}

interface StoryLogProps {
  logs: LogEntry[];
}

const TypewriterText: React.FC<{ text: string, onComplete?: () => void }> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayedText('');
    indexRef.current = 0;
    
    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText((prev) => prev + text.charAt(indexRef.current));
        indexRef.current++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 20); // Скорость печати

    return () => clearInterval(interval);
  }, [text]);

  // Парсинг markdown-like жирного текста (**text**)
  const parts = displayedText.split(/(\*\*.*?\*\*)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ color: '#c9ada7' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </span>
  );
};

const StoryLog: React.FC<StoryLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, logs.length]); // Scroll on new log or text update

  return (
    <div className="story-log-container">
      <h3 className="panel-title">Chronicles of the Realm</h3>
      <div className="story-logs">
        {logs.length === 0 ? (
          <div className="empty-log">The parchment is blank...</div>
        ) : (
          logs.map((log, index) => {
            // Анимируем только последнее сообщение
            const isLast = index === logs.length - 1;
            return (
              <div key={log.id} className={`log-entry log-${log.type}`}>
                <div className="log-meta">
                  <span className="log-time">[{log.timestamp}]</span>
                </div>
                <div className="log-content">
                  {isLast && log.type !== 'system' ? (
                    <TypewriterText text={log.text} />
                  ) : (
                    // Рендерим старые логи сразу (с парсингом)
                    log.text.split(/(\*\*.*?\*\*)/g).map((part, i) => 
                      part.startsWith('**') && part.endsWith('**') 
                        ? <strong key={i} style={{ color: '#c9ada7' }}>{part.slice(2, -2)}</strong> 
                        : part
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default StoryLog;
