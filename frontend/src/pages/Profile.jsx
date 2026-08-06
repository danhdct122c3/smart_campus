import React, { useState } from 'react';
import { UserCircle, Loader, KeyRound, CheckCircle2, Edit2, ShieldCheck, Wifi, Plus, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'https://d2utvhhrx300xg.cloudfront.net/api';

const Profile = () => {
  const { currentUser, setCurrentUser } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passResult, setPassResult] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  // --- Admin WAF Network Management ---
  const [networks, setNetworks] = useState([]);
  const [currentWafIp, setCurrentWafIp] = useState(null);
  const [newNetName, setNewNetName] = useState('');
  const [newNetIp, setNewNetIp] = useState('');
  const [isAddingNet, setIsAddingNet] = useState(false);
  const [isApplyingIp, setIsApplyingIp] = useState('');
  const [wafMsg, setWafMsg] = useState(null);

  React.useEffect(() => {
    if (currentUser?.role?.toUpperCase() === 'ADMIN') {
      fetch(`${API_BASE_URL}/security/networks`)
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
      const res = await fetch(`${API_BASE_URL}/security/networks`, {
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
      const res = await fetch(`${API_BASE_URL}/security/networks/${netId}`, {
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
      const res = await fetch(`${API_BASE_URL}/security/waf-ip`, {
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

  if (!currentUser) return null;

  const handleUpdatePhone = async () => {
    if (!newPhone) return;
    setIsUpdatingPhone(true);
    setPassResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.id || currentUser.user_id}/phone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: newPhone })
      });
      const data = await res.json();
      if (res.ok) {
        setPassResult({ success: true, message: 'Cập nhật số điện thoại thành công.' });
        setCurrentUser({ ...currentUser, phone_number: newPhone });
        setIsEditingPhone(false);
      } else throw new Error(data.message || 'Lỗi cập nhật số điện thoại');
    } catch (err) {
      setPassResult({ success: false, message: err.message });
    } finally { setIsUpdatingPhone(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassResult({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setIsSubmitting(true);
    setPassResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.id || currentUser.user_id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPassResult({ success: true, message: 'Đổi mật khẩu thành công.' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(() => setShowPasswordForm(false), 2000);
      } else throw new Error(data.message || 'Lỗi đổi mật khẩu');
    } catch (err) {
      setPassResult({ success: false, message: err.message });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'white', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <UserCircle size={28} color="var(--accent-primary)" /> Thông tin Cá nhân
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Quản lý tài khoản, bảo mật và cài đặt hệ thống.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        <Card style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 700, color: 'white',
              boxShadow: '0 4px 20px rgba(6, 182, 212, 0.3)'
            }}>
              {(currentUser.full_name || currentUser.name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>
                {currentUser.full_name || currentUser.name}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {currentUser.role}
                </span>
                {currentUser.department && (
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                    Phòng: {currentUser.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>Email</label>
              <div style={{ color: 'white', fontWeight: 500 }}>{currentUser.email || 'Chưa cập nhật'}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>User ID</label>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{currentUser.id || currentUser.user_id}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>Số điện thoại</label>
              {isEditingPhone ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="Nhập số điện thoại..."
                    style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.875rem' }}
                  />
                  <button onClick={handleUpdatePhone} disabled={isUpdatingPhone} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600 }}>
                    {isUpdatingPhone ? <Loader size={16} className="spin" /> : 'Lưu'}
                  </button>
                  <button onClick={() => setIsEditingPhone(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0 1rem', cursor: 'pointer', fontWeight: 600 }}>
                    Hủy
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ color: 'white', fontWeight: 500 }}>{currentUser.phone_number || currentUser.phone || 'Chưa cập nhật'}</div>
                  <button onClick={() => { setIsEditingPhone(true); setNewPhone(currentUser.phone_number || currentUser.phone || ''); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                    <Edit2 size={14} /> Sửa
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>Ngày tham gia</label>
                <div style={{ color: 'white', fontWeight: 500 }}>{currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('vi-VN') : 'N/A'}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'block' }}>Trạng thái Khuôn mặt</label>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: currentUser.face_registered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentUser.face_registered ? 'var(--status-success)' : 'var(--status-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {currentUser.face_registered ? 'Đã đăng ký' : 'Chưa đăng ký'}
                </div>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0' }} />

          {!showPasswordForm ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px',
                    padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  <KeyRound size={18} /> Thay đổi mật khẩu
                </button>
            </div>
          ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Mật khẩu hiện tại</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Mật khẩu mới</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Xác nhận mật khẩu mới</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} />
            </div>

            {passResult && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', background: passResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: '1px solid', borderColor: passResult.success ? 'var(--status-success)' : 'var(--status-error)', color: passResult.success ? 'var(--status-success)' : 'var(--status-error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {passResult.success ? <CheckCircle2 size={16} /> : null} {passResult.message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{
                background: 'var(--accent-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                padding: '0.85rem', cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? <Loader size={18} className="spin" /> : <KeyRound size={18} />}
              Lưu mật khẩu mới
            </button>
            <button 
              type="button" 
              onClick={() => { setShowPasswordForm(false); setPassResult(null); }}
              style={{
                background: 'transparent',
                color: 'var(--text-muted)', border: 'none', padding: '0.5rem', cursor: 'pointer', fontSize: '0.85rem'
              }}
            >
              Hủy
            </button>
          </form>
          )}
        </Card>

        {currentUser?.role?.toUpperCase() === 'ADMIN' && (
          <Card style={{ padding: '2rem', borderTop: '4px solid var(--accent-secondary)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={22} color="var(--accent-secondary)" /> Quản lý Mạng Công ty (Bảo mật WAF)
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
                  <Wifi size={14} /> Thêm mạng mới
                </h3>
                <form onSubmit={handleAddNetwork} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Tên mạng (VD: WiFi Công ty)</label>
                      <input value={newNetName} onChange={e => setNewNetName(e.target.value)} required style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'var(--bg-dark)', color: 'white', fontSize: '0.85rem' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>Địa chỉ IP Public (IPv4)</label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input value={newNetIp} onChange={e => setNewNetIp(e.target.value)} required placeholder="1.2.3.4" style={{ flex: 1, padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'var(--bg-dark)', color: 'white', fontSize: '0.85rem', fontFamily: 'monospace' }} />
                        <button type="button" onClick={handleFetchCurrentIp} title="Lấy IP hiện tại của bạn" style={{ background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0 0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <button type="submit" disabled={isAddingNet} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {isAddingNet ? <Loader size={14} className="spin" /> : <Plus size={14} />} Thêm vào danh sách
                    </button>
                  </div>
                </form>
              </div>

              {wafMsg && (
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem',
                  background: wafMsg.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid', borderColor: wafMsg.success ? 'var(--status-success)' : 'var(--status-error)',
                  color: wafMsg.success ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                  {wafMsg.success ? <CheckCircle2 size={16} /> : null} {wafMsg.text}
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>Danh sách mạng đã lưu</h3>
                {networks.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có mạng nào.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {networks.map(net => {
                      const isActive = currentWafIp === net.ip;
                      return (
                        <div key={net.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isActive ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255,255,255,0.02)', border: isActive ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Profile;
