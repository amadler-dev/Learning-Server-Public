/**
 * Server for Hadracha books
 * Run on Windows
 * Created By AAdler | 1.2025
 */

// imports
const express = require('express');
const cors = require('cors');
const path = require('path');
const util = require('util');
const https = require('https');
const os = require('os');
const fs = require('fs');
const WebSocket = require('ws');
const { Client } = require('ssh2');
const { exec } = require('child_process');


// connect to linux machine for the certificate
const conn = new Client();

// promise exec
const execPromise = util.promisify(exec);

// read JSON FILE
const data = JSON.parse(fs.readFileSync('./learning.json', 'utf8'));

// certificates 
// local path
const tempdir = os.tmpdir();
const sshDir = path.join(os.homedir(), '.ssh');
const localPrivateKey = path.join(sshDir, 'id_rsa');
let localCert = tempdir + '/cert.crt';
let localKey = tempdir + '/cert.key';

// remote path
const remotePath = data.pathToCertificate;
const remoteCert = remotePath.endsWith('/') ? remotePath + 'cert.crt' : remotePath + '/cert.crt';
const remoteKey = remotePath.endsWith('/') ? remotePath + 'cert.key' : remotePath + '/cert.key';


// create empty cert files in temp folder
function CreateLocalCertFiles() {
	try { 
		fs.writeFile(localCert, '', 'utf8', (err) => {
			if(err) {
				console.error('Error writing local certificate file:', err);
			} else {
				console.log('Local certificate file created successfully.');
			}
		});

		fs.writeFile(localKey, '', 'utf8', (err) => {
			if(err) {
				console.error('Error writing local key file:', err);
			} else {
				console.log('Local key file created successfully.');
			}
		});
	} catch (err) {
		console.error('Error creating local certificate files:', err);
	}
}


async function LocalPrivateKey() {
	try {
		await execPromise(`ssh -V`);
		console.log('SSH is installed on windows');
		
		if(!fs.existsSync(localPrivateKey)) {
			fs.mkdirSync(sshDir, { recursive: true });
			console.log('.ssh directory created successfully.');

			const sshKeygenCmd = `ssh-keygen -t rsa -b 2048 -f ${localPrivateKey} -N ""`;
			console.log('Generating SSH key... \nrun command: ' + sshKeygenCmd);
			await execPromise(sshKeygenCmd);

			return true;
		}
	} catch (err) {
		console.error('Error checking or creating local certificate files:', err);
		return false;
	}
}

// run first
async function GetCertFiles() {

	// if path to certificate is empty - use temp cert
	if(remotePath === '' || remotePath === null || remotePath === undefined) {
		console.log('Path to certificate on linux machine is not defined. using temp cert');

		localCert = __dirname + '/src/certificate/cert.crt';
		localKey = __dirname + '/src/certificate/cert.key';

		startServer();

	} else {

		try {
			CreateLocalCertFiles();

			await LocalPrivateKey();
			
			// get cert from linux
			conn.on('ready', () => {

				try {
					console.log('Connected to linux machine');
					conn.sftp((err, sftp) => {
						if(err) throw err;

						// download cert and key
						sftp.fastGet(remoteCert, localCert, (err) => {
							if(err) throw err;
							console.log('Certificate downloaded successfully.');

							sftp.fastGet(remoteKey, localKey, (err) => {
								if(err) throw err;
								console.log('Key downloaded successfully.');

								conn.end();
								startServer(); // run server function
							});
						});
					});
					
				} catch (err) {
					console.error('Error downloading files from linux machine:', err);
				}

			}).on('error', () => {

				console.log('learning server stop running. \nerror: connection to linux machine failed');

			}).connect({
				host: data.IPlocalVM,
				port: 22,
				username: 'Test',
				password: 'Test',
				// debug: (msg) => console.log('SSH DEBUG: ', msg), // for testing
				privateKey: fs.readFileSync(localPrivateKey),
				keepaliveInterval: 20000, // 20 seconds
				keepaliveCountMax: 3, // 3 keepalive packets
			});
		} catch (err) {
			console.error('Error creating local certificate files:', err);
		}
	}
}


function writeToLogFile(message) {
	const logPath = './log-learning.json'; // log file path

	let jsonLog = JSON.parse(fs.readFileSync(logPath));
	let currentTime = (new Date()).toISOString();

	jsonLog[currentTime] = message;
	fs.writeFileSync(logPath, JSON.stringify(jsonLog, null, 2));
}


