import React, { useState } from 'react';
import { Send, Bot, User, Database, Terminal } from 'lucide-react';
import Card from '../components/Card';

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Xin chào! Tôi là Trợ lý AI của Smart Campus. Bạn cần phân tích dữ liệu hay thống kê gì hôm nay?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    // Add user message
    const newMessages = [...messages, { role: 'user', text: input }];
    setMessages(newMessages);
    setInput('');

    // Mock AI response delay
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'Hôm nay có 1,248 sinh viên có mặt, 15 vắng và 42 đi trễ. Tỷ lệ chuyên cần cao nhất thuộc về Khoa CNTT (98%).',
        meta: {
          sql: "SELECT status, COUNT(*) FROM attendance_records WHERE date = '2026-07-06' GROUP BY status",
          records: 1248,
          confidence: 0.98
        }
      }]);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bot color="var(--accent-secondary)" /> AI Data Assistant
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Query campus data using natural language (Powered by Amazon Bedrock).</p>
      </div>

      <Card className="chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem' }}>
        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingRight: '1rem', paddingBottom: '1rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              gap: '1rem', 
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' 
            }}>
              <div style={{ 
                width: '36px', height: '36px', borderRadius: '50%', 
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-base)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: msg.role === 'assistant' ? '1px solid var(--accent-secondary)' : 'none'
              }}>
                {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="var(--accent-secondary)" />}
              </div>
              <div style={{ 
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                padding: '1rem 1.25rem',
                borderRadius: '16px',
                borderTopRightRadius: msg.role === 'user' ? 0 : '16px',
                borderTopLeftRadius: msg.role === 'assistant' ? 0 : '16px',
                maxWidth: '75%',
                border: msg.role === 'assistant' ? '1px solid var(--glass-border)' : 'none',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)'
              }}>
                <p style={{ margin: 0 }}>{msg.text}</p>
                
                {/* Meta details if available (SQL query insight) */}
                {msg.meta && (
                  <div style={{ 
                    marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '0.8rem', color: 'var(--text-muted)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Terminal size={14} /> <span>Generated SQL (Athena)</span>
                    </div>
                    <code style={{ 
                      display: 'block', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', 
                      borderRadius: '4px', fontFamily: 'monospace', color: 'var(--accent-success)'
                    }}>
                      {msg.meta.sql}
                    </code>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Database size={12}/> Rows scanned: {msg.meta.records}</span>
                      <span>Confidence: {msg.meta.confidence * 100}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div style={{ 
          marginTop: 'auto', 
          background: 'var(--bg-base)', 
          borderRadius: '12px', 
          border: '1px solid var(--glass-border)',
          display: 'flex',
          padding: '0.5rem'
        }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything (e.g., 'How many students were late today?')"
            style={{ 
              flex: 1, background: 'transparent', border: 'none', 
              color: 'var(--text-primary)', outline: 'none', padding: '0.5rem 1rem'
            }}
          />
          <button 
            onClick={handleSend}
            style={{ 
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none', borderRadius: '8px', width: '40px', height: '40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <Send size={18} color="white" style={{ marginLeft: '-2px' }}/>
          </button>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistant;
