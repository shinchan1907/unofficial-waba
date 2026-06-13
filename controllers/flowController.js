const fs = require('fs');
const config = require('../config/config');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');
const logService = require('../services/logService');

const readFlows = () => {
    try {
        let data = JSON.parse(fs.readFileSync(config.storagePaths.flows, 'utf8'));
        let needsSave = false;
        // Migrate old format to new format
        Object.keys(data).forEach(accId => {
            if (data[accId] && typeof data[accId] === 'object') {
                const keys = Object.keys(data[accId]);
                // Old format has node IDs as keys (1, 2, 3)
                const isOld = keys.some(k => !isNaN(parseInt(k)) && data[accId][k].class !== undefined);
                if (isOld) {
                    const oldFlow = data[accId];
                    data[accId] = {
                        'default_flow': {
                            id: 'default_flow',
                            name: 'Default Flow',
                            data: oldFlow,
                            isActive: true
                        }
                    };
                    needsSave = true;
                }
            }
        });
        if (needsSave) writeFlows(data);
        return data;
    } catch (e) {
        return {};
    }
};

const writeFlows = (data) => {
    fs.writeFileSync(config.storagePaths.flows, JSON.stringify(data, null, 2));
};

exports.getFlows = (req, res) => {
    const { accountId } = req.params;
    const flows = readFlows();
    res.json({ success: true, flows: flows[accountId] || {} });
};

exports.saveFlow = (req, res) => {
    const { accountId, flowId } = req.params;
    const { name, data, isActive } = req.body;
    
    if (!data) return res.status(400).json({ success: false, error: 'Flow data missing' });

    const flows = readFlows();
    if (!flows[accountId]) flows[accountId] = {};
    
    flows[accountId][flowId] = {
        id: flowId,
        name: name || 'Unnamed Flow',
        data: data,
        isActive: isActive !== undefined ? isActive : true
    };
    
    writeFlows(flows);
    res.json({ success: true });
};

exports.deleteFlow = (req, res) => {
    const { accountId, flowId } = req.params;
    const flows = readFlows();
    
    if (flows[accountId] && flows[accountId][flowId]) {
        delete flows[accountId][flowId];
        writeFlows(flows);
    }
    
    res.json({ success: true });
};

exports.getLatestWebhook = async (req, res) => {
    try {
        const { accountId } = req.params;
        const payloadFile = path.join(path.dirname(config.storagePaths.flows), `latest_webhook_${accountId}.json`);
        if (fs.existsSync(payloadFile)) {
            const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf8'));
            res.json({ success: true, payload });
        } else {
            res.json({ success: true, payload: null });
        }
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to get latest webhook');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

// Extracted internal runner
const runFlow = (accountId, flowDataObj, payload, isIncomingMessage, res = null) => {
    if (!flowDataObj || !flowDataObj.isActive) {
        if (res) res.status(404).json({ success: false, error: 'Flow not active or missing' });
        return;
    }

    const nodes = Object.values(flowDataObj.data);
    let triggerNode = null;
    
    if (isIncomingMessage) {
        triggerNode = nodes.find(n => n.name === 'incoming');
    } else {
        triggerNode = nodes.find(n => n.name === 'webhook');
    }
    
    if (!triggerNode) {
        if (res) res.status(200).json({ success: true, message: 'No matching trigger found in this flow' });
        return;
    }

    if (res) {
        res.json({ success: true, message: 'Flow execution started' });
    }
    
    logService.writeLog(accountId, 'FLOW_TRIGGERED', isIncomingMessage ? 'Incoming Message received' : 'Webhook received payload');

    // Extract basic data based on trigger configuration
    let context = {
        phone: '',
        name: 'there',
        payload: payload,
        accountId: accountId
    };

    if (isIncomingMessage) {
        context.phone = payload.sender;
        context.name = 'there'; // Can't easily get name from incoming without parsing vcards, fallback to 'there'
    } else {
        const phoneField = triggerNode.data.phoneField || 'phone';
        const nameField = triggerNode.data.nameField || 'name';
        context.phone = extractValue(payload, phoneField);
        context.name = extractValue(payload, nameField) || 'there';
    }
    
    if (!context.phone) {
        logger.warn({ accountId, payload }, 'Webhook triggered but phone field not found');
        return;
    }
    
    // Clean phone number
    context.phone = String(context.phone).replace(/[^0-9]/g, '');

    // Check if Human Agent has taken over this chat
    const chatController = require('./chatController');
    if (chatController.isBotPaused(accountId, context.phone)) {
        logService.writeLog(accountId, 'FLOW_SKIPPED', `Bot paused for ${context.phone} (Human Agent Mode)`);
        return;
    }

    // Start execution
    executeNextNodes(flowDataObj.data, triggerNode.outputs, context);
};

// Main webhook entry for a specific flow (e.g. from Make/n8n/Apps Script)
exports.executeWebhook = async (req, res) => {
    const { accountId, flowId } = req.params;
    const payload = req.body;
    
    // Save payload for debugging / UI visibility
    try {
        const payloadFile = path.join(path.dirname(config.storagePaths.flows), `latest_webhook_${accountId}.json`);
        fs.writeFileSync(payloadFile, JSON.stringify(payload, null, 2));
    } catch(e) {}
    
    const flows = readFlows();
    const accountFlows = flows[accountId] || {};
    
    // If flowId is provided, run that specific flow
    if (flowId && accountFlows[flowId]) {
        runFlow(accountId, accountFlows[flowId], payload, false, res);
        return;
    }
    
    // If no flowId provided (legacy support), try to find a default flow
    if (!flowId) {
        const defaultFlow = accountFlows['default_flow'] || Object.values(accountFlows)[0];
        if (defaultFlow) {
            runFlow(accountId, defaultFlow, payload, false, res);
            return;
        }
    }
    
    res.status(404).json({ success: false, error: 'No flow configured for this webhook' });
};

// Entry point for incoming WhatsApp messages
exports.executeIncoming = (accountId, payload) => {
    const flows = readFlows();
    const accountFlows = flows[accountId] || {};
    
    // Incoming messages could potentially trigger multiple flows (e.g. keyword routers).
    // For now, we execute all active flows that have an 'incoming' trigger.
    // In the future, we can add keyword checking logic here before executing.
    Object.values(accountFlows).forEach(flow => {
        if (flow.isActive) {
            runFlow(accountId, flow, payload, true);
        }
    });
};

// Helper to extract nested values (e.g. "user.phone")
function extractValue(obj, path) {
    if(!path) return null;
    return path.split('.').reduce((o, i) => (o ? o[i] : null), obj);
}

// Helper to template strings (e.g. "Hello {{name}}")
function templateString(str, context) {
    if (!str) return str;
    return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        return extractValue(context.payload, key) || context[key] || '';
    });
}

