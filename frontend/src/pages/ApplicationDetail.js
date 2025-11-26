import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('instances');
  const [envFilter, setEnvFilter] = useState('');

  useEffect(() => {
    fetchApplicationData();
  }, [id]);

  const fetchApplicationData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/applications/${id}`);
      setApplication(res.data);
    } catch (err) {
      setError('Failed to load application details');
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

  const filteredInstances = application?.instances?.filter(inst =>
    !envFilter || inst.environment === envFilter
  ) || [];

  const filteredDatabases = application?.databases?.filter(db =>
    !envFilter || db.environment === envFilter
  ) || [];

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="alert alert-error">
        {error || 'Application not found'}
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
        <span>Application: {application.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            {application.name}
          </h1>
          {application.description && (
            <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
              {application.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-value">{application.instances?.length || 0}</div>
          <div className="stat-label">Instances</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{application.databases?.length || 0}</div>
          <div className="stat-label">Databases</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {application.instances?.filter(i => i.last_status === 'UP').length || 0}
          </div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {application.instances?.filter(i => i.last_status === 'DOWN').length || 0}
          </div>
          <div className="stat-label">Offline</div>
        </div>
      </div>

      {/* Environment Filter */}
      <div className="filters-row" style={{ marginBottom: '20px' }}>
        <select
          className="filter-select"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
        >
          <option value="">All Environments</option>
          <option value="Production">Production</option>
          <option value="Dev">Dev</option>
          <option value="QA">QA</option>
          <option value="UAT">UAT</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'instances' ? 'active' : ''}`}
          onClick={() => setActiveTab('instances')}
        >
          Instances ({filteredInstances.length})
        </div>
        <div
          className={`tab ${activeTab === 'databases' ? 'active' : ''}`}
          onClick={() => setActiveTab('databases')}
        >
          Databases ({filteredDatabases.length})
        </div>
      </div>

      {/* Instances Tab */}
      {activeTab === 'instances' && (
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
                  <th>Databases</th>
                  <th>Last Checked</th>
                </tr>
              </thead>
              <tbody>
                {filteredInstances.map(instance => (
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
                    <td>
                      <strong>{instance.name}</strong>
                      {instance.ag_name && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          AG: {instance.ag_name}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`env-badge env-${getEnvClass(instance.environment)}`}>
                        {instance.environment}
                      </span>
                    </td>
                    <td>{instance.host}:{instance.port}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {instance.version || 'Unknown'}
                    </td>
                    <td>{instance.database_count || 0}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(instance.last_checked_at)}</td>
                  </tr>
                ))}
                {filteredInstances.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No instances found for this application
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
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Size (MB)</th>
                  <th>Recovery Model</th>
                  <th>Last Full Backup</th>
                </tr>
              </thead>
              <tbody>
                {filteredDatabases.map(db => (
                  <tr
                    key={db.id}
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
                      <span className={`env-badge env-${getEnvClass(db.environment)}`}>
                        {db.environment}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${db.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
                        {db.status}
                      </span>
                    </td>
                    <td>{db.size_mb?.toLocaleString()}</td>
                    <td>{db.recovery_model}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {db.last_full_backup ? formatDate(db.last_full_backup) : 'Never'}
                    </td>
                  </tr>
                ))}
                {filteredDatabases.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No databases found for this application
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

export default ApplicationDetail;
