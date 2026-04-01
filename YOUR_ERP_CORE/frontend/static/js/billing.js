const billingState={stats:{},documents:[],queueBoard:[],radar:[],timeline:[],dueSoon:[],reference:{customers:[],quotes:[],billing_documents:[],document_types:[],correction_modes:[],simulation_profiles:[],payment_methods:[]},selectedDocumentId:null,lineEditorRows:[]};

document.addEventListener('DOMContentLoaded',async()=>{if(!API.requireAuth())return;highlightNav('/app/billing');await loadBillingWorkspace();});

const billEscape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const billNumber=v=>Number(v||0).toLocaleString('es-CL',{maximumFractionDigits:0});
const billCurrency=v=>'$'+billNumber(v||0);
const billTodayIso=()=>new Date().toISOString().slice(0,10);
const billDate=v=>{if(!v)return'Sin fecha';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'});};
const billDateTime=v=>{if(!v)return'Sin registro';const d=new Date(v);return Number.isNaN(d.getTime())?v:d.toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const billDocMeta=code=>(billingState.reference.document_types||[]).find(i=>i.code===code)||{code,label:'Documento',sign:code==='61'?-1:1,supports_payment:code!=='61',default_tax_rate:19};
const billDocSign=code=>Number(billDocMeta(code).sign||1);
const billingNeedsRef=code=>['61','56'].includes(code);
const billingCanAdmin=()=>{const u=API.getUser();return !!u&&['superadmin','company_admin'].includes(u.role);};
const billingCanCreateCorrection=doc=>!!doc&&doc.sii_status==='accepted'&&doc.status!=='cancelled'&&doc.document_type!=='61';
const billingCurrentDocumentId=()=>Number(document.getElementById('billing-document-id')?.value||0);
const billingReferenceDocs=()=> (billingState.reference.billing_documents||[]).filter(i=>i.id!==billingCurrentDocumentId());
const billingCorrectionModes=()=>{const code=document.getElementById('billing-document-type')?.value||'33';return (billingState.reference.correction_modes||[]).filter(i=>(i.document_types||[]).includes(code));};
const billingEditorBlank=()=>!billingState.lineEditorRows.length||billingState.lineEditorRows.every(l=>!(String(l.description||'').trim())&&Number(l.unit_price||0)===0&&Number(l.discount_pct||0)===0&&Number(l.quantity||1)<=1);
const emptyBillingLine=()=>({description:'',quantity:1,unit_price:0,discount_pct:0,is_exempt:false});
const closeBillingModal=id=>document.getElementById(id)?.classList.remove('open');

async function loadBillingWorkspace(){
    const [dashboardRes,documentsRes,referenceRes]=await Promise.all([API.get('/billing/dashboard'),API.get('/billing/documents?limit=120'),API.get('/billing/reference-data')]);
    billingState.stats=dashboardRes?.data?.stats||{};
    billingState.queueBoard=dashboardRes?.data?.queue_board||[];
    billingState.radar=dashboardRes?.data?.customer_radar||[];
    billingState.timeline=dashboardRes?.data?.recent_events||[];
    billingState.dueSoon=dashboardRes?.data?.due_soon||[];
    billingState.documents=documentsRes?.data?.results||[];
    billingState.reference=referenceRes?.data||billingState.reference;
    if(!billingState.selectedDocumentId||!billingState.documents.some(d=>d.id===billingState.selectedDocumentId))billingState.selectedDocumentId=billingState.documents[0]?.id||null;
    renderBillingDashboard();fillBillingReferenceInputs();renderBillingQueueBoard();renderBillingDocuments();renderBillingRadar();renderBillingFocus();renderBillingTimeline();renderBillingDueSoon();
}

function renderBillingDashboard(){
    const s=billingState.stats||{};
    document.getElementById('billing-stat-total').textContent=billNumber(s.documents_total||0);
    document.getElementById('billing-stat-total-sub').textContent=`${billNumber(s.issued_total||0)} emitidos / ${billNumber(s.draft_total||0)} borradores`;
    document.getElementById('billing-stat-collected').textContent=billCurrency(s.collected_month_total||0);
    document.getElementById('billing-stat-incidents').textContent=billNumber(Number(s.observed_total||0)+Number(s.rejected_total||0));
    document.getElementById('billing-stat-overdue').textContent=billCurrency(s.overdue_amount_total||0);
    document.getElementById('billing-stat-overdue-sub').textContent=`${billNumber(s.overdue_total||0)} documentos`;
    document.getElementById('billing-acceptance-rate').textContent=`${billNumber(s.acceptance_rate||0)}%`;
    document.getElementById('billing-acceptance-bar').style.width=`${Math.max(0,Math.min(100,Number(s.acceptance_rate||0)))}%`;
    document.getElementById('billing-issued-month').textContent=billCurrency(s.issued_month_total||0);
    document.getElementById('billing-open-collections').textContent=billCurrency(s.outstanding_total||0);
}

function fillBillingReferenceInputs(){
    const typeFilter=document.getElementById('billing-type-filter'),docType=document.getElementById('billing-document-type'),customer=document.getElementById('billing-document-customer'),quote=document.getElementById('billing-document-quote'),ref=document.getElementById('billing-reference-document'),corr=document.getElementById('billing-correction-mode'),profile=document.getElementById('billing-document-simulation-profile'),pay=document.getElementById('billing-payment-method');
    if(typeFilter){const v=typeFilter.value||'';typeFilter.innerHTML='<option value="">Todos los tipos</option>'+(billingState.reference.document_types||[]).map(i=>`<option value="${billEscape(i.code)}">${billEscape(i.label)}</option>`).join('');typeFilter.value=v;}
    if(docType){const v=docType.value||'';docType.innerHTML=(billingState.reference.document_types||[]).map(i=>`<option value="${billEscape(i.code)}">${billEscape(i.label)}</option>`).join('');docType.value=v||(billingState.reference.document_types?.[0]?.code||'33');}
    if(customer){const v=customer.value||'';customer.innerHTML='<option value="">Sin vincular</option>'+(billingState.reference.customers||[]).map(i=>`<option value="${i.id}">${billEscape(i.name)}${i.tax_id?` - ${billEscape(i.tax_id)}`:''}</option>`).join('');customer.value=v;}
    if(quote){const v=quote.value||'';quote.innerHTML='<option value="">Documento manual</option>'+(billingState.reference.quotes||[]).map(i=>`<option value="${i.id}">${billEscape(i.quote_number)} - ${billEscape(i.lead_title||'Sin lead')}</option>`).join('');quote.value=v;}
    if(ref){const v=ref.value||'';ref.innerHTML='<option value="">Sin referencia</option>'+billingReferenceDocs().map(i=>`<option value="${i.id}">${billEscape(i.document_number)} - ${billEscape(i.document_type_label)} - ${billEscape(i.customer_name||'Sin cliente')}</option>`).join('');ref.value=v;}
    if(corr){const v=corr.value||'';corr.innerHTML=(billingState.reference.correction_modes||[]).map(i=>`<option value="${billEscape(i.code)}">${billEscape(i.label)}</option>`).join('');corr.value=v||(billingState.reference.correction_modes?.[0]?.code||'');}
    if(profile){const v=profile.value||'';profile.innerHTML=(billingState.reference.simulation_profiles||[]).map(i=>`<option value="${billEscape(i.code)}">${billEscape(i.label)}</option>`).join('');profile.value=v||(billingState.reference.simulation_profiles?.[0]?.code||'auto_accept');}
    if(pay){const v=pay.value||'';pay.innerHTML=(billingState.reference.payment_methods||[]).map(i=>`<option value="${billEscape(i)}">${billEscape(i)}</option>`).join('');pay.value=v||(billingState.reference.payment_methods?.[0]||'Transferencia');}
    billingToggleReferenceFields();
}

function renderBillingQueueBoard(){
    const c=document.getElementById('billing-queue-board');if(!c)return;
    c.innerHTML=!billingState.queueBoard.length?'<div class="text-sm text-muted">Aun no hay actividad.</div>':billingState.queueBoard.map(i=>`<div class="billing-queue-item"><strong>${billEscape(i.label)}</strong><span>${billNumber(i.count||0)} documentos</span></div>`).join('');
}

const billingStatusOrder=s=>({overdue:0,observed:1,rejected:2,draft:3,simulated_queued:4,collecting:5,issued:6,partially_paid:7,paid:8})[s]??99;

function getFilteredBillingDocuments(){
    const search=(document.getElementById('billing-search')?.value||'').trim().toLowerCase();
    const status=document.getElementById('billing-status-filter')?.value||'';
    const type=document.getElementById('billing-type-filter')?.value||'';
    const payment=document.getElementById('billing-payment-filter')?.value||'';
    return billingState.documents.filter(doc=>{
        const match=!search||(doc.document_number||'').toLowerCase().includes(search)||(doc.customer_name||'').toLowerCase().includes(search)||(doc.customer_tax_id||'').toLowerCase().includes(search)||(doc.source_reference||'').toLowerCase().includes(search)||(doc.reference_document_number||'').toLowerCase().includes(search)||(doc.correction_reason||'').toLowerCase().includes(search);
        return (!status||doc.status===status)&&(!type||doc.document_type===type)&&(!payment||doc.payment_status===payment)&&match;
    }).sort((a,b)=>{const rank=billingStatusOrder(a.status)-billingStatusOrder(b.status);return rank!==0?rank:String(b.issue_date||'').localeCompare(String(a.issue_date||''));});
}

function renderBillingDocuments(){
    const grid=document.getElementById('billing-documents-grid');if(!grid)return;
    const docs=getFilteredBillingDocuments();
    if(!docs.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1;">No hay documentos con esos filtros.</div>';return;}
    grid.innerHTML=docs.map(doc=>`<article class="billing-doc-card ${billingState.selectedDocumentId===doc.id?'selected':''}" onclick="selectBillingDocument(${doc.id})">
        <div class="billing-doc-top"><div><div class="billing-doc-number">${billEscape(doc.document_number)}</div><div class="billing-doc-type">${billEscape(doc.document_type_label)}</div></div><span class="billing-status-pill ${billEscape(doc.status)}">${billEscape(doc.status_label)}</span></div>
        <div class="billing-doc-customer">${billEscape(doc.customer_name)}</div>
        <div class="billing-doc-meta">Folio ${billEscape(doc.sii_folio)} - Emision ${billEscape(billDate(doc.issue_date))}<br>Vence ${billEscape(billDate(doc.due_date))} - ${billEscape(doc.payment_status_label)}</div>
        ${doc.reference_document_number?`<div class="billing-doc-meta">Referencia ${billEscape(doc.reference_document_number)}${doc.correction_mode_label?` - ${billEscape(doc.correction_mode_label)}`:''}</div>`:''}
        <div class="billing-doc-amounts"><div class="billing-amount-box"><span>Total</span><strong>${billCurrency(doc.total_amount||0)}</strong></div><div class="billing-amount-box"><span>Saldo</span><strong>${billCurrency(doc.balance_due||0)}</strong></div></div>
        <div class="billing-doc-meta">SII: ${billEscape(doc.sii_status_label)}${doc.last_sii_message?` - ${billEscape(doc.last_sii_message)}`:''}</div>
        <div class="billing-card-actions" onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="openBillingPreview(${doc.id})">Vista PDF</button>${doc.can_simulate_sii?`<button class="btn btn-ghost btn-sm" onclick="simulateBillingSii(${doc.id})">Simular SII</button>`:''}${doc.can_send_customer?`<button class="btn btn-ghost btn-sm" onclick="sendBillingToCustomer(${doc.id})">Enviar</button>`:''}${doc.can_register_payment?`<button class="btn btn-ghost btn-sm" onclick="openBillingPaymentModal(${doc.id})">Pagar</button>`:''}<button class="btn btn-ghost btn-sm" onclick="openBillingDocumentModal(${doc.id})">Editar</button></div>
    </article>`).join('');
}

function renderBillingRadar(){
    const c=document.getElementById('billing-radar');if(!c)return;
    c.innerHTML=!billingState.radar.length?'<div class="empty">No hay concentraciones de cobranza por ahora.</div>':billingState.radar.map(i=>`<div><strong style="color:#f8fafc;">${billEscape(i.customer_name)}</strong><div class="text-sm text-muted">${billNumber(i.documents||0)} documentos</div><div class="text-sm" style="margin-top:.35rem;color:#cbd5e1;">Pendiente ${billCurrency(i.pending_amount||0)}</div><div class="text-sm" style="color:${Number(i.overdue_amount||0)>0?'#fda4af':'#86efac'};">Vencido ${billCurrency(i.overdue_amount||0)}</div></div>`).join('');
}

function selectBillingDocument(id){billingState.selectedDocumentId=id;renderBillingDocuments();renderBillingFocus();}

function renderBillingFocus(){
    const c=document.getElementById('billing-focus');if(!c)return;
    const doc=billingState.documents.find(i=>i.id===billingState.selectedDocumentId);
    if(!doc){c.innerHTML='<div class="empty">Selecciona un documento para revisar su detalle.</div>';return;}
    const timeline=billingState.timeline.filter(e=>e.document_id===doc.id).slice(0,4);
    c.innerHTML=`<div class="billing-focus-card">
        <div class="billing-doc-top"><div><div class="billing-doc-number">${billEscape(doc.document_number)}</div><div class="billing-doc-type">${billEscape(doc.customer_name)}</div></div><span class="billing-status-pill ${billEscape(doc.status)}">${billEscape(doc.status_label)}</span></div>
        <div class="billing-focus-grid"><div class="billing-focus-box"><span>Total</span><strong>${billCurrency(doc.total_amount||0)}</strong></div><div class="billing-focus-box"><span>Saldo</span><strong>${billCurrency(doc.balance_due||0)}</strong></div></div>
        <div class="billing-focus-list"><div class="billing-focus-row"><div class="label">RUT</div><div class="value">${billEscape(doc.customer_tax_id||'Sin RUT')}</div></div><div class="billing-focus-row"><div class="label">Email</div><div class="value">${billEscape(doc.customer_email||'Sin email')}</div></div><div class="billing-focus-row"><div class="label">Simulacion</div><div class="value">${billEscape(doc.simulation_profile_label||'-')}</div></div><div class="billing-focus-row"><div class="label">SII</div><div class="value">${billEscape(doc.sii_status_label)}</div></div><div class="billing-focus-row"><div class="label">Cobranza</div><div class="value">${billEscape(doc.payment_status_label)}</div></div><div class="billing-focus-row"><div class="label">Referencia</div><div class="value">${billEscape(doc.source_reference||'Manual')}</div></div>${doc.reference_document_number?`<div class="billing-focus-row"><div class="label">Doc. corregido</div><div class="value">${billEscape(doc.reference_document_number)}</div></div>`:''}${doc.correction_mode_label?`<div class="billing-focus-row"><div class="label">Correccion</div><div class="value">${billEscape(doc.correction_mode_label)}</div></div>`:''}</div>
        <div class="billing-card-actions"><button class="btn btn-secondary btn-sm" onclick="openBillingPreview(${doc.id})">Vista PDF</button>${doc.can_simulate_sii?`<button class="btn btn-primary btn-sm" onclick="simulateBillingSii(${doc.id})">Simular SII</button>`:''}${doc.can_send_customer?`<button class="btn btn-secondary btn-sm" onclick="sendBillingToCustomer(${doc.id})">Enviar cliente</button>`:''}${doc.can_register_payment?`<button class="btn btn-ghost btn-sm" onclick="openBillingPaymentModal(${doc.id})">Registrar pago</button>`:''}${billingCanCreateCorrection(doc)?`<button class="btn btn-ghost btn-sm" onclick="openBillingCorrectionModal(${doc.id}, '61')">Nota credito</button>`:''}${billingCanCreateCorrection(doc)?`<button class="btn btn-ghost btn-sm" onclick="openBillingCorrectionModal(${doc.id}, '56')">Nota debito</button>`:''}<button class="btn btn-ghost btn-sm" onclick="duplicateBillingDocument(${doc.id})">Duplicar</button><button class="btn btn-ghost btn-sm" onclick="openBillingDocumentModal(${doc.id})">Editar</button>${billingCanAdmin()&&doc.can_delete?`<button class="btn btn-ghost btn-sm" style="color:#fda4af;border-color:#881337" onclick="deleteBillingDocument(${doc.id})">Eliminar</button>`:''}</div>
        <div class="billing-stack">${timeline.length?timeline.map(e=>`<div><strong style="color:#f8fafc;">${billEscape(e.title)}</strong><div class="text-sm text-muted">${billEscape(e.detail||'Sin detalle')}</div><div class="text-sm text-muted">${billEscape(e.actor_name||'Sistema')} - ${billEscape(billDateTime(e.occurred_at))}</div></div>`).join(''):'<div class="empty">Sin eventos todavia.</div>'}</div>
    </div>`;
}

function renderBillingTimeline(){
    const c=document.getElementById('billing-timeline');if(!c)return;
    c.innerHTML=!billingState.timeline.length?'<div class="empty">Sin eventos recientes.</div>':billingState.timeline.map(e=>`<div><strong style="color:#f8fafc;">${billEscape(e.title)}</strong><div class="text-sm text-muted">${billEscape(e.detail||'Sin detalle')}</div><div class="text-sm text-muted">${billEscape(e.actor_name||'Sistema')} - ${billEscape(billDateTime(e.occurred_at))}</div></div>`).join('');
}

function renderBillingDueSoon(){
    const c=document.getElementById('billing-due-soon');if(!c)return;
    c.innerHTML=!billingState.dueSoon.length?'<div class="empty">No hay documentos pendientes por ahora.</div>':billingState.dueSoon.map(doc=>`<div><strong style="color:#f8fafc;">${billEscape(doc.customer_name)}</strong><div class="text-sm text-muted">${billEscape(doc.document_number)} - Vence ${billEscape(billDate(doc.due_date))}</div><div class="text-sm" style="margin:.35rem 0;color:#cbd5e1;">Saldo ${billCurrency(doc.balance_due||0)}</div><span class="billing-risk ${billEscape(doc.risk_level||'low')}">${billEscape(doc.payment_status_label)}</span></div>`).join('');
}

function renderBillingReferenceSummary(){
    const box=document.getElementById('billing-reference-summary');if(!box)return;
    const type=document.getElementById('billing-document-type')?.value||'33';
    if(!billingNeedsRef(type)){box.textContent='Las notas de credito y debito deben quedar amarradas al documento que corrigen.';return;}
    const refId=Number(document.getElementById('billing-reference-document')?.value||0);
    const ref=billingReferenceDocs().find(i=>i.id===refId);
    const mode=billingCorrectionModes().find(i=>i.code===(document.getElementById('billing-correction-mode')?.value||''));
    if(!ref){box.textContent=type==='61'?'Selecciona el documento original para emitir una nota de credito o una correccion negativa.':'Selecciona el documento original para emitir una nota de debito o un recargo asociado.';return;}
    box.innerHTML=`<strong>${type==='61'?'Ajuste negativo':'Ajuste positivo'}</strong><br>${billEscape(ref.document_number)} - ${billEscape(ref.document_type_label)} - ${billEscape(ref.customer_name||'Sin cliente')}${mode?`<br><span class="text-sm text-muted">${billEscape(mode.label)}</span>`:''}`;
}

function billingToggleReferenceFields(){
    const type=document.getElementById('billing-document-type')?.value||'33';
    const wrap=document.getElementById('billing-reference-fields'),quote=document.getElementById('billing-document-quote'),corr=document.getElementById('billing-correction-mode'),paymentTerms=document.getElementById('billing-document-payment-terms'),due=document.getElementById('billing-document-due-date'),issue=document.getElementById('billing-document-issue-date');
    const visible=billingNeedsRef(type);
    if(wrap)wrap.hidden=!visible;
    if(quote){quote.disabled=visible;if(visible)quote.value='';}
    if(corr){const cur=corr.value||'';const modes=billingCorrectionModes();corr.innerHTML=modes.map(i=>`<option value="${billEscape(i.code)}">${billEscape(i.label)}</option>`).join('');corr.value=modes.some(i=>i.code===cur)?cur:(modes[0]?.code||'');}
    if(visible&&type==='61'){if(paymentTerms&&!paymentTerms.value)paymentTerms.value='No aplica';if(issue&&due&&issue.value&&!due.value)due.value=issue.value;}
    renderBillingReferenceSummary();
}

async function loadBillingDocumentDetail(documentId){
    const res=await API.get(`/billing/documents/${documentId}`);
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo cargar el documento.','error');return null;}
    return res.data||null;
}

async function billingApplySelectedReferenceDocument(opts={}){
    renderBillingReferenceSummary();
    const refId=Number(document.getElementById('billing-reference-document')?.value||0);
    if(!refId)return;
    const ref=await loadBillingDocumentDetail(refId);if(!ref)return;
    const type=document.getElementById('billing-document-type')?.value||'33',copyData=opts.copyData!==false,copyLines=!!opts.copyLines||(!billingCurrentDocumentId()&&billingEditorBlank());
    if(copyData){
        document.getElementById('billing-document-customer').value=ref.customer_id||'';
        document.getElementById('billing-document-customer-name').value=ref.customer_name||'';
        document.getElementById('billing-document-customer-tax-id').value=ref.customer_tax_id||'';
        document.getElementById('billing-document-customer-email').value=ref.customer_email||'';
        document.getElementById('billing-document-contact-name').value=ref.customer_contact_name||'';
        document.getElementById('billing-document-payment-terms').value=type==='61'?'No aplica':(ref.payment_terms||'');
        document.getElementById('billing-document-tax-rate').value=ref.tax_rate??billDocMeta(type).default_tax_rate??19;
        document.getElementById('billing-document-quote').value='';
    }
    if(copyLines){
        billingState.lineEditorRows=(ref.lines||[]).map(line=>({description:line.description||'',quantity:Number(line.quantity||1),unit_price:Number(line.unit_price||0),discount_pct:Number(line.discount_pct||0),is_exempt:!!line.is_exempt||type==='34'}));
        if(!billingState.lineEditorRows.length)billingState.lineEditorRows=[emptyBillingLine()];
        renderBillingLineEditor();
    }else renderBillingEditorTotals();
    renderBillingReferenceSummary();
}

function renderBillingLineEditor(){
    const c=document.getElementById('billing-line-editor-rows');if(!c)return;
    if(!billingState.lineEditorRows.length)billingState.lineEditorRows=[emptyBillingLine()];
    const sign=billDocSign(document.getElementById('billing-document-type')?.value||'33');
    c.innerHTML=billingState.lineEditorRows.map((line,index)=>{const base=Number(line.quantity||0)*Number(line.unit_price||0)*(1-(Number(line.discount_pct||0)/100));const total=Math.round(base*sign);return `<div class="billing-line-row"><input type="text" value="${billEscape(line.description||'')}" placeholder="Descripcion" oninput="updateBillingLineRow(${index}, 'description', this.value)"><input type="number" min="0.01" step="0.01" value="${billEscape(line.quantity||1)}" oninput="updateBillingLineRow(${index}, 'quantity', this.value)"><input type="number" min="0" step="1" value="${billEscape(line.unit_price||0)}" oninput="updateBillingLineRow(${index}, 'unit_price', this.value)"><input type="number" min="0" max="99" step="1" value="${billEscape(line.discount_pct||0)}" oninput="updateBillingLineRow(${index}, 'discount_pct', this.value)"><label><input type="checkbox" ${line.is_exempt?'checked':''} onchange="updateBillingLineRow(${index}, 'is_exempt', this.checked)">Exenta</label><div style="display:flex;gap:.5rem;align-items:center;"><div class="billing-line-row-total">${billCurrency(total)}</div><button type="button" class="btn btn-ghost btn-sm" onclick="removeBillingLineRow(${index})">Quitar</button></div></div>`;}).join('');
    renderBillingEditorTotals();
}

function updateBillingLineRow(index,field,value){if(!billingState.lineEditorRows[index])return;billingState.lineEditorRows[index][field]=value;renderBillingLineEditor();}
function addBillingLineRow(data=null){billingState.lineEditorRows.push(data?{...data}:emptyBillingLine());renderBillingLineEditor();}
function removeBillingLineRow(index){billingState.lineEditorRows.splice(index,1);if(!billingState.lineEditorRows.length)billingState.lineEditorRows=[emptyBillingLine()];renderBillingLineEditor();}

function renderBillingEditorTotals(){
    const type=document.getElementById('billing-document-type')?.value||'33',sign=billDocSign(type),taxRate=Number(document.getElementById('billing-document-tax-rate')?.value||0);let subtotal=0,taxable=0;
    for(const line of billingState.lineEditorRows){const q=Number(line.quantity||0),p=Number(line.unit_price||0),d=Number(line.discount_pct||0),base=Math.round(q*p*(1-(d/100)));subtotal+=Math.round(base*sign);if(!line.is_exempt&&type!=='34')taxable+=base;}
    const tax=Math.round(Math.round(taxable*((type==='34'?0:taxRate)/100))*sign),total=subtotal+tax;
    document.getElementById('billing-summary-subtotal').textContent=billCurrency(subtotal);
    document.getElementById('billing-summary-tax').textContent=billCurrency(tax);
    document.getElementById('billing-summary-total').textContent=billCurrency(total);
    document.getElementById('billing-summary-note').textContent=type==='61'?'La nota de credito se mostrara con montos negativos y sin cobranza.':type==='56'?'La nota de debito incrementa el monto pendiente del cliente referenciado.':'Los montos se recalculan en backend al guardar.';
}

function billingApplyDocumentTypeDefaults(){const code=document.getElementById('billing-document-type')?.value||'33';document.getElementById('billing-document-tax-rate').value=billDocMeta(code)?.default_tax_rate??19;billingToggleReferenceFields();renderBillingLineEditor();}

function billingApplySelectedCustomer(){
    const id=Number(document.getElementById('billing-document-customer')?.value||0),c=(billingState.reference.customers||[]).find(i=>i.id===id);if(!c)return;
    document.getElementById('billing-document-customer-name').value=c.name||'';document.getElementById('billing-document-customer-tax-id').value=c.tax_id||'';document.getElementById('billing-document-customer-email').value=c.email||'';document.getElementById('billing-document-contact-name').value=c.contact_name||'';document.getElementById('billing-document-payment-terms').value=c.payment_terms||'';
}

async function billingApplySelectedQuote(){
    const quoteId=Number(document.getElementById('billing-document-quote')?.value||0);if(!quoteId)return;
    const meta=(billingState.reference.quotes||[]).find(i=>i.id===quoteId);
    if(meta?.customer_id){document.getElementById('billing-document-customer').value=String(meta.customer_id);billingApplySelectedCustomer();}
    const res=await API.get(`/quotes/${quoteId}`);
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo cargar la cotizacion.','error');return;}
    billingState.lineEditorRows=(res.data?.lines||[]).map(line=>({description:line.description||'',quantity:Number(line.quantity||1),unit_price:Number(line.unit_price||0),discount_pct:0,is_exempt:(document.getElementById('billing-document-type')?.value||'33')==='34'}));
    if(!billingState.lineEditorRows.length)billingState.lineEditorRows=[emptyBillingLine()];
    renderBillingLineEditor();
}

function openBillingDocumentModal(documentId=null){
    const doc=billingState.documents.find(i=>i.id===documentId);
    document.getElementById('billing-document-modal-title').textContent=doc?'Editar documento':'Nuevo documento';
    document.getElementById('billing-document-id').value=doc?.id||'';
    fillBillingReferenceInputs();
    document.getElementById('billing-document-type').value=doc?.document_type||(billingState.reference.document_types?.[0]?.code||'33');
    document.getElementById('billing-document-customer').value=doc?.customer_id||'';
    document.getElementById('billing-document-customer-name').value=doc?.customer_name||'';
    document.getElementById('billing-document-customer-tax-id').value=doc?.customer_tax_id||'';
    document.getElementById('billing-document-customer-email').value=doc?.customer_email||'';
    document.getElementById('billing-document-contact-name').value=doc?.customer_contact_name||'';
    document.getElementById('billing-document-quote').value=doc?.source_quote_id||'';
    document.getElementById('billing-reference-document').value=doc?.reference_document_id||'';
    document.getElementById('billing-correction-mode').value=doc?.correction_mode||document.getElementById('billing-correction-mode').value;
    document.getElementById('billing-correction-reason').value=doc?.correction_reason||'';
    document.getElementById('billing-document-simulation-profile').value=doc?.simulation_profile||'auto_accept';
    document.getElementById('billing-document-issue-date').value=String(doc?.issue_date||billTodayIso()).slice(0,10);
    document.getElementById('billing-document-due-date').value=String(doc?.due_date||billTodayIso()).slice(0,10);
    document.getElementById('billing-document-payment-terms').value=doc?.payment_terms||'';
    document.getElementById('billing-document-tax-rate').value=doc?.tax_rate??19;
    document.getElementById('billing-document-customer-message').value=doc?.customer_message||'';
    document.getElementById('billing-document-internal-notes').value=doc?.internal_notes||'';
    fillBillingReferenceInputs();
    document.getElementById('billing-document-type').value=doc?.document_type||(billingState.reference.document_types?.[0]?.code||'33');
    document.getElementById('billing-reference-document').value=doc?.reference_document_id||'';
    document.getElementById('billing-correction-mode').value=doc?.correction_mode||document.getElementById('billing-correction-mode').value;
    billingToggleReferenceFields();
    document.getElementById('billing-document-modal').classList.add('open');
    if(doc)loadBillingDocumentDetailForEdit(documentId);else{billingState.lineEditorRows=[emptyBillingLine()];renderBillingLineEditor();}
}

async function loadBillingDocumentDetailForEdit(documentId){
    const data=await loadBillingDocumentDetail(documentId);if(!data)return;
    billingState.lineEditorRows=(data.lines||[]).map(line=>({description:line.description||'',quantity:Number(line.quantity||1),unit_price:Number(line.unit_price||0),discount_pct:Number(line.discount_pct||0),is_exempt:!!line.is_exempt}));
    if(!billingState.lineEditorRows.length)billingState.lineEditorRows=[emptyBillingLine()];
    renderBillingLineEditor();
}

function buildBillingDocumentPayload(){
    const type=document.getElementById('billing-document-type').value,useRef=billingNeedsRef(type);
    return{document_type:type,customer_id:document.getElementById('billing-document-customer').value||null,customer_name:document.getElementById('billing-document-customer-name').value,customer_tax_id:document.getElementById('billing-document-customer-tax-id').value,customer_email:document.getElementById('billing-document-customer-email').value,customer_contact_name:document.getElementById('billing-document-contact-name').value,source_quote_id:useRef?null:(document.getElementById('billing-document-quote').value||null),reference_document_id:useRef?(document.getElementById('billing-reference-document').value||null):null,correction_mode:useRef?document.getElementById('billing-correction-mode').value:'',correction_reason:useRef?document.getElementById('billing-correction-reason').value:'',simulation_profile:document.getElementById('billing-document-simulation-profile').value,issue_date:document.getElementById('billing-document-issue-date').value,due_date:document.getElementById('billing-document-due-date').value,payment_terms:document.getElementById('billing-document-payment-terms').value,tax_rate:document.getElementById('billing-document-tax-rate').value,customer_message:document.getElementById('billing-document-customer-message').value,internal_notes:document.getElementById('billing-document-internal-notes').value,lines:billingState.lineEditorRows.map(line=>({description:line.description,quantity:Number(line.quantity||0),unit_price:Number(line.unit_price||0),discount_pct:Number(line.discount_pct||0),is_exempt:!!line.is_exempt}))};
}

async function saveBillingDocument(event){
    event.preventDefault();
    const id=document.getElementById('billing-document-id').value,payload=buildBillingDocumentPayload();
    const res=id?await API.put(`/billing/documents/${id}`,payload):await API.post('/billing/documents',payload);
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo guardar el documento.','error');return;}
    closeBillingModal('billing-document-modal');showToast(id?'Documento actualizado.':'Documento creado.');await loadBillingWorkspace();if(res.data?.id)billingState.selectedDocumentId=res.data.id;renderBillingFocus();
}

async function openBillingCorrectionModal(referenceDocumentId,documentType){
    const ref=await loadBillingDocumentDetail(referenceDocumentId);if(!ref)return;
    openBillingDocumentModal(null);
    document.getElementById('billing-document-modal-title').textContent=documentType==='61'?'Nueva nota de credito':'Nueva nota de debito';
    document.getElementById('billing-document-type').value=documentType;
    document.getElementById('billing-document-issue-date').value=billTodayIso();
    document.getElementById('billing-document-due-date').value=billTodayIso();
    billingApplyDocumentTypeDefaults();
    document.getElementById('billing-reference-document').value=String(referenceDocumentId);
    document.getElementById('billing-correction-mode').value=documentType==='61'?'amount_decrease':'amount_increase';
    document.getElementById('billing-correction-reason').value=documentType==='61'?`Correccion sobre ${ref.document_number}`:`Recargo o ajuste sobre ${ref.document_number}`;
    billingToggleReferenceFields();
    await billingApplySelectedReferenceDocument({copyData:true,copyLines:true});
}

function buildBillingPreviewHtml(doc,company={}){
    const lines=(doc.lines||[]).map(line=>`<tr><td>${billEscape(line.description||'-')}</td><td style="text-align:right;">${billNumber(line.quantity||0)}</td><td style="text-align:right;">${billCurrency(line.unit_price||0)}</td><td style="text-align:right;">${billNumber(line.discount_pct||0)}%</td><td style="text-align:right;">${billCurrency(line.line_total||0)}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:#64748b;padding:1rem;">Sin detalle</td></tr>';
    const companyMeta=[company.tax_id&&`RUT ${billEscape(company.tax_id)}`,company.address&&billEscape(company.address),company.email&&billEscape(company.email),company.phone&&billEscape(company.phone)].filter(Boolean).join(' - ')||'Sin datos configurados';
    const referenceBlock=doc.reference_document_number?`<section class="panel"><div class="panel-title">Documento corregido</div><div class="row"><span>Documento</span><strong>${billEscape(doc.reference_document_number)}${doc.reference_document_type_label?` - ${billEscape(doc.reference_document_type_label)}`:''}</strong></div><div class="row"><span>Tipo de correccion</span><strong>${billEscape(doc.correction_mode_label||'Correccion')}</strong></div><div class="row"><span>Motivo</span><strong>${billEscape(doc.correction_reason||'Sin motivo registrado')}</strong></div></section>`:'';
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${billEscape(doc.document_number||'documento')}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#dbeafe;font-family:Segoe UI,Tahoma,sans-serif;color:#0f172a}.toolbar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:.75rem;padding:1rem;background:#0f172a}.toolbar button{border:none;border-radius:12px;padding:.75rem 1rem;font-weight:700;cursor:pointer}.toolbar .print{background:#0ea5e9;color:#fff}.toolbar .back{background:#e2e8f0;color:#0f172a}.sheet{width:min(210mm,100%);min-height:297mm;margin:1rem auto 2rem;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.18);padding:1.4rem}.banner{padding:.7rem 1rem;border-radius:14px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:1rem}.header{display:flex;justify-content:space-between;gap:1rem;border-bottom:2px solid #e2e8f0;padding-bottom:1rem;margin-bottom:1rem}.kicker{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#0369a1;font-weight:700}.title{font-size:2rem;font-weight:800;margin:.3rem 0 .45rem}.meta{color:#475569;line-height:1.7}.card{min-width:260px;padding:1rem;border-radius:18px;background:#0f172a;color:#e2e8f0}.badge{color:#67e8f9;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.85rem}.meta-grid{display:grid;gap:.6rem}.meta-grid div{display:flex;justify-content:space-between;gap:1rem}.meta-grid span{color:#94a3b8}.grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}.panel{border:1px solid #cbd5e1;border-radius:18px;padding:1rem;background:#f8fafc}.panel-title{font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:#0369a1;font-weight:700;margin-bottom:.6rem}.main{font-size:1.15rem;font-weight:700;margin-bottom:.35rem}.sub{color:#475569;line-height:1.7}.mini{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.mini div{padding:.75rem;border-radius:14px;background:#fff;border:1px solid #dbeafe}.mini span,.totals span,.row span{display:block;color:#64748b;font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem}.row{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid #e2e8f0}.row:last-child{border-bottom:none}.table{width:100%;border-collapse:collapse;margin:1rem 0}.table thead{background:#0f172a;color:#fff}.table th,.table td{padding:.85rem .7rem;border-bottom:1px solid #e2e8f0;text-align:left}.footer{display:grid;grid-template-columns:1.2fr .8fr;gap:1rem}.notes{border:1px solid #cbd5e1;border-radius:18px;padding:1rem;background:#f8fafc;line-height:1.7;color:#334155}.internal{margin-top:.75rem;padding-top:.75rem;border-top:1px dashed #cbd5e1;color:#475569}.totals{border:1px solid #cbd5e1;border-radius:18px;overflow:hidden}.totals div{display:flex;justify-content:space-between;gap:1rem;padding:.8rem 1rem;border-bottom:1px solid #e2e8f0}.totals div:last-child{border-bottom:none;background:#eff6ff;font-size:1rem}@media(max-width:900px){.header,.grid,.footer{display:grid;grid-template-columns:1fr}.card{min-width:0}.toolbar{position:static;flex-wrap:wrap}}@media print{body{background:#fff}.toolbar{display:none}.sheet{box-shadow:none;border-radius:0;width:auto;min-height:auto;margin:0;padding:0}}
    </style></head><body><div class="toolbar"><button class="back" onclick="window.close()">Cerrar</button><button class="print" onclick="window.print()">Guardar PDF / Imprimir</button></div><div class="sheet"><div class="banner">Simulacion interna previa a SII - documento no tributario real</div><header class="header"><div><div class="kicker">${billEscape(company.legal_name||company.name||'Empresa')}</div><div class="title">${billEscape(doc.document_type_label||'Documento')}</div><div class="meta">${companyMeta}</div></div><div class="card"><div class="badge">${billEscape(doc.document_number||'-')}</div><div class="meta-grid"><div><span>Folio</span><strong>${billEscape(doc.sii_folio||'-')}</strong></div><div><span>Emision</span><strong>${billEscape(billDate(doc.issue_date))}</strong></div><div><span>Vencimiento</span><strong>${billEscape(billDate(doc.due_date))}</strong></div><div><span>Estado</span><strong>${billEscape(doc.status_label||'-')}</strong></div></div></div></header><section class="grid"><article class="panel"><div class="panel-title">Receptor</div><div class="main">${billEscape(doc.customer_name||'-')}</div><div class="sub">${billEscape(doc.customer_tax_id||'Sin RUT')}<br>${billEscape(doc.customer_contact_name||'Sin contacto')}<br>${billEscape(doc.customer_email||'Sin email')}</div></article><article class="panel"><div class="panel-title">Control interno</div><div class="mini"><div><span>SII</span><strong>${billEscape(doc.sii_status_label||'-')}</strong></div><div><span>Cobranza</span><strong>${billEscape(doc.payment_status_label||'-')}</strong></div><div><span>Condiciones</span><strong>${billEscape(doc.payment_terms||'Sin condiciones')}</strong></div><div><span>Origen</span><strong>${billEscape(doc.source_reference||'Manual')}</strong></div></div></article></section>${referenceBlock}<table class="table"><thead><tr><th>Detalle</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">P. unitario</th><th style="text-align:right;">Desc.</th><th style="text-align:right;">Total</th></tr></thead><tbody>${lines}</tbody></table><section class="footer"><article class="notes"><div class="panel-title">Observaciones</div><div>${billEscape(doc.customer_message||'Sin mensaje al cliente.')}</div><div class="internal">${billEscape(doc.internal_notes||'Sin notas internas.')}</div></article><article class="totals"><div><span>Subtotal</span><strong>${billCurrency(doc.subtotal_amount||0)}</strong></div><div><span>Impuesto</span><strong>${billCurrency(doc.tax_amount||0)}</strong></div><div><span>Total</span><strong>${billCurrency(doc.total_amount||0)}</strong></div><div><span>Saldo</span><strong>${billCurrency(doc.balance_due||0)}</strong></div></article></section></div></body></html>`;
}

async function openBillingPreview(documentId){
    const previewWindow=window.open('about:blank','_blank');
    if(!previewWindow){showToast('El navegador bloqueo la ventana de previsualizacion.','error');return;}
    previewWindow.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cargando...</title></head><body style="font-family:Segoe UI,Tahoma,sans-serif;padding:2rem;color:#0f172a;">Cargando documento...</body></html>');
    previewWindow.document.close();
    try{
        const [docRes,companyRes]=await Promise.all([API.get(`/billing/documents/${documentId}`),API.get('/company/settings')]);
        if(!docRes?.success){
            previewWindow.document.body.innerHTML=`<div style="font-family:Segoe UI,Tahoma,sans-serif;padding:2rem;color:#b91c1c;">${billEscape(docRes?.errors?.[0]||'No se pudo cargar el documento.')}</div>`;
            return;
        }
        const html=buildBillingPreviewHtml(docRes.data||{},companyRes?.success?companyRes.data||{}:{});
        const blob=new Blob([html],{type:'text/html'});
        const blobUrl=URL.createObjectURL(blob);
        previewWindow.location.replace(blobUrl);
        previewWindow.focus();
        setTimeout(()=>URL.revokeObjectURL(blobUrl),60000);
    }catch(error){
        previewWindow.document.body.innerHTML=`<div style="font-family:Segoe UI,Tahoma,sans-serif;padding:2rem;color:#b91c1c;">${billEscape(error?.message||'No se pudo abrir la previsualizacion.')}</div>`;
    }
}

function openBillingPaymentModal(documentId=null){
    const doc=billingState.documents.find(i=>i.id===(documentId||billingState.selectedDocumentId));
    if(!doc){showToast('Selecciona un documento con saldo pendiente.','error');return;}
    if(!doc.can_register_payment){showToast('Este documento no admite pagos en este estado.','error');return;}
    document.getElementById('billing-payment-document-id').value=doc.id;
    document.getElementById('billing-payment-document-name').value=`${doc.document_number} - ${doc.customer_name}`;
    document.getElementById('billing-payment-amount').value=Math.round(doc.balance_due||0);
    document.getElementById('billing-payment-date').value=billTodayIso();
    document.getElementById('billing-payment-reference').value='';
    document.getElementById('billing-payment-notes').value='';
    document.getElementById('billing-payment-modal').classList.add('open');
}

async function saveBillingPayment(event){
    event.preventDefault();
    const documentId=document.getElementById('billing-payment-document-id').value;
    const res=await API.post(`/billing/documents/${documentId}/register-payment`,{amount:document.getElementById('billing-payment-amount').value,payment_date:document.getElementById('billing-payment-date').value,payment_method:document.getElementById('billing-payment-method').value,reference:document.getElementById('billing-payment-reference').value,notes:document.getElementById('billing-payment-notes').value});
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo registrar el pago.','error');return;}
    closeBillingModal('billing-payment-modal');showToast('Pago registrado.');billingState.selectedDocumentId=Number(documentId);await loadBillingWorkspace();renderBillingFocus();
}

async function simulateBillingSii(documentId){
    const res=await API.post(`/billing/documents/${documentId}/simulate-sii`,{});
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo ejecutar la simulacion SII.','error');return;}
    showToast(`Simulacion completada: ${res.data?.document?.sii_status_label||'actualizada'}.`);billingState.selectedDocumentId=Number(documentId);await loadBillingWorkspace();renderBillingFocus();
}

async function sendBillingToCustomer(documentId){
    const res=await API.post(`/billing/documents/${documentId}/send-customer`,{});
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo simular el envio al cliente.','error');return;}
    showToast('Documento enviado al cliente.');billingState.selectedDocumentId=Number(documentId);await loadBillingWorkspace();renderBillingFocus();
}

async function duplicateBillingDocument(documentId){
    const res=await API.post(`/billing/documents/${documentId}/duplicate`,{});
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo duplicar el documento.','error');return;}
    showToast('Documento duplicado.');billingState.selectedDocumentId=res.data?.id||billingState.selectedDocumentId;await loadBillingWorkspace();renderBillingFocus();
}

async function deleteBillingDocument(documentId){
    if(!confirm('Eliminar este documento? Solo se puede borrar si aun no esta emitido.'))return;
    const res=await API.del(`/billing/documents/${documentId}`);
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo eliminar el documento.','error');return;}
    showToast('Documento eliminado.');if(billingState.selectedDocumentId===documentId)billingState.selectedDocumentId=null;await loadBillingWorkspace();
}

async function seedBillingDemo(){
    const res=await API.post('/billing/demo-seed',{});
    if(!res?.success){showToast(res?.errors?.[0]||'No se pudo cargar el escenario demo.','error');return;}
    showToast('Escenario demo cargado.');await loadBillingWorkspace();
}
