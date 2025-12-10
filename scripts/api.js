/**
 * GitHub API utilities
 * Shared functions for interacting with GitHub REST API
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Get stored PAT from browser storage
 * @returns {string|null} PAT if found, null otherwise
 */
function getStoredPAT() {
    return localStorage.getItem('github_pat') || sessionStorage.getItem('github_pat');
}

/**
 * Get stored user info from browser storage
 * @returns {Object|null} User info if found, null otherwise
 */
function getStoredUserInfo() {
    const userInfoStr = localStorage.getItem('user_info') || sessionStorage.getItem('user_info');
    return userInfoStr ? JSON.parse(userInfoStr) : null;
}

/**
 * Store user info in browser storage
 * @param {Object} userInfo - User information object
 */
function storeUserInfo(userInfo) {
    const storage = localStorage.getItem('github_pat') ? localStorage : sessionStorage;
    storage.setItem('user_info', JSON.stringify(userInfo));
}

/**
 * Make authenticated request to GitHub API
 * @param {string} endpoint - API endpoint (e.g., '/user', '/user/repos')
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Response data
 */
async function githubAPI(endpoint, options = {}) {
    const pat = getStoredPAT();

    if (!pat) {
        throw new Error('NO_TOKEN');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API_BASE}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers
        }
    });

    if (response.status === 401) {
        // Token is invalid, clear it and redirect to auth
        clearAuth();
        window.location.href = 'auth.html';
        throw new Error('INVALID_TOKEN');
    }

    if (response.status === 403) {
        // Rate limit or forbidden
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
            throw new Error('RATE_LIMIT_EXCEEDED');
        }
        throw new Error('FORBIDDEN');
    }

    if (!response.ok) {
        throw new Error(`API_ERROR: ${response.status}`);
    }

    return response.json();
}

/**
 * Fetch current user information from GitHub API
 * @returns {Promise<Object>} User information
 */
async function fetchUserInfo() {
    const userData = await githubAPI('/user');

    return {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url,
        id: userData.id,
        email: userData.email,
        bio: userData.bio,
        public_repos: userData.public_repos,
        followers: userData.followers,
        following: userData.following
    };
}

/**
 * Clear all authentication data
 */
function clearAuth() {
    localStorage.removeItem('github_pat');
    sessionStorage.removeItem('github_pat');
    localStorage.removeItem('user_info');
    sessionStorage.removeItem('user_info');
    localStorage.removeItem('organizations');
    sessionStorage.removeItem('organizations');
    localStorage.removeItem('organizations_timestamp');
    sessionStorage.removeItem('organizations_timestamp');
}

/**
 * Require authentication - redirect to auth page if not logged in
 */
