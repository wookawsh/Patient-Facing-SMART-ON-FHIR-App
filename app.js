const express = require('express');
const smart = require('fhirclient/lib/entry/node');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
//const { smartAppConfig } = require('./setup');

const app = express();
const port = 3001;

// Add file-based session storage
app.use(session({
    store: new FileStore({
        path: './sessions',    // Sessions will be stored in a 'sessions' folder
        ttl: 3600,            // Time to live - 1 hour (matches typical FHIR token lifetime)
        retries: 0
    }),
    secret: 'your-random-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Root route to serve the landing page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Launch endpoint for SMART on FHIR authentication
app.get('/launch', (req, res) => {
    smart(req, res).authorize({
        client_id: '16c7f984-0847-4293-8900-bde14705d596',
        scope: 'launch/patient openid fhirUser offline_access',
        redirect_uri: 'http://localhost:3001/app',
        iss: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
        auth_url: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
        token_url: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token'
    });
});

// Callback endpoint after successful authentication
app.get('/app', async (req, res) => {
    try {
        const client = await smart(req, res).ready();
        const patient = await client.patient.read();

        // Calculate date 1 month ago
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const formattedDate = oneMonthAgo.toISOString().split('T')[0];

        // Fetch resources with date filter for vitals
        const vitalsQuery = `Observation?patient=${patient.id}&category=vital-signs&date=gt${formattedDate}&_sort=-date&_count=50`;
        const [medications, labs, vitals] = await Promise.all([
            client.request(`MedicationRequest?patient=${patient.id}`),
            client.request(`Observation?patient=${patient.id}&category=laboratory`),
            client.request(vitalsQuery)
        ]);

        res.send(`
            <html>
                <head>
                    <title>Patient Portal</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px; 
                            line-height: 1.6;
                        }
                        .header {
                            background-color: #f8f9fa;
                            padding: 20px;
                            border-radius: 8px;
                            margin-bottom: 20px;
                        }
                        .section {
                            background: white;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        }
                        button {
                            padding: 10px 15px;
                            background-color: #007bff;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        }
                        button:hover {
                            background-color: #0056b3;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Welcome, ${patient.name?.[0]?.given?.join(' ')} ${patient.name?.[0]?.family}</h1>
                        <p>
                            <strong>Date of Birth:</strong> ${new Date(patient.birthDate).toLocaleDateString()}<br>
                            <strong>Gender:</strong> ${patient.gender}<br>
                            <strong>MRN:</strong> ${patient.id}
                        </p>
                        <button onclick="window.location.href='/launch'">Connect to Epic</button>
                    </div>

                    <div class="section">
                        <h2>Current Medications</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Medication</th>
                                    <th>Dosage</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${medications.entry?.map(entry => `
                                    <tr>
                                        <td>${entry.resource.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown'}</td>
                                        <td>${entry.resource.dosageInstruction?.[0]?.text || 'Not specified'}</td>
                                        <td>${entry.resource.status || 'Unknown'}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="3">No medications found</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Recent Lab Results</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Test</th>
                                    <th>Result</th>
                                    <th>Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${labs.entry?.map(entry => `
                                    <tr>
                                        <td>${new Date(entry.resource.effectiveDateTime).toLocaleDateString()}</td>
                                        <td>${entry.resource.code?.coding?.[0]?.display || 'Unknown Test'}</td>
                                        <td>${entry.resource.valueQuantity?.value || 'N/A'}</td>
                                        <td>${entry.resource.valueQuantity?.unit || ''}</td>
                                    </tr>
                                `).join('') || '<tr><td colspan="4">No lab results found</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Recent Vital Signs (Last 30 Days)</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Vital Sign</th>
                                    <th>Value</th>
                                    <th>Unit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${vitals.entry?.map(entry => {
                                    const vitalDate = new Date(entry.resource.effectiveDateTime);
                                    return `
                                        <tr>
                                            <td>${vitalDate.toLocaleDateString()}</td>
                                            <td>${entry.resource.code?.coding?.[0]?.display || 'Unknown'}</td>
                                            <td>${entry.resource.valueQuantity?.value || 'N/A'}</td>
                                            <td>${entry.resource.valueQuantity?.unit || ''}</td>
                                        </tr>
                                    `;
                                }).join('') || '<tr><td colspan="4">No vital signs in the last 30 days</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`Error loading patient data: ${error.message}`);
    }
});

// Token refresh function (unchanged)
async function refreshTokenIfNeeded(client) {
    // ... existing refresh token code ...
}

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
