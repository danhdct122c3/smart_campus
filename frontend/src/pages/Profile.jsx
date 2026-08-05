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
    try {
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Cập nhật thất bại');
      
      setCurrentUser({ ...currentUser, phone: newPhone });
      setIsEditingPhone(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUpdatingPhone(false);
    }
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
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          current_password: currentPassword,
          new_password: newPassword
        }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Đổi mật khẩu thất bại');
      
      setPassResult({ success: true, message: 'Đổi mật khẩu thành công!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassResult({ success: false, message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Hồ sơ cá nhân
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Quản lý thông tự cá nhân và dữ liệu sinh trắc học.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Thông tin cá nhân */}
        <Card title="Thông tin cơ bản">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCircle size={40} color="var(--text-muted)" />
                </div>
                <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{currentUser.email}</div>
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.5rem 0' }}></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Phòng ban</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentUser.department || 'N/A'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Vai trò</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentUser.role}</div>
                </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Số điện thoại</div>
                    {!isEditingPhone ? (
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {currentUser.phone || 'Chưa cập nhật'}
                            <button onClick={() => { setNewPhone(currentUser.phone || ''); setIsEditingPhone(true); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}>
                                <Edit2 size={14} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                                value={newPhone} 
                                onChange={(e) => setNewPhone(e.target.value)}
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', width: '120px', fontSize: '0.875rem' }}
                            />
                            <button onClick={handleUpdatePhone} disabled={isUpdatingPhone} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                {isUpdatingPhone ? '...' : 'Lưu'}
                            </button>
                            <button onClick={() => setIsEditingPhone(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
                                Hủy
                            </button>
                        </div>
                    )}
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ngày bắt đầu</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Trạng thái Khuôn mặt</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: currentUser.face_registered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentUser.face_registered ? 'var(--status-success)' : 'var(--status-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {currentUser.face_registered ? 'Đã đăng ký' : 'Chưa đăng ký'}
                </div>
            </div>
          </div>
          </div>
        </Card>

        {/* Form đổi mật khẩu */}
        <Card title="Đổi mật khẩu">
          {!showPasswordForm ? (
            <div style={{ marginTop: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Bạn nên thay đổi mật khẩu định kỳ để bảo vệ tài khoản.</p>
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
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mật khẩu hiện tại</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mật khẩu mới</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>

            {passResult && (
              <div style={{
                  padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem',
                  background: passResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid', borderColor: passResult.success ? 'var(--status-success)' : 'var(--status-error)',
                  color: passResult.success ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                  {passResult.success ? <CheckCircle2 size={16} /> : null}
                  {passResult.message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{
                marginTop: '0.5rem',
                background: 'var(--accent-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                padding: '0.75rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? <Loader size={18} className="spin" /> : <KeyRound size={18} />}
              {isSubmitting ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowPasswordForm(false)}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)', border: 'none',
                padding: '0.5rem', cursor: 'pointer', fontWeight: 500,
                textAlign: 'center'
              }}
            >
              Hủy
            </button>
          </form>
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
                  {wafMsg.success ? <CheckCircle2 size={16} /> : null} {wafMsg.text}
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
                          <button onClick={() => handleApplyWafIp(net)} disabled={isApplyingIp === net.id || isActive} style={{ background: isActive ? 'transparent' : 'rgba(34, 197, 94, 0.15)', color: isActive ? 'var(--text-muted)' : 'var(--status-success)', border: isActive ? '1px solid var(--glass-border)' : '1px solid rgba(34,197,94,0.3)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: isActive ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {isApplyingIp === net.id ? <Loader size={14} className="spin" /> : <ShieldCheck size={14} />} {isActive ? 'Đã áp dụng' : 'Áp dụng'}
                          </button>
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