function requireAuth() {
    const pat = getStoredPAT();
    if (!pat) {
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}

/**
 * Initialize user info - load from storage or fetch from API
 * @param {boolean} forceRefresh - Force refresh from API even if cached
 * @returns {Promise<Object>} User information
 */
async function initUserInfo(forceRefresh = false) {
    if (!requireAuth()) {
        return null;
    }

    // Try to load from storage first
    if (!forceRefresh) {
        const storedUserInfo = getStoredUserInfo();
        if (storedUserInfo) {
            return storedUserInfo;
        }
    }

    // Fetch from API and store
    try {
        const userInfo = await fetchUserInfo();
        storeUserInfo(userInfo);
        return userInfo;
    } catch (error) {
        console.error('Failed to fetch user info:', error);
        // If token is invalid, requireAuth already redirected
        if (error.message !== 'INVALID_TOKEN') {
            throw error;
        }
        return null;
    }
}

/**
 * Display user info in the dashboard header
 * @param {Object} userInfo - User information object
 */
function displayUserInfo(userInfo) {
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    const loginEl = document.getElementById('user-login');

    if (avatarEl && userInfo.avatar_url) {
        avatarEl.src = userInfo.avatar_url;
        avatarEl.alt = `${userInfo.name}'s avatar`;
    }

    if (nameEl) {
        nameEl.textContent = userInfo.name;
    }

    if (loginEl) {
        loginEl.textContent = `@${userInfo.login}`;
    }
}

// ==================== Organization Management ====================

/**
 * Get stored organizations from browser storage
 * @returns {Array|null} Organizations array if found, null otherwise
 */
function getStoredOrganizations() {
    const orgsStr = localStorage.getItem('organizations') || sessionStorage.getItem('organizations');
    return orgsStr ? JSON.parse(orgsStr) : null;
}

/**
 * Store organizations in browser storage
 * @param {Array} organizations - Organizations array
 */
function storeOrganizations(organizations) {
    const storage = localStorage.getItem('github_pat') ? localStorage : sessionStorage;
    storage.setItem('organizations', JSON.stringify(organizations));

    // Store timestamp for cache management
    storage.setItem('organizations_timestamp', Date.now().toString());
}

/**
 * Check if organizations cache is still valid (30-minute TTL)
 * @returns {boolean} True if cache is valid, false otherwise
 */
function isOrganizationsCacheValid() {
    const storage = localStorage.getItem('github_pat') ? localStorage : sessionStorage;
    const timestamp = storage.getItem('organizations_timestamp');

    if (!timestamp) {
        return false;
    }

    const age = Date.now() - parseInt(timestamp);
    const TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

    return age < TTL;
}

/**
 * Fetch user organizations from GitHub API
 * @returns {Promise<Array>} Array of organization objects
 */
async function fetchOrganizations() {
    const orgs = await githubAPI('/user/orgs');

    return orgs.map(org => ({
        id: org.id,
        login: org.login,
        avatar_url: org.avatar_url,
        description: org.description || '',
        url: org.url
    }));
}

/**
 * Initialize organizations - load from storage or fetch from API
 * @param {boolean} forceRefresh - Force refresh from API even if cached
 * @returns {Promise<Array>} Organizations array
 */
async function initOrganizations(forceRefresh = false) {
    if (!requireAuth()) {
        return [];
    }

    // Try to load from cache first
    if (!forceRefresh && isOrganizationsCacheValid()) {
        const storedOrgs = getStoredOrganizations();
        if (storedOrgs) {
            return storedOrgs;
        }
    }

    // Fetch from API and store
    try {
        const organizations = await fetchOrganizations();
        storeOrganizations(organizations);
        return organizations;
    } catch (error) {
        console.error('Failed to fetch organizations:', error);

        // Return cached data if available, even if stale
        const storedOrgs = getStoredOrganizations();
        if (storedOrgs) {
            console.warn('Using stale organizations cache due to API error');
            return storedOrgs;
        }

        throw error;
    }
}

/**
 * Get organization by login name
 * @param {string} login - Organization login name
 * @returns {Promise<Object|null>} Organization object or null if not found
 */
async function getOrganizationByLogin(login) {
    const organizations = await initOrganizations();
    return organizations.find(org => org.login === login) || null;
}

// ==================== Repository Management ====================

/**
 * Fetch all repositories for a specific endpoint with pagination
 * @param {string} endpoint - API endpoint to fetch from
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>} Array of repositories
 */
async function fetchAllRepositories(endpoint, params = {}) {
    const repos = [];
    let page = 1;
    const perPage = 100;

    while (true) {
        const queryParams = new URLSearchParams({
            ...params,
            page: page.toString(),
            per_page: perPage.toString()
        });

        const url = `${endpoint}?${queryParams}`;
        const pageRepos = await githubAPI(url);

        if (pageRepos.length === 0) {
            break;
        }

        repos.push(...pageRepos);

        // If we got less than perPage, we're on the last page
        if (pageRepos.length < perPage) {
            break;
        }

        page++;
    }

    return repos;
}

/**
 * Fetch user's repositories
 * @returns {Promise<Array>} Array of repository objects
 */
async function fetchUserRepositories() {
    const params = {
        type: 'all',
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member'
    };

    const repos = await fetchAllRepositories('/user/repos', params);

    return repos.map(repo => ({
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name,
        owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url,
            type: repo.owner.type
        },
        owner_type: repo.owner.type, // 'User' or 'Organization'
        description: repo.description || '',
        private: repo.private,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        language: repo.language,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        archived: repo.archived
    }));
}

