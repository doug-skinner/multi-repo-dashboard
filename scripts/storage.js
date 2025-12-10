/**
 * LocalStorage Management System
 * Comprehensive utilities for managing application data in browser storage
 */

// Storage keys
const STORAGE_KEYS = {
    PAT: 'github_pat',
    USER_INFO: 'user_info',
    ORGANIZATIONS: 'organizations',
    ORGANIZATIONS_TIMESTAMP: 'organizations_timestamp',
    TRACKED_REPOS: 'tracked_repos',
    DASHBOARD_SETTINGS: 'dashboard_settings',
    CACHE: 'api_cache',
    LAST_REFRESH: 'last_refresh'
};

// Default dashboard settings
const DEFAULT_DASHBOARD_SETTINGS = {
    view_mode: 'grid',
    theme: 'auto',
    auto_refresh: false,
    refresh_interval: 300,
    density: 'comfortable',
    show_org_badge: true,
    default_sort: 'updated',
    default_sort_order: 'desc'
};

/**
 * Get the active storage (localStorage or sessionStorage)
 * @returns {Storage} Active storage object
 */
function getActiveStorage() {
    return localStorage.getItem(STORAGE_KEYS.PAT) ? localStorage : sessionStorage;
}

/**
 * Check if localStorage is available and working
 * @returns {boolean} True if localStorage is available
 */
function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get storage size information
 * @returns {Object} Storage size information
 */
function getStorageInfo() {
    if (!isLocalStorageAvailable()) {
        return { used: 0, available: 0, percentage: 0 };
    }

    let used = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            used += localStorage[key].length + key.length;
        }
    }

    // Typical localStorage limit is 5-10MB, we'll use 5MB as conservative estimate
    const limit = 5 * 1024 * 1024; // 5MB in bytes
    const available = limit - used;
    const percentage = (used / limit) * 100;

    return {
        used: Math.round(used / 1024), // KB
        available: Math.round(available / 1024), // KB
        percentage: Math.round(percentage * 10) / 10,
        limit: Math.round(limit / 1024) // KB
    };
}

/**
 * Handle localStorage quota exceeded errors
 * @param {Error} error - The error that occurred
 */
function handleQuotaExceeded(error) {
    console.error('localStorage quota exceeded:', error);

    // Try to clear old cache entries
    clearStaleCache();

    // If still exceeding, clear all cache
    const storage = getActiveStorage();
    storage.removeItem(STORAGE_KEYS.CACHE);

    throw new Error('STORAGE_QUOTA_EXCEEDED');
}

/**
 * Safe set item with quota handling
 * @param {string} key - Storage key
 * @param {string} value - Value to store
 * @param {boolean} useSession - Use sessionStorage instead of localStorage
 */
function safeSetItem(key, value, useSession = false) {
    const storage = useSession ? sessionStorage : getActiveStorage();

    try {
        storage.setItem(key, value);
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            handleQuotaExceeded(e);
            // Try again after cleanup
            storage.setItem(key, value);
        } else {
            throw e;
        }
    }
}

// ==================== Dashboard Settings ====================

/**
 * Get dashboard settings
 * @returns {Object} Dashboard settings object
 */
function getDashboardSettings() {
    const storage = getActiveStorage();
    const settingsStr = storage.getItem(STORAGE_KEYS.DASHBOARD_SETTINGS);

    if (!settingsStr) {
        return { ...DEFAULT_DASHBOARD_SETTINGS };
    }

    try {
        const settings = JSON.parse(settingsStr);
        return { ...DEFAULT_DASHBOARD_SETTINGS, ...settings };
    } catch (e) {
        console.error('Failed to parse dashboard settings:', e);
        return { ...DEFAULT_DASHBOARD_SETTINGS };
    }
}

/**
 * Set dashboard settings
 * @param {Object} settings - Settings object to merge with existing settings
 */
