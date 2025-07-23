import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [passwords, setPasswords] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    days: 1,
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const API_BASE = process.env.REACT_APP_BACKEND_URL;

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScreen('main');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Load passwords on main screen
  useEffect(() => {
    if (currentScreen === 'main') {
      loadPasswords();
    }
  }, [currentScreen]);

  // Auto-refresh passwords every minute
  useEffect(() => {
    if (currentScreen === 'main') {
      const interval = setInterval(loadPasswords, 60000);
      return () => clearInterval(interval);
    }
  }, [currentScreen]);

  const loadPasswords = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/passwords`);
      const data = await response.json();
      setPasswords(data);
    } catch (error) {
      console.error('Error loading passwords:', error);
    }
  };

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/passwords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setFormData({ password: '', days: 1, description: '' });
        setShowCreateForm(false);
        await loadPasswords();
      } else {
        const error = await response.json();
        alert(`خطأ: ${error.detail}`);
      }
    } catch (error) {
      alert('حدث خطأ في الحفظ');
      console.error('Error creating password:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async (passwordId) => {
    try {
      const response = await fetch(`${API_BASE}/api/passwords/${passwordId}`);
      const data = await response.json();
      
      if (data.password) {
        await navigator.clipboard.writeText(data.password);
        alert('تم نسخ كلمة المرور بنجاح!');
      }
    } catch (error) {
      alert('خطأ في نسخ كلمة المرور');
      console.error('Error copying password:', error);
    }
  };

  const handleDeletePassword = async (passwordId) => {
    if (window.confirm('هل تريد حذف كلمة المرور هذه؟')) {
      try {
        await fetch(`${API_BASE}/api/passwords/${passwordId}`, {
          method: 'DELETE'
        });
        await loadPasswords();
      } catch (error) {
        alert('خطأ في الحذف');
        console.error('Error deleting password:', error);
      }
    }
  };

  const formatTime = (remainingTime) => {
    if (remainingTime.total_seconds <= 0) {
      return 'انتهت المدة';
    }
    
    const { days, hours, minutes } = remainingTime;
    if (days > 0) {
      return `${days} يوم، ${hours} ساعة`;
    } else if (hours > 0) {
      return `${hours} ساعة، ${minutes} دقيقة`;
    } else {
      return `${minutes} دقيقة`;
    }
  };

  if (currentScreen === 'splash') {
    return (
      <div className="splash-screen">
        <div className="splash-content">
          <div className="logo-container">
            <div className="logo-icon">🔐</div>
            <h1 className="app-title">حافظ الأسرار</h1>
            <p className="app-subtitle">تطبيق ذكي لحفظ كلمات المرور بأمان لفترة محددة</p>
          </div>
          <div className="developer-signature">
            <p className="developed-by">تطوير</p>
            <h2 className="developer-name">Eng Youssef Elattar</h2>
          </div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        <div className="header-content">
          <h1 className="header-title">🔐 حافظ الأسرار</h1>
          <p className="header-subtitle">حافظ على أسرارك بأمان حتى حلول الوقت المحدد</p>
        </div>
      </header>

      <main className="main-content">
        {!showCreateForm ? (
          <div className="passwords-section">
            <div className="section-header">
              <h2>كلمات المرور المحفوظة</h2>
              <button 
                className="btn-primary"
                onClick={() => setShowCreateForm(true)}
              >
                + إضافة كلمة مرور جديدة
              </button>
            </div>

            {passwords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔒</div>
                <h3>لا توجد كلمات مرور محفوظة</h3>
                <p>ابدأ بإضافة كلمة مرور أو سر تريد حفظه لفترة محددة</p>
              </div>
            ) : (
              <div className="passwords-grid">
                {passwords.map((pwd) => (
                  <div key={pwd.id} className="password-card">
                    <div className="card-header">
                      <h3>{pwd.description || 'كلمة مرور بدون وصف'}</h3>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeletePassword(pwd.id)}
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className="card-content">
                      <div className="time-info">
                        <div className="time-display">
                          <span className="time-label">الوقت المتبقي:</span>
                          <span className={`time-value ${pwd.is_expired ? 'expired' : ''}`}>
                            {formatTime(pwd.remaining_time)}
                          </span>
                        </div>
                        
                        {!pwd.is_expired && (
                          <div className="progress-bar">
                            <div 
                              className="progress-fill"
                              style={{
                                width: `${Math.max(0, (pwd.remaining_time.total_seconds / (pwd.remaining_time.total_seconds + 86400)) * 100)}%`
                              }}
                            ></div>
                          </div>
                        )}
                      </div>

                      <div className="card-actions">
                        {pwd.is_expired ? (
                          <button 
                            className="btn-copy"
                            onClick={() => handleCopyPassword(pwd.id)}
                          >
                            📋 نسخ كلمة المرور
                          </button>
                        ) : (
                          <div className="locked-message">
                            🔒 كلمة المرور مقفلة حتى انتهاء الوقت المحدد
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="card-footer">
                      <small>تم الحفظ: {new Date(pwd.created_at).toLocaleDateString('ar-EG')}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="create-form">
            <div className="form-header">
              <h2>إضافة كلمة مرور جديدة</h2>
              <button 
                className="btn-close"
                onClick={() => setShowCreateForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePassword}>
              <div className="form-group">
                <label>كلمة المرور أو السر</label>
                <textarea
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="أدخل كلمة المرور أو السر الذي تريد حفظه..."
                  required
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>الوصف (اختياري)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="وصف مختصر لكلمة المرور..."
                />
              </div>

              <div className="form-group">
                <label>عدد الأيام (1-100 يوم)</label>
                <input
                  type="number"
                  value={formData.days}
                  onChange={(e) => setFormData({...formData, days: parseInt(e.target.value)})}
                  min="1"
                  max="100"
                  required
                />
                <small>سيتم قفل كلمة المرور لهذه المدة</small>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'جاري الحفظ...' : '🔒 حفظ وقفل'}
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>تطوير <span className="developer-highlight">Eng Youssef Elattar</span></p>
      </footer>
    </div>
  );
};

export default App;