/**
 * Fetch repositories for a specific organization
 * @param {string} orgLogin - Organization login name
 * @returns {Promise<Array>} Array of repository objects
 */
async function fetchOrganizationRepositories(orgLogin) {
    const params = {
        type: 'all',
        sort: 'updated'
    };

    const repos = await fetchAllRepositories(`/orgs/${orgLogin}/repos`, params);

    return repos.map(repo => ({
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name,
        owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url,
            type: repo.owner.type
        },
        owner_type: repo.owner.type,
        description: repo.description || '',
        private: repo.private,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        watchers_count: repo.watchers_count,
        forks_count: repo.forks_count,
        open_issues_count: repo.open_issues_count,
        language: repo.language,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        archived: repo.archived
    }));
}

/**
 * Check if repositories cache is still valid (5-minute TTL)
 * @returns {boolean} True if cache is valid, false otherwise
 */
function isRepositoriesCacheValid() {
    const cacheKey = 'repositories_all';
    const cachedData = getCachedValue(cacheKey);
    return cachedData !== null;
}

/**
 * Get stored repositories from cache
 * @returns {Array|null} Repositories array if found, null otherwise
 */
function getStoredRepositories() {
    const cacheKey = 'repositories_all';
    return getCachedValue(cacheKey);
}

/**
 * Store repositories in cache
 * @param {Array} repositories - Repositories array
 */
function storeRepositories(repositories) {
    const cacheKey = 'repositories_all';
    setCachedValue(cacheKey, repositories, 5); // 5-minute TTL
}

/**
 * Fetch all repositories from user and all organizations
 * @returns {Promise<Array>} Array of all repository objects
 */
async function fetchAllUserRepositories() {
    // Fetch user repositories
    const userRepos = await fetchUserRepositories();

    // Fetch organization repositories
    const organizations = await initOrganizations();
    const orgReposPromises = organizations.map(org =>
        fetchOrganizationRepositories(org.login).catch(error => {
            console.error(`Failed to fetch repos for org ${org.login}:`, error);
            return []; // Return empty array on error, don't fail entire fetch
        })
    );

    const orgReposArrays = await Promise.all(orgReposPromises);
    const orgRepos = orgReposArrays.flat();

    // Merge and deduplicate by repo ID
    const allRepos = [...userRepos, ...orgRepos];
    const uniqueRepos = Array.from(
        new Map(allRepos.map(repo => [repo.id, repo])).values()
    );

    return uniqueRepos;
}

/**
 * Initialize repositories - load from cache or fetch from API
 * @param {boolean} forceRefresh - Force refresh from API even if cached
 * @returns {Promise<Array>} Repositories array
 */
async function initRepositories(forceRefresh = false) {
    if (!requireAuth()) {
        return [];
    }

    // Try to load from cache first
    if (!forceRefresh && isRepositoriesCacheValid()) {
        const storedRepos = getStoredRepositories();
        if (storedRepos) {
            return storedRepos;
        }
    }

    // Fetch from API and store
    try {
        const repositories = await fetchAllUserRepositories();
        storeRepositories(repositories);
        return repositories;
    } catch (error) {
        console.error('Failed to fetch repositories:', error);

        // Return cached data if available, even if stale
        const storedRepos = getStoredRepositories();
        if (storedRepos) {
            console.warn('Using stale repositories cache due to API error');
            return storedRepos;
        }

        throw error;
    }
}

/**
 * Get repository by full name (owner/repo)
 * @param {string} fullName - Repository full name (e.g., "owner/repo")
 * @returns {Promise<Object|null>} Repository object or null if not found
 */
async function getRepositoryByFullName(fullName) {
    const repositories = await initRepositories();
    return repositories.find(repo => repo.full_name === fullName) || null;
}

/**
 * Get repository by ID
 * @param {number} id - Repository ID
 * @returns {Promise<Object|null>} Repository object or null if not found
 */
async function getRepositoryById(id) {
    const repositories = await initRepositories();
    return repositories.find(repo => repo.id === id) || null;
}
