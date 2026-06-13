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

function toggleFullscreen() {
    const container = document.getElementById('view-flows');
    container.classList.toggle('fullscreen-flow');
    const btn = document.getElementById('btn-fullscreen');
    if (container.classList.contains('fullscreen-flow')) {
        btn.innerText = 'Exit Fullscreen';
    } else {
        btn.innerText = 'Fullscreen';
    }
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
                        <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">Maps incoming JSON payload.</p>
                        <button type="button" class="btn btn-secondary" onclick="fetchLatestWebhook(this)" style="padding:4px 8px; font-size:0.7rem; width:100%; margin-bottom:8px;">Fetch Last Payload</button>
                        <pre class="payload-display" style="display:none; background:#f1f5f9; padding:8px; border-radius:4px; font-size:0.65rem; overflow-x:auto; max-height:100px; margin-bottom:8px; color:#334155; white-space:pre-wrap; word-break:break-all;"></pre>
                        <div>
                            <label>Phone Field Key (Required)</label>
                            <input type="text" name="phoneField" df-phoneField placeholder="e.g. phone" value="phone">
                        </div>
                        <div>
                            <label>Name Field Key (Optional)</label>
                            <input type="text" name="nameField" df-nameField placeholder="e.g. name" value="name">
                        </div>
                    </div>
                `
            };
        case 'incoming':
            return {
                inputs: 0,
                outputs: 1,
                data: {},
                html: `
                    <div class="title-box" style="background:#d1fae5; color:#065f46; border-color:#a7f3d0;">
                        <span class="node-icon" style="background:#059669">📥</span> Incoming Message
                    </div>
                    <div class="box">
                        <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">Triggers when a user sends a WhatsApp message.</p>
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
                            <textarea name="message" df-message placeholder="Enter message... You can use {{name}} variables.">Hello {{name}}!</textarea>
                        </div>
                        <div>
                            <label>Media URL (Optional)</label>
                            <input type="url" name="mediaUrl" df-mediaUrl placeholder="https://...">
                        </div>
                    </div>
                `
            };
        case 'ai_agent':
            return {
                inputs: 1,
                outputs: 1,
                data: { apiKey: '', prompt: 'You are a helpful assistant. Keep answers brief.' },
                html: `
                    <div class="title-box" style="background:#ede9fe; color:#5b21b6; border-color:#ddd6fe;">
                        <span class="node-icon" style="background:#8b5cf6">🤖</span> AI Agent
                    </div>
                    <div class="box">
                        <div>
                            <label>OpenAI API Key</label>
                            <input type="password" name="apiKey" df-apiKey placeholder="sk-...">
                        </div>
                        <div>
                            <label>System Prompt (Guidelines)</label>
                            <textarea name="prompt" df-prompt placeholder="Strict guidelines for the AI...">You are a helpful assistant...</textarea>
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
                data: { conditionType: 'payload', conditionField: 'status', conditionValue: 'paid' },
                html: `
                    <div class="title-box" style="background:#ccfbf1; color:#0f766e; border-color:#99f6e4;">
                        <span class="node-icon" style="background:#14b8a6">🔀</span> If / Else
                    </div>
                    <div class="box">
                        <div>
                            <label>Condition Type</label>
                            <select name="conditionType" df-conditionType onchange="this.parentElement.nextElementSibling.style.display = this.value === 'payload' ? 'block' : 'none'; this.parentElement.nextElementSibling.nextElementSibling.style.display = this.value === 'payload' ? 'block' : 'none';">
                                <option value="payload">Payload Field</option>
                                <option value="replied">Has Replied?</option>
                                <option value="seen">Has Seen/Read?</option>
                            </select>
                        </div>
                        <div>
                            <label>Field (if Payload)</label>
                            <input type="text" name="conditionField" df-conditionField value="status">
                        </div>
                        <div>
                            <label>Equals Value (if Payload)</label>
                            <input type="text" name="conditionValue" df-conditionValue value="paid">
                        </div>
                        <div style="display:flex; justify-content: space-between; font-size: 0.75rem; color:var(--text-muted); margin-top:8px;">
                            <span>Output 1: Yes</span>
                            <span>Output 2: No</span>
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

async function fetchLatestWebhook(btn) {
    if (!currentFlowAccount) return alert("Please select an account first.");
    
    btn.innerText = "Fetching...";
    try {
        const res = await api(`/api/flows/webhook/latest/${currentFlowAccount}`);
        const pre = btn.nextElementSibling;
        if (res.success && res.payload) {
            pre.textContent = JSON.stringify(res.payload, null, 2);
            pre.style.display = 'block';
            btn.innerText = "Refresh Payload";
        } else {
            alert("No payload found! Please send a test payload from your source first.");
            btn.innerText = "Fetch Last Payload";
        }
    } catch(e) {
        alert("Failed to fetch payload.");
        btn.innerText = "Fetch Last Payload";
    }
}

async function testFlow() {
    if (!currentFlowAccount) {
        return alert("Please select an account first.");
    }
    
    const exportdata = editor.export();
    const flowData = exportdata.drawflow.Home.data;
    const nodes = Object.values(flowData);
    const hasIncoming = nodes.find(n => n.name === 'incoming');
    
    let payload = {};
    if (hasIncoming) {
        payload = {
            event: 'message_received',
            sender: '1234567890',
            text: 'Hello, this is a test message from dashboard!'
        };
    } else {
        payload = {
            phone: '1234567890',
            name: 'Test User',
            status: 'paid'
        };
    }

    const btn = document.getElementById('btn-test');
    btn.innerText = 'Testing...';
    
    try {
        const response = await fetch(`/api/flows/webhook/${currentFlowAccount}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            alert('Test payload sent! Check the Overview or Logs to see execution.');
        } else {
            alert('Error testing flow: ' + result.error);
        }
    } catch (error) {
        alert('Failed to send test payload: ' + error.message);
    }
    btn.innerText = 'Test Flow';
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
