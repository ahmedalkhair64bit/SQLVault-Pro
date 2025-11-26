import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function AGDetail() {
  const { agName } = useParams();
  const navigate = useNavigate();
  const [agData, setAgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('replicas');

  useEffect(() => {
    fetchAGData();
  }, [agName]);

  const fetchAGData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/instances/ag/${encodeURIComponent(agName)}`);
      setAgData(res.data);
    } catch (err) {
      setError('Failed to load Availability Group details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getEnvClass = (env) => {
    const envMap = {
      'Production': 'production',
      'Dev': 'dev',
      'QA': 'qa',
      'UAT': 'uat',
      'Other': 'other'
    };
    return envMap[env] || 'other';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !agData) {
    return (
      <div className="alert alert-error">
        {error || 'Availability Group not found'}
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
        <span>Availability Group: {agData.ag_name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            {agData.ag_name}
          </h1>
          <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
            SQL Server Always On Availability Group
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-value">{agData.instances?.length || 0}</div>
          <div className="stat-label">Replicas</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{agData.databases?.length || 0}</div>
          <div className="stat-label">Databases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {agData.instances?.filter(i => i.last_status === 'UP').length || 0}
          </div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {agData.instances?.filter(i => i.last_status === 'DOWN').length || 0}
          </div>
          <div className="stat-label">Offline</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'replicas' ? 'active' : ''}`}
          onClick={() => setActiveTab('replicas')}
        >
          Replicas ({agData.instances?.length || 0})
        </div>
        <div
          className={`tab ${activeTab === 'databases' ? 'active' : ''}`}
          onClick={() => setActiveTab('databases')}
        >
          Databases ({agData.databases?.length || 0})
        </div>
      </div>

      {/* Replicas Tab */}
      {activeTab === 'replicas' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Instance Name</th>
                  <th>Environment</th>
                  <th>Host</th>
                  <th>Version</th>
                  <th>Edition</th>
                  <th>CPU / Memory</th>
                  <th>Databases</th>
                  <th>Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {agData.instances?.map(instance => (
                  <tr
                    key={instance.id}
                    className="clickable"
                    onClick={() => navigate(`/instance/${instance.id}`)}
                  >
                    <td>
                      <span className={`status-badge status-${instance.last_status?.toLowerCase()}`}>
                        <span className={`status-dot ${instance.last_status?.toLowerCase()}`}></span>
                        {instance.last_status || 'Unknown'}
                      </span>
                    </td>
                    <td><strong>{instance.name}</strong></td>
                    <td>
                      <span className={`env-badge env-${getEnvClass(instance.environment)}`}>
                        {instance.environment}
                      </span>
                    </td>
                    <td>{instance.host}:{instance.port}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {instance.version || 'Unknown'}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {instance.edition || 'Unknown'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {instance.cpu_cores ? `${instance.cpu_cores} cores` : 'Unknown'}
                      {instance.total_memory_gb ? ` / ${instance.total_memory_gb} GB` : ''}
                    </td>
                    <td>{instance.database_count || 0}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(instance.last_checked_at)}</td>
                  </tr>
                ))}
                {(!agData.instances || agData.instances.length === 0) && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No replicas found in this Availability Group
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Databases Tab */}
      {activeTab === 'databases' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Database Name</th>
                  <th>Instance</th>
                  <th>Status</th>
                  <th>Recovery Model</th>
                  <th>Size (MB)</th>
                  <th>Last Full Backup</th>
                  <th>Last Diff Backup</th>
                  <th>Last Log Backup</th>
                </tr>
              </thead>
              <tbody>
                {agData.databases?.map(db => (
                  <tr
                    key={`${db.instance_id}-${db.id}`}
                    className="clickable"
                    onClick={() => navigate(`/database/${db.id}`)}
                  >
                    <td><strong>{db.name}</strong></td>
                    <td>
                      <Link
                        to={`/instance/${db.instance_id}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--primary-color)' }}
                      >
                        {db.instance_name}
                      </Link>
                    </td>
                    <td>
                      <span className={`status-badge ${db.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
                        {db.status}
                      </span>
                    </td>
                    <td>{db.recovery_model}</td>
                    <td>{db.size_mb?.toLocaleString()}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {db.last_full_backup ? formatDate(db.last_full_backup) : 'Never'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {db.last_diff_backup ? formatDate(db.last_diff_backup) : 'Never'}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {db.last_log_backup ? formatDate(db.last_log_backup) : 'Never'}
                    </td>
                  </tr>
                ))}
                {(!agData.databases || agData.databases.length === 0) && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No databases found in this Availability Group
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AGDetail;
