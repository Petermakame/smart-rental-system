// Show Add Tenant Modal
function showAddTenant() {
  document.getElementById('addTenantModal').classList.remove('hidden');
}

// Show Add Payment Modal
function showAddPayment() {
  fetch('/api/tenants')
    .then(res => res.json())
    .then(tenants => {
      const select = document.getElementById('tenantSelect');
      select.innerHTML = '<option value="">Select Tenant</option>';
      tenants.forEach(tenant => {
        select.innerHTML += `<option value="${tenant.id}">${tenant.room_no} - ${tenant.name}</option>`;
      });
      document.getElementById('addPaymentModal').classList.remove('hidden');
    })
    .catch(err => console.error(err));
}

// Close Modal
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Add Tenant Form Submit
document.getElementById('addTenantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    const msgDiv = document.getElementById('tenantMsg');
    
    if (res.ok) {
      msgDiv.className = 'alert alert-success';
      msgDiv.textContent = '✅ Tenant created successfully!';
      msgDiv.classList.remove('hidden');
      setTimeout(() => location.reload(), 1500);
    } else {
      msgDiv.className = 'alert alert-error';
      msgDiv.textContent = '❌ ' + result.error;
      msgDiv.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
  }
});

// Add Payment Form Submit
document.getElementById('addPaymentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  
  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await res.json();
    const msgDiv = document.getElementById('paymentMsg');
    
    if (res.ok) {
      msgDiv.className = 'alert alert-success';
      msgDiv.textContent = '✅ Payment recorded successfully!';
      msgDiv.classList.remove('hidden');
      setTimeout(() => location.reload(), 1500);
    } else {
      msgDiv.className = 'alert alert-error';
      msgDiv.textContent = '❌ ' + result.error;
      msgDiv.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
  }
});

// Close modals when clicking outside
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.add('hidden');
  }
};