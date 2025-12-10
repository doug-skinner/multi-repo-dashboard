# GitHub Multi-Repo Dashboard

## Project Overview

A frontend-only GitHub Pages application that provides a unified dashboard view of multiple GitHub repositories. Designed for AI-native solo developers who want to track activity, issues, and PRs across all their projects in one place.

**Core Value Proposition:**
- No backend required - runs entirely in the browser
- Privacy-first - your GitHub token never leaves your device
- Lightweight and fast
- Customizable to your workflow
- Track both personal and organization repositories

---

## Technical Architecture

### Authentication & Security

**GitHub Personal Access Token (PAT)**
- User provides their own GitHub PAT on first use
- Token stored in browser localStorage
- Security considerations:
  - Clear warning that token is stored locally
  - Option to use session storage (cleared on browser close)
  - Never transmitted to any third-party servers
  - Only sent directly to GitHub API

**Required PAT Scopes:**
- `repo` - Access to repository data
- `read:user` - Read user profile information
- `read:org` - Read organization membership and repository access

**Alternative OAuth Flow (Future Enhancement):**
- Create GitHub OAuth App
- Use serverless function (Vercel/Netlify) as OAuth callback proxy
- More user-friendly but requires minimal backend

### Data Fetching Strategy

**GitHub APIs:**
- **REST API**: `https://api.github.com`
- **GraphQL API**: `https://api.github.com/graphql` (more efficient for complex queries)

**Key Endpoints:**
```
GET /user/repos
  - List all repositories for authenticated user
  - Params: type=all, sort=updated, per_page=100, affiliation=owner,collaborator,organization_member

GET /user/orgs
  - List organizations the user belongs to

GET /orgs/{org}/repos
  - List repositories for an organization
  - Params: type=all, sort=updated, per_page=100

GET /repos/{owner}/{repo}
  - Get detailed repo information

GET /repos/{owner}/{repo}/commits
  - List commits (default: 30)
  - Params: per_page=5 (just get recent ones)

GET /repos/{owner}/{repo}/pulls
  - List pull requests
  - Params: state=open

GET /repos/{owner}/{repo}/issues
  - List issues
  - Params: state=open

GET /rate_limit
  - Check remaining API quota
```

**Rate Limiting:**
- Authenticated: 5,000 requests/hour
- Display remaining quota in UI
- Implement intelligent caching
- Warn user when approaching limit

### Client-Side Storage

**localStorage Schema:**
```javascript
{
  "github_pat": "ghp_xxxxxxxxxxxxx",
  "user_info": {
    "login": "username",
    "name": "Display Name",
    "avatar_url": "https://..."
  },
  "organizations": [
    {
      "id": 123456,
      "login": "org-name",
      "avatar_url": "https://...",
      "description": "Org description"
    }
  ],
  "tracked_repos": [
    {
      "id": 123456,
      "full_name": "username/repo-name",
      "name": "repo-name",
      "owner": "username",
      "owner_type": "User", // "User" or "Organization"
      "pinned": false,
      "notes": "Personal notes about this repo"
    },
    {
      "id": 789012,
      "full_name": "org-name/org-repo",
      "name": "org-repo",
      "owner": "org-name",
      "owner_type": "Organization",
      "pinned": false,
      "notes": ""
    }
  ],
  "dashboard_settings": {
    "view_mode": "grid", // "grid", "list", "compact"
    "sort_by": "updated", // "updated", "name", "created", "stars"
    "auto_refresh": false,
    "refresh_interval": 300, // seconds
    "theme": "dark", // "light", "dark", "auto"
    "show_org_badge": true // Show badge for org repos
  },
  "cache": {
    "user_repos": {
      "data": [...],
      "timestamp": 1234567890,
      "ttl": 300
    },
    "org_repos_org-name": {
      "data": [...],
      "timestamp": 1234567890,
      "ttl": 300
    },
    "commits_username_repo-name": {
      "data": [...],
      "timestamp": 1234567890
    },
    // ... per-repo caches
  },
  "last_refresh": 1234567890
}
```

### Caching Strategy

**Cache Invalidation:**
- Repo list: 5 minutes TTL
- Organization list: 30 minutes TTL
- Commits: 2 minutes TTL
- Issues/PRs: 2 minutes TTL
- Repo details: 10 minutes TTL