function executeNextNodes(flowData, outputs, context) {
    if (!outputs) return;
    
    // Iterate through all outputs (output_1, output_2, etc)
    Object.keys(outputs).forEach(outputKey => {
        const connections = outputs[outputKey].connections;
        if (connections && connections.length > 0) {
            connections.forEach(conn => {
                const targetNode = flowData[conn.node];
                if (targetNode) {
                    processNode(flowData, targetNode, outputKey, context);
                }
            });
        }
    });
}

function processNode(flowData, node, fromOutputKey, context) {
    try {
        switch (node.name) {
            case 'message':
                const text = templateString(node.data.message, context);
                let media = null;
                if (node.data.mediaUrl && node.data.mediaUrl.trim() !== '') {
                    const url = templateString(node.data.mediaUrl.trim(), context);
                    const ext = url.split('.').pop().toLowerCase();
                    const isVideo = ext.includes('mp4') || ext.includes('mov');
                    media = { type: isVideo ? 'video' : 'image', url: url };
                }
                
                queueService.addToQueue(context.accountId, context.phone, text, media);
                executeNextNodes(flowData, node.outputs, context);
                break;
                
            case 'timer':
                const delayHours = parseFloat(node.data.delayHours || 1);
                const delayMs = delayHours * 60 * 60 * 1000;
                logService.writeLog(context.accountId, 'FLOW_DELAY', `Waiting ${delayHours} hours for ${context.phone}`);
                
                // Clear any previous state flags before waiting, so we can check fresh replies/seen
                if (global._flowState && global._flowState[context.accountId] && global._flowState[context.accountId][context.phone]) {
                    global._flowState[context.accountId][context.phone].replied = false;
                    global._flowState[context.accountId][context.phone].seen = false;
                }
                
                setTimeout(() => {
                    executeNextNodes(flowData, node.outputs, context);
                }, delayMs);
                break;
                
            case 'ifelse':
                const condType = node.data.conditionType || 'payload';
                let isTrue = false;
                
                if (condType === 'payload') {
                    const field = node.data.conditionField;
                    const expectedVal = String(node.data.conditionValue || '').toLowerCase();
                    const actualVal = String(extractValue(context.payload, field) || '').toLowerCase();
                    isTrue = (actualVal === expectedVal);
                } else if (condType === 'replied') {
                    isTrue = global._flowState?.[context.accountId]?.[context.phone]?.replied === true;
                } else if (condType === 'seen') {
                    isTrue = global._flowState?.[context.accountId]?.[context.phone]?.seen === true;
                }
                
                if (isTrue) {
                    // True path is output_1
                    if (node.outputs && node.outputs.output_1) {
                        executeNextNodes(flowData, { output_1: node.outputs.output_1 }, context);
                    }
                } else {
                    // False path is output_2
                    if (node.outputs && node.outputs.output_2) {
                        executeNextNodes(flowData, { output_2: node.outputs.output_2 }, context);
                    }
                }
                break;
                
            case 'ai_agent':
                const apiKey = node.data.apiKey;
                const prompt = node.data.prompt || 'You are a helpful assistant.';
                const userMessage = extractValue(context.payload, 'text') || 'Hello';
                
                if (!apiKey) {
                    logger.warn('AI Agent node failed: No API Key provided');
                    executeNextNodes(flowData, node.outputs, context);
                    break;
                }
                
                logService.writeLog(context.accountId, 'FLOW_AI_PROCESSING', `Asking AI for ${context.phone}`);
                
                fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: prompt },
                            { role: 'user', content: userMessage }
                        ],
                        max_tokens: 150
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.choices && data.choices.length > 0) {
                        const reply = data.choices[0].message.content;
                        queueService.addToQueue(context.accountId, context.phone, reply, null);
                    }
                    executeNextNodes(flowData, node.outputs, context);
                })
                .catch(err => {
                    logger.error({ err: err.message }, 'AI Agent API Error');
                    executeNextNodes(flowData, node.outputs, context);
                });
                break;
                
            case 'end':
                // Do nothing, stops here
                break;
        }
    } catch (e) {
        logger.error({ error: e.message, node: node.name }, 'Error executing flow node');
    }
}