function reduceLogFile() {
	const logPath = './log-learning.json'; // log file path
	let jsonLog = JSON.parse(fs.readFileSync(logPath));

	const N = 100; // number of entries to remove from log file
	const keys = Object.keys(jsonLog);

	// if file bigger than 10M - remove first N entries
	fs.stat(logPath, (err, stats) => {
		if(err) {
			console.error(err);
		} else {
			console.log('log-learning size is: ' + stats.size + ' bytes'); // log
			if(stats.size > 10000000) {
				for(let i = 0; i < N && i < keys.length; i++) {
					delete jsonLog[keys[i]];
				}
				fs.writeFileSync(logPath, JSON.stringify(jsonLog, null, 2));
				console.log(`First ${N} entries of log-learning has been deleted`); // log
			}
		}
	});
}


async function pathExists(path) {
	try {
		const stat = fs.statSync(path);
		if(stat.isDirectory() || stat.isFile()) {
			console.log(`Path exists: ${path}`);
			return true;
		} else {
			console.log(`Path does not exist: ${path}`);
			return false;
		}
	} catch (err) {
		if(err.code === 'ENOENT') {
			console.log(`Path does not exist: ${path}`);
		} else {
			console.error(`Error checking path: ${path}`, err);
		}
		return false;
	}
}


// main function
async function startServer() {

	try {
		const options = {
			cert: fs.readFileSync(localCert, 'utf-8'),
			key: fs.readFileSync(localKey, 'utf-8'),
		};

		// create server
		const app = express();
		app.use(cors());

		const server = https.createServer(options, app);
		const wss = new WebSocket.Server({server});

		console.log("Hadracha Server Started");
		process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';


		try {
			// get the rest of the data from the json object
			// and lower case for keys on dictionary, formation and folders
			const booksPath = data.booksPath.endsWith('/') ? data.booksPath : data.booksPath + '/';
			const pagePath = data.pagePath.endsWith('/') ? data.pagePath : data.pagePath + '/';

			// check if paths exist
			// if not send to ENOENT.html
			if(!await pathExists(booksPath) || !await pathExists(pagePath)) {
				console.error("Learning Server Stopped: \nerror: booksPath or pagePath not found");
				app.get('*', (req, res) => {
					app.use(express.static(__dirname));
					res.status(500).sendFile(__dirname + '/src/ENOENT.html');
				});
			}

			// continue if paths exist
			else {

				const folders = (fs.readdirSync(booksPath)).map(name => name.toLowerCase());
				let formation = data.formation.toLowerCase();
				const dictionary = Object.fromEntries(
					Object.entries(data.dictionary).map(([key, value]) => [key.toLowerCase(), value])
				);

				// log socket
				wss.on('connection', function connection(ws) {
					ws.on('close', () => {
						writeToLogFile('page closed');
					});
				});

				// create dictionary for the local books
				let books = {};
				folders.forEach(book => {
					if(book in dictionary) {
						books[book] = dictionary[book];
					}
				});

				// logs
				console.log("Books available for hadracha: "); 
				console.log(books);
				
				// router
				app.get('/', (req, res) => {
					if (formation && books.hasOwnProperty(formation)) {
						res.redirect('/' + formation + '/');
					} else {
						res.redirect('/homepage');
					}
				});

				// page to choose which formation 
				app.get('/homepage', (req, res) => {
					app.use(express.static(pagePath));
					res.sendFile(pagePath);

					// log file 
					writeToLogFile('homepage loaded');

					// reduce log file size if needed
					reduceLogFile();
				});
					
				// Names of folders for the main page
				app.get('/folders', (req, res) => {
					if(folders) {
						res.send(books);
					}
				});

				// Every book
				for (const book of folders) {
					app.get('/' + book, (req, res) => {

						app.use(express.static(booksPath)); // fix for MIME TYPE
						res.sendFile(book + '/index.html', { root: path.join(booksPath)}, (err) => {
							if(err) {
								console.error(`Error sending file for book ${book}:`, err);
								res.status(404).sendFile(__dirname + '/src/404.html');
							}
						});

						// log file
						try {
							writeToLogFile(`${book} formation loaded`);
						} catch (err) {
							console.error('Error writing to log file:', err);
						}					
					});
				}
			}
		}

		catch (err) {
			console.error("Learning Server Stopped: \nerror: json configuration not opened\n", err);
		}

		// run server
		server.listen(3000);

	} catch (err) {
		console.error("Learning Server Stopped: \nerror: certificate files not found in windows\n", err);
	}
}

// run function
GetCertFiles();