const http = require('http');

function makeRequest(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: headers
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function test() {
    try {
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('Missing ADMIN_PASSWORD environment variable. Set ADMIN_PASSWORD before running this test.');
            process.exit(1);
        }

        console.log('1. Logging in as admin...');
        const loginRes = await makeRequest('http://localhost:6060/api/auth/login', 'POST', {
            'Content-Type': 'application/json'
        }, {
            username: adminUsername,
            password: adminPassword
        });

        console.log('Login Status:', loginRes.statusCode);
        console.log('Login Body:', loginRes.body);

        // Get cookie
        const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : '';
        console.log('Cookie:', cookie);

        if (!cookie) {
            console.error('Failed to get session cookie');
            process.exit(1);
        }

        console.log('\n2. Creating a notification...');
        const createRes = await makeRequest('http://localhost:6060/api/notifications', 'POST', {
            'Content-Type': 'application/json',
            'Cookie': cookie
        }, {
            message: 'Test notification delete',
            targetType: 'all'
        });

        console.log('Create Status:', createRes.statusCode);
        console.log('Create Body:', createRes.body);

        const notif = JSON.parse(createRes.body);
        const notifId = notif.notification ? notif.notification._id : null;
        
        console.log('Created Notification ID:', notifId);
        if (!notifId) {
            console.error('Failed to get notification ID');
            process.exit(1);
        }

        console.log('\n3. Deleting the notification...');
        const deleteRes = await makeRequest(`http://localhost:6060/api/notifications/${notifId}`, 'DELETE', {
            'Cookie': cookie
        });

        console.log('Delete Status:', deleteRes.statusCode);
        console.log('Delete Body:', deleteRes.body);

    } catch (e) {
        console.error('Error during testing:', e);
    }
}

test();
