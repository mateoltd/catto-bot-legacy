'use client';

import { useState } from 'react';

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      // Call Sapphire's OAuth logout endpoint
      await fetch('/api/oauth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Redirect to home page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50"
      aria-label="Sign out"
    >
      {isLoading ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