**Smart Refresh:**
- Only refetch data older than TTL
- Manual refresh button overrides cache
- Background refresh for pinned repos (optional)

---

## User Flow

### First-Time Setup
1. User visits GitHub Pages site
2. Welcome screen explains the app and what it does
3. Prompt for GitHub PAT with instructions:
   - Link to create PAT: `https://github.com/settings/tokens/new`
   - List required scopes (including `read:org`)
   - Security disclaimer
4. Validate PAT by calling `/user` endpoint
5. Fetch user organizations via `/user/orgs`
6. Fetch repositories from multiple sources:
   - Personal repos via `/user/repos`
   - Organization repos via `/orgs/{org}/repos` for each org
7. Show repository selection interface:
   - **Tab/Filter by source:**
     - Personal Repos
     - Organization Repos (with org selector dropdown)
     - All Repos
   - Display all repos with checkboxes
   - Show repo metadata:
     - Owner (user or org) with avatar
     - Stars, language, last updated
     - Organization badge if applicable
   - Allow select all / deselect all (per tab)
   - Search/filter within selection interface
8. Save selections and proceed to dashboard

### Returning User Flow
1. User visits site
2. Check for valid PAT in localStorage
3. Load tracked repos from localStorage
4. Fetch fresh data (respecting cache)
5. Display dashboard

### Main Dashboard Interaction
1. Dashboard loads with repo cards
2. User can:
   - Click repo card to see details
   - Click quick links (Issues, PRs, Commits)
   - Refresh individual repo or all
   - Pin/unpin repos
   - Add personal notes to repos
   - Remove repos from tracking
   - Filter by owner type (personal vs org)
3. Settings panel for view customization
4. Add/remove repos from tracked list (including org repos)

---

## Core Features

### 1. Repository Cards
Each card displays:
- **Header:**
  - Owner avatar (user or org)
  - Repository name (linked to GitHub)
  - Organization badge (if org repo)
  - Pin button (pinned repos show at top)
  - Remove from dashboard button

- **Stats Row:**
  - ⭐ Stars count
  - 🔀 Forks count
  - 👁️ Watchers count

- **Activity Section:**
  - Last commit time (relative: "2 hours ago")
  - Last commit message (truncated)
  - Commit author + avatar

- **Issues & PRs:**
  - Open issues count with link
  - Open PRs count with link

- **Footer:**
  - Primary language badge
  - Owner name (clickable to filter)
  - Last updated timestamp
  - Quick action buttons:
    - View on GitHub
    - View Issues
    - View PRs
    - View Commits

### 2. Global Dashboard Features

**Header:**
- App title/logo
- User avatar + name
- Total repos tracked
- Last refresh timestamp
- Global refresh button
- Settings button
- Add repos button

**Filters & Sorting:**
- Search repos by name
- Filter by:
  - Owner type (Personal / Organization)
  - Specific organization
  - Language
  - Has open issues
  - Has open PRs
  - Last updated (ranges)
- Sort by:
  - Last updated (default)
  - Name (A-Z)
  - Created date
  - Stars count
  - Open issues count
  - Owner name

**View Modes:**
- Grid view (cards in responsive grid)
- List view (condensed rows)
- Compact view (ultra-dense table)

**Organization Management:**
- List all organizations user has access to
- Quick filter to show only repos from specific org
- Organization avatar and name in UI
- Add all repos from an organization at once

### 3. API Rate Limit Monitor
- Display remaining requests
- Progress bar or percentage
- Warning when < 100 requests remain
- Reset time countdown

---

## Extra Features

### 1. Repository Management
- **Pinned Repos:** Pin important repos to top of dashboard
- **Personal Notes:** Add private notes to each repo
- **Tags/Categories:** Organize repos with custom tags
- **Archive:** Hide inactive repos without removing tracking
- **Bulk Add:** Add all repos from an organization at once

### 2. Organization Features
- **Org Overview Cards:** Summary cards for each org showing total repos, activity
- **Org Filtering:** Quick toggle to show only org repos
- **Org Permissions:** Display your role/permissions in org repos
- **Team Repos:** Show team membership and team repos

