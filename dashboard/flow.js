let editor = null;
let currentFlowAccount = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure container is ready
    setTimeout(() => {
        initDrawflow();
        initFlowAccounts();
    }, 500);

    // Watch for click on flow builder tab to refresh accounts
    document.getElementById('nav-flows')?.addEventListener('click', initFlowAccounts);
});

function initDrawflow() {
    const id = document.getElementById("drawflow");
    editor = new Drawflow(id);
    editor.reroute = true;
    editor.start();
    
    // Add custom events to inputs so they don't trigger drag
    editor.on('nodeCreated', function(id) {
        const node = document.getElementById(`node-${id}`);
        const inputs = node.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('mousedown', (e) => e.stopPropagation());
            input.addEventListener('touchstart', (e) => e.stopPropagation());
            // Update editor data on change
            input.addEventListener('input', (e) => {
                const attr = e.target.getAttribute('df-' + e.target.name) !== null ? e.target.name : e.target.getAttribute('df-name') || e.target.name;
                if(attr) {
                    const nodeData = editor.getNodeFromId(id);
                    nodeData.data[attr] = e.target.value;
                    editor.updateNodeDataFromId(id, nodeData.data);
                }
            });
        });
    });
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    if (ev.type === "touchstart") {
        ev.dataTransfer = { setData: function () {} };
        ev.dataTransfer.setData("node", ev.target.closest('.drag-drawflow').getAttribute('data-node'));
    } else {
        ev.dataTransfer.setData("node", ev.target.getAttribute('data-node'));
    }
}

function drop(ev) {
    if (ev.type === "touchend") {
        ev.preventDefault();
        return;
    }
    ev.preventDefault();
    let data = ev.dataTransfer.getData("node");
    addNodeToDrawFlow(data, ev.clientX, ev.clientY);
}

