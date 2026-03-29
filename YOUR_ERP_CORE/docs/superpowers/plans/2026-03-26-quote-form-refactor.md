# Quote Form UI/UX Refactoring + Data Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Quote Form to use Hub & Spoke architecture with read-only Lead info and a horizontal control panel, while ensuring data hydration works correctly when editing existing quotes.

**Architecture:**
- **Top Section (Read-Only Lead Info):** Shows opportunity title and customer name as a highlighted badge (disabled inputs)
- **Control Panel (Horizontal):** Responsive grid with Template Selector, % Admin, % Profit, % Tax controls
- **Content Area (Below):** Three tables for Services, Personnel, and Items with dynamic rows and calculations

**Tech Stack:** Python (FastAPI, Jinja2), HTML/CSS (Tailwind), Vanilla JavaScript, API calls via `api.js`

---

## File Structure

**Files to Modify:**
- `frontend/pages/quote_form.py` - HTML structure refactoring (lines 1-250)
- `frontend/static/js/quote_form.js` - Data hydration verification + debug logging

**Files to Reference:**
- `modules/quotes/module_quotes.py` - Quote data model
- `frontend/routes.py` - API route handlers

---

## Task 1: Refactor HTML Structure - Lead Info Block (Read-Only Badge)

**Files:**
- Modify: `frontend/pages/quote_form.py:22-57` (current top section)
- Create: Updated structure with read-only lead badge

- [ ] **Step 1: Read the current quote_form.py to understand existing structure**

```bash
# Read lines 1-200 of quote_form.py to see current layout
head -200 "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE\frontend\pages\quote_form.py"
```

Expected: See the current flexbox layout with lead title + template selector + % inputs on right

- [ ] **Step 2: Replace the Top Section with Read-Only Lead Badge**

In `quote_form.py`, replace lines 21-57 with:

```python
    <!-- TOP: Lead Info (Read-Only Badge - Hub & Spoke) -->
    <div style="margin-bottom:1.5rem;">
        <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:#1e293b;border:2px solid #0ea5e9;border-radius:12px;">
            <div style="flex:1;">
                <div style="font-size:0.7rem;text-transform:uppercase;color:#64748b;letter-spacing:0.08em;margin-bottom:0.25rem;">📋 Oportunidad</div>
                <div style="display:flex;align-items:center;gap:1rem;">
                    <h2 id="lead-title" style="font-size:1.2rem;color:#f1f5f9;margin:0;font-weight:700;font-family:monospace;">—</h2>
                    <div style="height:1px;flex:1;background:#334155;"></div>
                    <div style="font-size:0.85rem;color:#94a3b8;">
                        <span style="font-weight:600;">Cliente:</span>
                        <span id="lead-customer" style="color:#e2e8f0;margin-left:0.5rem;">—</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 3: Verify the lead info section is now read-only and highlighted**

After making the change, open browser to http://localhost:9000/app/quotes/new?lead_id=5 and verify:
- The lead title and customer display in a highlighted blue border box
- The section looks like a "status badge" not an editable form

Expected: Blue bordered box with PRJ-XXXX title and customer name visible

- [ ] **Step 4: Commit this change**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
git add frontend/pages/quote_form.py
git commit -m "refactor: create read-only lead info badge (Hub & Spoke architecture)"
```

---

## Task 2: Create Horizontal Control Panel with Grid Layout

**Files:**
- Modify: `frontend/pages/quote_form.py:59-70` (current percentage inputs section)
- Insert: New responsive grid panel

- [ ] **Step 1: Replace the old percentage inputs section with new horizontal panel**

In `quote_form.py`, replace the current percentage inputs section (lines 33-55) with:

```python
    <!-- CONTROL PANEL: Horizontal Responsive Grid -->
    <div style="margin-bottom:1.5rem;padding:1.25rem;background:#0f172a;border:1px solid #334155;border-radius:12px;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;align-items:end;">

            <!-- Template Selector -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600;margin-bottom:0.5rem;display:block;">📄 Cargar Plantilla</label>
                <div id="template-dropdown-wrapper" style="width:100%;"></div>
            </div>

            <!-- % Admin Expenses -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600;margin-bottom:0.5rem;display:block;">% Gastos Administrativos</label>
                <input type="number" id="pct-adm" value="5" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.6rem 0.75rem;color:#e2e8f0;font-size:0.9rem;text-align:center;font-weight:600;">
            </div>

            <!-- % Profit/Utility -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600;margin-bottom:0.5rem;display:block;">% Utilidad (Ganancia)</label>
                <input type="number" id="pct-profit" value="10" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.6rem 0.75rem;color:#e2e8f0;font-size:0.9rem;text-align:center;font-weight:600;">
            </div>

            <!-- % Tax/IVA -->
            <div class="form-group" style="margin:0;">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600;margin-bottom:0.5rem;display:block;">% IVA (Impuesto)</label>
                <input type="number" id="pct-tax" value="19" min="0" max="100" step="0.5"
                       oninput="recalculate()"
                       style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:0.6rem 0.75rem;color:#e2e8f0;font-size:0.9rem;text-align:center;font-weight:600;">
            </div>

        </div>
    </div>
```

