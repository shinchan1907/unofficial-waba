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

function showAddAccountModal() {
    document.getElementById('addAccountModal').classList.add('active');
    document.getElementById('newAccountId').value = '';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function createAccount() {
    const id = document.getElementById('newAccountId').value.trim().toLowerCase();
    if(!id) return alert('Enter a valid account ID');
    
    // Placeholder for actual API call
    alert('Will call POST /api/accounts with: ' + id);
    closeModal('addAccountModal');
    
    // Mock addition
    mockAccounts.push({ id, name: id.charAt(0).toUpperCase() + id.slice(1), status: 'DISCONNECTED', number: '-' });
    renderAccounts(mockAccounts);
}

function showQR(accountId) {
    document.getElementById('qrModal').classList.add('active');
    document.getElementById('qr-container').innerHTML = '<div class="loader"></div>';
    document.getElementById('qr-status').textContent = 'Generating QR Code...';
    
    // Placeholder for actual QR fetch
    setTimeout(() => {
        document.getElementById('qr-container').innerHTML = `
            <div style="width:200px; height:200px; background:#fff; border:1px solid #e2e8f0; margin:0 auto; display:flex; align-items:center; justify-content:center; border-radius:12px;">
                <span style="color:#94a3b8; font-size:0.9rem;">QR Code Space</span>
            </div>
        `;
        document.getElementById('qr-status').textContent = 'Scan with WhatsApp';
    }, 1500);
}

// MOCK DATA for now until we build the backend services
let mockAccounts = [
    { id: 'marketing', name: 'Marketing', status: 'CONNECTED', number: '+91 9876543210' },
    { id: 'support', name: 'Support', status: 'DISCONNECTED', number: '-' }
];

function loadDashboardData() {
    // In next steps, this will call GET /api/accounts
    renderAccounts(mockAccounts);
}

function renderAccounts(accounts) {
    const container = document.getElementById('accounts-container');
    container.innerHTML = '';
    
    let online = 0;
    let offline = 0;

    accounts.forEach(acc => {
        const isConnected = acc.status === 'CONNECTED';
        if(isConnected) online++; else offline++;
        
        container.innerHTML += `
            <div class="account-card">
                <div class="account-header">
                    <div class="account-title">${acc.name}</div>
                    <div class="status-badge ${isConnected ? 'connected' : 'disconnected'}">
                        ${isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
                <div class="account-details">
                    <p>ID: <code>${acc.id}</code></p>
                    <p>Phone: <strong>${acc.number}</strong></p>
                </div>
                <div class="account-actions">
                    ${isConnected ? 
                        `<button class="btn" onclick="alert('Sending test...')">Test Msg</button>
                         <button class="btn" style="color:var(--danger); border-color:#fca5a5" onclick="alert('Logging out...')">Logout</button>` :
                        `<button class="btn btn-primary" onclick="showQR('${acc.id}')">Scan QR</button>
                         <button class="btn" style="color:var(--danger); border-color:#fca5a5" onclick="alert('Deleting...')">Delete</button>`
                    }
                </div>
            </div>
        `;
    });

    document.getElementById('online-count').textContent = online;
    document.getElementById('offline-count').textContent = offline;
    document.getElementById('stat-total').textContent = accounts.length;
}
