import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/search', { params: { q: query } });
        setResults(res.data);
        setShowResults(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (type, id) => {
    setShowResults(false);
    setQuery('');
    if (type === 'instance') {
      navigate(`/instance/${id}`);
    } else {
      navigate(`/database/${id}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && query.length >= 2) {
      setShowResults(false);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="search-container" ref={searchRef}>
      <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        type="text"
        className="search-input"
        placeholder="Search instances, databases, apps..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setShowResults(true)}
        onKeyDown={handleKeyDown}
      />

      {showResults && results && (
        <div className="search-results">
          {results.instances.length > 0 && (
            <div className="search-results-section">
              <h4>Instances</h4>
              {results.instances.map(instance => (
                <div
                  key={instance.id}
                  className="search-result-item"
                  onClick={() => handleSelect('instance', instance.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-dot ${instance.last_status?.toLowerCase()}`}></span>
                    <span>{instance.name}</span>
                    <span className={`env-badge env-${instance.environment?.toLowerCase()}`}>
                      {instance.environment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.databases.length > 0 && (
            <div className="search-results-section">
              <h4>Databases</h4>
              {results.databases.map(db => (
                <div
                  key={db.id}
                  className="search-result-item"
                  onClick={() => handleSelect('database', db.id)}
                >
                  <div>{db.name}</div>
                  <small style={{ color: 'var(--text-secondary)' }}>
                    on {db.instance_name}
                  </small>
                </div>
              ))}
            </div>
          )}

          {results.instances.length === 0 && results.databases.length === 0 && (
            <div className="search-results-section">
              <p style={{ color: 'var(--text-secondary)' }}>No results found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
