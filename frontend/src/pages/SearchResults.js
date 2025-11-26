import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState({ instances: [], databases: [], tables: [], procedures: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (query) {
      fetchResults();
    }
  }, [query]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const res = await api.get('/search', { params: { q: query } });
      setResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!query) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Enter a search query to find instances and databases</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
        <span style={{ margin: '0 10px', color: 'var(--text-secondary)' }}>/</span>
        <span>Search Results</span>
      </div>

      <h1 style={{ marginBottom: '20px' }}>Search Results for "{query}"</h1>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Instances Results */}
          {results.instances.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Instances ({results.instances.length})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Instance Name</th>
                      <th>Environment</th>
                      <th>AG Name</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.instances.map(instance => (
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
                          <span className={`env-badge env-${instance.environment?.toLowerCase()}`}>
                            {instance.environment}
                          </span>
                        </td>
                        <td>{instance.ag_name || 'Standalone'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {instance.description?.substring(0, 50) || '-'}
                          {instance.description?.length > 50 ? '...' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Databases Results */}
          {results.databases.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '15px' }}>Databases ({results.databases.length})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Database Name</th>
                      <th>Instance</th>
                      <th>Environment</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.databases.map(db => (
                      <tr
                        key={db.id}
                        className="clickable"
                        onClick={() => navigate(`/database/${db.id}`)}
                      >
                        <td>
                          <span className={`status-badge ${db.status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
                            {db.status || 'Unknown'}
                          </span>
                        </td>
                        <td><strong>{db.name}</strong></td>
                        <td>{db.instance_name}</td>
                        <td>
                          <span className={`env-badge env-${db.environment?.toLowerCase()}`}>
                            {db.environment}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {db.description?.substring(0, 50) || '-'}
                          {db.description?.length > 50 ? '...' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tables Results */}
          {results.tables && results.tables.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Tables ({results.tables.length})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Table Name</th>
                      <th>Schema</th>
                      <th>Database</th>
                      <th>Instance</th>
                      <th>Environment</th>
                      <th>Row Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.tables.map(table => (
                      <tr
                        key={table.id}
                        className="clickable"
                        onClick={() => navigate(`/database/${table.database_id}`)}
                      >
                        <td><strong>{table.table_name}</strong></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{table.schema_name}</td>
                        <td>
                          <Link
                            to={`/database/${table.database_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--primary-color)' }}
                          >
                            {table.database_name}
                          </Link>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{table.instance_name}</td>
                        <td>
                          <span className={`env-badge env-${table.environment?.toLowerCase()}`}>
                            {table.environment}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {table.row_count?.toLocaleString() || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stored Procedures Results */}
          {results.procedures && results.procedures.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>Stored Procedures ({results.procedures.length})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Procedure Name</th>
                      <th>Schema</th>
                      <th>Database</th>
                      <th>Instance</th>
                      <th>Environment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.procedures.map(proc => (
                      <tr
                        key={proc.id}
                        className="clickable"
                        onClick={() => navigate(`/database/${proc.database_id}`)}
                      >
                        <td><strong>{proc.procedure_name}</strong></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{proc.schema_name}</td>
                        <td>
                          <Link
                            to={`/database/${proc.database_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'var(--primary-color)' }}
                          >
                            {proc.database_name}
                          </Link>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{proc.instance_name}</td>
                        <td>
                          <span className={`env-badge env-${proc.environment?.toLowerCase()}`}>
                            {proc.environment}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No Results */}
          {results.instances.length === 0 && results.databases.length === 0 &&
           (!results.tables || results.tables.length === 0) &&
           (!results.procedures || results.procedures.length === 0) && (
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No results found for "{query}"</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '10px' }}>
                Try searching for instance names, database names, table names, or stored procedure names
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SearchResults;