- [ ] **Step 2: Remove the old template-loader-container from lead-title section**

Remove this line from the lead info block (it was in the old code):
```html
<div id="template-loader-container" style="margin-top:1.25rem; display:flex; align-items:center; gap:0.75rem;">
```

The template loader is now in the control panel.

- [ ] **Step 3: Verify responsive grid works on desktop and mobile**

Test at: http://localhost:9000/app/quotes/new?lead_id=5

Desktop (1920px): Should show all 4 controls in one row
Tablet (768px): Should show 2 controls per row
Mobile (375px): Should stack vertically

Expected: Grid adapts responsively, controls are visible and clickable

- [ ] **Step 4: Commit this change**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
git add frontend/pages/quote_form.py
git commit -m "refactor: implement horizontal control panel with responsive grid layout"
```

---

## Task 3: Add Missing DOM Elements (Quote Date, Notes, Totals Summary)

**Files:**
- Modify: `frontend/pages/quote_form.py` - verify all totals section elements exist
- Reference: Lines 140-210

- [ ] **Step 1: Verify all required DOM elements exist**

Run this search to find each element:

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
echo "=== Checking DOM elements ==="
grep -n "quote-date\|quote-notes\|total-subtotal\|total-adm\|total-profit\|total-net\|total-tax\|total-gross" frontend/pages/quote_form.py
```

Expected output should show all 8 IDs present (you verified this earlier - all exist)

- [ ] **Step 2: Verify quote-date and quote-notes are in the right place**

They should be in a section after the 3 tables. Check around line 142 and 154.

If they're not visible, add them before the totals section:

```html
    <!-- Quote Metadata -->
    <div class="card" style="margin-bottom:1.5rem;margin-top:1rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1rem;">
            <div class="form-group">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:0.5rem;display:block;">Fecha de Cotización</label>
                <input type="date" id="quote-date"
                       style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.6rem 0.75rem;color:#e2e8f0;font-size:0.9rem;">
            </div>
            <div class="form-group">
                <label style="font-size:0.75rem;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:0.5rem;display:block;">Validez / Términos</label>
                <textarea id="quote-notes" rows="3"
                          placeholder="Ej: Cotización válida por 30 días, sujeta a disponibilidad de stock..."
                          style="width:100%;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:0.6rem 0.75rem;color:#e2e8f0;font-size:0.85rem;resize:vertical;"></textarea>
            </div>
        </div>
    </div>
```

- [ ] **Step 3: Commit verification**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
git add frontend/pages/quote_form.py
git commit -m "verify: all DOM elements for quote metadata and totals exist"
```

---

## Task 4: Add Data Hydration Debug Logging & Verify loadExistingQuote()

**Files:**
- Modify: `frontend/static/js/quote_form.js:138-184` (loadExistingQuote function)
- Add: Debug logging to trace data flow

- [ ] **Step 1: Read the current loadExistingQuote function**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
sed -n '138,184p' frontend/static/js/quote_form.js
```

Expected: See the function that fetches quote data and populates the form

- [ ] **Step 2: Add debug logging to loadExistingQuote()**

In `quote_form.js`, replace the `loadExistingQuote()` function with enhanced logging:

