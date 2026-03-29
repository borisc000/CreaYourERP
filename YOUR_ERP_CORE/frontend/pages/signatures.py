from frontend.pages.layout import base_layout

def signatures_page():
    content = """
    <div class="page-header flex justify-between items-center">
        <div>
            <h1>Signature Requests</h1>
            <p>Create, send and track document signatures</p>
        </div>
        <button class="btn btn-primary" onclick="openNewModal()">+ New Request</button>
    </div>

    <div class="card">
        <h3>My Requests</h3>
        <div id="my-requests" class="empty">Loading...</div>
    </div>

    <div class="card">
        <h3>Pending My Signature</h3>
        <div id="pending-requests" class="empty">Loading...</div>
    </div>

    <!-- New request modal -->
    <div class="modal-overlay" id="new-modal">
        <div class="modal">
            <h2>New Signature Request</h2>
            <form onsubmit="createRequest(event)">
                <div class="form-group">
                    <label>Document Name *</label>
                    <input type="text" id="sig-name" placeholder="Employment Contract" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="sig-desc" placeholder="Brief description..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Recipient Email *</label>
                        <input type="email" id="sig-email" placeholder="signer@company.com" required>
                    </div>
                    <div class="form-group">
                        <label>File Name</label>
                        <input type="text" id="sig-file" placeholder="contract.pdf">
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" onclick="closeNewModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="create-btn">Create & Send</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Link modal -->
    <div class="modal-overlay" id="link-modal">
        <div class="modal" style="text-align:center">
            <h2>Signature Request Created!</h2>
            <p class="text-muted mb-2">Share this link with the signer:</p>
            <div style="background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.75rem;word-break:break-all;font-family:monospace;font-size:0.85rem;color:#60a5fa;margin-bottom:1rem" id="sign-link"></div>
            <div class="flex gap-1 justify-between" style="justify-content:center">
                <button class="btn btn-primary" onclick="copyLink()">Copy Link</button>
                <button class="btn btn-ghost" onclick="closeLinkModal()">Done</button>
            </div>
        </div>
    </div>
    """
    return base_layout("Signatures", "signatures", content, scripts=["signatures.js"])
