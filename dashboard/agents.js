// Agents Management

let allAgents = [];

document.addEventListener('DOMContentLoaded', () => {
    // Nav click bindings
    document.getElementById('nav-agents')?.addEventListener('click', loadAgents);
    
    // Global Agent Select Logic
    const agentSelect = document.getElementById('global-agent-select');
    if (agentSelect) {
        agentSelect.addEventListener('change', (e) => {
            const agentName = e.target.value;
            if (agentName) {
                localStorage.setItem('agentName', agentName);
                if (typeof currentAgentName !== 'undefined') currentAgentName = agentName; // update chats.js variable if loaded
            } else {
                localStorage.removeItem('agentName');
                if (typeof currentAgentName !== 'undefined') currentAgentName = null;
            }
        });
    }

    // Load agents immediately to populate global dropdown
    loadAgents();
});

async function loadAgents() {
    try {
        const res = await api('/api/agents');
        if (res.success) {
            allAgents = res.agents;
            renderAgentsTable();
            updateGlobalAgentDropdown();
        }
    } catch (e) {
        console.error('Failed to load agents', e);
    }
}

function updateGlobalAgentDropdown() {
    const select = document.getElementById('global-agent-select');
    if (!select) return;
    
    const currentName = localStorage.getItem('agentName');
    
    select.innerHTML = '<option value="">-- Select Agent --</option>';
    allAgents.forEach(agent => {
        select.innerHTML += `<option value="${agent.name}">${agent.name} (${agent.role})</option>`;
    });
    
    if (currentName) {
        select.value = currentName;
    }
}

function renderAgentsTable() {
    const tbody = document.getElementById('agents-tbody');
    if (!tbody) return;
    
    if (allAgents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No agents found. Add one above.</td></tr>';
        return;
    }
    
    tbody.innerHTML = allAgents.map(agent => `
        <tr>
            <td><strong>${agent.name}</strong><br><small class="text-muted">@${agent.username}</small></td>
            <td><span style="background: var(--bg-hover); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">${agent.role}</span></td>
            <td>${new Date(agent.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="icon-btn text-danger" onclick="deleteAgent('${agent.id}')" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function showAddAgentModal() {
    document.getElementById('newAgentName').value = '';
    document.getElementById('newAgentUsername').value = '';
    document.getElementById('newAgentPassword').value = '';
    document.getElementById('newAgentRole').value = 'Agent';
    document.getElementById('addAgentModal').style.display = 'flex';
}

async function submitAddAgent() {
    const name = document.getElementById('newAgentName').value.trim();
    const username = document.getElementById('newAgentUsername').value.trim();
    const password = document.getElementById('newAgentPassword').value.trim();
    const role = document.getElementById('newAgentRole').value;
    
    if (!name || !username || !password) return alert('Name, Username, and Password are required');
    
    try {
        const res = await api('/api/agents', {
            method: 'POST',
            body: JSON.stringify({ name, username, password, role })
        });
        
        if (res.success) {
            closeModal('addAgentModal');
            loadAgents(); // Reload table and dropdowns
        } else {
            alert('Failed to add agent: ' + res.error);
        }
    } catch (e) {
        alert('Error adding agent');
    }
}

async function deleteAgent(id) {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    
    try {
        const res = await api(`/api/agents/${id}`, { method: 'DELETE' });
        if (res.success) {
            loadAgents();
        } else {
            alert('Failed to delete agent');
        }
    } catch (e) {
        alert('Error deleting agent');
    }
}