```javascript
// ── Load Existing Quote ───────────────────────────────────────
async function loadExistingQuote(quoteId) {
    console.log('[QF] Loading existing quote:', quoteId);
    const res = await API.get('/quotes/' + quoteId);
    if (!res || res.success === false) {
        console.error('[QF] Error fetching quote:', res);
        showToast('Error al cargar cotizacion', 'error');
        return;
    }

    const q = res.data || res;
    QF.quote = q;
    console.log('[QF] Quote data loaded:', q);

    // ═══ Populate Lead Info ═══
    const bc = document.getElementById('breadcrumb-title');
    if (bc) bc.textContent = q.quote_number || 'Editar';
    console.log('[QF] Set breadcrumb to:', q.quote_number);

    document.getElementById('lead-title').textContent = q.lead_title || '—';
    document.getElementById('lead-customer').textContent = q.customer_name || '—';
    console.log('[QF] Set lead info:', q.lead_title, 'Customer:', q.customer_name);

    // ═══ Populate Financial Controls ═══
    const admEl = document.getElementById('pct-adm');
    const profitEl = document.getElementById('pct-profit');
    const taxEl = document.getElementById('pct-tax');

    if (admEl) admEl.value = q.adm_margin_pct ?? 5;
    if (profitEl) profitEl.value = q.profit_margin_pct ?? 10;
    if (taxEl) taxEl.value = q.tax_pct ?? 19;
    console.log('[QF] Set percentages - Adm:', q.adm_margin_pct, 'Profit:', q.profit_margin_pct, 'Tax:', q.tax_pct);

    // ═══ Populate Quote Metadata ═══
    const notesEl = document.getElementById('quote-notes');
    const dateEl = document.getElementById('quote-date');

    if (notesEl) notesEl.value = q.notes || '';
    if (dateEl && q.quote_date) dateEl.value = q.quote_date.split('T')[0];
    console.log('[QF] Set metadata - Date:', q.quote_date, 'Notes length:', (q.notes || '').length);

    // ═══ Load Documents ═══
    if (q.lead_id) loadLeadDocuments(q.lead_id);

    // ═══ Populate Lines by Section ═══
    console.log('[QF] Populating lines from quote.lines:', (q.lines || []).length, 'lines');
    const lines = q.lines || [];
    const svcLines = lines.filter(l => l.section_type === 'SERVICIOS');
    const wrkLines = lines.filter(l => l.section_type === 'PERSONAL');
    const itmLines = lines.filter(l => l.section_type === 'INSUMOS');

    console.log('[QF] Lines by section - Services:', svcLines.length, 'Personnel:', wrkLines.length, 'Items:', itmLines.length);

    if (svcLines.length > 0) {
        svcLines.forEach((l, i) => {
            console.log('[QF] Adding service line', i+1, ':', l.description, 'qty:', l.quantity, 'price:', l.unit_price);
            addLine('SERVICIOS', l);
        });
    } else {
        addLine('SERVICIOS');
    }

    if (wrkLines.length > 0) {
        wrkLines.forEach((l, i) => {
            console.log('[QF] Adding personnel line', i+1, ':', l.description, 'hours:', l.quantity);
            addLine('PERSONAL', l);
        });
    } else {
        addLine('PERSONAL');
    }

    if (itmLines.length > 0) {
        itmLines.forEach((l, i) => {
            console.log('[QF] Adding item line', i+1, ':', l.description, 'qty:', l.quantity);
            addLine('INSUMOS', l);
        });
    } else {
        addLine('INSUMOS');
    }

    // ═══ Disable form if not in draft status ═══
    if (q.status && q.status !== 'draft') {
        console.log('[QF] Quote status is', q.status, '- disabling form');
        disableForm();
    }

    // ═══ Recalculate Totals ═══
    console.log('[QF] Running recalculate()');
    recalculate();
    console.log('[QF] Data hydration complete ✓');
}
```

- [ ] **Step 3: Test data hydration with debug console**

Open http://localhost:9000/app/quotes/5/edit (replace 5 with an existing quote ID)

Open Browser DevTools (F12) and check Console:
- Should see logs like "[QF] Loading existing quote: 5"
- Should see "[QF] Quote data loaded: {...}"
- Should see section population logs
- Should see "[QF] Data hydration complete ✓"

Expected: All logs appear in sequence, no errors

- [ ] **Step 4: Verify form is populated**

In the browser, check:
- Lead title displays
- % Adm, % Profit, % Tax show correct values
- Quote date and notes are populated
- All table rows are filled with data

If anything is missing, note the missing log and investigate

