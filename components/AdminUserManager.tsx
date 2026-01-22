'use client';

import { useState, useEffect } from 'react';
import { UserProfile, UserProfileUpdate, getAllUsers, updateUserProfile, supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

interface InviteFormData {
  email: string;
  full_name: string;
  territory_zip: string;
  territory_radius_miles: number;
  territory_name: string;
  license_type: 'basic' | 'pro' | 'exclusive';
}

export default function AdminUserManager() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    full_name: '',
    territory_zip: '',
    territory_radius_miles: 50,
    territory_name: '',
    license_type: 'basic'
  });
  const [inviting, setInviting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<UserProfileUpdate>({});

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    const fetchedUsers = await getAllUsers();
    setUsers(fetchedUsers);
    setLoading(false);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviting(true);

    try {
      // Create user with Supabase Auth
      const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
      const { data, error: signupError } = await supabase.auth.signUp({
        email: inviteForm.email,
        password: tempPassword,
        options: {
          data: { full_name: inviteForm.full_name }
        }
      });

      if (signupError) throw signupError;

      if (data.user) {
        // Update the user profile with territory settings
        // Small delay to let the trigger create the user row
        await new Promise(r => setTimeout(r, 1000));

        await updateUserProfile(data.user.id, {
          full_name: inviteForm.full_name,
          territory_zip: inviteForm.territory_zip,
          territory_radius_miles: inviteForm.territory_radius_miles,
          territory_name: inviteForm.territory_name,
          license_type: inviteForm.license_type,
          is_active: true
        });

        // Send password reset email so user can set their own password
        await supabase.auth.resetPasswordForEmail(inviteForm.email);

        setSuccess(`User invited! A password reset email has been sent to ${inviteForm.email}`);
        setShowInviteForm(false);
        setInviteForm({
          email: '',
          full_name: '',
          territory_zip: '',
          territory_radius_miles: 50,
          territory_name: '',
          license_type: 'basic'
        });
        loadUsers();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    }

    setInviting(false);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      territory_zip: user.territory_zip,
      territory_radius_miles: user.territory_radius_miles,
      territory_name: user.territory_name,
      is_active: user.is_active,
      license_type: user.license_type,
      max_items_per_search: user.max_items_per_search
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setError('');

    try {
      await updateUserProfile(editingUser.id, editForm);
      setSuccess('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const toggleUserActive = async (user: UserProfile) => {
    try {
      await updateUserProfile(user.id, { is_active: !user.is_active });
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">Admin access required</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          User Management
        </h2>
        <button
          onClick={() => setShowInviteForm(true)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm transition-colors"
        >
          + Invite User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
          <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Invite New User
            </h3>

            <form onSubmit={handleInviteUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Territory Zip Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteForm.territory_zip}
                      onChange={(e) => setInviteForm(f => ({ ...f, territory_zip: e.target.value }))}
                      placeholder="55401"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Radius (miles)
                    </label>
                    <select
                      value={inviteForm.territory_radius_miles}
                      onChange={(e) => setInviteForm(f => ({ ...f, territory_radius_miles: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                    >
                      <option value={25}>25 miles</option>
                      <option value={50}>50 miles</option>
                      <option value={75}>75 miles</option>
                      <option value={100}>100 miles</option>
                      <option value={150}>150 miles</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Territory Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.territory_name}
                    onChange={(e) => setInviteForm(f => ({ ...f, territory_name: e.target.value }))}
                    placeholder="Minneapolis Metro"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    License Type
                  </label>
                  <select
                    value={inviteForm.license_type}
                    onChange={(e) => setInviteForm(f => ({ ...f, license_type: e.target.value as 'basic' | 'pro' | 'exclusive' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro (50mi exclusive)</option>
                    <option value="exclusive">Exclusive (100mi exclusive)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md font-medium text-sm transition-colors"
                >
                  {inviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Edit User: {editingUser.email}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Territory Zip
                  </label>
                  <input
                    type="text"
                    value={editForm.territory_zip || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, territory_zip: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Radius (miles)
                  </label>
                  <select
                    value={editForm.territory_radius_miles || 50}
                    onChange={(e) => setEditForm(f => ({ ...f, territory_radius_miles: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                  >
                    <option value={25}>25 miles</option>
                    <option value={50}>50 miles</option>
                    <option value={75}>75 miles</option>
                    <option value={100}>100 miles</option>
                    <option value={150}>150 miles</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Territory Name
                </label>
                <input
                  type="text"
                  value={editForm.territory_name || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, territory_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Type
                </label>
                <select
                  value={editForm.license_type || 'basic'}
                  onChange={(e) => setEditForm(f => ({ ...f, license_type: e.target.value as 'basic' | 'pro' | 'exclusive' }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="exclusive">Exclusive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Items Per Search
                </label>
                <input
                  type="number"
                  value={editForm.max_items_per_search || 100}
                  onChange={(e) => setEditForm(f => ({ ...f, max_items_per_search: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editForm.is_active ?? true}
                  onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  Account Active
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : users.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No users found. Invite your first user!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">User</th>
                <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">Territory</th>
                <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">License</th>
                <th className="text-left py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-2 text-gray-600 dark:text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-3 px-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{user.email}</p>
                      {user.full_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.full_name}</p>
                      )}
                      {user.role === 'admin' && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    {user.territory_zip ? (
                      <div>
                        <p className="text-gray-900 dark:text-gray-100">
                          {user.territory_name || user.territory_zip}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.territory_zip} - {user.territory_radius_miles}mi radius
                        </p>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">Not set</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                      user.license_type === 'exclusive'
                        ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                        : user.license_type === 'pro'
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {user.license_type}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => toggleUserActive(user)}
                      className={`inline-block px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                        user.is_active
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900'
                      }`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
