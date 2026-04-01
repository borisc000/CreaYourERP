const SUBSCRIPTION_STORAGE_KEY = 'erp_subscription_preview';

const subscriptionState = {
    planId: 'growth',
    billingCycle: 'monthly',
    paymentMethod: 'card',
};

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('subscription-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const storedPreview = getStoredSubscription();

    subscriptionState.planId = params.get('plan') || storedPreview?.plan_id || root.dataset.defaultPlan || 'growth';
    subscriptionState.billingCycle = storedPreview?.billing_cycle || root.dataset.defaultCycle || 'monthly';
    subscriptionState.paymentMethod = storedPreview?.payment_method || 'card';

    hydrateSubscriptionForm(storedPreview);
    applySelectedPlan(subscriptionState.planId);
    setBillingCycle(subscriptionState.billingCycle, false);
    applySelectedPaymentMethod(subscriptionState.paymentMethod);
    updateCheckoutSummary();
});

function getStoredSubscription() {
    try {
        return JSON.parse(localStorage.getItem(SUBSCRIPTION_STORAGE_KEY));
    } catch {
        return null;
    }
}

function hydrateSubscriptionForm(preview) {
    if (!preview) return;

    const companyName = document.getElementById('company-name');
    const adminName = document.getElementById('admin-name');
    const adminEmail = document.getElementById('admin-email');
    const teamSize = document.getElementById('team-size');
    const taxId = document.getElementById('tax-id');
    const billingCountry = document.getElementById('billing-country');

    if (companyName && !companyName.value) companyName.value = preview.company_name || '';
    if (adminName && !adminName.value) adminName.value = preview.admin_name || '';
    if (adminEmail && !adminEmail.value) adminEmail.value = preview.admin_email || '';
    if (teamSize && preview.team_size) teamSize.value = preview.team_size;
    if (taxId && !taxId.value) taxId.value = preview.tax_id || '';
    if (billingCountry && !billingCountry.value) billingCountry.value = preview.billing_country || 'Chile';
}

function formatClp(amount) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function formatBillingCycle(cycle) {
    return cycle === 'yearly' ? 'Anual' : 'Mensual';
}

function getSelectedPlanCard() {
    return document.querySelector(`.plan-card[data-plan-id="${subscriptionState.planId}"]`);
}

function getSelectedPaymentMethod() {
    return document.querySelector(`.payment-method[data-method-id="${subscriptionState.paymentMethod}"]`);
}

function selectPlanCard(cardElement) {
    if (!cardElement) return;
    subscriptionState.planId = cardElement.dataset.planId;
    applySelectedPlan(subscriptionState.planId);
    updateCheckoutSummary();
}

function applySelectedPlan(planId) {
    document.querySelectorAll('.plan-card').forEach((card) => {
        card.classList.toggle('selected', card.dataset.planId === planId);
    });
}

function setBillingCycle(cycle, refreshSummary = true) {
    subscriptionState.billingCycle = cycle;

    document.querySelectorAll('.billing-cycle-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.cycleId === cycle);
    });

    document.querySelectorAll('.plan-card').forEach((card) => {
        const priceLabel = cycle === 'yearly' ? card.querySelector('.plan-price').dataset.yearlyLabel : card.querySelector('.plan-price').dataset.monthlyLabel;
        const priceNote = cycle === 'yearly' ? card.querySelector('.plan-price-note').dataset.yearlyNote : card.querySelector('.plan-price-note').dataset.monthlyNote;

        card.querySelector('.plan-price').textContent = priceLabel;
        card.querySelector('.plan-price-note').textContent = priceNote;
    });

    if (refreshSummary) updateCheckoutSummary();
}

function selectPaymentMethod(buttonElement) {
    if (!buttonElement) return;
    subscriptionState.paymentMethod = buttonElement.dataset.methodId;
    applySelectedPaymentMethod(subscriptionState.paymentMethod);
    updateCheckoutSummary();
}