- [ ] **Step 5: Commit this change**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
git add frontend/static/js/quote_form.js
git commit -m "feat: add comprehensive debug logging to loadExistingQuote() for data hydration verification"
```

---

## Task 5: Test New Quote Creation Flow

**Files:**
- Test: Manual browser testing at http://localhost:9000/app/quotes/new?lead_id=5

- [ ] **Step 1: Create a new quote from scratch**

Open: http://localhost:9000/app/quotes/new?lead_id=5

Expected:
- Lead title and customer display in read-only badge
- Control panel shows default percentages (5%, 10%, 19%)
- Three empty tables with one empty row each
- "+ Agregar" buttons are visible
- Today's date is pre-filled

- [ ] **Step 2: Add data to the quote**

- Add one service (search and select from dropdown)
- Add quantity and verify price auto-populates
- Add one personnel line
- Add one item line
- Verify totals calculate in real-time

Expected: Subtotals update as you add data, final total displays correctly

- [ ] **Step 3: Change percentage values**

- Change % Adm to 10
- Change % Profit to 20
- Change % Tax to 8

Expected: Totals recalculate immediately reflecting new percentages

- [ ] **Step 4: Verify Responsive Design**

Resize browser to test responsiveness:
- Desktop (1920px): All controls visible in one row
- Tablet (768px): Controls wrap to 2 columns
- Mobile (375px): Controls stack vertically

Expected: Layout adapts smoothly, no overflow or broken elements

- [ ] **Step 5: Document test results**

```
✓ New quote creation works
✓ Control panel is horizontal and responsive
✓ Data entry and calculations work
✓ Percentage changes update totals in real-time
```

---

## Task 6: Test Data Hydration (Edit Existing Quote)

**Files:**
- Test: Manual browser testing at http://localhost:9000/app/quotes/{id}/edit

- [ ] **Step 1: Find an existing quote**

In the Quotes list (http://localhost:9000/app/quotes), find a quote that has data (you saw COT-5000-02 with $7,006,314)

Note its quote_id

- [ ] **Step 2: Open quote for editing**

Navigate to: http://localhost:9000/app/quotes/{id}

Expected (from console logs):
```
[QF] Loading existing quote: 5
[QF] Quote data loaded: {quote_number: "COT-5000-02", ...}
[QF] Set lead info: PRJ-5000 - ...
[QF] Populating lines from quote.lines: 3 lines
[QF] Lines by section - Services: 2, Personnel: 1, Items: 0
[QF] Adding service line 1: ...
...
[QF] Data hydration complete ✓
```

- [ ] **Step 3: Verify all data is populated**

In the browser, check:
- Lead badge shows correct opportunity and customer
- % Adm, % Profit, % Tax are set to saved values
- Quote date is populated
- Notes/Terms are populated
- All three tables show the correct saved lines
- Totals match the saved total

Expected: Every field matches what was saved in the database

- [ ] **Step 4: Verify calculations are correct**

Manually verify one calculation:
- Take first service line: qty × price = subtotal
- Check if displayed subtotal matches

Expected: Math is correct, totals match

- [ ] **Step 5: Test editing existing data**

- Change one line's quantity
- Verify totals recalculate immediately

Expected: Changes take effect instantly

- [ ] **Step 6: Document test results**

```
✓ Quote data loads completely
✓ All fields (lead, percentages, date, notes, lines) are populated
✓ Calculations match saved totals
✓ Form is editable
✓ Real-time recalculation works
```

---

## Task 7: Final Verification & Documentation

**Files:**
- Reference: All modified files
- Document: Test summary

- [ ] **Step 1: Verify no JavaScript errors**

Open DevTools Console (F12):
- No red error messages
- Only informational logs from [QF]

Expected: Clean console, no errors

- [ ] **Step 2: Test keyboard navigation**

Tab through controls:
- Can tab between fields
- Template dropdown opens on focus
- Tab order makes sense

Expected: Smooth keyboard navigation

- [ ] **Step 3: Verify data persistence**

- Create a quote
- Add data
- Save it (via save button)
- Reload page
- Edit the same quote
- Verify data persists

Expected: Data is saved and retrieved correctly

- [ ] **Step 4: Document completion**

Create a summary of what was completed:

```
✓ HTML Refactored: Hub & Spoke architecture with read-only lead badge
✓ Control Panel: Responsive horizontal grid (Template, % Adm, % Profit, % Tax)
✓ Data Hydration: Enhanced logging added, all DOM elements verified
✓ New Quote Flow: Tested, works correctly
✓ Edit Quote Flow: Tested, data loads and calculates correctly
✓ Responsive Design: Tested on desktop, tablet, mobile
✓ No JavaScript errors: Console clean
```

- [ ] **Step 5: Final commit**

```bash
cd "C:\Users\PC\Desktop\nuevo erp\YOUR_ERP_CORE"
git add -A
git commit -m "refactor: complete quote form UI/UX refactoring with Hub & Spoke architecture and data hydration verification

- Restructured HTML with read-only lead info badge
- Created responsive horizontal control panel (Template, % Admin, % Profit, % Tax)
- Added comprehensive debug logging to loadExistingQuote()
- Verified all DOM elements exist and work correctly
- Tested new quote creation flow
- Tested existing quote editing and data hydration
- Verified responsive design works on all screen sizes
- All calculations and totals working correctly"
```

- [ ] **Step 6: Verify server still runs on port 9000**

```bash
curl -s "http://localhost:9000/app/quotes/new?lead_id=5" | head -20
```

Expected: HTML response with new quote form structure

---

## Success Criteria

✅ All tasks complete when:
1. HTML refactored with Hub & Spoke read-only lead badge
2. Horizontal control panel responsive and styled
3. Data hydration logging shows complete flow
4. New quote creation works end-to-end
5. Existing quote editing shows all data populated
6. No JavaScript console errors
7. Responsive design verified
8. All changes committed to git

---

## Notes for Implementation

- **Port 9000:** Server is running on port 9000 (not 8000) to avoid port conflicts
- **Debug Logging:** Console logs marked with `[QF]` prefix for easy filtering
- **Grid Layout:** Uses `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))` for responsiveness
- **Hub & Spoke:** Read-only lead ensures quotes stay associated with correct opportunity
- **TDD Approach:** Each step includes expected results to verify before moving forward