function addNodeToDrawFlow(name, pos_x, pos_y) {
    if(editor.editor_mode === 'fixed') {
        return false;
    }
    pos_x = pos_x * ( editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * ( editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
    pos_y = pos_y * ( editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * ( editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

    const template = getNodeTemplate(name);
    editor.addNode(name, template.inputs, template.outputs, pos_x, pos_y, name, template.data, template.html);
}

function getNodeTemplate(name) {
    switch (name) {
        case 'webhook':
            return {
                inputs: 0,
                outputs: 1,
                data: { phoneField: 'phone', nameField: 'name' },
                html: `
                    <div class="title-box" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">
                        <span class="node-icon" style="background:#f59e0b">⚡</span> Webhook Trigger
                    </div>
                    <div class="box">
                        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0;">Maps incoming JSON payload.</p>
                        <div>
                            <label>Phone Field Key</label>
                            <input type="text" name="phoneField" df-phoneField placeholder="e.g. phone" value="phone">
                        </div>
                        <div>
                            <label>Name Field Key</label>
                            <input type="text" name="nameField" df-nameField placeholder="e.g. name" value="name">
                        </div>
                    </div>
                `
            };
        case 'message':
            return {
                inputs: 1,
                outputs: 1,
                data: { message: 'Hello {{name}}!', mediaUrl: '' },
                html: `
                    <div class="title-box" style="background:#dbeafe; color:#1e40af; border-color:#bfdbfe;">
                        <span class="node-icon" style="background:#3b82f6">💬</span> Send Message
                    </div>
                    <div class="box">
                        <div>
                            <label>Message Text</label>
                            <textarea name="message" df-message placeholder="Enter message... You can use {{key}} variables.">Hello {{name}}!</textarea>
                        </div>
                        <div>
                            <label>Media URL (Optional)</label>
                            <input type="url" name="mediaUrl" df-mediaUrl placeholder="https://...">
                        </div>
                    </div>
                `
            };
        case 'timer':
            return {
                inputs: 1,
                outputs: 1,
                data: { delayHours: 1 },
                html: `
                    <div class="title-box" style="background:#ede9fe; color:#5b21b6; border-color:#ddd6fe;">
                        <span class="node-icon" style="background:#8b5cf6">⏱️</span> Timer
                    </div>
                    <div class="box">
                        <div>
                            <label>Delay (Hours)</label>
                            <input type="number" name="delayHours" df-delayHours value="1" min="0" step="0.5">
                        </div>
                    </div>
                `
            };
        case 'ifelse':
            return {
                inputs: 1,
                outputs: 2,
                data: { conditionField: 'status', conditionValue: 'paid' },
                html: `
                    <div class="title-box" style="background:#d1fae5; color:#065f46; border-color:#a7f3d0;">
                        <span class="node-icon" style="background:#10b981">🔀</span> If / Else
                    </div>
                    <div class="box">
                        <div>
                            <label>Payload Field</label>
                            <input type="text" name="conditionField" df-conditionField value="status">
                        </div>
                        <div>
                            <label>Equals Value</label>
                            <input type="text" name="conditionValue" df-conditionValue value="paid">
                        </div>
                        <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color:var(--text-muted); margin-top:8px;">
                            <span>Output 1: True</span>
                            <span>Output 2: False</span>
                        </div>
                    </div>
                `
            };
        case 'end':
            return {
                inputs: 1,
                outputs: 0,
                data: {},
                html: `
                    <div class="title-box" style="background:#fee2e2; color:#991b1b; border-color:#fecaca;">
                        <span class="node-icon" style="background:#ef4444">🛑</span> End Flow
                    </div>
                    <div class="box">
                        <p style="font-size:0.8rem; text-align:center; color:var(--text-muted); margin:0;">Stops execution.</p>
                    </div>
                `
            };
    }
}

async function initFlowAccounts() {
    try {
        const res = await api('/api/accounts');
        if (res.success) {
            const select = document.getElementById('flow-account-select');
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select Account</option>';
            res.accounts.forEach(acc => {
                if (acc.status !== 'LOGGED_OUT') {
                    select.innerHTML += `<option value="${acc.id}">${acc.name} (${acc.id})</option>`;
                }
            });
            if (currentVal) select.value = currentVal;
            
            // Re-bind change event
            select.removeEventListener('change', onFlowAccountChange);
            select.addEventListener('change', onFlowAccountChange);
        }
    } catch(e) {}
}

async function onFlowAccountChange(e) {
    currentFlowAccount = e.target.value;
    const urlDisplay = document.getElementById('flow-webhook-url');
    
    if (!currentFlowAccount) {
        editor.clear();
        urlDisplay.textContent = 'Select an account to view webhook URL';
        return;
    }
    
    // Set Webhook URL
    const host = window.location.origin;
    urlDisplay.textContent = `${host}/api/flows/webhook/${currentFlowAccount}`;
    
    // Load existing flow
    try {
        const res = await api(`/api/flows/${currentFlowAccount}`);
        if (res.success && res.flow && Object.keys(res.flow).length > 0) {
            editor.import({ drawflow: { Home: { data: res.flow } } });
        } else {
            editor.clear();
        }
    } catch (err) {
        editor.clear();
    }
}

function clearFlow() {
    if(confirm('Are you sure you want to clear the flow?')) {
        editor.clear();
    }
}

async function saveFlow() {
    if (!currentFlowAccount) {
        return alert("Please select an account first.");
    }
    
    const exportdata = editor.export();
    const flowData = exportdata.drawflow.Home.data;
    
    try {
        const res = await fetch(`/api/flows/${currentFlowAccount}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ADMIN_KEY
            },
            body: JSON.stringify({ flow: flowData })
        });
        const data = await res.json();
        if (data.success) {
            alert('Flow saved successfully!');
        } else {
            alert('Error saving flow: ' + data.error);
        }
    } catch (e) {
        alert('Failed to save flow.');
    }
}
