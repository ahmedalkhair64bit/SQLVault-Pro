import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Dashboard() {
  const [instances, setInstances] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('instances'); // 'instances', 'applications', 'ag'
  const [filters, setFilters] = useState({
    environment: '',
    status: '',
    search: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showExportModal, setShowExportModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.environment) params.environment = filters.environment;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const [instancesRes, appsRes] = await Promise.all([
        api.get('/instances', { params }),
        api.get('/applications')
      ]);
      setInstances(instancesRes.data);
      setApplications(appsRes.data);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type) => {
    try {
      let endpoint = '/export/instances';
      let filename = 'sql_instances.csv';

      if (type === 'databases') {
        endpoint = '/export/all-databases';
        filename = 'all_databases.csv';
      } else if (type === 'backups') {
        endpoint = '/export/backup-history';
        filename = 'backup_history.csv';
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

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Sort instances
  const sortedInstances = useMemo(() => {
    const sorted = [...instances].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const comparison = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [instances, sortConfig]);

  // Group instances by AG name
  const groupedByAG = useMemo(() => {
    return sortedInstances.reduce((acc, instance) => {
      const key = instance.ag_name || 'Standalone';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(instance);
      return acc;
    }, {});
  }, [sortedInstances]);

  // Group instances by Application (need to fetch instance-application relationships)
  const groupedByApplication = useMemo(() => {
    // For now, we'll show applications with their associated instance count
    return applications.map(app => ({
      ...app,
      instances: sortedInstances.filter(inst =>
        inst.applications?.includes(app.name) || inst.application_ids?.includes(app.id)
      )
    }));
  }, [applications, sortedInstances]);

  // Calculate stats
  const stats = {
    total: instances.length,
    up: instances.filter(i => i.last_status === 'UP').length,
    down: instances.filter(i => i.last_status === 'DOWN').length,
    production: instances.filter(i => i.environment === 'Production').length,
    agCount: Object.keys(groupedByAG).filter(k => k !== 'Standalone').length,
    appCount: applications.length
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>SQL Server Inventory</h1>
        <button className="btn btn-primary" onClick={() => setShowExportModal(true)}>
          Export
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-4" style={{ marginBottom: '30px' }}>
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Instances</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.up}</div>
          <div className="stat-label">Online</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.down}</div>
          <div className="stat-label">Offline</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.production}</div>
          <div className="stat-label">Production</div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <div
          className={`tab ${viewMode === 'instances' ? 'active' : ''}`}
          onClick={() => setViewMode('instances')}
        >
          Instances View
        </div>
        <div
          className={`tab ${viewMode === 'applications' ? 'active' : ''}`}
          onClick={() => setViewMode('applications')}
        >
          Applications View ({stats.appCount})
        </div>
        <div
          className={`tab ${viewMode === 'ag' ? 'active' : ''}`}
          onClick={() => setViewMode('ag')}
        >
          Availability Groups ({stats.agCount})
        </div>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <select
          className="filter-select"
          value={filters.environment}
          onChange={(e) => setFilters({ ...filters, environment: e.target.value })}
        >
          <option value="">All Environments</option>
          <option value="Production">Production</option>
          <option value="Dev">Dev</option>
          <option value="QA">QA</option>
          <option value="UAT">UAT</option>
          <option value="Other">Other</option>
        </select>

        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="UP">Online</option>
          <option value="DOWN">Offline</option>
          <option value="UNKNOWN">Unknown</option>
        </select>

        <input
          type="text"
          className="form-input"
          placeholder="Search instances..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ maxWidth: '250px' }}
        />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Instances View */}
          {viewMode === 'instances' && (
            <>
              {Object.entries(groupedByAG).map(([agName, agInstances]) => (
                <div key={agName} className={agName !== 'Standalone' ? 'ag-group' : ''}>
                  {agName !== 'Standalone' && (
                    <div className="ag-group-header">
                      <span className="ag-group-name">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="9" cy="7" r="4"></circle>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Availability Group: {agName}
                      </span>
                      <span style={{ marginLeft: '15px', color: 'var(--text-secondary)' }}>
                        ({agInstances.length} replicas)
                      </span>
                    </div>
                  )}

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th onClick={() => handleSort('last_status')} style={{ cursor: 'pointer' }}>
                            Status {getSortIcon('last_status')}
                          </th>
                          <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                            Instance Name {getSortIcon('name')}
                          </th>
                          <th onClick={() => handleSort('environment')} style={{ cursor: 'pointer' }}>
                            Environment {getSortIcon('environment')}
                          </th>
                          <th onClick={() => handleSort('version')} style={{ cursor: 'pointer' }}>
                            Version {getSortIcon('version')}
                          </th>
                          <th onClick={() => handleSort('last_restart_time')} style={{ cursor: 'pointer' }}>
                            Last Restart {getSortIcon('last_restart_time')}
                          </th>
                          <th onClick={() => handleSort('database_count')} style={{ cursor: 'pointer' }}>
                            Databases {getSortIcon('database_count')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {agInstances.map(instance => (
                          <tr
                            key={instance.id}
                            className="clickable"
                            onClick={() => navigate(`/instance/${instance.id}`)}
                          >
                            <td>
                              <span className={`status-badge status-${instance.last_status?.toLowerCase()}`} title={instance.last_error || ''}>
                                <span className={`status-dot ${instance.last_status?.toLowerCase()}`}></span>
                                {instance.last_status || 'Unknown'}
                                {instance.last_status === 'DOWN' && instance.last_error && (
                                  <span style={{ marginLeft: '5px', cursor: 'help' }} title={instance.last_error}>⚠</span>
                                )}
                              </span>
                            </td>
                            <td>
                              <strong>{instance.name}</strong>
                              {instance.last_status === 'DOWN' && instance.last_error && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '3px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={instance.last_error}>
                                  {instance.last_error}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`env-badge env-${getEnvClass(instance.environment)}`}>
                                {instance.environment}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {instance.version || 'Unknown'}
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {formatDate(instance.last_restart_time)}
                            </td>
                            <td>{instance.database_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Applications View */}
          {viewMode === 'applications' && (
            <div className="card">
              {applications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>No applications defined yet.</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                    Go to Manage Applications to create your first application.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {applications.map(app => (
                    <div
                      key={app.id}
                      className="card"
                      style={{
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onClick={() => navigate(`/application/${app.id}`)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <h3 style={{ margin: '0 0 15px 0' }}>{app.name}</h3>
                      {app.description && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '15px' }}>
                          {app.description}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '15px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        <span className="env-badge env-production">{app.instance_count || 0} instances</span>
                        <span className="env-badge env-dev">{app.database_count || 0} databases</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AG View */}
          {viewMode === 'ag' && (
            <div className="card">
              {Object.keys(groupedByAG).filter(k => k !== 'Standalone').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  <p>No Availability Groups configured.</p>
                  <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                    Configure AG when adding instances.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {Object.entries(groupedByAG)
                    .filter(([name]) => name !== 'Standalone')
                    .map(([agName, agInstances]) => (
                      <div
                        key={agName}
                        className="card"
                        style={{
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/ag/${encodeURIComponent(agName)}`)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <h3 style={{ margin: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '10px', verticalAlign: 'middle' }}>
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="9" cy="7" r="4"></circle>
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            {agName}
                          </h3>
                          <span className="env-badge env-production">
                            {agInstances.length} replicas
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          {agInstances.map(inst => (
                            <div key={inst.id} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 0',
                              borderBottom: '1px solid var(--border-color)'
                            }}>
                              <span>{inst.name}</span>
                              <span className={`status-badge status-${inst.last_status?.toLowerCase()}`}>
                                {inst.last_status || 'Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Standalone Instances */}
              {groupedByAG['Standalone'] && groupedByAG['Standalone'].length > 0 && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
                    Standalone Instances ({groupedByAG['Standalone'].length})
                  </h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Instance Name</th>
                          <th>Environment</th>
                          <th>Databases</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedByAG['Standalone'].map(instance => (
                          <tr
                            key={instance.id}
                            className="clickable"
                            onClick={() => navigate(`/instance/${instance.id}`)}
                          >
                            <td>
                              <span className={`status-badge status-${instance.last_status?.toLowerCase()}`}>
                                {instance.last_status || 'Unknown'}
                              </span>
                            </td>
                            <td><strong>{instance.name}</strong></td>
                            <td>
                              <span className={`env-badge env-${getEnvClass(instance.environment)}`}>
                                {instance.environment}
                              </span>
                            </td>
                            <td>{instance.database_count || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {instances.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No instances found</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '10px' }}>
                Add your first SQL Server instance from the Admin panel
              </p>
            </div>
          )}
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowExportModal(false)}>
          <div className="modal" style={{ width: '400px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Export Data</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>&times;</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => handleExport('instances')} style={{ justifyContent: 'flex-start' }}>
                Export All Instances
              </button>
              <button className="btn btn-secondary" onClick={() => handleExport('databases')} style={{ justifyContent: 'flex-start' }}>
                Export All Databases
              </button>
              <button className="btn btn-secondary" onClick={() => handleExport('backups')} style={{ justifyContent: 'flex-start' }}>
                Export Backup History
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

export default Dashboard;