### 3. Activity Insights
- **Streak Tracker:** Track commit streaks across all repos (personal + org)
- **Activity Heatmap:** Visual calendar of commits
- **Language Breakdown:** Pie chart of languages used
- **Most Active Repos:** Rank by recent activity
- **Org Contribution Stats:** See contributions to org vs personal repos

### 4. Export & Import
- **Export Settings:** Download JSON of tracked repos + settings
- **Import Settings:** Restore from JSON file
- **Share Config:** Generate shareable link (without PAT)

### 5. Notifications & Alerts
- **Browser Notifications:** Alert on new issues/PRs (if enabled)
- **Activity Badges:** Visual indicators for new activity since last visit
- **PR Review Reminders:** Highlight PRs awaiting review
- **Org Mentions:** Notifications for @mentions in org repos

### 6. Quick Actions
- **Bulk Operations:** Select multiple repos for bulk actions
- **Quick Links:** Customizable quick action buttons
- **Keyboard Shortcuts:** Navigate dashboard with keyboard
  - `r` - Refresh all
  - `s` - Focus search
  - `/` - Open command palette
  - `n` - Add new repo
  - `o` - Filter by organization

### 7. Theming & Customization
- **Themes:** Light, dark, auto (follows system)
- **Custom Colors:** Accent color picker
- **Density:** Comfortable, compact, ultra-compact
- **Card Layout:** Customize which info shows on cards
- **Org Colors:** Custom colors per organization

### 8. Advanced Filtering
- **Saved Filters:** Save commonly used filter combinations
- **Smart Collections:** Dynamic groups (e.g., "Active this week", "Org repos with open PRs")
- **Boolean Search:** Complex search queries
- **Multi-Org Filter:** Show repos from multiple selected orgs

### 9. Integration Features
- **Bookmarklet:** Add to bookmarks bar for quick access
- **Browser Extension:** (Future) Popup with quick stats
- **Webhooks Display:** (Future) Real-time updates via webhook proxy

---

## Technical Stack

### Frontend Framework
**Recommended: Vanilla JS + Web Components**
- No build step required
- Fast loading
- Easy to deploy to GitHub Pages
- Progressive enhancement

**Alternative: React/Vue/Svelte**
- Better DX for complex state
- Requires build step
- Larger bundle size

### UI Framework
**Recommended: Tailwind CSS**
- Utility-first approach
- Easy theming
- Good documentation
- Can use via CDN

**Alternative: Plain CSS with CSS Variables**
- Zero dependencies
- Full control
- More manual work

### State Management
- **Simple:** Plain JavaScript objects + localStorage
- **Advanced:** Local state machine (XState) for complex flows

### Data Fetching
- **Fetch API** (native)
- **Octokit.js** (official GitHub API client)
  - Better TypeScript support
  - Automatic pagination
  - Better error handling

### Charts & Visualizations
- **Chart.js** - Simple, lightweight
- **D3.js** - Powerful but heavier
- **Raw SVG** - Full control, no dependencies

---

## Implementation Phases

### Phase 1: MVP (Core Functionality)
- [ ] Setup GitHub Pages repository
- [ ] Create PAT input & validation
- [ ] Fetch user info and organizations
- [ ] Fetch user repositories and org repositories
- [ ] Repository selection interface with org support
- [ ] Basic dashboard with repo cards
- [ ] Display: name, owner, last commit, issues, PRs
- [ ] Organization badge on repo cards
- [ ] Manual refresh functionality
- [ ] localStorage persistence

### Phase 2: Enhanced UX
- [ ] Implement caching layer
- [ ] Add search and basic filtering
- [ ] Filter by organization
- [ ] Grid/list view toggle
- [ ] Dark/light theme
- [ ] Pin/unpin repos
- [ ] Rate limit monitoring
- [ ] Responsive design
- [ ] Organization avatars and branding

### Phase 3: Advanced Features
- [ ] Activity insights (heatmap, language breakdown)
- [ ] Org contribution stats
- [ ] Saved filters
- [ ] Export/import settings
- [ ] Personal notes on repos
- [ ] Keyboard shortcuts
- [ ] Advanced sorting options
- [ ] Bulk add repos from organization

