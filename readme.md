## Start

- ip '168.192.1.1' (Windows) | or your local IP
- PORT 3000
- Change the data inside 'learning.json' with full paths.
- Create local RSA private and public Key in Certificate Folder with the names "cert.crt" and "key.pem". You will also need csr file.
- TO START: Run learning.exe from the Terminal.
- Created By AAdler on 1.25 

### Run On Your Local Environment

- change the IP '168.192.1.1' in the index file inside 'src' to your local IP. Do this also to every root index file of all the books.
- Open your browser and run https://you-local-ip:3000/ and confirm the certificate.
- If you want to debug without exe file - run node server.js or run 'npm i -g nodemon' and after that 'nodemon server.js'.

### Server for Hadracha in Every Internal System

This project run on 3 different paths:
- EXE file
- Landing page in src and it's resources.
- Books folder for the learning data.

### Compile

If you want to compile the server into an exe file:
- Run npm i -g pkg.
- On the root folder run folder run "pkg . --output learning.exe -t node*-win-x64".