import React, { useState, useEffect } from 'react';
import {
  CheckSquare, Clock, RotateCcw, CheckCircle2, AlertTriangle,
  FileText, Upload, Loader, User, Filter, ArrowRight, X,
  ChevronDown, Check, Send, Sparkles, Search, Calendar, Briefcase, Award
} from 'lucide-react';
import Card from '../components/Card';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const STATUS_CONFIG = {
  OPEN: { label: 'Cần làm', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.15)', icon: CheckSquare },
  TODO: { label: 'Cần làm', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.15)', icon: CheckSquare },
  IN_PROGRESS: { label: 'Đang thực hiện', color: 'var(--accent-primary)', bg: 'rgba(6,182,212,0.15)', icon: RotateCcw },
  IN_REVIEW: { label: 'Chờ duyệt', color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.15)', icon: Clock },
  COMPLETED: { label: 'Hoàn thành', color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle2 },
  DONE: { label: 'Hoàn thành', color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.15)', icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  URGENT: { label: 'Khẩn cấp', color: 'var(--accent-danger)', bg: 'rgba(239,68,68,0.15)' },
  HIGH: { label: 'Cao', color: 'var(--accent-warning)', bg: 'rgba(245,158,11,0.15)' },
  MEDIUM: { label: 'Trung bình', color: 'var(--accent-primary)', bg: 'rgba(6,182,212,0.15)' },
  LOW: { label: 'Thấp', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' },
};

const MyTasks = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Submit Modal State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [taskToSubmit, setTaskToSubmit] = useState(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Status updating state
  const [updatingId, setUpdatingId] = useState(null);

  // 1. Fetch Users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users?limit=100`);
        const json = await res.json();
        const userList = json.data?.items || [];
        setUsers(userList);
        
        // Try to pick stored user or first staff/security/maintenance user
        const stored = localStorage.getItem('my_tasks_user_id');
        const foundStored = userList.find(u => u.user_id === stored);
        if (foundStored) {
          setSelectedUser(foundStored);
        } else if (userList.length > 0) {
          const staffUser = userList.find(u => ['STAFF', 'SECURITY', 'MAINTENANCE'].includes(u.role)) || userList[0];
          setSelectedUser(staffUser);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    fetchUsers();
  }, []);

  // 2. Fetch User Tasks & Stats whenever selectedUser changes
  const fetchUserTasksAndStats = async (user) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/users/${user.user_id}/tasks`),
        fetch(`${API_BASE}/users/${user.user_id}/stats`)
      ]);

      if (!tasksRes.ok || !statsRes.ok) throw new Error('Không thể tải dữ liệu công việc');

      const tasksJson = await tasksRes.json();
      const statsJson = await statsRes.json();

      setTasks(tasksJson.data?.items || []);
      setStats(statsJson.data || null);
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi khi tải danh sách công việc cá nhân.');
      setTasks([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      localStorage.setItem('my_tasks_user_id', selectedUser.user_id);
      fetchUserTasksAndStats(selectedUser);
    }
  }, [selectedUser]);

  // Handle Quick Status Update (e.g., TODO -> IN_PROGRESS)
  const handleUpdateStatus = async (taskId, newStatus) => {
    if (!selectedUser) return;
    setUpdatingId(taskId);
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedUser.user_id
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        await fetchUserTasksAndStats(selectedUser);
      }
    } catch (err) {
      console.error('Update status error:', err);
      alert('Lỗi khi cập nhật trạng thái công việc!');
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Submit Task with File/Note
  const handleSubmitTask = async () => {
    if (!taskToSubmit || !selectedUser) return;
    setSubmitting(true);
    let finalFileUrl = null;

    if (submissionFile) {
      try {
        const pr = await fetch(`${API_BASE}/tasks/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_name: submissionFile.name, file_type: submissionFile.type })
        });
        const prd = await pr.json();
        if (prd.success && prd.data?.upload_url) {
          await fetch(prd.data.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': submissionFile.type },
            body: submissionFile
          });
          finalFileUrl = prd.data.public_url;
        }
      } catch (err) {
        console.error('File upload error:', err);
        alert('Lỗi khi tải file báo cáo!');
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/tasks/${taskToSubmit.task_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedUser.user_id
        },
        body: JSON.stringify({
          status: 'IN_REVIEW',
          submission_file_url: finalFileUrl,
          submission_note: submissionNote
        })
      });

      if (res.ok) {
        setShowSubmitModal(false);
        setTaskToSubmit(null);
        setSubmissionFile(null);
        setSubmissionNote('');
        await fetchUserTasksAndStats(selectedUser);
      } else {
        alert('Có lỗi khi nộp kết quả công việc.');
      }
    } catch (err) {
      console.error('Submit task error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter tasks based on Tab & Search
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'ALL') return true;
    if (activeTab === 'TODO') return ['OPEN', 'TODO'].includes(t.status);
    if (activeTab === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (activeTab === 'IN_REVIEW') return t.status === 'IN_REVIEW';
    if (activeTab === 'COMPLETED') return ['COMPLETED', 'DONE'].includes(t.status);
    return true;
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* ── Header & User Selector ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
        gap: '1rem', background: 'var(--bg-panel)', padding: '1.25rem 1.5rem',
        borderRadius: '16px', border: '1px solid var(--glass-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
      }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Briefcase color="var(--accent-primary)" /> Giao việc & Nộp báo cáo cá nhân
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Cổng Self-Service tối giản: Nhận nhiệm vụ, cập nhật tiến độ và nộp kết quả chỉ với 1 chạm.
          </p>
        </div>

        {/* User Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>
            {selectedUser ? selectedUser.name?.charAt(0).toUpperCase() : '?'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Nhân viên hiện tại</span>
            <select
              value={selectedUser?.user_id || ''}
              onChange={e => {
                const u = users.find(usr => usr.user_id === e.target.value);
                if (u) setSelectedUser(u);
              }}
              style={{
                background: 'transparent', border: 'none', color: '#fff',
                fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', outline: 'none', padding: 0
              }}
            >
              {users.map(u => (
                <option key={u.user_id} value={u.user_id} style={{ background: '#0f172a', color: '#fff' }}>
                  {u.name} ({u.role}) - {u.department || 'Chung'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-primary)' }}>
              <Briefcase size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TỔNG CÔNG VIỆC</p>
              <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: 700 }}>{stats.total_tasks}</h2>
            </div>
          </Card>

          <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-warning)' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)' }}>
              <RotateCcw size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐANG THỰC HIỆN</p>
              <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: 700 }}>{stats.in_progress}</h2>
            </div>
          </Card>

          <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--accent-success)' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-success)' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐÃ HOÀN THÀNH</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: 700 }}>{stats.done}</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-success)', fontWeight: 600 }}>({stats.completion_rate}%)</span>
              </div>
            </div>
          </Card>

          <Card style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: `4px solid ${stats.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-muted)'}` }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: stats.overdue > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)', color: stats.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: stats.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-muted)', fontWeight: 600 }}>VIỆC QUÁ HẠN</p>
              <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: stats.overdue > 0 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                {stats.overdue}
              </h2>
            </div>
          </Card>
        </div>
      )}

      {/* ── Filter Tabs & Search Bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.35rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          {[
            { id: 'ALL', label: 'Tất cả', count: tasks.length },
            { id: 'TODO', label: 'Cần làm', count: tasks.filter(t => ['OPEN', 'TODO'].includes(t.status)).length },
            { id: 'IN_PROGRESS', label: 'Đang làm', count: tasks.filter(t => t.status === 'IN_PROGRESS').length },
            { id: 'IN_REVIEW', label: 'Chờ duyệt', count: tasks.filter(t => t.status === 'IN_REVIEW').length },
            { id: 'COMPLETED', label: 'Hoàn thành', count: tasks.filter(t => ['COMPLETED', 'DONE'].includes(t.status)).length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s'
              }}
            >
              {tab.label}
              <span style={{
                padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.72rem',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)',
                color: '#fff'
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Tìm kiếm công việc..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px',
              background: 'rgba(15,23,42,0.6)', border: '1px solid var(--glass-border)',
              color: '#fff', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* ── Task List Section ── */}
      {loading ? (
        <Card style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem', color: 'var(--accent-primary)' }} />
          <p style={{ fontSize: '1rem' }}>Đang tải danh sách công việc cá nhân...</p>
        </Card>
      ) : error ? (
        <Card style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-danger)' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>{error}</p>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-secondary)' }}>Không tìm thấy công việc nào</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Hiện chưa có công việc thuộc bộ lọc hoặc từ khóa tìm kiếm này.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredTasks.map(task => {
            const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.OPEN;
            const pr = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
            const isOverdue = task.due_date && task.due_date < todayStr && !['COMPLETED', 'DONE', 'CANCELLED'].includes(task.status);
            const isUpdatingThis = updatingId === task.task_id;

            return (
              <Card key={task.task_id} style={{
                padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between',
                borderTop: `3px solid ${pr.color}`, position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div>
                  {/* Card Header Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700,
                      background: st.bg, color: st.color
                    }}>
                      {st.icon && <st.icon size={12} />}
                      {st.label}
                    </span>

                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                      background: pr.bg, color: pr.color
                    }}>
                      {pr.label}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {task.title}
                  </h3>
                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, minHeight: '42px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {task.description || 'Không có mô tả chi tiết cho công việc này.'}
                  </p>

                  {/* Task Meta Info */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: isOverdue ? 'var(--accent-danger)' : 'var(--text-secondary)' }}>
                      <Calendar size={15} color={isOverdue ? 'var(--accent-danger)' : 'var(--text-muted)'} />
                      <span style={{ fontWeight: isOverdue ? 700 : 400 }}>
                        {task.due_date ? `Hạn: ${task.due_date}` : 'Không thời hạn'}
                      </span>
                      {isOverdue && <span style={{ fontSize: '0.72rem', background: 'rgba(239,68,68,0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>⚠️ Quá hạn</span>}
                    </div>

                    {task.department && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                        <Briefcase size={15} color="var(--text-muted)" />
                        <span>Khoa/Phòng: {task.department}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons (One-touch Mobile-First) */}
                <div style={{ marginTop: 'auto' }}>
                  {['OPEN', 'TODO'].includes(task.status) && (
                    <button
                      onClick={() => handleUpdateStatus(task.task_id, 'IN_PROGRESS')}
                      disabled={isUpdatingThis}
                      style={{
                        width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, var(--accent-primary), #3b82f6)',
                        color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: isUpdatingThis ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(6,182,212,0.25)', transition: 'all 0.2s', opacity: isUpdatingThis ? 0.7 : 1
                      }}
                    >
                      {isUpdatingThis ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang cập nhật...</> : <>🚀 Nhận việc (Bắt đầu làm) <ArrowRight size={16} /></>}
                    </button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => { setTaskToSubmit(task); setShowSubmitModal(true); }}
                      style={{
                        width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, var(--accent-warning), #f97316)',
                        color: '#000', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(245,158,11,0.25)', transition: 'all 0.2s'
                      }}
                    >
                      📤 Nộp kết quả báo cáo
                    </button>
                  )}

                  {task.status === 'IN_REVIEW' && (
                    <div style={{
                      padding: '0.7rem', borderRadius: '10px', background: 'rgba(245,158,11,0.1)',
                      border: '1px dashed rgba(245,158,11,0.4)', color: 'var(--accent-warning)',
                      textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}>
                      <Clock size={16} /> Đang chờ quản lý kiểm duyệt & đánh giá
                    </div>
                  )}

                  {['COMPLETED', 'DONE'].includes(task.status) && (
                    <div style={{
                      padding: '0.7rem', borderRadius: '10px', background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)',
                      textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}>
                      <CheckCircle2 size={16} /> Đã hoàn thành nhiệm vụ
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Submit Result Modal ── */}
      {showSubmitModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--glass-border)',
            borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '450px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '1.25rem',
            position: 'relative'
          }}>
            <button onClick={() => setShowSubmitModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <div>
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.3rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📤 Nộp kết quả công việc
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nhiệm vụ: <strong style={{ color: '#fff' }}>{taskToSubmit?.title}</strong>
              </p>
            </div>

            {/* Drag & Drop File Upload */}
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Tải lên file báo cáo / hình ảnh minh chứng
              </label>
              <label style={{
                border: '2px dashed rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1.5rem',
                textAlign: 'center', cursor: 'pointer', display: 'block', background: 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; if (e.dataTransfer.files && e.dataTransfer.files[0]) setSubmissionFile(e.dataTransfer.files[0]); }}
              >
                <input type="file" style={{ display: 'none' }} onChange={e => setSubmissionFile(e.target.files[0])} />
                {submissionFile ? (
                  <div style={{ color: 'var(--accent-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <FileText size={28} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{submissionFile.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{(submissionFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload size={28} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>Click chọn file hoặc kéo thả vào đây</span>
                    <span style={{ fontSize: '0.75rem' }}>Hỗ trợ PDF, DOCX, PNG, JPG (Tối đa 25MB)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Note Textarea */}
            <div>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block', fontWeight: 600 }}>
                Ghi chú thực hiện / Kết quả đạt được
              </label>
              <textarea
                placeholder="Mô tả tóm tắt kết quả công việc đã thực hiện..."
                value={submissionNote}
                onChange={e => setSubmissionNote(e.target.value)}
                rows={4}
                style={{
                  width: '100%', background: 'rgba(15,23,42,0.7)', border: '1px solid var(--glass-border)',
                  borderRadius: '10px', padding: '0.75rem 1rem', color: 'var(--text-primary)',
                  fontFamily: 'inherit', fontSize: '0.875rem', resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box', lineHeight: 1.5
                }}
              />
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setShowSubmitModal(false)}
                style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 600 }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSubmitTask}
                disabled={submitting}
                style={{
                  padding: '0.6rem 1.5rem', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, var(--accent-success), #10b981)',
                  color: '#fff', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang gửi...</> : <><CheckCircle2 size={16} /> Gửi trình duyệt</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MyTasks;
