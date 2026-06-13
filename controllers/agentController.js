const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

const agentsFile = path.join(path.dirname(config.storagePaths.accounts), 'agents.json');

const readAgents = () => {
    try {
        if (!fs.existsSync(agentsFile)) {
            fs.writeFileSync(agentsFile, JSON.stringify([]));
            return [];
        }
        return JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
    } catch (e) {
        logger.error({ error: e.message }, 'Failed to read agents file');
        return [];
    }
};

const writeAgents = (data) => {
    try {
        fs.writeFileSync(agentsFile, JSON.stringify(data, null, 2));
    } catch (e) {
        logger.error({ error: e.message }, 'Failed to write agents file');
    }
};

exports.getAgents = (req, res) => {
    const agents = readAgents();
    res.json({ success: true, agents });
};

exports.addAgent = (req, res) => {
    const { name, email, role } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const agents = readAgents();
    const newAgent = {
        id: 'agent_' + Date.now(),
        name,
        email: email || '',
        role: role || 'Agent',
        createdAt: new Date().toISOString()
    };
    
    agents.push(newAgent);
    writeAgents(agents);
    
    res.json({ success: true, agent: newAgent });
};

exports.deleteAgent = (req, res) => {
    const { id } = req.params;
    let agents = readAgents();
    agents = agents.filter(a => a.id !== id);
    writeAgents(agents);
    
    res.json({ success: true });
};
