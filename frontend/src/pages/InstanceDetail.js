import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function InstanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [logins, setLogins] = useState([]);
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupPeriod, setBackupPeriod] = useState('week');
  const [activeTab, setActiveTab] = useState('databases');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    fetchInstanceData();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchBackupHistory(backupPeriod);
    }
  }, [id, backupPeriod]);

  const fetchInstanceData = async () => {
    setLoading(true);
    try {
      const [instanceRes, databasesRes, loginsRes] = await Promise.all([
        api.get(`/instances/${id}`),
        api.get(`/instances/${id}/databases`),
        api.get(`/instances/${id}/logins`)
      ]);
      setInstance(instanceRes.data);
      setDatabases(databasesRes.data);
      setLogins(loginsRes.data);
    } catch (err) {
      setError('Failed to load instance details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupHistory = async (period) => {
    try {
      const res = await api.get(`/instances/${id}/backup-history`, { params: { period } });
      setBackupHistory(res.data);
    } catch (err) {
      console.error('Failed to load backup history:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/instances/${id}/refresh`);
      await fetchInstanceData();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (type) => {
    try {
      let endpoint = `/export/instance/${id}`;
      let filename = `${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv`;

      switch (type) {
        case 'all':
          endpoint = `/export/instance/${id}`;
          filename = `${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_full_export.csv`;
          break;
        case 'databases':
          endpoint = `/export/instance/${id}/databases`;
          filename = `${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_databases.csv`;
          break;
        case 'logins':
          endpoint = `/export/instance/${id}/logins`;
          filename = `${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_logins.csv`;
          break;
        case 'backups':
          endpoint = `/export/instance/${id}/backup-history`;
          filename = `${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_backup_history.csv`;
          break;
        default:
          break;
      }

      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShowExportModal(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getBackupStatusClass = (status) => {
    if (status === 'OK') return 'status-online';
    if (status === 'Warning') return 'status-warning';
    return 'status-offline';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="alert alert-error">
        {error || 'Instance not found'}
        <button className="btn btn-secondary btn-small" onClick={() => navigate('/')} style={{ marginLeft: '15px' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
        <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>/</span>
        <span>{instance.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span className={`status-dot ${instance.last_status?.toLowerCase()}`}></span>
            {instance.name}
          </h1>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className={`env-badge env-${instance.environment?.toLowerCase()}`}>
              {instance.environment}
            </span>
            {instance.ag_name && (
              <span style={{ color: 'var(--text-secondary)' }}>
                AG: {instance.ag_name}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
            Export
          </button>
        </div>
      </div>

      {/* Instance Info */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <div className="info-grid">
          <div className="info-item">
            <label>Status</label>
            <span className={`status-badge status-${instance.last_status?.toLowerCase()}`}>
              {instance.last_status || 'Unknown'}
            </span>
          </div>
          <div className="info-item">
            <label>Version</label>
            <span>{instance.version || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Edition</label>
            <span>{instance.edition || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>CPU Cores</label>
            <span>{instance.cpu_cores || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Total Memory</label>
            <span>{instance.total_memory_gb ? `${instance.total_memory_gb} GB` : 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Last Restart</label>
            <span>{formatDate(instance.last_restart_time)}</span>
          </div>
          <div className="info-item">
            <label>Host</label>
            <span>{instance.host}:{instance.port}</span>
          </div>
          <div className="info-item">
            <label>Last Checked</label>
            <span>{formatDate(instance.last_checked_at)}</span>
          </div>
        </div>

        {instance.description && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Description</label>
            <p style={{ marginTop: '8px' }}>{instance.description}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'databases' ? 'active' : ''}`}
          onClick={() => setActiveTab('databases')}
        >
          Databases ({databases.length})
        </div>
        <div
          className={`tab ${activeTab === 'backups' ? 'active' : ''}`}
          onClick={() => setActiveTab('backups')}
        >
          Backup History ({backupHistory.length})
        </div>
        <div
          className={`tab ${activeTab === 'logins' ? 'active' : ''}`}
          onClick={() => setActiveTab('logins')}
        >
          Logins ({logins.length})
        </div>
      </div>

      {/* Databases Tab */}
      {activeTab === 'databases' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Database Name</th>
                  <th>Status</th>
                  <th>Recovery Model</th>
                  <th>Size (MB)</th>
                  <th>Last Full Backup</th>
                  <th>Last Diff Backup</th>
                  <th>Last Log Backup</th>
                  <th>Applications</th>
                </tr>
              </thead>
              <tbody>
                {databases.map(db => (
                  <tr
                    key={db.id}
                    className="clickable"
                    onClick={() => navigate(`/database/${db.id}`)}
                  >
                    <td>
                      <strong>{db.name}</strong>
                      {db.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {db.description.substring(0, 50)}{db.description.length > 50 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${db.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
                        {db.status}
                      </span>
                    </td>
                    <td>{db.recovery_model}</td>
                    <td>{db.size_mb?.toLocaleString()}</td>
                    <td style={{ fontSize: '0.85rem' }}>{db.last_full_backup ? formatDate(db.last_full_backup) : 'Never'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{db.last_diff_backup ? formatDate(db.last_diff_backup) : 'Never'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{db.last_log_backup ? formatDate(db.last_log_backup) : 'Never'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {db.applications || '-'}
                    </td>
                  </tr>
                ))}
                {databases.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No databases found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backup History Tab */}
      {activeTab === 'backups' && (
        <div className="card">
          {/* Period Filter Buttons */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button
              className={`btn btn-small ${backupPeriod === 'today' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBackupPeriod('today')}
            >
              Today
            </button>
            <button
              className={`btn btn-small ${backupPeriod === 'week' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBackupPeriod('week')}
            >
              This Week
            </button>
            <button
              className={`btn btn-small ${backupPeriod === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBackupPeriod('month')}
            >
              This Month
            </button>
            <button
              className={`btn btn-small ${backupPeriod === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBackupPeriod('all')}
            >
              All
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Database</th>
                  <th>Backup Type</th>
                  <th>Start Time</th>
                  <th>Finish Time</th>
                  <th>Size (MB)</th>
                </tr>
              </thead>
              <tbody>
                {backupHistory.map((backup, index) => (
                  <tr key={index}>
                    <td>
                      <Link to={`/database/${backup.database_id}`} style={{ color: 'var(--primary-color)' }}>
                        {backup.database_name}
                      </Link>
                    </td>
                    <td>
                      <span className={`env-badge ${
                        backup.backup_type === 'Full' ? 'env-production' :
                        backup.backup_type === 'Differential' ? 'env-uat' :
                        'env-dev'
                      }`}>
                        {backup.backup_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(backup.backup_start_date)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(backup.backup_finish_date)}</td>
                    <td>{backup.backup_size_mb?.toLocaleString()}</td>
                  </tr>
                ))}
                {backupHistory.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No backup history found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logins Tab */}
      {activeTab === 'logins' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Login Name</th>
                  <th>Type</th>
                  <th>Default Database</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {logins.map(login => (
                  <tr key={login.id}>
                    <td>{login.login_name}</td>
                    <td>{login.login_type}</td>
                    <td>{login.default_database || '-'}</td>
                    <td>
                      <span className={`status-badge ${login.is_disabled ? 'status-offline' : 'status-online'}`}>
                        {login.is_disabled ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td>{formatDate(login.created_date)}</td>
                  </tr>
                ))}
                {logins.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No logins found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowExportModal(false)}>
          <div className="modal" style={{ width: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Export Instance Data</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>&times;</button>
            </div>
            <div style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
              Select what you want to export for <strong>{instance.name}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('all')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Full Export</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    Instance info, databases, and logins
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('databases')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Databases Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {databases.length} databases with details
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('logins')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Logins Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {logins.length} SQL Server logins
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('backups')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Backup History</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    All backup records for this instance
                  </div>
                </div>
              </button>
            </div>
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstanceDetail;
