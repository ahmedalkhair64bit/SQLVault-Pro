import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import InstanceDetail from './pages/InstanceDetail';
import DatabaseDetail from './pages/DatabaseDetail';
import ApplicationDetail from './pages/ApplicationDetail';
import AGDetail from './pages/AGDetail';
import AdminInstances from './pages/AdminInstances';
import AdminUsers from './pages/AdminUsers';
import AdminApplications from './pages/AdminApplications';
import SearchResults from './pages/SearchResults';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="instance/:id" element={<InstanceDetail />} />
        <Route path="database/:id" element={<DatabaseDetail />} />
        <Route path="application/:id" element={<ApplicationDetail />} />
        <Route path="ag/:agName" element={<AGDetail />} />
        <Route path="search" element={<SearchResults />} />
        <Route
          path="admin/instances"
          element={
            <PrivateRoute adminOnly>
              <AdminInstances />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <PrivateRoute adminOnly>
              <AdminUsers />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/applications"
          element={
            <PrivateRoute adminOnly>
              <AdminApplications />
            </PrivateRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
