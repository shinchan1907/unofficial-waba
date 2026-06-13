const fs = require('fs');
const config = require('../config/config');
const queueService = require('../services/queueService');
const logger = require('../utils/logger');
const logService = require('../services/logService');

const readFlows = () => {
    try {
        return JSON.parse(fs.readFileSync(config.storagePaths.flows, 'utf8'));
    } catch (e) {
        return {};
    }
};

const writeFlows = (data) => {
    fs.writeFileSync(config.storagePaths.flows, JSON.stringify(data, null, 2));
};

exports.getFlow = (req, res) => {
    const { accountId } = req.params;
    const flows = readFlows();
    res.json({ success: true, flow: flows[accountId] || {} });
};

exports.saveFlow = (req, res) => {
    const { accountId } = req.params;
    const { flow } = req.body;
    
    if (!flow) return res.status(400).json({ success: false, error: 'Flow data missing' });

    const flows = readFlows();
    flows[accountId] = flow;
    writeFlows(flows);
    
    res.json({ success: true });
};

// Flow Execution Engine
exports.executeWebhook = async (req, res) => {
    const { accountId } = req.params;
    const payload = req.body;
    
    const flows = readFlows();
    const flowData = flows[accountId];
    
    if (!flowData || Object.keys(flowData).length === 0) {
        return res.status(404).json({ success: false, error: 'No flow configured for this account' });
    }

    // Determine trigger node based on event type
    let triggerNode = null;
    const isIncomingMessage = payload.event === 'message_received';
    
    if (isIncomingMessage) {
        triggerNode = nodes.find(n => n.name === 'incoming');
    } else {
        triggerNode = nodes.find(n => n.name === 'webhook');
    }
    
    if (!triggerNode) {
        // If it's just a background webhook hitting a flow that doesn't have the right trigger, ignore silently
        return res.status(200).json({ success: true, message: 'No matching trigger found' });
    }

    // Acknowledge webhook immediately
    res.json({ success: true, message: 'Flow execution started' });
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

    // Start execution
    executeNextNodes(flowData, triggerNode.outputs, context);
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
