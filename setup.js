const express = require('express');
const FHIR = require('fhirclient');
const { smartAppConfig } = require('./setup');

const app = express();
const port = 3000;

app.use(express.static('public'));

// Log the FHIR object to ensure it's correctly imported
console.log(FHIR);

app.get('/launch', (req, res) => {
    FHIR.oauth2.authorize({
        client_id: '16c7f984-0847-4293-8900-bde14705d596',
        scope: 'launch/patient openid fhirUser',
        redirect_uri: 'http://localhost:3000/app'
    }).catch(error => {
        console.error('Authorization error:', error);
        res.status(500).send('Authorization failed');
    });
});

app.get('/app', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, () => {
    console.log(`MedBlocks Patient App listening at http://localhost:${port}`);
});