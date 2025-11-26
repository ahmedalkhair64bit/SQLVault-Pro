import React, { useState, useEffect } from 'react';
import api from '../services/api';

function AdminApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications');
      setApplications(res.data);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    });
    setEditingApp(null);
    setError('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (app) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      description: app.description || ''
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
      if (editingApp) {
        await api.put(`/applications/${editingApp.id}`, formData);
      } else {
        await api.post('/applications', formData);
      }
      closeModal();
      fetchApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (app) => {
    if (!window.confirm(`Are you sure you want to delete application "${app.name}"?\n\nThis will remove all associations with databases.`)) {
      return;
    }

    try {
      await api.delete(`/applications/${app.id}`);
      fetchApplications();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete application');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1>Manage Applications</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>
            Create applications to group and organize your SQL Server instances and databases
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          Add Application
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
                  <th>Application Name</th>
                  <th>Description</th>
                  <th>Databases</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td>
                      <strong>{app.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '300px' }}>
                      {app.description ? (
                        <>
                          {app.description.substring(0, 100)}
                          {app.description.length > 100 ? '...' : ''}
                        </>
                      ) : (
                        <span style={{ opacity: 0.5 }}>No description</span>
                      )}
                    </td>
                    <td>
                      <span className="env-badge env-dev">
                        {app.database_count || 0} databases
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDate(app.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-secondary btn-small"
                          onClick={() => openEditModal(app)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small"
                          style={{ backgroundColor: 'var(--danger)', color: 'white' }}
                          onClick={() => handleDelete(app)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                      <p>No applications defined yet.</p>
                      <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                        Click "Add Application" to create your first application.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Application Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ width: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingApp ? 'Edit Application' : 'Add New Application'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Application Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., CRM System, ERP, HR Portal"
                  required
                  autoFocus
                />
                <small style={{ color: 'var(--text-secondary)', marginTop: '5px', display: 'block' }}>
                  Choose a descriptive name for your application
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this application is used for..."
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingApp ? 'Update Application' : 'Create Application')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminApplications;
