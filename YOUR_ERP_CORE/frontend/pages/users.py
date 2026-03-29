from frontend.pages.layout import base_layout

def users_page():
    content = """
    <div class="page-header flex justify-between items-center">
        <div>
            <h1>Users</h1>
            <p>Manage your company users</p>
        </div>
        <button class="btn btn-primary" id="btn-add-employee" onclick="openEmployeeModal()">+ Add Employee</button>
    </div>

    <div class="card">
        <h3>All Users <span class="text-sm text-muted" id="user-count"></span></h3>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Módulos de Acceso</th><th>Status</th><th>Acciones</th></tr>
                </thead>
                <tbody id="users-tbody">
                    <tr><td colspan="5" class="empty">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Add Employee modal -->
    <div class="modal-overlay" id="employee-modal">
        <div class="modal">
            <h2 id="emp-modal-title">Add Employee</h2>
            <p class="text-muted mb-2" id="emp-modal-desc" style="font-size:0.85rem;margin-bottom:1.25rem">
                The employee will be added to your company with a temporary password: <strong>temp1234</strong>
            </p>
            <form onsubmit="saveEmployee(event)">
                <input type="hidden" id="emp-id" value="">
                <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" id="emp-name" placeholder="Juan Pérez" required>
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" id="emp-email" placeholder="juan@empresa.com" required>
                </div>
                <!-- RBAC SELECTION -->
                <div class="form-group">
                    <label>Role *</label>
                    <select id="emp-role" required onchange="toggleModulePermissions()">
                        <option value="company_admin">Administrador (Acceso Total)</option>
                        <option value="employee" selected>Trabajador (Acceso Restringido)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Permisos de Acceso</label>
                    <div id="module-permissions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="crm" class="mod-check"> CRM (Comercial)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="operations" class="mod-check"> Operaciones
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="finance" class="mod-check"> Finanzas
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="settings" class="mod-check"> Configuracion
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="recruitment" class="mod-check"> Reclutamiento
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="hr" class="mod-check"> Recursos Humanos
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: normal; color: #cbd5e1; cursor: pointer;">
                            <input type="checkbox" value="inventory" class="mod-check"> Inventario
                        </label>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeEmployeeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="emp-btn">Create Employee</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Employee created confirmation modal -->
    <div class="modal-overlay" id="emp-created-modal">
        <div class="modal" style="text-align:center">
            <div style="font-size:2.5rem;margin-bottom:0.75rem">&#10003;</div>
            <h2>Employee Created!</h2>
            <p class="text-muted" style="margin:0.5rem 0 1.5rem">Share these credentials with the new employee:</p>
            <div class="credentials-box" id="emp-credentials"></div>
            <div class="modal-actions" style="justify-content:center">
                <button class="btn btn-primary" onclick="copyCredentials()">Copy Credentials</button>
                <button class="btn btn-ghost" onclick="closeCreatedModal()">Done</button>
            </div>
        </div>
    </div>

    <!-- User detail modal -->
    <div class="modal-overlay" id="user-modal">
        <div class="modal">
            <h2>User Detail</h2>
            <div id="user-detail-content"></div>
            <div class="modal-actions">
                <button class="btn btn-ghost" onclick="closeModal()">Close</button>
            </div>
        </div>
    </div>
    """
    return base_layout("Users", "users", content, scripts=["users.js"])
