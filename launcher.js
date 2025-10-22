const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');

const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore'
});

child.unref();