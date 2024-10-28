FHIR.oauth2.ready().then(function(client) {
    client.patient.read().then(function(patient) {
        const patientInfo = document.getElementById('patient-info');
        patientInfo.innerHTML = `
            <p>Name: ${patient.name[0].given.join(' ')} ${patient.name[0].family}</p>
            <p>Gender: ${patient.gender}</p>
            <p>Date of Birth: ${patient.birthDate}</p>
            <p>ID: ${patient.id}</p>
        `;
    });

    client.request("MedicationRequest?patient=" + client.patient.id)
        .then(function(medications) {
            const medicationsList = document.getElementById('medications');
            medications.entry.forEach(function(med) {
                const li = document.createElement('li');
                li.textContent = med.resource.medicationCodeableConcept.text;
                medicationsList.appendChild(li);
            });
        });

    client.request("DiagnosticReport?patient=" + client.patient.id + "&category=LAB")
        .then(function(labReports) {
            const labReportsList = document.getElementById('lab-reports');
            labReports.entry.forEach(function(report) {
                const li = document.createElement('li');
                li.textContent = report.resource.code.text;
                labReportsList.appendChild(li);
            });
        });

    client.request("Observation?patient=" + client.patient.id + "&category=vital-signs")
        .then(function(vitalSigns) {
            const vitalSignsList = document.getElementById('vital-signs');
            vitalSigns.entry.forEach(function(sign) {
                const li = document.createElement('li');
                li.textContent = `${sign.resource.code.text}: ${sign.resource.valueQuantity.value} ${sign.resource.valueQuantity.unit}`;
                vitalSignsList.appendChild(li);
            });
        });
});