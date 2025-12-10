/**
 * GitHub Personal Access Token Authentication
 * Handles PAT validation, storage, and user authentication flow
 */

// Constants
const GITHUB_API_BASE = 'https://api.github.com';
const STORAGE_KEY_PAT = 'github_pat';

// DOM Elements
const form = document.getElementById('auth-form');
const patInput = document.getElementById('pat-input');
const submitButton = document.getElementById('submit-button');
const errorMessage = document.getElementById('error-message');
const toggleVisibility = document.getElementById('toggle-visibility');
const eyeIcon = document.getElementById('eye-icon');

/**
 * Initialize the authentication page
 */
function init() {
    // Check if user is already authenticated
    checkExistingAuth();

    // Setup event listeners
    form.addEventListener('submit', handleSubmit);
    toggleVisibility.addEventListener('click', handleToggleVisibility);

    // Auto-focus on PAT input
    patInput.focus();
}

/**
 * Check if user already has a valid token stored
 */
async function checkExistingAuth() {
    const existingPat = getStoredPAT();

    if (existingPat) {
        // Validate the existing token
        showLoading(true);
        const isValid = await validatePAT(existingPat);

        if (isValid) {
            // Redirect to dashboard if token is valid
            window.location.href = 'dashboard.html';
            return;
        } else {
            // Clear invalid token
            clearStoredPAT();
        }
        showLoading(false);
    }
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
    event.preventDefault();

    hideError();
    showLoading(true);

    const pat = patInput.value.trim();
    const storageType = document.querySelector('input[name="storage"]:checked').value;

    if (!pat) {
        showError('Please enter your GitHub Personal Access Token.');
        showLoading(false);
        return;
    }

    // Validate token format (GitHub PATs start with ghp_, gho_, etc.)
    if (!pat.match(/^(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}$/)) {
        showError('Invalid token format. GitHub Personal Access Tokens should start with "ghp_" and be followed by at least 36 characters.');
        showLoading(false);
        return;
    }

    try {
        // Validate PAT with GitHub API
        const userData = await validatePAT(pat);

        if (userData) {
            // Store the PAT
            storePAT(pat, storageType);

            // Store user info
            storeUserInfo(userData, storageType);

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            showError('Failed to validate token. Please check your token and try again.');
            showLoading(false);
        }
    } catch (error) {
        handleAuthError(error);
        showLoading(false);
    }
}

/**
 * Validate PAT by calling GitHub API /user endpoint
 * @param {string} pat - Personal Access Token
 * @returns {Object|null} User data if valid, null otherwise
 */
async function validatePAT(pat) {
    try {
        const response = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const userData = await response.json();

            // Verify required scopes
            const scopes = response.headers.get('X-OAuth-Scopes');
            if (!validateScopes(scopes)) {
                throw new Error('INSUFFICIENT_SCOPES');
            }

            return {
                login: userData.login,
                name: userData.name || userData.login,
                avatar_url: userData.avatar_url,
                id: userData.id
            };
        } else if (response.status === 401) {
            throw new Error('INVALID_TOKEN');
        } else if (response.status === 403) {
            throw new Error('RATE_LIMIT');
        } else {
            throw new Error('API_ERROR');
        }
    } catch (error) {
        if (error.message === 'INSUFFICIENT_SCOPES' ||
            error.message === 'INVALID_TOKEN' ||
            error.message === 'RATE_LIMIT' ||
            error.message === 'API_ERROR') {
            throw error;
        }
        // Network error
        throw new Error('NETWORK_ERROR');
    }
}

/**
 * Validate that the token has required scopes
 * @param {string} scopes - Comma-separated list of scopes
 * @returns {boolean} True if all required scopes are present
 */
function validateScopes(scopes) {
    if (!scopes) return false;

    const scopeList = scopes.split(',').map(s => s.trim());
    const requiredScopes = ['repo', 'read:user', 'read:org'];

    // Check if token has repo scope (this gives access to everything we need)
    if (scopeList.includes('repo')) {
        return true;
    }

    // Otherwise check for individual scopes
    return requiredScopes.every(required => {
        // Handle scope prefixes (e.g., 'read:user' matches 'user' or 'read:user')
        return scopeList.some(scope =>
            scope === required ||
            scope === required.split(':')[1] ||
            scope.startsWith(required.split(':')[1])
        );
    });
}

/**
 * Store PAT in browser storage
 * @param {string} pat - Personal Access Token
 * @param {string} storageType - 'local' or 'session'
 */
function storePAT(pat, storageType) {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    storage.setItem(STORAGE_KEY_PAT, pat);
}

/**
 * Store user information
 * @param {Object} userData - User data from GitHub API
 * @param {string} storageType - 'local' or 'session'
 */
function storeUserInfo(userData, storageType) {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    storage.setItem('user_info', JSON.stringify(userData));
}

/**
 * Get stored PAT from browser storage
 * @returns {string|null} PAT if found, null otherwise
 */
function getStoredPAT() {
    return localStorage.getItem(STORAGE_KEY_PAT) || sessionStorage.getItem(STORAGE_KEY_PAT);
}

/**
 * Clear stored PAT from all storage
 */
function clearStoredPAT() {
    localStorage.removeItem(STORAGE_KEY_PAT);
    sessionStorage.removeItem(STORAGE_KEY_PAT);
    localStorage.removeItem('user_info');
    sessionStorage.removeItem('user_info');
}

/**
 * Handle authentication errors with user-friendly messages
 * @param {Error} error - Error object
 */
function handleAuthError(error) {
    let errorMsg = '';

    switch (error.message) {
        case 'INVALID_TOKEN':
            errorMsg = 'Invalid token. Please check your Personal Access Token and try again. Make sure you copied the entire token.';
            break;
        case 'INSUFFICIENT_SCOPES':
            errorMsg = 'Insufficient permissions. Please create a new token with the required scopes: <code>repo</code>, <code>read:user</code>, and <code>read:org</code>.';
            break;
        case 'RATE_LIMIT':
            errorMsg = 'GitHub API rate limit exceeded. Please wait a moment and try again.';
            break;
        case 'NETWORK_ERROR':
            errorMsg = 'Network error. Please check your internet connection and try again.';
            break;
        case 'API_ERROR':
            errorMsg = 'GitHub API error. Please try again later.';
            break;
        default:
            errorMsg = 'An unexpected error occurred. Please try again.';
    }

    showError(errorMsg);
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    errorMessage.innerHTML = message;
    errorMessage.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
    errorMessage.style.display = 'none';
    errorMessage.innerHTML = '';
}

/**
 * Show/hide loading state
 * @param {boolean} loading - True to show loading, false to hide
 */
function showLoading(loading) {
    submitButton.disabled = loading;

    if (loading) {
        submitButton.classList.add('loading');
        submitButton.textContent = 'Validating...';
    } else {
        submitButton.classList.remove('loading');
        submitButton.textContent = 'Validate & Continue';
    }
}

/**
 * Toggle PAT input visibility
 */
function handleToggleVisibility() {
    const isPassword = patInput.type === 'password';

    patInput.type = isPassword ? 'text' : 'password';
    eyeIcon.textContent = isPassword ? '🙈' : '👁️';
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
