const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');

const agentsFile = path.join(path.dirname(config.storagePaths.accounts), 'agents.json');
const JWT_SECRET = config.apiKey || 'fallback-secret-key'; // Use the main api key as salt

const readAgents = () => {
    try {
        if (!fs.existsSync(agentsFile)) {
            // Seed a default admin if file doesn't exist
            const defaultAdmin = {
                id: 'admin_0',
                name: 'System Admin',
                username: 'admin',
                password: bcrypt.hashSync('admin123', 10),
                role: 'Admin',
                createdAt: new Date().toISOString()
            };
            fs.writeFileSync(agentsFile, JSON.stringify([defaultAdmin], null, 2));
            return [defaultAdmin];
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
    // Only return non-sensitive info
    const agents = readAgents().map(a => ({
        id: a.id,
        name: a.name,
        username: a.username,
        role: a.role,
        createdAt: a.createdAt
    }));
    res.json({ success: true, agents });
};

exports.addAgent = (req, res) => {
    const { name, username, password, role } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ success: false, error: 'Name, username, and password are required' });
    }

    const agents = readAgents();
    
    if (agents.find(a => a.username === username)) {
        return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const newAgent = {
        id: 'agent_' + Date.now(),
        name,
        username,
        password: bcrypt.hashSync(password, 10),
        role: role || 'Agent',
        createdAt: new Date().toISOString()
    };
    
    agents.push(newAgent);
    writeAgents(agents);
    
    // Return without password
    const returnedAgent = { ...newAgent };
    delete returnedAgent.password;
    
    res.json({ success: true, agent: returnedAgent });
};

exports.deleteAgent = (req, res) => {
    const { id } = req.params;
    let agents = readAgents();
    agents = agents.filter(a => a.id !== id);
    writeAgents(agents);
    
    res.json({ success: true });
};

exports.login = (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password required' });
    }
    
    const agents = readAgents();
    const agent = agents.find(a => a.username === username);
    
    if (!agent || !bcrypt.compareSync(password, agent.password)) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
        { id: agent.id, username: agent.username, role: agent.role, name: agent.name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    
    res.json({
        success: true,
        token,
        agent: {
            id: agent.id,
            name: agent.name,
            username: agent.username,
            role: agent.role
        }
    });
};