function setDashboardSettings(settings) {
    const currentSettings = getDashboardSettings();
    const newSettings = { ...currentSettings, ...settings };

    safeSetItem(STORAGE_KEYS.DASHBOARD_SETTINGS, JSON.stringify(newSettings));
}

/**
 * Reset dashboard settings to defaults
 */
function resetDashboardSettings() {
    const storage = getActiveStorage();
    storage.removeItem(STORAGE_KEYS.DASHBOARD_SETTINGS);
}

// ==================== Tracked Repositories ====================

/**
 * Get tracked repositories
 * @returns {Array} Array of tracked repository objects
 */
function getTrackedRepos() {
    const storage = getActiveStorage();
    const reposStr = storage.getItem(STORAGE_KEYS.TRACKED_REPOS);

    if (!reposStr) {
        return [];
    }

    try {
        return JSON.parse(reposStr);
    } catch (e) {
        console.error('Failed to parse tracked repos:', e);
        return [];
    }
}

/**
 * Set tracked repositories
 * @param {Array} repos - Array of repository objects
 */
function setTrackedRepos(repos) {
    safeSetItem(STORAGE_KEYS.TRACKED_REPOS, JSON.stringify(repos));
}

/**
 * Add repository to tracked list
 * @param {Object} repo - Repository object to add
 * @returns {boolean} True if added, false if already exists
 */
function addTrackedRepo(repo) {
    const repos = getTrackedRepos();

    // Check if already tracked
    if (repos.some(r => r.id === repo.id)) {
        return false;
    }

    // Add with default fields
    const newRepo = {
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name,
        owner: repo.owner,
        owner_type: repo.owner_type,
        pinned: false,
        notes: ''
    };

    repos.push(newRepo);
    setTrackedRepos(repos);
    return true;
}

/**
 * Remove repository from tracked list
 * @param {number} repoId - Repository ID to remove
 * @returns {boolean} True if removed, false if not found
 */
function removeTrackedRepo(repoId) {
    const repos = getTrackedRepos();
    const initialLength = repos.length;
    const filtered = repos.filter(r => r.id !== repoId);

    if (filtered.length === initialLength) {
        return false;
    }

    setTrackedRepos(filtered);
    return true;
}

/**
 * Update repository in tracked list
 * @param {number} repoId - Repository ID to update
 * @param {Object} updates - Fields to update
 * @returns {boolean} True if updated, false if not found
 */
function updateTrackedRepo(repoId, updates) {
    const repos = getTrackedRepos();
    const index = repos.findIndex(r => r.id === repoId);

    if (index === -1) {
        return false;
    }

    repos[index] = { ...repos[index], ...updates };
    setTrackedRepos(repos);
    return true;
}

/**
 * Get repository by ID
 * @param {number} repoId - Repository ID
 * @returns {Object|null} Repository object or null if not found
 */
function getTrackedRepoById(repoId) {
    const repos = getTrackedRepos();
    return repos.find(r => r.id === repoId) || null;
}

// ==================== Cache Management ====================

/**
 * Get cache object
 * @returns {Object} Cache object
 */
function getCache() {
    const storage = getActiveStorage();
    const cacheStr = storage.getItem(STORAGE_KEYS.CACHE);

    if (!cacheStr) {
        return {};
    }

    try {
        return JSON.parse(cacheStr);
    } catch (e) {
        console.error('Failed to parse cache:', e);
        return {};
    }
}

/**
 * Set cache object
 * @param {Object} cache - Cache object
 */
function setCache(cache) {
    safeSetItem(STORAGE_KEYS.CACHE, JSON.stringify(cache));
}

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {any} Cached value or null if not found or expired
 */
function getCachedValue(key) {
    const cache = getCache();
    const entry = cache[key];

    if (!entry) {
        return null;
    }

    // Check if expired
    if (entry.expires && Date.now() > entry.expires) {
        return null;
    }

    return entry.data;
}

