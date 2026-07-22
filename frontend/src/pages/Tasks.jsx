import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Plus, Search, FileText, Paperclip,
  Loader, Calendar, User, UserCheck, ChevronDown,
  Clock, AlertTriangle, CheckCircle2, Circle, RotateCcw, Filter,
  Eye, X, Hash, Link2, MessageSquare, Edit2, Trash2
} from 'lucide-react';
import Card from '../components/Card';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  OPEN: { label: 'Cần làm', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.15)', icon: Circle },
  IN_PROGRESS: { label: 'Đang làm', color: 'var(--accent-primary)', bg: 'rgba(6,182,212,0.15)', icon: RotateCcw },
  IN_REVIEW: { label: 'Chờ duyệt', color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.15)', icon: Clock },
  COMPLETED: { label: 'Hoàn thành', color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  URGENT: { label: 'Khẩn cấp', color: 'var(--accent-danger)', bg: 'rgba(239,68,68,0.15)' },
  HIGH: { label: 'Cao', color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.15)' },
  MEDIUM: { label: 'Trung bình', color: 'var(--accent-primary)', bg: 'rgba(6,182,212,0.15)' },
  LOW: { label: 'Thấp', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

const Badge = ({ cfg, value }) => {
  if (!cfg) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>
      {cfg.icon && <cfg.icon size={11} />}
      {cfg.label ?? value}
    </span>
  );
};

const Avatar = ({ name = '?', size = 28 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.38, fontWeight: 700, color: '#fff',
  }}>
    {name.charAt(0).toUpperCase()}
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'sm', ...rest }) => {
  const variants = {
    primary: { background: 'var(--accent-primary)', color: '#fff', border: 'none' },
    danger: { background: 'var(--accent-danger)', color: '#fff', border: 'none' },
    success: { background: 'var(--accent-success)', color: '#fff', border: 'none' },
    warning: { background: 'var(--accent-warning)', color: '#000', border: 'none' },
    ghost: { background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' },
    dashed: { background: 'transparent', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.2)' },
  };
  const sizes = {
    sm: { padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '6px' },
    md: { padding: '0.55rem 1.2rem', fontSize: '0.875rem', borderRadius: '8px' },
    lg: { padding: '0.7rem 1.5rem', fontSize: '1rem', borderRadius: '10px' },
  };
  return (
    <button
      {...rest}
      style={{
        ...variants[variant], ...sizes[size],
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        opacity: rest.disabled ? 0.55 : 1, transition: 'opacity 0.2s',
        fontFamily: 'inherit',
        ...(rest.style || {}),
      }}
    >
      {children}
    </button>
  );
};

// ── Task Detail Drawer ────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <p style={{ margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
    {children}
  </p>
);

