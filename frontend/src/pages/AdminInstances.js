import React, { useState, useEffect } from 'react';
import api from '../services/api';

function AdminInstances() {
  const [instances, setInstances] = useState([]);
  const [disabledInstances, setDisabledInstances] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablingInstance, setDisablingInstance] = useState(null);
  const [disableForm, setDisableForm] = useState({
    reason: '',
    type: 'temporary'
  });
  const [editingInstance, setEditingInstance] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    environment: 'Production',
    host: '',
    port: 1433,
    is_always_on: false,
    ag_name: '',
    auth_username: '',
    auth_password: '',
    description: '',
    application_ids: []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPrivilegeInfo, setShowPrivilegeInfo] = useState(false);
  const [showDisabledSection, setShowDisabledSection] = useState(false);

  useEffect(() => {
    fetchInstances();
    fetchApplications();
    fetchDisabledInstances();
  }, []);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const res = await api.get('/instances');
      setInstances(res.data);
    } catch (err) {
      console.error('Failed to load instances:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDisabledInstances = async () => {
    try {
      const res = await api.get('/instances/disabled/list');
      setDisabledInstances(res.data);
    } catch (err) {
      console.error('Failed to load disabled instances:', err);
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

  const resetForm = () => {
    setFormData({
      name: '',
      environment: 'Production',
      host: '',
      port: 1433,
      is_always_on: false,
      ag_name: '',
      auth_username: '',
      auth_password: '',
      description: '',
      application_ids: []
    });
    setEditingInstance(null);
    setError('');
    setShowPrivilegeInfo(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (instance) => {
    setEditingInstance(instance);
    setFormData({
      name: instance.name,
      environment: instance.environment,
      host: instance.host,
      port: instance.port,
      is_always_on: instance.is_always_on,
      ag_name: instance.ag_name || '',
      auth_username: '',
      auth_password: '',
      description: instance.description || '',
      application_ids: instance.application_ids || []
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingInstance) {
        // Update existing instance
        const updateData = { ...formData };
        if (!updateData.auth_password) {
          delete updateData.auth_password;
        }
        await api.put(`/instances/${editingInstance.id}`, updateData);
      } else {
        // Create new instance
        await api.post('/instances', formData);
      }
      closeModal();
      fetchInstances();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save instance');
    } finally {
      setSaving(false);
    }
  };

  const openDisableModal = (instance) => {
    setDisablingInstance(instance);
    setDisableForm({ reason: '', type: 'temporary' });
    setShowDisableModal(true);
  };

  const closeDisableModal = () => {
    setShowDisableModal(false);
    setDisablingInstance(null);
    setDisableForm({ reason: '', type: 'temporary' });
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (!disableForm.reason.trim()) {
      setError('Please provide a reason for disabling');
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/instances/${disablingInstance.id}`, {
        data: { reason: disableForm.reason, type: disableForm.type }
      });
      closeDisableModal();
      fetchInstances();
      fetchDisabledInstances();
    } catch (err) {
      console.error('Disable failed:', err);
      setError(err.response?.data?.error || 'Failed to disable instance');
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (instance) => {
    if (!window.confirm(`Are you sure you want to reactivate instance "${instance.name}"?`)) {
      return;
    }

    try {
      await api.post(`/instances/${instance.id}/reactivate`);
      fetchInstances();
      fetchDisabledInstances();
    } catch (err) {
      console.error('Reactivate failed:', err);
    }
  };

  const handleRefresh = async (instance) => {
    try {
      await api.post(`/instances/${instance.id}/refresh`);
      fetchInstances();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Manage SQL Server Instances</h1>
        <button className="btn btn-primary" onClick={openAddModal}>
          Add Instance
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Instance Name</th>
                  <th>Environment</th>
                  <th>Host</th>
                  <th>AG Name</th>
                  <th>Last Checked</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(instance => (
                  <tr key={instance.id}>
                    <td>
                      <span className={`status-badge status-${instance.last_status?.toLowerCase()}`}>
                        {instance.last_status || 'Unknown'}
                      </span>
                    </td>
                    <td>
                      <strong>{instance.name}</strong>
                      {instance.description && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {instance.description.substring(0, 40)}{instance.description.length > 40 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`env-badge env-${instance.environment?.toLowerCase()}`}>
                        {instance.environment}
                      </span>
                    </td>
                    <td>{instance.host}:{instance.port}</td>
                    <td>{instance.ag_name || 'Standalone'}</td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(instance.last_checked_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => handleRefresh(instance)}
                          title="Refresh metadata"
                        >
                          Refresh
                        </button>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => openEditModal(instance)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small"
                          style={{ backgroundColor: 'var(--danger)', color: 'white' }}
                          onClick={() => openDisableModal(instance)}
                        >
                          Disable
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {instances.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No instances configured. Click "Add Instance" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ width: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingInstance ? 'Edit Instance' : 'Add New Instance'}
              </h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Instance Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., SQLPROD01\MAIN"
                    required
                    disabled={editingInstance}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment *</label>
                  <select
                    className="form-select"
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                  >
                    <option value="Production">Production</option>
                    <option value="Dev">Dev</option>
                    <option value="QA">QA</option>
                    <option value="UAT">UAT</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Host / IP *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="e.g., 192.168.1.100 or hostname"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 1433 })}
                    min="1"
                    max="65535"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.is_always_on}
                    onChange={(e) => setFormData({ ...formData, is_always_on: e.target.checked })}
                  />
                  Part of Always On Availability Group
                </label>
              </div>

              {formData.is_always_on && (
                <div className="form-group">
                  <label className="form-label">Availability Group Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.ag_name}
                    onChange={(e) => setFormData({ ...formData, ag_name: e.target.value })}
                    placeholder="e.g., AG_Production"
                  />
                </div>
              )}

              {/* Applications Selection */}
              <div className="form-group">
                <label className="form-label">Associated Applications</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  {applications.length > 0 ? applications.map(app => (
                    <label key={app.id} className="form-checkbox" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={formData.application_ids.includes(app.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, application_ids: [...formData.application_ids, app.id] });
                          } else {
                            setFormData({ ...formData, application_ids: formData.application_ids.filter(id => id !== app.id) });
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

              {/* Credentials Section */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>SQL Server Credentials</h3>
                  <button
                    type="button"
                    className="btn btn-small btn-secondary"
                    onClick={() => setShowPrivilegeInfo(!showPrivilegeInfo)}
                  >
                    {showPrivilegeInfo ? 'Hide' : 'Show'} Required Privileges
                  </button>
                </div>

                {showPrivilegeInfo && (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--primary-color)' }}>
                      Minimum Required Privileges for Inventory Collection:
                    </h4>
                    <pre style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      background: 'var(--bg-primary)',
                      padding: '10px',
                      borderRadius: '4px',
                      overflow: 'auto'
                    }}>
{`-- Create a login for inventory collection
CREATE LOGIN [inventory_reader] WITH PASSWORD = 'YourSecurePassword';

-- Grant server-level permissions
GRANT VIEW SERVER STATE TO [inventory_reader];
GRANT VIEW ANY DEFINITION TO [inventory_reader];
GRANT VIEW ANY DATABASE TO [inventory_reader];

-- For each database you want to inventory:
USE [YourDatabase];
CREATE USER [inventory_reader] FOR LOGIN [inventory_reader];
GRANT VIEW DEFINITION TO [inventory_reader];
GRANT SELECT ON sys.database_principals TO [inventory_reader];

-- For backup history (read from msdb):
USE [msdb];
CREATE USER [inventory_reader] FOR LOGIN [inventory_reader];
GRANT SELECT ON dbo.backupset TO [inventory_reader];`}
                    </pre>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">SQL Auth Username {editingInstance ? '' : '*'}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.auth_username}
                      onChange={(e) => setFormData({ ...formData, auth_username: e.target.value })}
                      placeholder={editingInstance ? 'Leave blank to keep current' : 'SQL Server login'}
                      required={!editingInstance}
                    />
                    {editingInstance && (
                      <small style={{ color: 'var(--success)', marginTop: '5px', display: 'block' }}>
                        Username is saved. Leave blank to keep current username.
                      </small>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      SQL Auth Password {editingInstance ? '' : '*'}
                    </label>
                    <input
                      type="password"
                      className="form-input"
                      value={formData.auth_password}
                      onChange={(e) => setFormData({ ...formData, auth_password: e.target.value })}
                      placeholder={editingInstance ? 'Leave blank to keep current' : 'Enter password'}
                      required={!editingInstance}
                    />
                    {editingInstance && (
                      <small style={{ color: 'var(--success)', marginTop: '5px', display: 'block' }}>
                        Password is saved securely. Leave blank to keep current password.
                      </small>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this instance used for?"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingInstance ? 'Update Instance' : 'Add Instance')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable Instance Modal */}
      {showDisableModal && disablingInstance && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeDisableModal()}>
          <div className="modal" style={{ width: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Disable Instance</h2>
              <button className="modal-close" onClick={closeDisableModal}>&times;</button>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
              <p style={{ margin: 0 }}>
                You are about to disable: <strong>{disablingInstance.name}</strong>
              </p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleDisable}>
              <div className="form-group">
                <label className="form-label">Disable Type *</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label className="form-checkbox">
                    <input
                      type="radio"
                      name="disableType"
                      checked={disableForm.type === 'temporary'}
                      onChange={() => setDisableForm({ ...disableForm, type: 'temporary' })}
                    />
                    Temporary
                  </label>
                  <label className="form-checkbox">
                    <input
                      type="radio"
                      name="disableType"
                      checked={disableForm.type === 'permanent'}
                      onChange={() => setDisableForm({ ...disableForm, type: 'permanent' })}
                    />
                    Permanent
                  </label>
                </div>
                <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                  {disableForm.type === 'temporary'
                    ? 'Instance can be reactivated later'
                    : 'Instance is being decommissioned'}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Disabling *</label>
                <textarea
                  className="form-textarea"
                  value={disableForm.reason}
                  onChange={(e) => setDisableForm({ ...disableForm, reason: e.target.value })}
                  placeholder="e.g., Server maintenance, Migration to new server, Decommissioned..."
                  rows={3}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeDisableModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ backgroundColor: 'var(--danger)', color: 'white' }}
                  disabled={saving || !disableForm.reason.trim()}
                >
                  {saving ? 'Disabling...' : 'Disable Instance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disabled Instances Section */}
      {disabledInstances.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px',
              cursor: 'pointer'
            }}
            onClick={() => setShowDisabledSection(!showDisabledSection)}
          >
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {showDisabledSection ? '▼' : '▶'}
              </span>
              Disabled Instances ({disabledInstances.length})
            </h2>
          </div>

          {showDisabledSection && (
            <div className="card">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Instance Name</th>
                      <th>Environment</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Disabled At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disabledInstances.map(instance => (
                      <tr key={instance.id} style={{ opacity: 0.7 }}>
                        <td>
                          <strong>{instance.name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {instance.host}:{instance.port}
                          </div>
                        </td>
                        <td>
                          <span className={`env-badge env-${instance.environment?.toLowerCase()}`}>
                            {instance.environment}
                          </span>
                        </td>
                        <td>
                          <span
                            className="env-badge"
                            style={{
                              backgroundColor: instance.disabled_type === 'permanent'
                                ? 'var(--danger)'
                                : 'var(--warning)',
                              color: 'white'
                            }}
                          >
                            {instance.disabled_type === 'permanent' ? 'Permanent' : 'Temporary'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '250px' }}>
                          <div style={{ fontSize: '0.9rem' }}>
                            {instance.disabled_reason}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {formatDate(instance.disabled_at)}
                        </td>
                        <td>
                          <button
                            className="btn btn-small"
                            style={{ backgroundColor: 'var(--success)', color: 'white' }}
                            onClick={() => handleReactivate(instance)}
                          >
                            Reactivate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminInstances;
