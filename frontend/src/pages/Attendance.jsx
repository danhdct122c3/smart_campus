import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraOff, CheckCircle, XCircle, AlertTriangle, Clock, Users, RefreshCw, Loader, Shield, Wifi, Plus, ShieldCheck, LogOut } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';


const API_BASE = 'https://d2utvhhrx300xg.cloudfront.net/api';


// ----- Status badge helper -----
const StatusBadge = ({ status }) => {
  const map = {
    PRESENT: { color: 'var(--accent-success)', label: 'Đúng giờ' },
    LATE: { color: 'var(--accent-warning)', label: 'Muộn' },
    INACTIVE: { color: 'var(--text-muted)', label: 'Không hoạt động' },
    REJECTED: { color: 'var(--accent-danger)', label: 'Từ chối' },
    DUPLICATE: { color: '#06b6d4', label: 'Trùng lặp' },
  };
  const cfg = map[status] || { color: 'var(--text-muted)', label: status };
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, padding: '2px 10px', borderRadius: '999px',
      background: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}55`,
    }}>
      {cfg.label}
    </span>
  );
};

// ----- Format timestamp -----
const formatTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
};

// ----- Checkout window helper (16:30–18:30 VN) -----
const isInCheckoutWindow = () => {
  const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const total = vnNow.getHours() * 60 + vnNow.getMinutes();
  return total >= 16 * 60 + 30 && total <= 18 * 60 + 30;
};

const timeUntilCheckout = () => {
  const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const total = vnNow.getHours() * 60 + vnNow.getMinutes();
  const target = 16 * 60 + 30;
  if (total >= target) return null;
  const diff = target - total;
  return `${Math.floor(diff / 60)}h${diff % 60 > 0 ? (diff % 60) + 'p' : ''}`;
};

// ========================================================
export default function Attendance() {
  // Auth context
  const { currentUser, updateUser } = useAuth();
  const [registering, setRegistering] = useState(false);

  // webcam
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState('');

  // recognition
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);   // { success, message, attendance, user }
  const [resultType, setResultType] = useState(null);   // 'success' | 'error' | 'warning'
  const [autoScan, setAutoScan] = useState(false);
  const autoScanRef = useRef(false);

  // history
  const [history, setHistory] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // checkout
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [proxyCheckoutLoading, setProxyCheckoutLoading] = useState('');
  const [inWindow, setInWindow] = useState(isInCheckoutWindow());

  // today string
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  const fetchHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const res = await fetch(`${API_BASE}/attendance?date=${todayStr}&user_id=${currentUser?.user_id || ''}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data?.items || []);
      }
    } catch (e) {
      console.error('Fetch history error:', e);
    } finally {
      setLoadingHist(false);
    }
  }, [todayStr, currentUser]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refresh checkout window state every minute
  useEffect(() => {
    const timer = setInterval(() => setInWindow(isInCheckoutWindow()), 60000);
    return () => clearInterval(timer);
  }, []);

  // ---------- Checkout handlers ----------
  const handleCheckout = useCallback(async () => {
    if (!currentUser?.user_id || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutResult(null);
    try {
      const res = await fetch(`${API_BASE}/attendance/checkout?user_id=${currentUser.user_id}`, { method: 'POST' });
      const json = await res.json();
      const data = json.data || {};
      setCheckoutResult({ success: data.success, message: data.message, checkout_time: data.checkout_time });
      if (data.success) fetchHistory();
    } catch (e) {
      setCheckoutResult({ success: false, message: 'Lỗi kết nối: ' + e.message });
    } finally {
      setCheckoutLoading(false);
    }
  }, [currentUser, checkoutLoading, fetchHistory]);

  const handleProxyCheckout = useCallback(async (targetUserId) => {
    if (!currentUser?.role || proxyCheckoutLoading) return;
    setProxyCheckoutLoading(targetUserId);
    try {
      const res = await fetch(
        `${API_BASE}/attendance/checkout/proxy?target_user_id=${targetUserId}&requester_role=${currentUser.role}`,
        { method: 'POST' }
      );
      const json = await res.json();
      const data = json.data || {};
      if (data.success) {
        fetchHistory();
        alert(`✅ Checkout hộ thành công cho người dùng!`);
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (e) {
      alert('Lỗi kết nối: ' + e.message);
    } finally {
      setProxyCheckoutLoading('');
    }
  }, [currentUser, proxyCheckoutLoading, fetchHistory]);

  // ---------- Camera for Registration ----------
  const startCamera = async () => {
    setCamError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setStream(s);
      setCamActive(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch (e) {
      setCamError('Không thể mở Camera: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setCamActive(false);
  };



  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || scanning) return;
    setScanning(true);
    setCamError('');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const res = await fetch(`${API_BASE}/attendance/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          timestamp: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const data = json.data;
        if (data.success) {
          let userInfo = null;
          try {
            const ur = await fetch(`${API_BASE}/users/${data.attendance?.user_id}`);
            if (ur.ok) { const uj = await ur.json(); userInfo = uj.data; }
          } catch { }
          setLastResult({ ...data, user: userInfo });
          setResultType(data.attendance?.is_duplicate ? 'warning' : 'success');
          fetchHistory();
        } else {
          setLastResult({ ...data, user: null });
          setResultType('warning');
        }
      } else {
        const msg = json.message || 'Lỗi nhận diện';
        setLastResult({ success: false, message: msg, attendance: null, user: null });
        setResultType('error');
      }
    } catch (e) {
      const isBlocked = e.message.includes('Failed to fetch') || e.message.includes('NetworkError');
      setLastResult({ success: false, message: isBlocked ? 'Bị chặn kết nối: Vui lòng kết nối vào mạng WiFi công ty để điểm danh.' : 'Lỗi kết nối Backend: ' + e.message, attendance: null, user: null });
      setResultType('error');
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const captureAndRegister = useCallback(async () => {
    if (!videoRef.current || registering) return;
    setRegistering(true);
    setCamError('');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const res = await fetch(`${API_BASE}/faces/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          image_base64: imageBase64,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        updateUser({ ...currentUser, face_registered: true });
        setLastResult({ success: true, message: 'Đăng ký khuôn mặt thành công! Hệ thống đã ghi nhận mẫu khuôn mặt của bạn. Bạn đã có thể sử dụng tính năng Điểm danh ngay bây giờ.', attendance: null, user: currentUser });
        setResultType('success');
      } else {
        setCamError(json.message || 'Lỗi đăng ký khuôn mặt');
      }
    } catch (e) {
      const isBlocked = e.message.includes('Failed to fetch') || e.message.includes('NetworkError');
      setCamError(isBlocked ? 'Bị chặn kết nối: Vui lòng kết nối vào mạng WiFi công ty để đăng ký.' : 'Lỗi kết nối máy chủ: ' + e.message);
    } finally {
      setRegistering(false);
    }
  }, [registering, currentUser, updateUser]);

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

  // --- Admin WAF Network Management ---
  const [networks, setNetworks] = useState([]);
  const [currentWafIp, setCurrentWafIp] = useState(null);
  const [newNetName, setNewNetName] = useState('');
  const [newNetIp, setNewNetIp] = useState('');
  const [isAddingNet, setIsAddingNet] = useState(false);
  const [isApplyingIp, setIsApplyingIp] = useState('');
  const [wafMsg, setWafMsg] = useState(null);

  useEffect(() => {
    if (currentUser?.role?.toUpperCase() === 'ADMIN') {
      fetch(`${API_BASE}/security/networks`)
        .then(res => res.json())
        .then(data => { 
          if (data.data) {
            setNetworks(data.data.networks || []); 
            setCurrentWafIp(data.data.current_waf_ip);
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);

  const handleFetchCurrentIp = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      setNewNetIp(data.ip);
    } catch (err) {
      alert('Không thể tự động lấy IP: ' + err.message);
    }
  };

  const handleAddNetwork = async (e) => {
    e.preventDefault();
    if (!newNetName || !newNetIp) return;
    setIsAddingNet(true);
    setWafMsg(null);
    try {
      const res = await fetch(`${API_BASE}/security/networks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newNetName, ip: newNetIp })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setNetworks([...networks, data.data]);
        setNewNetName('');
        setNewNetIp('');
        setWafMsg({ success: true, text: 'Đã thêm mạng mới vào danh sách.' });
      } else throw new Error(data.message || 'Lỗi thêm mạng');
    } catch (err) {
      setWafMsg({ success: false, text: err.message });
    } finally { setIsAddingNet(false); }
  };

  const handleDeleteNetwork = async (netId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mạng này?")) return;
    try {
      const res = await fetch(`${API_BASE}/security/networks/${netId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNetworks(networks.filter(n => n.id !== netId));
        setWafMsg({ success: true, text: 'Đã xóa mạng thành công.' });
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi xóa mạng');
      }
    } catch (err) {
      setWafMsg({ success: false, text: err.message });
    }
  };

  const handleApplyWafIp = async (net) => {
    setIsApplyingIp(net.id);
    setWafMsg(null);
    try {
      const res = await fetch(`${API_BASE}/security/waf-ip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: net.ip })
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentWafIp(net.ip);
        setWafMsg({ success: true, text: `Áp dụng mạng "${net.name}" (${net.ip}) làm mạng Công ty thành công!` });
      } else throw new Error(data.message || 'Lỗi cập nhật WAF');
    } catch (err) {
      setWafMsg({ success: false, text: err.message });
    } finally { setIsApplyingIp(''); }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            <Camera size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent-primary)' }} />
            Đang bật camera
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Hôm nay: {new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

      </div>

      {/* Main content: Camera + Result side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* ---- Camera Panel ---- */}
        <Card style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{currentUser?.face_registered ? '📷 Nhận diện khuôn mặt' : '📸 Đăng ký Khuôn mặt lần đầu'}</h2>
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
            <>
              {!currentUser?.face_registered && camActive && !registering && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 10,
                  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '2rem', textAlign: 'center', pointerEvents: 'none'
                }}>
                  <div style={{ background: 'var(--accent-warning)', color: '#000', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Bắt buộc</div>
                  <p style={{ color: 'white', fontWeight: 600, fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>Tài khoản của bạn chưa có khuôn mặt</p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: 0 }}>Vui lòng ngồi thẳng, tháo khẩu trang và bấm nút Đăng ký bên dưới để chụp ảnh lưu vào hệ thống.</p>
                </div>
              )}
              {(scanning || registering) && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 11,
                  background: 'rgba(6,182,212,0.15)', backdropFilter: 'blur(4px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '0.75rem',
                }}>
                  <Loader size={40} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>{registering ? 'Đang trích xuất đặc trưng khuôn mặt...' : 'Đang nhận diện khuôn mặt...'}</p>
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
            </>
          </div>

          {camError && (
            <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', margin: 0 }}>⚠️ {camError}</p>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!currentUser?.face_registered ? (
              !camActive ? (
                <button id="btn-start-cam" onClick={startCamera} style={{
                  flex: 1, background: 'var(--accent-primary)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}>
                  <Camera size={18} /> Bật Camera
                </button>
              ) : (
                <>
                  <button id="btn-register-face" onClick={captureAndRegister} disabled={registering} style={{
                    flex: 2, background: registering ? 'rgba(16,185,129,0.4)' : 'var(--accent-success)',
                    color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.75rem', cursor: registering ? 'not-allowed' : 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                  }}>
                    {registering ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={18} />}
                    {registering ? 'Đang đăng ký...' : 'Chụp ảnh & Đăng ký khuôn mặt'}
                  </button>
                  <button onClick={stopCamera} style={{
                    background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                    padding: '0.75rem 1rem', cursor: 'pointer',
                  }}>
                    <CameraOff size={18} />
                  </button>
                </>
              )
            ) : (
              !camActive ? (
                <button onClick={startCamera} style={{
                  flex: 1, background: 'var(--bg-card-hover)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)',
                  borderRadius: '8px', padding: '0.75rem', cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minWidth: '140px'
                }}>
                  <Camera size={18} /> Điểm danh
                </button>
              ) : (
                <>
                  <button onClick={captureAndRecognize} disabled={scanning} style={{
                    flex: 2, background: scanning ? 'rgba(16,185,129,0.4)' : 'var(--accent-success)',
                    color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.75rem', cursor: scanning ? 'not-allowed' : 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                  }}>
                    {scanning ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={18} />}
                    {scanning ? 'Đang nhận diện...' : 'Chụp ảnh Điểm danh'}
                  </button>
                  <button onClick={stopCamera} style={{
                    background: 'rgba(239,68,68,0.1)', color: 'var(--accent-danger)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                    padding: '0.75rem 1rem', cursor: 'pointer',
                  }}>
                    <CameraOff size={18} />
                  </button>
                </>
              )
            )}
          </div>
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
              flex: 1, background: resultBg, border: `1px solid ${resultType === 'success' ? 'rgba(16,185,129,0.3)'
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

      {/* ---- Checkout Box ---- */}
      {(() => {
        const todayCheckin = history.find(r => r.status === 'PRESENT' || r.status === 'LATE');
        const alreadyCheckedOut = !!todayCheckin?.checkout_time;
        const canCheckout = inWindow && !!todayCheckin && !alreadyCheckedOut;
        const after1830 = (() => {
          const vnNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
          return vnNow.getHours() * 60 + vnNow.getMinutes() > 18 * 60 + 30;
        })();
        return (
          <Card style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
                <LogOut size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: '#f59e0b' }} />
                Checkout hôm nay
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cửa sổ checkout: 16:30 – 18:30</span>
            </div>

            {/* Checkin + Checkout time display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>⏰ Giờ Check-in</p>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: 'var(--accent-success)' }}>
                  {todayCheckin ? formatTime(todayCheckin.timestamp) : '—'}
                </p>
                {todayCheckin && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '2px 0 0' }}><StatusBadge status={todayCheckin.status} /></p>}
              </div>
              <div style={{ background: alreadyCheckedOut ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.03)', border: `1px solid ${alreadyCheckedOut ? 'rgba(245,158,11,0.25)' : 'var(--glass-border)'}`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>📤 Giờ Checkout</p>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0, color: alreadyCheckedOut ? '#f59e0b' : 'var(--text-muted)' }}>
                  {alreadyCheckedOut ? formatTime(todayCheckin.checkout_time) : '—'}
                </p>
              </div>
            </div>

            {/* Checkout button */}
            <button
              id="btn-checkout"
              onClick={handleCheckout}
              disabled={!canCheckout || checkoutLoading}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', fontWeight: 700,
                fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                border: 'none', cursor: canCheckout ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
                background: alreadyCheckedOut
                  ? 'rgba(245,158,11,0.1)'
                  : canCheckout
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'rgba(255,255,255,0.05)',
                color: alreadyCheckedOut ? '#f59e0b' : canCheckout ? 'white' : 'var(--text-muted)',
                boxShadow: canCheckout ? '0 4px 15px rgba(245,158,11,0.3)' : 'none',
                opacity: (!todayCheckin || alreadyCheckedOut) ? 0.7 : 1,
              }}
            >
              {checkoutLoading
                ? <><Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> Đang xử lý...</>
                : alreadyCheckedOut
                  ? <><CheckCircle size={18} /> Đã Checkout</>
                  : <><LogOut size={18} /> Checkout</>
              }
            </button>

            {/* Status hint */}
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', textAlign: 'center' }}>
              {!todayCheckin
                ? '⛔ Bạn chưa check-in hôm nay'
                : alreadyCheckedOut
                  ? `✅ Đã checkout lúc ${formatTime(todayCheckin.checkout_time)}`
                  : inWindow
                    ? '✅ Trong giờ checkout – nút đã sẵn sàng!'
                    : after1830
                      ? '⛔ Đã quá giờ checkout hôm nay (sau 18:30)'
                      : `⏳ Checkout mở lúc 16:30 (còn ${timeUntilCheckout() || '...'})`
              }
            </p>

            {/* Checkout result message */}
            {checkoutResult && (
              <div style={{
                marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem',
                background: checkoutResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${checkoutResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: checkoutResult.success ? 'var(--accent-success)' : 'var(--accent-danger)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                {checkoutResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {checkoutResult.message}
              </div>
            )}
          </Card>
        );
      })()}

      {/* ---- History Table ---- */}
      <Card style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent-primary)' }} />
            Lịch sử điểm danh hôm nay ({todayStr})
          </h2>
          <button onClick={fetchHistory} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
            color: 'var(--text-muted)', borderRadius: '8px', padding: '0.4rem 0.75rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem',
          }}>
            <RefreshCw size={14} style={loadingHist ? { animation: 'spin 1s linear infinite' } : {}} />
            Làm mới
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Users size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p style={{ fontSize: '0.875rem' }}>Chưa có dữ liệu điểm danh hôm nay</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['#', 'Độ tin cậy', 'Trạng thái', 'Check-in', 'Checkout'].map(h => (
                    <th key={h} style={{
                      padding: '0.6rem 0.75rem', textAlign: 'left',
                      color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={item.attendance_id || idx} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <span style={{ color: 'var(--accent-primary)' }}>
                        {Number(item.confidence || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}><StatusBadge status={item.status} /></td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--accent-success)', fontFamily: 'monospace', fontWeight: 600 }}>
                      {formatTime(item.timestamp)}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: item.checkout_time ? '#f59e0b' : 'var(--text-muted)', fontFamily: 'monospace', fontWeight: item.checkout_time ? 600 : 400 }}>
                      {item.checkout_time ? formatTime(item.checkout_time) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form Quản lý mạng công ty (Chỉ dành cho Admin) */}
      {currentUser?.role?.toUpperCase() === 'ADMIN' && (
        <Card title="Quản lý Mạng Công ty (Bảo mật WAF)">
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Thêm mạng mới */}
            <form onSubmit={handleAddNetwork} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Wifi size={16}/> Thêm mạng mới</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Tên mạng (VD: WiFi Công ty)</label>
                  <input value={newNetName} onChange={e => setNewNetName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.875rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Địa chỉ IP Public (IPv4)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input value={newNetIp} onChange={e => setNewNetIp(e.target.value)} required style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'white', fontSize: '0.875rem', fontFamily: 'monospace' }} />
                    <button type="button" onClick={handleFetchCurrentIp} title="Lấy IP hiện tại" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '0 0.75rem', cursor: 'pointer' }}><RefreshCw size={14} /></button>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={isAddingNet} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, cursor: isAddingNet ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isAddingNet ? <Loader size={14} className="spin" /> : <Plus size={14} />} Thêm vào danh sách
              </button>
            </form>

            {/* Thông báo kết quả WAF */}
            {wafMsg && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', background: wafMsg.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid', borderColor: wafMsg.success ? 'var(--status-success)' : 'var(--status-error)', color: wafMsg.success ? 'var(--status-success)' : 'var(--status-error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {wafMsg.success ? <CheckCircle size={16} /> : null} {wafMsg.text}
              </div>
            )}

            {/* Danh sách mạng */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>Danh sách mạng đã lưu</h3>
              {networks.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có mạng nào. Vui lòng thêm mạng mới.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {networks.map(net => {
                    const isActive = currentWafIp === net.ip;
                    return (
                      <div key={net.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isActive ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {net.name}
                            {isActive && <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white' }}>Đang áp dụng</span>}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{net.ip}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleApplyWafIp(net)} disabled={isApplyingIp === net.id || isActive} style={{ background: isActive ? 'transparent' : 'rgba(34, 197, 94, 0.15)', color: isActive ? 'var(--text-muted)' : 'var(--status-success)', border: isActive ? '1px solid var(--glass-border)' : '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: isActive ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {isApplyingIp === net.id ? <Loader size={14} className="spin" /> : <ShieldCheck size={14} />} {isActive ? 'Đã áp dụng' : 'Áp dụng'}
                          </button>
                          <button onClick={() => handleDeleteNetwork(net.id)} disabled={isActive} title={isActive ? "Không thể xóa mạng đang áp dụng" : "Xóa mạng này"} style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: isActive ? 'not-allowed' : 'pointer', opacity: isActive ? 0.5 : 1 }}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </div>
        </Card>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
