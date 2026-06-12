document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadDashboardData();
});

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            
            link.classList.add('active');
            const targetId = link.getAttribute('href').substring(1);
            document.getElementById(`view-${targetId}`).classList.add('active');
            pageTitle.textContent = link.textContent.trim();
        });
    });
}

// API Helper
async function api(path, options = {}) {
    const defaultOptions = {
        headers: {
            'x-api-key': 'my-super-secret-api-key', // Hardcoded for dashboard demo purposes, should ideally be dynamic
            'Content-Type': 'application/json'
        }
    };
    const res = await fetch(path, { ...defaultOptions, ...options });
    return res.json();
}

function showAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('active');
    document.getElementById('newAccountId').value = '';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function createAccount() {
    const id = document.getElementById('newAccountId').value.trim().toLowerCase();
    if(!id) return alert('Enter a valid account ID');
    
    closeModal('addAccountModal');
    
    try {
        const res = await api('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ name: id })
        });
        
        if(res.success) {
            setTimeout(loadDashboardData, 1000); // Reload list
        } else {
            alert('Error: ' + res.error);
        }
    } catch (e) {
        alert('Failed to connect to API');
    }
}

async function showQR(accountId) {
    document.getElementById('qrModal').classList.add('active');
    document.getElementById('qr-container').innerHTML = '<div class="loader"></div>';
    document.getElementById('qr-status').textContent = 'Generating QR Code...';
    
    let attempts = 0;
    
    const fetchQr = async () => {
        if (!document.getElementById('qrModal').classList.contains('active')) return;
        
        try {
            const res = await api(`/api/accounts/${accountId}/qr`);
            if (res.success && res.qr) {
                document.getElementById('qr-container').innerHTML = `<img src="${res.qr}" alt="QR Code" style="width: 250px; border-radius: 12px; border: 1px solid #e2e8f0;">`;
                document.getElementById('qr-status').textContent = 'Scan with WhatsApp';
                
                // Start polling status to close modal when connected
                checkStatus(accountId);
            } else {
                if (attempts < 10) {
                    attempts++;
                    setTimeout(fetchQr, 2000); // Retry every 2s
                } else {
                    document.getElementById('qr-status').textContent = 'Failed to generate QR. Please refresh.';
                }
            }
        } catch (e) {
            document.getElementById('qr-status').textContent = 'API Error.';
        }
    };
    
    fetchQr();
}

async function checkStatus(accountId) {
    if (!document.getElementById('qrModal').classList.contains('active')) return;
    
    try {
        const res = await api(`/api/accounts/${accountId}/status`);
        if (res.status === 'CONNECTED') {
            closeModal('qrModal');
            loadDashboardData(); // Refresh UI
        } else {
            setTimeout(() => checkStatus(accountId), 3000); // Check again in 3s
        }
    } catch (e) {}
}

async function loadDashboardData() {
    try {
        const res = await api('/api/accounts');
        if (res.success) {
            renderAccounts(res.accounts);
        }
    } catch (e) {
        console.error('Failed to load accounts');
    }
}

async function deleteAccount(id) {
    if (!confirm(`Are you sure you want to delete ${id}?`)) return;
    try {
        await api(`/api/accounts/${id}/logout`, { method: 'POST' });
        loadDashboardData();
    } catch(e) {}
}

function renderAccounts(accounts) {
    const container = document.getElementById('accounts-container');
    container.innerHTML = '';
    
    let online = 0;
    let offline = 0;

    accounts.forEach(acc => {
        if (acc.status === 'LOGGED_OUT') return; // Hide logged out accounts completely
        
        const isConnected = acc.status === 'CONNECTED';
        if(isConnected) online++; else offline++;
        
        container.innerHTML += `
            <div class="account-card">
                <div class="account-header">
                    <div class="account-title">${acc.name}</div>
                    <div class="status-badge ${isConnected ? 'connected' : 'disconnected'}">
                        ${acc.status}
                    </div>
                </div>
                <div class="account-details">
                    <p>ID: <code>${acc.id}</code></p>
                    <p>Phone: <strong>${acc.number}</strong></p>
                    <p>Key: <code class="blur-text" style="font-size:0.75rem; cursor:pointer;" onclick="navigator.clipboard.writeText('${acc.apiKey}'); alert('API Key copied!');" title="Click to copy">${acc.apiKey}</code></p>
                </div>
                <div class="account-actions">
                    ${isConnected ? 
                        `<button class="btn" onclick="alert('Sending test...')">Test Msg</button>
                         <button class="btn" style="color:var(--danger); border-color:#fca5a5" onclick="deleteAccount('${acc.id}')">Logout</button>` :
                        `<button class="btn btn-primary" onclick="showQR('${acc.id}')">Scan QR</button>
                         <button class="btn" style="color:var(--danger); border-color:#fca5a5" onclick="deleteAccount('${acc.id}')">Delete</button>`
                    }
                </div>
            </div>
        `;
    });

    document.getElementById('online-count').textContent = online;
    document.getElementById('offline-count').textContent = offline;
    document.getElementById('stat-total').textContent = online + offline;
}
