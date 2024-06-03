// Import Axios
const axios = require('axios');

// Your existing code here
const form = document.getElementById('domainForm');

// Event listener and axios usage
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const domain = document.getElementById('domainInput').value;
    const apiUrl = '/api/analyzeDomain';

    try {
        const response = await axios.post(apiUrl, { domain });
        const data = response.data;
        const outputElement = document.getElementById('output');

        if (data.message === 'Report generated successfully.') { // Check the message property
            outputElement.innerHTML = `
                <p>Domain analyzed successfully.</p>
                <a href="/pdfs/${data.pdfFileName}" download>Download PDF</a>
            `;
        } else {
            outputElement.innerText = JSON.stringify(data, null, 2);
        }
    } catch (error) {
        console.error('Error analyzing domain:', error);
    }
});
