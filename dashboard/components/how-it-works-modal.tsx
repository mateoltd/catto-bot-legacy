'use client';

import { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';

export function HowItWorksModal() {
  const [isOpen, setIsOpen] = useState(false);

  // Unified effect to handle scroll and Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Save current scroll position
    const scrollY = window.scrollY;

    // Block scroll - using a different approach to prevent the left margin issue
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = 'var(--scrollbar-width, 15px)'; // Compensate for scrollbar
    document.body.style.position = 'relative'; // Changed from fixed to relative

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleEscape);

    // Cleanup
    return () => {
      // Restore original styles
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      document.body.style.position = '';

      // Remove event listener
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="text-gray-400 hover:text-gray-600 text-xs">
        how it works
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 m-0 p-0 left-0 right-0 top-0 bottom-0 w-full h-full"
          style={{ margin: 0, padding: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] relative mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                aria-label="Close modal"
              >
                <XIcon className="h-5 w-5" />
              </button>

              <div className="overflow-y-auto pr-2 max-h-[calc(90vh-3rem)]">
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">How it works</h2>

                  <p className="text-sm text-gray-600">
                    This implementation provides a simple and secure way to add Discord
                    authentication to your bot dashboard, including user verification and enhanced
                    security features.
                  </p>

                  <div className="space-y-2">
                    <h3 className="font-semibold">What You Get</h3>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      <li>
                        A clean, minimal login button that opens Discord's authentication popup
                      </li>
                      <li>Secure user authentication using Discord's OAuth 2.0 protocol</li>
                      <li>
                        User profile information including username, discriminator, avatar, and
                        guilds
                      </li>
                      <li>Access to user's Discord servers for bot management</li>
                      <li>Comprehensive error handling with specific error messages</li>
                      <li>Secure session management with HTTP-only, SameSite=lax cookies</li>
                      <li>Optimized performance using React Server Components</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Technical Implementation</h3>
                    <p className="text-sm text-gray-600">
                      This project uses Next.js App Router with React Server Components for optimal
                      performance. When a user clicks "Login with Discord":
                    </p>
                    <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
                      <li>A popup window opens with Discord's authentication page</li>
                      <li>
                        After authenticating, Discord redirects to our callback URL with an
                        authorization code
                      </li>
                      <li>Our server verifies the state parameter to prevent CSRF attacks</li>
                      <li>The server exchanges the code for an access token using Discord's API</li>
                      <li>We fetch the user's profile information and guild list</li>
                      <li>
                        The app creates a secure JWT token containing the user data with proper
                        expiration
                      </li>
                      <li>
                        The JWT is stored in an HTTP-only, SameSite=lax cookie for secure session
                        management
                      </li>
                      <li>
                        The popup closes automatically and the main page updates to show the user's
                        profile
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Error Handling</h3>
                    <p className="text-sm text-gray-600">
                      The app includes robust error handling for various scenarios:
                    </p>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      <li>
                        Authentication cancellation - Gracefully handles when a user cancels the
                        Discord login process
                      </li>
                      <li>
                        Specific error messages - Provides detailed error information based on error
                        type
                      </li>
                      <li>Token validation - Automatically clears invalid or expired tokens</li>
                      <li>
                        Popup blocking detection - Notifies users when popups are blocked by their
                        browser
                      </li>
                      <li>
                        State parameter validation - Prevents cross-site request forgery attacks
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Setup Instructions</h3>
                    <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
                      <li>Create a Discord Application in the Discord Developer Portal</li>
                      <li>
                        Set your redirect URI to:{' '}
                        <code>https://your-domain.com/api/auth/callback</code>
                      </li>
                      <li>
                        Add these environment variables to your project:
                        <ul className="list-disc pl-5 mt-1">
                          <li>
                            <code>DISCORD_CLIENT_ID</code> - Your Discord app's client ID
                          </li>
                          <li>
                            <code>DISCORD_CLIENT_SECRET</code> - Your Discord app's client secret
                          </li>
                          <li>
                            <code>DISCORD_REDIRECT_URI</code> - Your callback URL
                          </li>
                          <li>
                            <code>JWT_SECRET</code> - A secure random string for JWT signing
                          </li>
                        </ul>
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Security Features</h3>
                    <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                      <li>
                        Proper PKCE implementation with SHA-256 hashing to prevent code interception
                        attacks
                      </li>
                      <li>State parameter validation to prevent CSRF attacks</li>
                      <li>
                        HTTP-only cookies to prevent client-side JavaScript access to authentication
                        tokens
                      </li>
                      <li>SameSite=lax cookie attribute to prevent cross-site request forgery</li>
                      <li>Secure JWT implementation with proper expiration and signing</li>
                      <li>Explicit error handling with detailed error codes</li>
                      <li>Centralized configuration for consistent security settings</li>
                      <li>Automatic token validation and cleanup of expired tokens</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