const PersonCard = ({ label, name, role, accentColor = 'var(--accent-primary)' }) => (
  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
    <p style={{ margin: '0 0 0.5rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${accentColor}, var(--accent-secondary))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {(name || '?').charAt(0).toUpperCase()}
      </div>
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{name || '—'}</p>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{role || '—'}</p>
      </div>
    </div>
  </div>
);

const DateCard = ({ label, value, danger }) => (
  <div style={{ flex: 1, background: danger ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
    <p style={{ margin: '0 0 0.35rem', fontSize: '0.7rem', fontWeight: 600, color: danger ? 'var(--accent-danger)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: danger ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
      {value || '—'}
    </p>
    {danger && <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--accent-danger)' }}>⚠ Quá hạn</p>}
  </div>
);

const TaskDetailDrawer = ({ task, users, currentUser, onClose, onUpdateStatus, onSubmit, onAddSubtask, onEdit, onDelete }) => {
  if (!task) return null;

  const getUser = (id) => users.find(x => x.user_id === id) || { name: id || '—', role: '—' };
  const reporter = getUser(task.reporter_id);
  const assignee = getUser(task.assignee_id);

  const isAssignee = currentUser?.user_id === task.assignee_id;
  const isReporter = currentUser?.user_id === task.reporter_id;
  const isAdmin = currentUser?.role === 'ADMIN';

  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.OPEN;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED';

  const createdStr = task.created_at
    ? new Date(task.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const dueStr = task.due_date
    ? new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200 }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(600px, 95vw)',
        maxHeight: '90vh',
        background: '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden'
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.06))',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {task.parent_task_id && (
                <span style={{ fontSize: '0.65rem', background: 'rgba(139,92,246,0.2)', color: 'var(--accent-secondary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>↳ SUBTASK</span>
              )}
              <Badge cfg={pc} />
              <Badge cfg={sc} />
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem 0.5rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', lineHeight: 1 }}>
              <X size={17} />
            </button>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.45 }}>
            {task.title}
          </h2>
          {task.task_id && (
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              #{task.task_id.slice(-12).toUpperCase()}
            </p>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. Mô tả */}
          <div>
            <SectionLabel>📋 Mô tả công việc</SectionLabel>
            {task.description ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '1rem 1.1rem' }}>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {task.description}
                </p>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.9rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Không có mô tả
              </div>
            )}
          </div>

          {/* 2. Người giao / Người thực hiện */}
          <div>
            <SectionLabel>👥 Thành viên</SectionLabel>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <PersonCard label="Người giao" name={reporter.name} role={reporter.role} accentColor="var(--accent-secondary)" />
              <PersonCard label="Người thực hiện" name={assignee.name} role={assignee.role} accentColor="var(--accent-primary)" />
            </div>
          </div>

          {/* 3. Ngày giao / Deadline */}
          <div>
            <SectionLabel>📅 Thời gian</SectionLabel>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <DateCard label="Ngày giao" value={createdStr} />
              <DateCard label="Deadline" value={dueStr} danger={isOverdue} />
            </div>
          </div>

          {/* 4. Tệp đính kèm */}
          {(task.file_url || task.submission_file_url) && (
            <div>
              <SectionLabel>📎 Tệp đính kèm</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {task.file_url && (
                  <a href={task.file_url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)',
                    borderRadius: '10px', textDecoration: 'none',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Paperclip size={16} color="var(--accent-primary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Tài liệu yêu cầu</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click để tải xuống / xem</p>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>↗</span>
                  </a>
                )}
                {task.submission_file_url && (
                  <a href={task.submission_file_url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: '10px', textDecoration: 'none',
                  }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={16} color="var(--accent-secondary)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>Báo cáo kết quả</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>File nộp bởi người thực hiện</p>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>↗</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 5. Ghi chú kết quả */}
          {task.submission_note && (
            <div>
              <SectionLabel>💬 Ghi chú kết quả</SectionLabel>
              <div style={{
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.22)',
                borderRadius: '10px', padding: '1rem 1.1rem',
                borderLeft: '3px solid var(--accent-warning)',
              }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                  {task.submission_note}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          {isAssignee && task.status === 'OPEN' && (
            <Btn variant="primary" size="md" onClick={() => { onUpdateStatus(task.task_id, 'IN_PROGRESS'); onClose(); }}>
              <RotateCcw size={14} /> Bắt đầu
            </Btn>
          )}
          {isAssignee && task.status === 'IN_PROGRESS' && (
            <Btn variant="warning" size="md" onClick={() => { onSubmit(task); onClose(); }}>
              <CheckCircle2 size={14} /> Gửi duyệt
            </Btn>
          )}
          {(isReporter || isAdmin) && task.status === 'IN_REVIEW' && (
            <>
              <Btn variant="danger" size="md" onClick={() => { onUpdateStatus(task.task_id, 'IN_PROGRESS'); onClose(); }}>Từ chối</Btn>
              <Btn variant="success" size="md" onClick={() => { onUpdateStatus(task.task_id, 'COMPLETED'); onClose(); }}>
                <CheckCircle2 size={14} /> Duyệt
              </Btn>
            </>
          )}
          {currentUser?.role === 'MANAGER' && isAssignee && task.status === 'IN_PROGRESS' && !task.parent_task_id && (
            <Btn variant="dashed" size="md" onClick={() => { onAddSubtask(task.task_id); onClose(); }}>
              <Plus size={14} /> Thêm việc con
            </Btn>
          )}
          <Btn variant="ghost" size="md" style={{ marginLeft: 'auto' }} onClick={onClose}>Đóng</Btn>
        </div>
      </div>

      <style>{`
        @keyframes modalZoomIn { from { transform: translate(-50%, -45%) scale(0.96); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
      `}</style>
    </>
  );
};



// ── Task Row (list item) ──────────────────────────────────────────────────────
const TaskRow = ({ task, users, currentUser, onUpdateStatus, onSubmit, onAddSubtask, onViewDetail, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const getUser = (id) => users.find(x => x.user_id === id) || { name: id || '—', role: '' };
  const reporter = getUser(task.reporter_id);
  const assignee = getUser(task.assignee_id);

  const isAssignee = currentUser?.user_id === task.assignee_id;
  const isReporter = currentUser?.user_id === task.reporter_id;
  const isAdmin = currentUser?.role === 'ADMIN';

  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.OPEN;
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'COMPLETED';

  return (
    <div style={{
      background: 'rgba(30,41,59,0.65)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${pc.color}`,
      borderRadius: '12px',
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Main row — 3 zones: [status+title] | [badges] | [eye + chevron] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem' }}>
        {/* Status icon */}
        <sc.icon size={18} color={sc.color} style={{ flexShrink: 0 }} />

        {/* Title + description — clickable to expand */}
        <div
          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => setExpanded(v => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {task.parent_task_id && (
              <span style={{ fontSize: '0.65rem', background: 'rgba(139,92,246,0.2)', color: 'var(--accent-secondary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600, flexShrink: 0 }}>↳ Sub</span>
            )}
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </span>
          </div>
          {task.description && (
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.description}
            </p>
          )}
        </div>

        {/* Badges + meta (hidden on very small screens via gap) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <Badge cfg={pc} />
          <Badge cfg={sc} />

          {task.due_date && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '999px',
              color: isOverdue ? 'var(--accent-danger)' : 'var(--text-muted)',
              background: isOverdue ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
              fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              <Calendar size={11} />
              {new Date(task.due_date).toLocaleDateString('vi-VN')}
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Avatar name={assignee.name} size={24} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{assignee.name}</span>
          </div>
        </div>

        {/* Right controls — always visible, never wraps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {/* Eye: open detail drawer */}
          <button
            onClick={e => { e.stopPropagation(); onViewDetail(task); }}
            title="Xem chi tiết"
            style={{
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.3)',
              borderRadius: '7px',
              padding: '0.3rem 0.55rem',
              cursor: 'pointer',
              color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.72rem', fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.12)'}
          >
            <Eye size={14} /> Chi tiết
          </button>

          {/* Chevron: expand inline */}
          <div
            onClick={() => setExpanded(v => !v)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.3rem' }}
          >
            <ChevronDown
              size={16}
              color="var(--text-muted)"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </div>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{
          padding: '0 1rem 1rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          {task.description && (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {task.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={13} /> Giao bởi: <strong style={{ color: 'var(--text-secondary)' }}>{reporter.name}</strong>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <UserCheck size={13} /> Thực hiện: <strong style={{ color: 'var(--text-secondary)' }}>{assignee.name}</strong>
            </span>
            {task.created_at && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={13} /> Tạo: {new Date(task.created_at).toLocaleDateString('vi-VN')}
              </span>
            )}
          </div>

          {/* Attachments */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {task.file_url && (
              <a href={task.file_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.78rem', color: 'var(--accent-primary)',
                background: 'rgba(6,182,212,0.1)', padding: '0.3rem 0.7rem',
                borderRadius: '6px', textDecoration: 'none', border: '1px solid rgba(6,182,212,0.2)',
              }}>
                <Paperclip size={13} /> Tài liệu yêu cầu
              </a>
            )}
            {task.submission_file_url && (
              <a href={task.submission_file_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.78rem', color: 'var(--accent-secondary)',
                background: 'rgba(139,92,246,0.1)', padding: '0.3rem 0.7rem',
                borderRadius: '6px', textDecoration: 'none', border: '1px solid rgba(139,92,246,0.2)',
              }}>
                <FileText size={13} /> Báo cáo đã nộp
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
            {isAssignee && task.status === 'OPEN' && (
              <Btn variant="primary" onClick={() => onUpdateStatus(task.task_id, 'IN_PROGRESS')}>
                <RotateCcw size={13} /> Bắt đầu
              </Btn>
            )}
            {isAssignee && task.status === 'IN_PROGRESS' && (
              <Btn variant="warning" onClick={() => onSubmit(task)}>
                <CheckCircle2 size={13} /> Gửi duyệt
              </Btn>
            )}
            {(isReporter || isAdmin) && task.status === 'IN_REVIEW' && (
              <>
                <Btn variant="danger" onClick={() => onUpdateStatus(task.task_id, 'IN_PROGRESS')}>
                  Từ chối
                </Btn>
                <Btn variant="success" onClick={() => onUpdateStatus(task.task_id, 'COMPLETED')}>
                  <CheckCircle2 size={13} /> Duyệt
                </Btn>
              </>
            )}
            {currentUser?.role === 'MANAGER' && isAssignee && task.status === 'IN_PROGRESS' && !task.parent_task_id && (
              <Btn variant="dashed" onClick={() => onAddSubtask(task.task_id)}>
                <Plus size={13} /> Thêm việc con
              </Btn>
            )}
            {(isReporter || isAdmin) && !['COMPLETED', 'CANCELLED'].includes(task.status) && (
              <Btn variant="dashed" onClick={() => onEdit(task)}>
                <Edit2 size={13} /> Sửa
              </Btn>
            )}
            {(isReporter || isAdmin) && (
              <Btn variant="danger" style={{ background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--accent-danger)' }} onClick={() => onDelete(task)}>
                <Trash2 size={13} /> Xóa
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [detailTask, setDetailTask] = useState(null); // detail drawer

  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignee_id: '', priority: 'MEDIUM', due_date: '', parent_task_id: null, task_type: 'STANDARD', department: '', category: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Submit modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [taskToSubmit, setTaskToSubmit] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionNote, setSubmissionNote] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users?limit=1000`);
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data?.items || [];
      setUsers(list);
      if (!currentUser && list.length > 0) {
        setCurrentUser(list.find(u => u.role === 'ADMIN') || list[0]);
      }
    } catch (e) { console.error(e); }
  };

  const fetchTasks = async (loadMore = false) => {
    if (loadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let url = `${API_BASE}/tasks?limit=30`;
      if (loadMore && cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
      if (filterPriority !== 'ALL') url += `&priority=${filterPriority}`;
      if (searchQ) url += `&search=${encodeURIComponent(searchQ)}`;

      // If not admin, filter by user_id
      if (currentUser && currentUser.role !== 'ADMIN') {
        url += `&user_id=${currentUser.user_id}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      const newItems = data.data?.items || [];
      if (loadMore) {
        setTasks(prev => [...prev, ...newItems]);
        if (newItems.length > 0) setCurrentPage(prev => prev + 1);
      } else {
        setTasks(newItems);
        setCurrentPage(1);
      }

      setCursor(data.data?.next_key);
      setHasMore(!!data.data?.next_key);
    } catch (e) { console.error(e); }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      fetchTasks(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [currentUser, filterStatus, filterPriority, searchQ]);

  const handleSaveTask = async () => {
    if (!newTask.title) return alert('Vui lòng điền tiêu đề');
    if (newTask.task_type === 'STANDARD' && !newTask.assignee_id) return alert('Công việc thường bắt buộc phải chọn người nhận việc');
    if (newTask.task_type === 'INCIDENT' && !newTask.department) return alert('Báo cáo sự cố bắt buộc phải chọn phòng ban xử lý');
    setUploading(true);
    let finalFileUrl = null;

    if (selectedFile) {
      try {
        const pr = await fetch(`${API_BASE}/tasks/upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: selectedFile.name, file_type: selectedFile.type }) });
        const prd = await pr.json();
        if (prd.success) {
          await fetch(prd.data.upload_url, { method: 'PUT', headers: { 'Content-Type': selectedFile.type }, body: selectedFile });
          finalFileUrl = prd.data.public_url;
        }
      } catch (e) { alert('Lỗi upload file!'); setUploading(false); return; }
    }

    try {
      const url = editTaskId ? `${API_BASE}/tasks/${editTaskId}` : `${API_BASE}/tasks`;
      const method = editTaskId ? 'PATCH' : 'POST';
      const body = { ...newTask };
      if (!editTaskId) body.reporter_id = currentUser.user_id;
      if (finalFileUrl) body.file_url = finalFileUrl;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.user_id },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowModal(false);
        setNewTask({ title: '', description: '', assignee_id: '', priority: 'MEDIUM', due_date: '', parent_task_id: null, task_type: 'STANDARD', department: '', category: '' });
        setSelectedFile(null);
        setEditTaskId(null);
        fetchTasks(false);
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.message || 'Không thể lưu công việc'}`);
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const updateStatus = async (taskId, newStatus) => {
    try {
      await fetch(`${API_BASE}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.user_id },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks(false);
    } catch (e) { console.error(e); }
  };

  const handleSubmitTask = async () => {
    if (!taskToSubmit) return;
    setSubmitting(true);
    let finalFileUrl = null;

    if (submissionFile) {
      try {
        const pr = await fetch(`${API_BASE}/tasks/upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_name: submissionFile.name, file_type: submissionFile.type }) });
        const prd = await pr.json();
        if (prd.success) {
          await fetch(prd.data.upload_url, { method: 'PUT', headers: { 'Content-Type': submissionFile.type }, body: submissionFile });
          finalFileUrl = prd.data.public_url;
        }
      } catch (e) { alert('Lỗi upload file báo cáo!'); setSubmitting(false); return; }
    }

    try {
      const res = await fetch(`${API_BASE}/tasks/${taskToSubmit.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.user_id },
        body: JSON.stringify({ status: 'IN_REVIEW', submission_file_url: finalFileUrl, submission_note: submissionNote })
      });
      if (res.ok) { setShowSubmitModal(false); setTaskToSubmit(null); setSubmissionFile(null); setSubmissionNote(''); fetchTasks(false); }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const openSubtaskModal = (parentTaskId) => {
    const parent = tasks.find(t => t.task_id === parentTaskId);
    setNewTask({
      title: '',
      description: '',
      assignee_id: '',
      priority: 'MEDIUM',
      due_date: '',
      parent_task_id: parentTaskId,
      task_type: parent?.task_type || 'STANDARD',
      department: parent?.department || ''
    });
    setShowModal(true);
  };

  const getAvailableAssignees = () => {
    if (!currentUser) return [];

    let candidates = [];
    if (currentUser.role === 'ADMIN' || currentUser.role === 'DIRECTOR') candidates = users.filter(u => u.role === 'MANAGER');
    else if (currentUser.role === 'MANAGER') candidates = users.filter(u => u.role === 'STAFF' || u.role === 'SECURITY' || u.role === 'MAINTENANCE');

    if (newTask.department) {
      candidates = candidates.filter(u => u.department === newTask.department);
    }

    return candidates;
  };

  const handleEditTask = (task) => {
    setNewTask({
      title: task.title,
      description: task.description || '',
      assignee_id: task.assignee_id || '',
      priority: task.priority || 'MEDIUM',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      parent_task_id: task.parent_task_id || null,
      task_type: task.task_type || 'STANDARD',
      department: task.department || '',
      category: task.category || ''
    });
    setEditTaskId(task.task_id);
    setShowModal(true);
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa/hủy công việc "${task.title}" không?`)) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${task.task_id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': currentUser.user_id }
      });
      if (res.ok) {
        fetchTasks(false);
      } else {
        const err = await res.json();
        alert(`Lỗi: ${err.message || 'Không thể xóa công việc'}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter pipeline (moved to backend)
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(tasks.length / ITEMS_PER_PAGE);
  const visibleTasks = tasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const inputStyle = { background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.7rem 1rem', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.9rem', width: '100%', outline: 'none' };
  const labelStyle = { fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.6rem' }}>
            <CheckSquare size={26} color="var(--accent-primary)" /> Quản lý Công việc
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.9rem' }}>Giao việc và theo dõi tiến độ nhân viên</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mock role switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.45rem 0.9rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Đóng vai:</span>
            <select
              value={currentUser?.user_id || ''}
              onChange={e => setCurrentUser(users.find(u => u.user_id === e.target.value))}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 700, outline: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              {users.map(u => (
                <option key={u.user_id} value={u.user_id} style={{ color: '#000' }}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') && (
            <Btn variant="primary" size="md" onClick={() => { setNewTask({ title: '', description: '', assignee_id: '', priority: 'MEDIUM', due_date: '', parent_task_id: null }); setShowModal(true); }}>
              <Plus size={16} /> Giao việc
            </Btn>
          )}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Tìm kiếm công việc..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.2rem', padding: '0.55rem 0.9rem 0.55rem 2.2rem' }}
          />
        </div>

        {/* Priority filter */}
        <div style={{ position: 'relative' }}>
          <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            style={{ ...inputStyle, width: 'auto', paddingLeft: '2rem', appearance: 'none', cursor: 'pointer', paddingRight: '1.5rem' }}
          >
            <option value="ALL">Tất cả ưu tiên</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k} style={{ color: '#000' }}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[['ALL', 'Tất cả'], ...Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])].map(([key, label]) => {
          const active = filterStatus === key;
          const sc = STATUS_CONFIG[key];
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer',
                fontWeight: active ? 700 : 500, fontSize: '0.85rem', fontFamily: 'inherit',
                background: active ? (sc ? sc.bg : 'rgba(6,182,212,0.15)') : 'rgba(255,255,255,0.04)',
                color: active ? (sc ? sc.color : 'var(--accent-primary)') : 'var(--text-muted)',
                border: active ? `1px solid ${sc ? sc.color : 'var(--accent-primary)'}40` : '1px solid rgba(255,255,255,0.07)',
                transition: 'all 0.2s',
              }}
            >
              {sc?.icon && <sc.icon size={13} />}
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Task list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
            <p style={{ margin: 0 }}>Đang tải danh sách công việc...</p>
          </div>
        ) : visibleTasks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <CheckSquare size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Không có công việc nào phù hợp</p>
          </div>
        ) : (
          <>
            {visibleTasks.map(task => (
              <TaskRow
                key={task.task_id}
                task={task}
                currentUser={currentUser}
                users={users}
                onUpdateStatus={updateStatus}
                onSubmit={t => { setTaskToSubmit(t); setShowSubmitModal(true); }}
                onAddSubtask={openSubtaskModal}
                onViewDetail={setDetailTask}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            ))}
            {tasks.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '1rem' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                      color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer'
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages && !hasMore}
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage(p => p + 1);
                    } else if (hasMore) {
                      fetchTasks(true);
                    }
                  }}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: (currentPage === totalPages && !hasMore) ? 'not-allowed' : 'pointer', opacity: (currentPage === totalPages && !hasMore) ? 0.5 : 1 }}>
                  {loadingMore && currentPage === totalPages ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '>'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {detailTask && (
        <TaskDetailDrawer
          task={detailTask}
          users={users}
          currentUser={currentUser}
          onClose={() => setDetailTask(null)}
          onUpdateStatus={(id, s) => { updateStatus(id, s); setDetailTask(null); }}
          onSubmit={t => { setTaskToSubmit(t); setShowSubmitModal(true); setDetailTask(null); }}
          onAddSubtask={id => { openSubtaskModal(id); setDetailTask(null); }}
        />
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{newTask.parent_task_id ? '↳ Tạo công việc con (Subtask)' : 'Giao việc mới'}</h3>

            <div><label style={labelStyle}>Tiêu đề công việc *</label>
              <input placeholder="Nhập tiêu đề..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} style={inputStyle} />
            </div>

            <div><label style={labelStyle}>Mô tả chi tiết</label>
              <textarea placeholder="Yêu cầu cụ thể..." value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Loại công việc *</label>
                <select
                  value={newTask.task_type}
                  onChange={e => setNewTask({ ...newTask, task_type: e.target.value })}
                  disabled={!!newTask.parent_task_id}
                  style={{ ...inputStyle, appearance: 'none', cursor: newTask.parent_task_id ? 'not-allowed' : 'pointer', opacity: newTask.parent_task_id ? 0.7 : 1 }}
                >
                  <option value="STANDARD" style={{ color: '#000' }}>Công việc văn phòng</option>
                  <option value="INCIDENT" style={{ color: '#000' }}>Báo cáo sự cố / Yêu cầu bảo trì</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Phòng ban xử lý {newTask.task_type === 'INCIDENT' && '*'}</label>
                <select
                  value={newTask.department}
                  onChange={e => setNewTask({ ...newTask, department: e.target.value })}
                  disabled={!!newTask.parent_task_id}
                  style={{ ...inputStyle, appearance: 'none', cursor: newTask.parent_task_id ? 'not-allowed' : 'pointer', opacity: newTask.parent_task_id ? 0.7 : 1 }}
                >
                  <option value="" style={{ color: '#000' }}>-- Chọn phòng ban --</option>
                  <option value="IT" style={{ color: '#000' }}>IT (Công nghệ thông tin)</option>
                  <option value="MAINTENANCE" style={{ color: '#000' }}>Bảo trì (Maintenance)</option>
                  <option value="SECURITY" style={{ color: '#000' }}>Bảo vệ (Security)</option>
                  <option value="HR" style={{ color: '#000' }}>Nhân sự (HR)</option>
                  <option value="ADMIN" style={{ color: '#000' }}>Hành chính (Admin)</option>
                </select>
              </div>
            </div>

            {newTask.task_type === 'INCIDENT' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Phân loại sự cố</label>
                  <select value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ color: '#000' }}>-- Chọn loại sự cố --</option>
                    <option value="ELECTRIC" style={{ color: '#000' }}>Điện</option>
                    <option value="WATER" style={{ color: '#000' }}>Nước</option>
                    <option value="HVAC" style={{ color: '#000' }}>Điều hòa / Thông gió</option>
                    <option value="FURNITURE" style={{ color: '#000' }}>Nội thất / Bàn ghế</option>
                    <option value="NETWORK" style={{ color: '#000' }}>Mạng / Internet</option>
                    <option value="OTHER" style={{ color: '#000' }}>Khác</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Người thực hiện {newTask.task_type === 'STANDARD' ? '*' : '(Tùy chọn)'}</label>
                <div style={{ position: 'relative' }}>
                  <UserCheck size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <select value={newTask.assignee_id} onChange={e => setNewTask({ ...newTask, assignee_id: e.target.value })} style={{ ...inputStyle, paddingLeft: '2.2rem', appearance: 'none', cursor: 'pointer' }}>
                    <option value="">-- Chọn nhân viên --</option>
                    {getAvailableAssignees().map(u => (
                      <option key={u.user_id} value={u.user_id} style={{ color: '#000' }}>{u.name} – {u.role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Hạn chót (Due Date)</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} style={{ ...inputStyle, paddingLeft: '2.2rem' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Mức độ ưu tiên</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                  <button key={val} onClick={() => setNewTask({ ...newTask, priority: val })} style={{
                    flex: 1, padding: '0.5rem', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', fontFamily: 'inherit', transition: 'all 0.2s',
                    border: `1px solid ${newTask.priority === val ? cfg.color : 'rgba(255,255,255,0.1)'}`,
                    background: newTask.priority === val ? cfg.bg : 'transparent',
                    color: newTask.priority === val ? cfg.color : 'var(--text-muted)',
                  }}>{cfg.label}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tài liệu đính kèm (tùy chọn)</label>
              <label style={{ border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', display: 'block', background: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; if (e.dataTransfer.files && e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]); }}
              >
                <input type="file" style={{ display: 'none' }} onChange={e => setSelectedFile(e.target.files[0])} />
                {selectedFile ? (
                  <div style={{ color: 'var(--accent-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={22} />
                    <span style={{ fontWeight: 600 }}>{selectedFile.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={22} />
                    <span style={{ fontSize: '0.85rem' }}>Click để chọn file hoặc kéo thả</span>
                  </div>
                )}
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Btn variant="ghost" size="md" onClick={() => setShowModal(false)}>Hủy</Btn>
              <Btn variant="primary" size="md" onClick={handleCreateTask} disabled={uploading}>
                {uploading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Đang gửi...</> : 'Xác nhận giao việc'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Task Modal ── */}
      {showSubmitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>Nộp kết quả công việc</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Tải lên file báo cáo và điền ghi chú kết quả trước khi gửi duyệt.
            </p>

            <label style={{ border: '2px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', display: 'block', background: 'rgba(255,255,255,0.02)', transition: 'border-color 0.2s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; if (e.dataTransfer.files && e.dataTransfer.files[0]) setSubmissionFile(e.dataTransfer.files[0]); }}
            >
              <input type="file" style={{ display: 'none' }} onChange={e => setSubmissionFile(e.target.files[0])} />
              {submissionFile ? (
                <div style={{ color: 'var(--accent-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={22} /><span style={{ fontWeight: 600 }}>{submissionFile.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(submissionFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={22} /><span style={{ fontSize: '0.85rem' }}>Click hoặc kéo thả file báo cáo</span>
                </div>
              )}
            </label>

            {/* Note textarea */}
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'block' }}>
                Ghi chú / Tóm tắt kết quả
              </label>
              <textarea
                placeholder="Mô tả ngắn những gì đã làm, kết quả đạt được, vấn đề gặp phải..."
                value={submissionNote}
                onChange={e => setSubmissionNote(e.target.value)}
                rows={3}
                style={{
                  background: 'rgba(15,23,42,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '0.7rem 1rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  width: '100%',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Btn variant="ghost" size="md" onClick={() => setShowSubmitModal(false)}>Hủy</Btn>
              <Btn variant="warning" size="md" onClick={handleSubmitTask} disabled={submitting}>
                {submitting ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Đang nộp...</> : <><CheckCircle2 size={14} /> Gửi duyệt</>}
              </Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
