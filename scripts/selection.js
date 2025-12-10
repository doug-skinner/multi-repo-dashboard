/**
 * Repository Selection Interface
 * Handles repository selection for tracking
 */

let allRepositories = [];
let filteredRepositories = [];
let selectedRepoIds = new Set();
let currentFilter = 'all';
let currentOrgFilter = '';
let currentSearch = '';

/**
 * Initialize selection interface
 */
async function initSelection() {
    if (!requireAuth()) {
        return;
    }

    try {
        // Load existing tracked repos
        const trackedRepos = getTrackedRepos();
        selectedRepoIds = new Set(trackedRepos.map(r => r.id));

        // Load repositories
        allRepositories = await initRepositories();

        // Load organizations for filter
        const organizations = await initOrganizations();
        populateOrgFilter(organizations);

        // Display repositories
        applyFilters();

        // Setup event listeners
        setupEventListeners();

        updateSelectionCount();

    } catch (error) {
        console.error('Failed to initialize selection:', error);
        showError('Failed to load repositories. Please refresh the page.');
    }
}

/**
 * Populate organization filter dropdown
 */
function populateOrgFilter(organizations) {
    const orgFilter = document.getElementById('org-filter');

    organizations.forEach(org => {
        const option = document.createElement('option');
        option.value = org.login;
        option.textContent = org.login;
        orgFilter.appendChild(option);
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Tab filters
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;

            // Show/hide org filter
            const orgFilter = document.getElementById('org-filter');
            orgFilter.style.display = currentFilter === 'organization' ? 'block' : 'none';

            applyFilters();
        });
    });

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        currentSearch = e.target.value.toLowerCase();
        applyFilters();
    });

    // Org filter
    document.getElementById('org-filter').addEventListener('change', (e) => {
        currentOrgFilter = e.target.value;
        applyFilters();
    });

    // Bulk actions
    document.getElementById('select-all').addEventListener('click', selectAll);
    document.getElementById('deselect-all').addEventListener('click', deselectAll);

    // Action buttons
    document.getElementById('cancel-button').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    document.getElementById('save-button').addEventListener('click', saveSelection);
}

/**
 * Apply all active filters
 */
function applyFilters() {
    filteredRepositories = allRepositories.filter(repo => {
        // Filter by tab
        if (currentFilter === 'personal' && repo.owner_type !== 'User') {
            return false;
        }
        if (currentFilter === 'organization' && repo.owner_type !== 'Organization') {
            return false;
        }

        // Filter by specific org
        if (currentOrgFilter && repo.owner.login !== currentOrgFilter) {
            return false;
        }

        // Filter by search
        if (currentSearch) {
            const searchStr = `${repo.full_name} ${repo.description || ''}`.toLowerCase();
            if (!searchStr.includes(currentSearch)) {
                return false;
            }
        }

        return true;
    });

    displayRepositories();
}

/**
 * Display repositories in the UI
 */
function displayRepositories() {
    const container = document.getElementById('repos-container');

    if (filteredRepositories.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No repositories found matching your filters.</p></div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'repos-grid';

    filteredRepositories.forEach(repo => {
        const card = createRepoCard(repo);
        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

/**
 * Create repository card element
 */
function createRepoCard(repo) {
    const isSelected = selectedRepoIds.has(repo.id);

    const card = document.createElement('div');
    card.className = `repo-card ${isSelected ? 'selected' : ''}`;
    card.dataset.repoId = repo.id;

    const lastUpdated = new Date(repo.updated_at);
    const relativeTime = getRelativeTime(lastUpdated);

    card.innerHTML = `
        <div class="repo-header">
            <input
                type="checkbox"
                class="repo-checkbox"
                ${isSelected ? 'checked' : ''}
                data-repo-id="${repo.id}"
            >
            <img class="repo-avatar" src="${repo.owner.avatar_url}" alt="${repo.owner.login}">
            <div class="repo-info">
                <div class="repo-name">${repo.name}</div>
                <div class="repo-full-name">${repo.full_name}</div>
            </div>
        </div>
        ${repo.description ? `<div class="repo-description">${repo.description}</div>` : ''}
        <div class="repo-meta">
            <span class="repo-meta-item">⭐ ${repo.stargazers_count}</span>
            ${repo.language ? `<span class="language-badge">${repo.language}</span>` : ''}
            ${repo.owner_type === 'Organization' ? `<span class="org-badge">ORG</span>` : ''}
            <span class="repo-meta-item">Updated ${relativeTime}</span>
        </div>
    `;

    // Click anywhere on card to toggle selection
    card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            const checkbox = card.querySelector('.repo-checkbox');
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });

    // Checkbox change event
    const checkbox = card.querySelector('.repo-checkbox');
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
            selectedRepoIds.add(repo.id);
            card.classList.add('selected');
        } else {
            selectedRepoIds.delete(repo.id);
            card.classList.remove('selected');
        }
        updateSelectionCount();
    });

    return card;
}

/**
 * Select all visible repositories
 */
function selectAll() {
    filteredRepositories.forEach(repo => {
        selectedRepoIds.add(repo.id);
    });
    displayRepositories();
    updateSelectionCount();
}

/**
 * Deselect all visible repositories
 */
function deselectAll() {
    filteredRepositories.forEach(repo => {
        selectedRepoIds.delete(repo.id);
    });
    displayRepositories();
    updateSelectionCount();
}

/**
 * Update selection count display and save button state
 */
function updateSelectionCount() {
    document.getElementById('selected-count').textContent = selectedRepoIds.size;
    document.getElementById('save-button').disabled = selectedRepoIds.size === 0;
}

/**
 * Save selected repositories
 */
function saveSelection() {
    const selectedRepos = allRepositories
        .filter(repo => selectedRepoIds.has(repo.id))
        .map(repo => ({
            id: repo.id,
            full_name: repo.full_name,
            name: repo.name,
            owner: repo.owner,
            owner_type: repo.owner_type,
            pinned: false,
            notes: ''
        }));

    setTrackedRepos(selectedRepos);

    // Redirect to dashboard
    window.location.href = 'dashboard.html';
}

/**
 * Show error message
 */
function showError(message) {
    const container = document.getElementById('repos-container');
    container.innerHTML = `<div class="empty-state"><p style="color: #d73a49;">${message}</p></div>`;
}

/**
 * Get relative time string
 */
function getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 30) {
        return date.toLocaleDateString();
    } else if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMins > 0) {
        return `${diffMins}m ago`;
    } else {
        return 'just now';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSelection);
} else {
    initSelection();
}