/**
 * Set cached value with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttlMinutes - Time to live in minutes
 */
function setCachedValue(key, data, ttlMinutes) {
    const cache = getCache();
    const expires = Date.now() + (ttlMinutes * 60 * 1000);

    cache[key] = {
        data,
        expires,
        timestamp: Date.now()
    };

    setCache(cache);
}

/**
 * Remove cached value
 * @param {string} key - Cache key
 */
function removeCachedValue(key) {
    const cache = getCache();
    delete cache[key];
    setCache(cache);
}

/**
 * Clear stale cache entries
 */
function clearStaleCache() {
    const cache = getCache();
    const now = Date.now();
    const cleaned = {};

    for (const key in cache) {
        const entry = cache[key];
        if (!entry.expires || entry.expires > now) {
            cleaned[key] = entry;
        }
    }

    setCache(cleaned);
}

/**
 * Clear all cache entries
 */
function clearAllCache() {
    const storage = getActiveStorage();
    storage.removeItem(STORAGE_KEYS.CACHE);
}

// ==================== Last Refresh ====================

/**
 * Get last refresh timestamp
 * @returns {number|null} Timestamp or null if never refreshed
 */
function getLastRefresh() {
    const storage = getActiveStorage();
    const timestamp = storage.getItem(STORAGE_KEYS.LAST_REFRESH);
    return timestamp ? parseInt(timestamp) : null;
}

/**
 * Set last refresh timestamp
 */
function setLastRefresh() {
    const storage = getActiveStorage();
    storage.setItem(STORAGE_KEYS.LAST_REFRESH, Date.now().toString());
}

// ==================== Export/Import ====================

/**
 * Export all application data
 * @returns {Object} Application data object
 */
function exportData() {
    return {
        version: '1.0',
        exported_at: new Date().toISOString(),
        user_info: getStoredUserInfo(),
        organizations: getStoredOrganizations(),
        tracked_repos: getTrackedRepos(),
        dashboard_settings: getDashboardSettings(),
        last_refresh: getLastRefresh()
    };
}

/**
 * Import application data (excluding PAT)
 * @param {Object} data - Data object to import
 * @returns {boolean} True if successful
 */
function importData(data) {
    try {
        if (data.user_info) {
            storeUserInfo(data.user_info);
        }

        if (data.organizations) {
            storeOrganizations(data.organizations);
        }

        if (data.tracked_repos) {
            setTrackedRepos(data.tracked_repos);
        }

        if (data.dashboard_settings) {
            setDashboardSettings(data.dashboard_settings);
        }

        return true;
    } catch (e) {
        console.error('Failed to import data:', e);
        return false;
    }
}

// ==================== Data Validation ====================

/**
 * Validate data integrity on load
 * @returns {Object} Validation results
 */
function validateDataIntegrity() {
    const results = {
        valid: true,
        issues: []
    };

    // Validate user info
    const userInfo = getStoredUserInfo();
    if (userInfo && (!userInfo.login || !userInfo.id)) {
        results.valid = false;
        results.issues.push('Invalid user info structure');
    }

    // Validate tracked repos
    const repos = getTrackedRepos();
    if (!Array.isArray(repos)) {
        results.valid = false;
        results.issues.push('Tracked repos is not an array');
    }

    // Validate dashboard settings
    const settings = getDashboardSettings();
    if (typeof settings !== 'object') {
        results.valid = false;
        results.issues.push('Dashboard settings is not an object');
    }

    return results;
}

// ==================== Migration Utilities ====================

/**
 * Migrate data from old schema to new schema
 * @param {string} fromVersion - Version to migrate from
 */
function migrateDataSchema(fromVersion) {
    // Placeholder for future schema migrations
    console.log(`Migrating data from version ${fromVersion}`);

    // Example migration logic would go here
    // if (fromVersion === '1.0') {
    //     // Migrate from 1.0 to 2.0
    // }
}
