let currentChatAccount = null;
let activeChatPhone = null;
let allChats = {};
let chatRefreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    // We will hook into app.js's fetchSystemData to update the dropdown if needed,
    // but easier to just init the accounts dropdown on load
    setTimeout(initChatAccounts, 500);
    
    // Refresh active chat every 5 seconds if we are on the chats view
    setInterval(() => {
        const view = document.getElementById('view-chats');
        if (view && view.classList.contains('active') && currentChatAccount) {
            loadChats(currentChatAccount, false);
        }
    }, 5000);
});

async function initChatAccounts() {
    try {
        const res = await api('/api/accounts');
        if (res.success) {
            const select = document.getElementById('chat-account-select');
            const currentVal = select.value;
            select.innerHTML = '<option value="">Select Account</option>';
            res.accounts.forEach(acc => {
                if (acc.status !== 'LOGGED_OUT') {
                    select.innerHTML += `<option value="${acc.id}">${acc.name} (${acc.id})</option>`;
                }
            });
            if (currentVal) select.value = currentVal;
            
            select.removeEventListener('change', onChatAccountChange);
            select.addEventListener('change', onChatAccountChange);
        }
    } catch (e) {
        console.error('Failed to init chat accounts');
    }
}

async function onChatAccountChange(e) {
    currentChatAccount = e.target.value;
    activeChatPhone = null; // reset active chat
    
    if (!currentChatAccount) {
        document.getElementById('chat-contacts-list').innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Select an account to load chats.</div>';
        document.getElementById('chat-messages-container').innerHTML = '';
        document.getElementById('chat-active-contact').textContent = 'Select a conversation';
        document.getElementById('chat-input-area').style.display = 'none';
        return;
    }
    
    document.getElementById('chat-input-area').style.display = 'none';
    await loadChats(currentChatAccount, true);
}

async function loadChats(accountId, fullRefresh = false) {
    try {
        const res = await api(`/api/chats/${accountId}`);
        if (res.success) {
            allChats = res.chats || {};
            renderContactList();
            if (activeChatPhone) {
                renderMessages(activeChatPhone);
            } else {
                document.getElementById('chat-messages-container').innerHTML = '';
            }
        }
    } catch(e) {
        console.error('Failed to load chats');
    }
}

function renderContactList() {
    const list = document.getElementById('chat-contacts-list');
    
    const phones = Object.keys(allChats).sort((a, b) => {
        return allChats[b].lastUpdate - allChats[a].lastUpdate;
    });
    
    if (phones.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No chats found for this account.</div>';
        return;
    }
    
    list.innerHTML = phones.map(phone => {
        const chat = allChats[phone];
        const lastMsg = chat.messages[chat.messages.length - 1];
        let preview = lastMsg ? lastMsg.text : '';
        if(preview.length > 30) preview = preview.substring(0, 30) + '...';
        
        const date = new Date(chat.lastUpdate);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const isActive = activeChatPhone === phone;
        
        return `
            <div onclick="selectChat('${phone}')" style="padding: 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.2s; background: ${isActive ? '#f1f5f9' : '#fff'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="font-size: 0.95rem;">${phone}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${lastMsg && lastMsg.sender === 'bot' ? '🤖: ' : '👤: '}${preview}
                </div>
            </div>
        `;
    }).join('');
}

function selectChat(phone) {
    activeChatPhone = phone;
    renderContactList(); // Re-render to highlight active
    renderMessages(phone);
    
    // Also scroll to bottom
    setTimeout(() => {
        const container = document.getElementById('chat-messages-container');
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function renderMessages(phone) {
    document.getElementById('chat-active-contact').textContent = '+' + phone;
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-status-toggle').style.display = 'flex';
    
    const chat = allChats[phone];
    const isHuman = chat && chat.status === 'human';
    
    const toggle = document.getElementById('chat-human-toggle');
    const label = document.getElementById('chat-status-label');
    toggle.checked = isHuman;
    
    if (isHuman) {
        label.textContent = "Agent Mode (Bot Paused)";
        label.style.color = "var(--primary)";
    } else {
        label.textContent = "Bot Active";
        label.style.color = "var(--text-muted)";
    }
    
    const container = document.getElementById('chat-messages-container');
    
    if (!chat || !chat.messages || chat.messages.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No messages</div>';
        return;
    }
    
    // Check if user is scrolled to bottom
    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
    
    container.innerHTML = chat.messages.map(msg => {
        const isBot = msg.sender === 'bot';
        const bg = isBot ? '#dbeafe' : '#e2e8f0';
        const color = isBot ? '#1e3a8a' : '#0f172a';
        const align = isBot ? 'flex-end' : 'flex-start';
        const text = (msg.text || '').replace(/\n/g, '<br>');
        
        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div style="display: flex; flex-direction: column; align-items: ${align}; width: 100%;">
                <div style="background: ${bg}; color: ${color}; padding: 10px 14px; border-radius: 12px; max-width: 75%; font-size: 0.9rem;">
                    ${text}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; padding: 0 4px;">
                    ${timeStr}
                </div>
            </div>
        `;
    }).join('');
    
    if (isScrolledToBottom) {
        container.scrollTop = container.scrollHeight;
    }
}

async function toggleAgentMode() {
    if (!currentChatAccount || !activeChatPhone) return;
    
    const toggle = document.getElementById('chat-human-toggle');
    const label = document.getElementById('chat-status-label');
    const newStatus = toggle.checked ? 'human' : 'bot';
    
    try {
        const res = await api(`/api/chats/${currentChatAccount}/${activeChatPhone}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (res.success) {
            if (allChats[activeChatPhone]) {
                allChats[activeChatPhone].status = newStatus;
            }
            if (newStatus === 'human') {
                label.textContent = "Agent Mode (Bot Paused)";
                label.style.color = "var(--primary)";
            } else {
                label.textContent = "Bot Active";
                label.style.color = "var(--text-muted)";
            }
        } else {
            toggle.checked = !toggle.checked; // revert UI
            alert('Failed to update status');
        }
    } catch(e) {
        toggle.checked = !toggle.checked; // revert UI
        alert('Error updating status');
    }
}

function handleChatKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatReply();
    }
}

async function sendChatReply() {
    const input = document.getElementById('chat-reply-input');
    const text = input.value.trim();
    
    if (!text || !currentChatAccount || !activeChatPhone) return;
    
    input.value = '';
    
    try {
        const res = await api('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({
                account: currentChatAccount,
                number: activeChatPhone,
                message: text
            })
        });
        
        if (res.success) {
            // Optimistically add to UI
            if (!allChats[activeChatPhone]) allChats[activeChatPhone] = { messages: [] };
            allChats[activeChatPhone].messages.push({
                sender: 'bot',
                text: text,
                type: 'text',
                timestamp: new Date().toISOString()
            });
            allChats[activeChatPhone].lastUpdate = Date.now();
            renderContactList();
            renderMessages(activeChatPhone);
        } else {
            alert('Failed to send message: ' + res.error);
            input.value = text; // Restore text
        }
    } catch(e) {
        alert('Error sending message');
        input.value = text;
    }
}