function applySelectedPaymentMethod(methodId) {
    document.querySelectorAll('.payment-method').forEach((button) => {
        button.classList.toggle('selected', button.dataset.methodId === methodId);
    });
}

function updateCheckoutSummary() {
    const selectedPlan = getSelectedPlanCard();
    const selectedMethod = getSelectedPaymentMethod();
    if (!selectedPlan || !selectedMethod) return;

    const amount = subscriptionState.billingCycle === 'yearly'
        ? Number(selectedPlan.dataset.yearlyPrice)
        : Number(selectedPlan.dataset.monthlyPrice);

    const planName = selectedPlan.dataset.planName;
    const methodName = selectedMethod.querySelector('strong').textContent;

    const fields = {
        'summary-plan-name': planName,
        'summary-price': formatClp(amount),
        'summary-cycle': formatBillingCycle(subscriptionState.billingCycle),
        'summary-method': methodName,
        'subscription-summary-status': subscriptionState.billingCycle === 'yearly' ? 'Cobro anual planificado' : 'Cobro mensual planificado',
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

async function handleSubscriptionCheckout(event) {
    event.preventDefault();

    const selectedPlan = getSelectedPlanCard();
    const selectedMethod = getSelectedPaymentMethod();
    const errorBox = document.getElementById('subscription-error');
    const submitBtn = document.getElementById('subscription-submit-btn');

    errorBox.textContent = '';

    if (!selectedPlan || !selectedMethod) {
        errorBox.textContent = 'Selecciona un plan y un metodo de pago.';
        return;
    }

    const payload = {
        plan_id: subscriptionState.planId,
        billing_cycle: subscriptionState.billingCycle,
        payment_method: subscriptionState.paymentMethod,
        company_name: document.getElementById('company-name').value.trim(),
        admin_name: document.getElementById('admin-name').value.trim(),
        admin_email: document.getElementById('admin-email').value.trim(),
        team_size: document.getElementById('team-size').value,
        tax_id: document.getElementById('tax-id').value.trim(),
        billing_country: document.getElementById('billing-country').value.trim(),
    };

    if (!payload.company_name || !payload.admin_name || !payload.admin_email || !payload.team_size || !payload.billing_country) {
        errorBox.textContent = 'Completa los datos de empresa y contacto para continuar.';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Preparando checkout...';

    const response = await API.post('/app/api/billing/checkout-preview', payload);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Simular checkout recurrente';

    if (!response || !response.success) {
        errorBox.textContent = (response && response.errors && response.errors[0]) || 'No se pudo preparar la suscripcion.';
        return;
    }

    const preview = {
        ...payload,
        ...response.data,
        plan_name: response.data.plan_name || selectedPlan.dataset.planName,
        amount: response.data.amount,
        payment_method_label: selectedMethod.querySelector('strong').textContent,
        created_at: new Date().toISOString(),
    };

    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(preview));
    renderSubscriptionSuccess(preview);
    showToast('Suscripcion simulada lista para conectar proveedor.');
}

function renderSubscriptionSuccess(preview) {
    const successCard = document.getElementById('subscription-success-card');
    if (!successCard) return;

    const fields = {
        'subscription-success-copy': `Se creo una referencia comercial para ${preview.company_name}. Puedes volver al login y continuar con la cuenta administradora.`,
        'success-plan': `${preview.plan_name} ${formatBillingCycle(preview.billing_cycle).toLowerCase()}`,
        'success-amount': formatClp(preview.amount),
        'success-reference': preview.subscription_id,
        'success-status': preview.status_label || 'Listo para integrar pasarela',
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });

    successCard.classList.remove('is-hidden');
    successCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToLoginWithSubscription() {
    window.location.href = '/app/login?subscription=ready';
}

function scrollToCheckoutTop() {
    const root = document.getElementById('subscription-root');
    if (root) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
