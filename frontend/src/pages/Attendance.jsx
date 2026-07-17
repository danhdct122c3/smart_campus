import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, CheckCircle, XCircle, AlertTriangle, Clock, Users, RefreshCw, Loader, Shield, ScanFace, List } from 'lucide-react';
import Card from '../components/Card';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const CAMERA_ID = 'CAM-MAIN-001';
const ROOM_ID = 'ROOM-A101';

// ----- Status badge helper -----
const StatusBadge = ({ status }) => {
  const map = {
    PRESENT:   { variant: 'success',  label: 'Đúng giờ' },
    LATE:      { variant: 'warning',  label: 'Muộn' },
    INACTIVE:  { variant: 'default',  label: 'Không hoạt động' },
    REJECTED:  { variant: 'danger',   label: 'Từ chối' },
    DUPLICATE: { variant: 'info',     label: 'Trùng lặp' },
  };
  const cfg = map[status] || { variant: 'default', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

// ----- Format timestamp -----
const formatTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
};

// ========================================================
export default function Attendance() {
  // webcam
  const videoRef    = useRef(null);
  const [stream,    setStream]    = useState(null);
  const [camActive, setCamActive] = useState(false);
  const [camError,  setCamError]  = useState('');

  // recognition
  const [scanning,     setScanning]     = useState(false);
  const [lastResult,   setLastResult]   = useState(null);   // { success, message, attendance, user }
  const [resultType,   setResultType]   = useState(null);   // 'success' | 'error' | 'warning'
  const [autoScan,     setAutoScan]     = useState(false);
  const autoScanRef    = useRef(false);

  // history
  const [history,     setHistory]     = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // today string
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'raw'

  // ---------- Camera ----------
  const startCamera = async () => {
    setCamError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setStream(s);
      setCamActive(true);
    } catch (e) {
      setCamError('Không thể mở Camera: ' + e.message);
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream, camActive]);

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setCamActive(false);
    setAutoScan(false);
    autoScanRef.current = false;
  };

  const toggleAutoScan = () => {
    setAutoScan(prev => !prev);
  };

  // ---------- Capture + Recognize ----------
  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || scanning) return;
    setScanning(true);

    const canvas = document.createElement('canvas');
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const res = await fetch(`${API_BASE}/attendance/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          camera_id: CAMERA_ID,
          room_id: ROOM_ID,
          timestamp: new Date().toISOString(),
        }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const data = json.data;
        if (data.success) {
          // Fetch user info to show name
          let userInfo = null;
          try {
            const ur = await fetch(`${API_BASE}/users/${data.attendance?.user_id}`);
            if (ur.ok) { const uj = await ur.json(); userInfo = uj.data; }
          } catch { /* non-critical */ }

          setLastResult({ ...data, user: userInfo });
          setResultType(data.attendance?.is_duplicate ? 'warning' : 'success');
          fetchHistory(); // refresh history
        } else {
          setLastResult({ ...data, user: null });
          setResultType('warning');
        }
      } else {
        const msg = json.message || 'Lỗi không xác định';
        setLastResult({ success: false, message: msg, attendance: null, user: null });
        setResultType('error');
      }
    } catch (e) {
      setLastResult({ success: false, message: 'Không kết nối được backend: ' + e.message, attendance: null, user: null });
      setResultType('error');
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  // ---------- Auto scan every 3s ----------
  useEffect(() => {
    autoScanRef.current = autoScan;
  }, [autoScan]);

  useEffect(() => {
    if (!autoScan || !camActive) return;
    const iv = setInterval(() => {
      if (autoScanRef.current) captureAndRecognize();
    }, 3500);
    return () => clearInterval(iv);
  }, [autoScan, camActive, captureAndRecognize]);

  // ---------- History ----------
  const fetchHistory = async () => {
    setLoadingHist(true);
    try {
      const res = await fetch(`${API_BASE}/attendance?date=${selectedDate}`);
      const json = await res.json();
      if (res.ok && json.data) setHistory(json.data.items || []);
    } catch { /* ignore */ }
    finally { setLoadingHist(false); }
  };

  useEffect(() => { fetchHistory(); }, [selectedDate]);

  // Aggregation for Check-in / Check-out
  const aggregatedHistory = React.useMemo(() => {
    const map = {};
    history.forEach(item => {
      const uid = item.userId;
      if (!map[uid]) map[uid] = { userId: uid, events: [] };
      map[uid].events.push(item);
    });

    return Object.values(map).map(userLog => {
      userLog.events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const first = userLog.events[0];
      const last = userLog.events[userLog.events.length - 1];
      
      const checkInTime = first.timestamp;
      const checkOutTime = userLog.events.length > 1 ? last.timestamp : null;
      
      let workDuration = '—';
      if (checkOutTime) {
        const diffMs = new Date(checkOutTime) - new Date(checkInTime);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        workDuration = `${diffHrs}h ${diffMins}m`;
      }

      return {
        userId: userLog.userId,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        duration: workDuration,
        status: last.status, 
        confidence: last.confidence
      };
    });
  }, [history]);

  // ---------- Cleanup ----------
  useEffect(() => () => { if (stream) stream.getTracks().forEach(t => t.stop()); }, [stream]);

  // ======================== RENDER ========================
  const resultIcon = resultType === 'success'
    ? <CheckCircle size={32} color="var(--accent-success)" />
    : resultType === 'warning'
    ? <AlertTriangle size={32} color="var(--accent-warning)" />
    : <XCircle size={32} color="var(--accent-danger)" />;

  const resultBg = resultType === 'success'
    ? 'rgba(16,185,129,0.08)'
    : resultType === 'warning'
    ? 'rgba(245,158,11,0.08)'
    : 'rgba(239,68,68,0.08)';

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%' }}>

      {/* Header */}
      <PageHeader
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={22} color="var(--accent-primary)" />
            Điểm danh Khuôn mặt
          </span>
        }
        description={`Hôm nay: ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      >
        <Badge variant="info">📍 {ROOM_ID}</Badge>
        <Badge variant="default" style={{ borderColor: 'var(--accent-secondary)', color: 'var(--accent-secondary)' }}>🎥 {CAMERA_ID}</Badge>
      </PageHeader>

      {/* Main content: Camera + Result side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* ---- Camera Panel ---- */}
        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>📷 Camera Nhận diện</h2>
            {camActive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--accent-success)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                LIVE
              </span>
            )}
          </div>

          {/* Video frame */}
          <div style={{
            width: '100%', aspectRatio: '4/3', background: '#0a0f1e',
            borderRadius: '12px', overflow: 'hidden', position: 'relative',
            border: camActive ? '2px solid var(--accent-primary)' : '2px solid var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {scanning && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: 'rgba(6,182,212,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '0.75rem',
              }}>
                <Loader size={36} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.875rem' }}>Đang nhận diện...</p>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: camActive ? 'block' : 'none' }}
            />
            {!camActive && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                <CameraOff size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p style={{ fontSize: '0.875rem' }}>Camera chưa được bật</p>
              </div>
            )}
            {/* Corner scan guides */}
            {camActive && !scanning && (
              <>
                {[['0','0','borderTop','borderLeft'],['0','auto','borderTop','borderRight'],
                  ['auto','0','borderBottom','borderLeft'],['auto','auto','borderBottom','borderRight']].map(([t,r,bv,bh], i) => (
                  <div key={i} style={{
                    position:'absolute', top:t!=='auto'?16:undefined, right:r!=='auto'?16:undefined,
                    bottom:t==='auto'?16:undefined, left:r==='auto'?16:undefined,
                    width:24, height:24,
                    [bv]: '2px solid var(--accent-primary)',
                    [bh]: '2px solid var(--accent-primary)',
                  }} />
                ))}
              </>
            )}
          </div>

          {camError && (
            <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', margin: 0 }}>⚠️ {camError}</p>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {!camActive ? (
              <Button variant="primary" icon={Camera} onClick={startCamera} style={{ flex: 1 }}>
                Bật Camera
              </Button>
            ) : (
              <>
                <Button 
                  variant="primary" 
                  icon={ScanFace} 
                  onClick={captureAndRecognize} 
                  disabled={scanning || autoScan} 
                  style={{ flex: 1 }}
                >
                  {scanning ? 'Đang quét...' : 'Nhận diện thủ công'}
                </Button>
                
                <Button 
                  variant={autoScan ? "danger" : "secondary"} 
                  icon={RefreshCw} 
                  onClick={toggleAutoScan}
                  disabled={scanning && !autoScan}
                >
                  {autoScan ? 'Dừng Tự động' : 'Tự động'}
                </Button>

                <Button variant="danger" icon={CameraOff} onClick={stopCamera} />
              </>
            )}
          </div>

          {autoScan && camActive && (
            <p style={{ fontSize: '0.75rem', color: 'var(--accent-success)', margin: 0, textAlign: 'center' }}>
              🔄 Đang tự động quét mỗi 3.5 giây...
            </p>
          )}
        </Card>

        {/* ---- Result Panel ---- */}
        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>🎯 Kết quả Nhận diện</h2>

          {!lastResult ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '1rem', padding: '3rem',
              border: '2px dashed var(--glass-border)', borderRadius: '12px', minHeight: '280px',
            }}>
              <Shield size={48} style={{ opacity: 0.2 }} />
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.875rem' }}>
                Bật camera và nhấn nhận diện để bắt đầu
              </p>
            </div>
          ) : (
            <div style={{
              flex: 1, background: resultBg, border: `1px solid ${
                resultType === 'success' ? 'rgba(16,185,129,0.3)'
                : resultType === 'warning' ? 'rgba(245,158,11,0.3)'
                : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '12px', padding: '1.5rem',
              display: 'flex', flexDirection: 'column', gap: '1rem',
            }}>
              {/* Status header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {resultIcon}
                <div>
                  <p style={{ fontWeight: 700, margin: 0, fontSize: '1rem' }}>
                    {resultType === 'success' ? 'Điểm danh thành công!' : resultType === 'warning' ? 'Cảnh báo' : 'Không nhận diện được'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    {lastResult.message}
                  </p>
                </div>
              </div>

              {/* User info card */}
              {lastResult.user && (
                <div style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                  padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 700, color: 'white', flexShrink: 0,
                  }}>
                    {(lastResult.user.name || 'U')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, margin: '0 0 2px', fontSize: '1rem', color: 'var(--text-primary)' }}>
                      {lastResult.user.name || '—'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>
                      {lastResult.user.employee_id || lastResult.user.user_id}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                      {lastResult.user.department || lastResult.user.role}
                    </p>
                  </div>
                </div>
              )}

              {/* Attendance details */}
              {lastResult.attendance && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Trạng thái', value: <StatusBadge status={lastResult.attendance.status} /> },
                    { label: 'Độ tin cậy', value: `${Number(lastResult.attendance.confidence || 0).toFixed(1)}%` },
                    { label: 'Ca học', value: lastResult.attendance.session_type || '—' },
                    { label: 'Thời gian', value: formatTime(lastResult.attendance.timestamp) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem' }}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
            {[
              { label: 'Tổng hôm nay', value: history.length, color: 'var(--accent-primary)' },
              { label: 'Đúng giờ', value: history.filter(h => h.status === 'PRESENT').length, color: 'var(--accent-success)' },
              { label: 'Muộn', value: history.filter(h => h.status === 'LATE').length, color: 'var(--accent-warning)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                padding: '0.75rem', textAlign: 'center', border: '1px solid var(--glass-border)',
              }}>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color, margin: '0 0 2px' }}>{value}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---- History Table ---- */}
      <Card style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="var(--accent-primary)" />
            Lịch sử Điểm danh
          </h2>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedDate === '' ? 'ALL' : 'DATE'}
              onChange={e => {
                if (e.target.value === 'ALL') setSelectedDate('');
                else setSelectedDate(todayStr);
              }}
              style={{ 
                padding: '0.4rem 0.75rem', height: '34px', fontSize: '0.8rem', 
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', 
                border: '1px solid var(--glass-border)', borderRadius: '6px' 
              }}
            >
              <option value="DATE">Xem theo ngày</option>
              <option value="ALL">Xem tất cả</option>
            </select>
            
            {selectedDate !== '' && (
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', height: '34px', fontSize: '0.8rem' }}
              />
            )}
            
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
              <button 
                onClick={() => setViewMode('summary')}
                style={{
                  background: viewMode === 'summary' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'summary' ? 'white' : 'var(--text-muted)',
                  border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600
                }}>
                <Users size={14} /> Log Vào/Ra
              </button>
              <button 
                onClick={() => setViewMode('raw')}
                style={{
                  background: viewMode === 'raw' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'raw' ? 'white' : 'var(--text-muted)',
                  border: 'none', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600
                }}>
                <List size={14} /> Lịch sử quét
              </button>
            </div>

            <Button variant="secondary" icon={RefreshCw} onClick={fetchHistory} disabled={loadingHist}>
              {loadingHist ? 'Đang tải...' : 'Làm mới'}
            </Button>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.875rem' }}>
              {selectedDate === '' ? 'Chưa có bất kỳ dữ liệu điểm danh nào.' : `Chưa có dữ liệu điểm danh cho ngày ${selectedDate}`}
            </p>
          </div>
        ) : viewMode === 'summary' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['#', 'Mã nhân sự', 'Giờ Vào (Check-in)', 'Giờ Ra (Check-out)', 'Thời gian làm', 'Trạng thái (gần nhất)'].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left',
                      color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aggregatedHistory.map((item, idx) => (
                  <tr key={item.userId} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s'
                  }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>{item.userId}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--accent-success)', fontFamily: 'monospace' }}>
                      {formatTime(item.checkIn)}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: item.checkOut ? 'var(--accent-warning)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {item.checkOut ? formatTime(item.checkOut) : 'Đang làm việc'}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                      {item.duration}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['#', 'Mã nhân sự', 'Ca học', 'Phòng', 'Độ tin cậy', 'Trạng thái', 'Thời gian'].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left',
                      color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={item.attendanceId || idx} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600 }}>{item.userId || '—'}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)' }}>{item.sessionType || '—'}</td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-secondary)' }}>{item.roomId || '—'}</td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <span style={{ color: 'var(--accent-primary)' }}>
                        {Number(item.confidence || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}><StatusBadge status={item.status} /></td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {formatTime(item.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
