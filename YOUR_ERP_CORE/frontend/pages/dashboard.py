from frontend.pages.layout import base_layout

def dashboard_page():
    content = """
    <div class="page-header">
        <h1>Dashboard</h1>
        <p id="welcome-msg">Welcome back</p>
    </div>

    <div class="cards-row">
        <div class="stat-card">
            <div class="label">Total Users</div>
            <div class="value" id="stat-users">-</div>
        </div>
        <div class="stat-card">
            <div class="label">Signature Requests</div>
            <div class="value" id="stat-sigs">-</div>
        </div>
        <div class="stat-card">
            <div class="label">Pending to Sign</div>
            <div class="value" id="stat-pending">-</div>
        </div>
        <div class="stat-card">
            <div class="label">Open Jobs</div>
            <div class="value" id="stat-jobs">-</div>
        </div>
        <div class="stat-card">
            <div class="label">Employees</div>
            <div class="value" id="stat-employees">-</div>
        </div>
    </div>

    <div class="card">
        <h3>Recent Signature Requests <a href="/app/signatures" class="btn btn-sm btn-ghost">View All</a></h3>
        <div id="recent-list" class="empty">Loading...</div>
    </div>

    <div class="card">
        <h3>Quick Actions</h3>
        <div class="flex gap-2" style="flex-wrap:wrap">
            <a href="/app/inventory" class="btn btn-secondary">Inventario</a>
            <a href="/app/signatures" class="btn btn-primary">New Signature Request</a>
            <a href="/app/users" class="btn btn-ghost">Manage Users</a>
            <a href="/app/recruitment" class="btn btn-ghost">Recruitment</a>
            <a href="/app/hr" class="btn btn-ghost">HR</a>
            <a href="/docs" target="_blank" class="btn btn-ghost">API Docs</a>
        </div>
    </div>
    """
    return base_layout("Dashboard", "dashboard", content, scripts=["dashboard.js"])