### Phase 4: Polish & Optimization
- [ ] Loading states and skeletons
- [ ] Error handling and retry logic
- [ ] Accessibility audit (WCAG AA)
- [ ] Performance optimization
- [ ] Analytics (privacy-focused)
- [ ] User documentation

---

## File Structure

```
github-repo-dashboard/
├── index.html           # Main entry point
├── css/
│   ├── main.css        # Global styles
│   ├── components.css  # Component-specific styles
│   └── themes.css      # Theme variables
├── js/
│   ├── app.js          # Main application logic
│   ├── github-api.js   # GitHub API wrapper
│   ├── storage.js      # localStorage management
│   ├── cache.js        # Caching layer
│   ├── components/
│   │   ├── repo-card.js
│   │   ├── org-badge.js
│   │   ├── settings-panel.js
│   │   └── filters.js
│   └── utils/
│       ├── date.js     # Date formatting
│       └── helpers.js  # Misc utilities
├── assets/
│   ├── icons/          # SVG icons
│   └── images/         # Logos, screenshots
├── README.md           # Project documentation
└── LICENSE             # License file
```

---

## API Usage Estimation

**Per Dashboard Load (10 repos tracked, 2 orgs):**
- 1 request: User info
- 1 request: List user orgs
- 1 request: List user repos (cached)
- 2 requests: List org repos per org (cached)
- 10 requests: Recent commits per repo
- 10 requests: Open issues per repo
- 10 requests: Open PRs per repo
- 1 request: Rate limit check

**Total: ~36 requests per full refresh**

**With 5-minute cache:** ~7.2 requests/minute = ~430 requests/hour
**Well within the 5,000/hour limit**

---

## Security Considerations

1. **PAT Storage:**
   - Store only with user consent
   - Clear warning about localStorage security
   - Option to use sessionStorage
   - Never log or transmit PAT anywhere except GitHub
   - PAT needs `read:org` scope for org access

2. **XSS Prevention:**
   - Sanitize all user input
   - Escape HTML in dynamic content
   - Use Content Security Policy headers

3. **Organization Data:**
   - Only show repos user has access to
   - Respect organization permissions
   - Don't expose private org data

4. **No Third-Party Services:**
   - All API calls go directly to GitHub
   - No analytics that track user data
   - No external dependencies for core functionality

---

## Future Enhancements

### Near-Term
- GraphQL API for more efficient queries
- Webhook proxy for real-time updates
- Team support within organizations
- Branch management view
- Organization admin features

### Long-Term
- Browser extension version
- Mobile-responsive PWA
- Offline support with Service Workers
- GitHub Actions integration
- Deployment status tracking
- Code review queue
- Organization-wide insights
- Team collaboration features

---

## Success Metrics

**User Engagement:**
- Daily active users
- Average session duration
- Number of repos tracked per user
- Number of organizations connected

**Performance:**
- Page load time < 2s
- Time to interactive < 3s
- API response caching effectiveness

**Reliability:**
- Error rate < 1%
- Successful API calls > 99%

---

## Open Questions

1. Should we support GitHub Enterprise instances?
2. Should we add support for GitLab/Bitbucket?
3. Should we include code frequency/contributor stats?
4. Should we support multiple GitHub accounts?
5. Should we add issue/PR templates?
6. Should we show team-specific views within organizations?
7. Should we support organization-level settings/preferences?

---

## Getting Started

### For Users
1. Visit: `https://[username].github.io/github-repo-dashboard`
2. Create GitHub PAT: https://github.com/settings/tokens/new
   - Required scopes: `repo`, `read:user`, `read:org`
3. Enter PAT and select repos to track (personal and org repos)
4. Enjoy your unified dashboard!

### For Developers
1. Fork this repository
2. Enable GitHub Pages in settings
3. Start coding!
4. Deploy: Push to `main` branch

---

## Resources

- GitHub REST API: https://docs.github.com/en/rest
- GitHub GraphQL API: https://docs.github.com/en/graphql
- Octokit.js: https://github.com/octokit/octokit.js
- GitHub PAT Guide: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token
- GitHub Organizations: https://docs.github.com/en/organizations

---

## License

MIT License - Feel free to use, modify, and distribute!

---

**Last Updated:** 2025-12-10
**Version:** 1.0.0 (Specification)
