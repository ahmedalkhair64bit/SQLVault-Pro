import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function DatabaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [database, setDatabase] = useState(null);
  const [tables, setTables] = useState({ data: [], pagination: {} });
  const [indexes, setIndexes] = useState({ data: [], pagination: {} });
  const [procedures, setProcedures] = useState({ data: [], pagination: {} });
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('objects');
  const [objectsSubTab, setObjectsSubTab] = useState('tables');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [selectedApps, setSelectedApps] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDatabaseData();
    fetchApplications();
  }, [id]);

  const fetchDatabaseData = async () => {
    setLoading(true);
    try {
      const [dbRes, tablesRes, indexesRes, procsRes, usersRes] = await Promise.all([
        api.get(`/databases/${id}`),
        api.get(`/databases/${id}/tables`),
        api.get(`/databases/${id}/indexes`),
        api.get(`/databases/${id}/procedures`),
        api.get(`/databases/${id}/users`)
      ]);
      setDatabase(dbRes.data);
      setTables(tablesRes.data);
      setIndexes(indexesRes.data);
      setProcedures(procsRes.data);
      setUsers(usersRes.data);
      setEditDescription(dbRes.data.description || '');
      setSelectedApps(dbRes.data.applications?.map(a => a.id) || []);
    } catch (err) {
      setError('Failed to load database details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await api.get('/applications');
      setApplications(res.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post(`/databases/${id}/refresh`);
      await fetchDatabaseData();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (type) => {
    try {
      let endpoint = `/export/database/${id}`;
      let filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv`;

      switch (type) {
        case 'all':
          endpoint = `/export/database/${id}`;
          filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_full_export.csv`;
          break;
        case 'tables':
          endpoint = `/export/database/${id}/tables`;
          filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_tables.csv`;
          break;
        case 'indexes':
          endpoint = `/export/database/${id}/indexes`;
          filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_indexes.csv`;
          break;
        case 'procedures':
          endpoint = `/export/database/${id}/procedures`;
          filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_procedures.csv`;
          break;
        case 'users':
          endpoint = `/export/database/${id}/users`;
          filename = `${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_users.csv`;
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

  const handleSaveDescription = async () => {
    try {
      await api.put(`/databases/${id}`, {
        description: editDescription,
        application_ids: selectedApps
      });
      setDatabase({ ...database, description: editDescription });
      setEditing(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const loadMoreTables = async (page) => {
    try {
      const res = await api.get(`/databases/${id}/tables`, { params: { page } });
      setTables(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMoreIndexes = async (page) => {
    try {
      const res = await api.get(`/databases/${id}/indexes`, { params: { page } });
      setIndexes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMoreProcedures = async (page) => {
    try {
      const res = await api.get(`/databases/${id}/procedures`, { params: { page } });
      setProcedures(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !database) {
    return (
      <div className="alert alert-error">
        {error || 'Database not found'}
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
        <Link to={`/instance/${database.instance_id}`} style={{ color: 'var(--text-secondary)' }}>
          {database.instance_name}
        </Link>
        <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>/</span>
        <span>{database.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h1>{database.name}</h1>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className={`status-badge ${database.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
              {database.status}
            </span>
            <span className={`env-badge env-${database.environment?.toLowerCase()}`}>
              {database.environment}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              on {database.instance_name}
            </span>
            {database.ag_name && (
              <span style={{ color: 'var(--text-secondary)' }}>
                (AG: {database.ag_name})
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

      {/* Database Info */}
      <div className="card" style={{ marginBottom: '30px' }}>
        <div className="info-grid">
          <div className="info-item">
            <label>Status</label>
            <span className={`status-badge ${database.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
              {database.status}
            </span>
          </div>
          <div className="info-item">
            <label>Recovery Model</label>
            <span>{database.recovery_model || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Total Size</label>
            <span>{database.size_mb ? `${database.size_mb.toLocaleString()} MB` : 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Data File Size</label>
            <span>{database.data_file_size_mb ? `${database.data_file_size_mb.toLocaleString()} MB` : 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Log File Size</label>
            <span>{database.log_file_size_mb ? `${database.log_file_size_mb.toLocaleString()} MB` : 'Unknown'}</span>
          </div>
          <div className="info-item">
            <label>Last Full Backup</label>
            <span>{formatDate(database.last_full_backup)}</span>
          </div>
          <div className="info-item">
            <label>Last Diff Backup</label>
            <span>{formatDate(database.last_diff_backup)}</span>
          </div>
          <div className="info-item">
            <label>Last Log Backup</label>
            <span>{formatDate(database.last_log_backup)}</span>
          </div>
        </div>

        {/* File Paths */}
        {(database.data_file_path || database.log_file_path) && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>File Paths</label>
            {database.data_file_path && (
              <div style={{ marginBottom: '8px' }}>
                <strong>Data File:</strong> <code style={{ fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '3px' }}>{database.data_file_path}</code>
              </div>
            )}
            {database.log_file_path && (
              <div>
                <strong>Log File:</strong> <code style={{ fontSize: '0.85rem', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '3px' }}>{database.log_file_path}</code>
              </div>
            )}
          </div>
        )}

        {/* Description and Applications */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          {editing ? (
            <div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What is this database used for?"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Related Applications</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  {applications.length > 0 ? applications.map(app => (
                    <label key={app.id} className="form-checkbox" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedApps.includes(app.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedApps([...selectedApps, app.id]);
                          } else {
                            setSelectedApps(selectedApps.filter(id => id !== app.id));
                          }
                        }}
                      />
                      {app.name}
                    </label>
                  )) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      No applications defined yet. Go to Manage Applications to create one.
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-small" onClick={handleSaveDescription}>
                  Save
                </button>
                <button className="btn btn-secondary btn-small" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    Description
                  </label>
                  <p style={{ marginTop: '8px' }}>
                    {database.description || <span style={{ color: 'var(--text-secondary)' }}>No description provided</span>}
                  </p>
                </div>
                <button className="btn btn-secondary btn-small" onClick={() => setEditing(true)}>
                  Edit
                </button>
              </div>
              {database.applications && database.applications.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    Related Applications
                  </label>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {database.applications.map(app => (
                      <span key={app.id} className="env-badge env-qa">{app.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div
          className={`tab ${activeTab === 'objects' ? 'active' : ''}`}
          onClick={() => setActiveTab('objects')}
        >
          Objects
        </div>
        <div
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security ({users.length})
        </div>
      </div>

      {/* Objects Tab */}
      {activeTab === 'objects' && (
        <div className="card">
          {/* Sub-tabs for objects */}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <button
              className={`btn btn-small ${objectsSubTab === 'tables' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setObjectsSubTab('tables')}
            >
              Tables ({tables.pagination.total || 0})
            </button>
            <button
              className={`btn btn-small ${objectsSubTab === 'indexes' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setObjectsSubTab('indexes')}
            >
              Indexes ({indexes.pagination.total || 0})
            </button>
            <button
              className={`btn btn-small ${objectsSubTab === 'procedures' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setObjectsSubTab('procedures')}
            >
              Stored Procedures ({procedures.pagination.total || 0})
            </button>
          </div>

          {/* Tables */}
          {objectsSubTab === 'tables' && (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Schema</th>
                      <th>Table Name</th>
                      <th>Row Count</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.data.map(table => (
                      <tr key={table.id}>
                        <td>{table.schema_name}</td>
                        <td>{table.table_name}</td>
                        <td>{table.row_count?.toLocaleString() || 'N/A'}</td>
                        <td>{formatDate(table.created_date)}</td>
                      </tr>
                    ))}
                    {tables.data.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No tables found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {tables.pagination.pages > 1 && (
                <div className="pagination">
                  <button
                    disabled={tables.pagination.page <= 1}
                    onClick={() => loadMoreTables(tables.pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {tables.pagination.page} of {tables.pagination.pages}</span>
                  <button
                    disabled={tables.pagination.page >= tables.pagination.pages}
                    onClick={() => loadMoreTables(tables.pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* Indexes */}
          {objectsSubTab === 'indexes' && (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Table Name</th>
                      <th>Index Name</th>
                      <th>Type</th>
                      <th>Unique</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexes.data.map(idx => (
                      <tr key={idx.id}>
                        <td>{idx.table_name}</td>
                        <td>{idx.index_name}</td>
                        <td>{idx.index_type}</td>
                        <td>{idx.is_unique ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                    {indexes.data.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No indexes found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {indexes.pagination.pages > 1 && (
                <div className="pagination">
                  <button
                    disabled={indexes.pagination.page <= 1}
                    onClick={() => loadMoreIndexes(indexes.pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {indexes.pagination.page} of {indexes.pagination.pages}</span>
                  <button
                    disabled={indexes.pagination.page >= indexes.pagination.pages}
                    onClick={() => loadMoreIndexes(indexes.pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          {/* Stored Procedures */}
          {objectsSubTab === 'procedures' && (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Schema</th>
                      <th>Procedure Name</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procedures.data.map(proc => (
                      <tr key={proc.id}>
                        <td>{proc.schema_name}</td>
                        <td>{proc.procedure_name}</td>
                        <td>{formatDate(proc.created_date)}</td>
                      </tr>
                    ))}
                    {procedures.data.length === 0 && (
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No stored procedures found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {procedures.pagination.pages > 1 && (
                <div className="pagination">
                  <button
                    disabled={procedures.pagination.page <= 1}
                    onClick={() => loadMoreProcedures(procedures.pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {procedures.pagination.page} of {procedures.pagination.pages}</span>
                  <button
                    disabled={procedures.pagination.page >= procedures.pagination.pages}
                    onClick={() => loadMoreProcedures(procedures.pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Type</th>
                  <th>Default Schema</th>
                  <th>Roles</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.user_name}</td>
                    <td>{user.user_type}</td>
                    <td>{user.default_schema || '-'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{user.roles || '-'}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No users found
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
              <h2 className="modal-title">Export Database Data</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>&times;</button>
            </div>
            <div style={{ marginBottom: '15px', color: 'var(--text-secondary)' }}>
              Select what you want to export for <strong>{database.name}</strong>
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
                    Database info, tables, indexes, procedures, and users
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('tables')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Tables Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {tables.pagination?.total || 0} tables with row counts
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('indexes')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Indexes Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {indexes.pagination?.total || 0} database indexes
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('procedures')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Stored Procedures Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {procedures.pagination?.total || 0} stored procedures
                  </div>
                </div>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('users')}
                style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <div>
                  <strong>Database Users Only</strong>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {users.length} database users and their roles
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

export default DatabaseDetail;
