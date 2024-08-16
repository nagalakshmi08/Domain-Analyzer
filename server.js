const express = require('express');
const { analyzeBacklinks } = require('./backlinks');
const { fetchDomainCategories } = require('./categories');
const { fetchOpenGraphData } = require('./openGraph');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

let clients = [];

// Function to take screenshot using Python script
const takeScreenshot = (domain) => {
    // Ensure the URL includes the protocol
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const screenshotPath = path.join(__dirname, `screenshot_${domain}.png`);

    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['take_screenshot.py', url, screenshotPath]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(`Screenshot path: ${data.toString().trim()}`);
            resolve(screenshotPath);
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error taking screenshot: ${data.toString()}`);
            reject(data.toString());
        });
    });
};

// Function to fetch social media data using Python script
const fetchSocialMediaData = (domain) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['social_media_scraper.py', domain]);

        pythonProcess.stdout.on('data', (data) => {
            try {
                const socialMediaData = JSON.parse(data);
                resolve(socialMediaData);
            } catch (error) {
                console.error('Error parsing social media data:', error);
                reject(error);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error fetching social media data: ${data}`);
            reject(data.toString());
        });
    });
};

const callPythonScript = (domain) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['fetch_website_content.py', domain]);

        pythonProcess.stdout.on('data', (data) => {
            console.log(data.toString());
            resolve();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Error calling Python script: ${data.toString()}`);
            reject(data.toString());
        });
    });
};

// Function to send events to clients
const sendEventToClients = (message) => {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify(message)}\n\n`));
};

// SSE endpoint
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
    });
});

// API endpoint to analyze domain
app.post('/api/analyzeDomain', async (req, res) => {
    const domain = req.body.domain;

    try {
        sendEventToClients({ status: 'Analyzing...' });

        const pdfFileName = `${domain}_report.pdf`;
        const pdfFilePath = path.join(__dirname, pdfFileName);
        const pdfDoc = new PDFDocument();
        pdfDoc.pipe(fs.createWriteStream(pdfFilePath));

        // Include backlinks data in the PDF
        pdfDoc.text('Backlinks Data:');
        try {
            const backlinksData = await analyzeBacklinks(domain);
            pdfDoc.text(JSON.stringify(backlinksData, null, 2));
        } catch (error) {
            pdfDoc.text('The website\'s JSON format for backlinks data is not applicable.');
        }
        pdfDoc.text('\n');

        // Include social media data in the PDF
        pdfDoc.text('Social Media Data:');
        try {
            const socialMediaData = await fetchSocialMediaData(domain);
            pdfDoc.text(JSON.stringify(socialMediaData, null, 2));
        } catch (error) {
            pdfDoc.text('The website\'s JSON format for social media data is not applicable.');
        }
        pdfDoc.text('\n');

        // Include domain categories data in the PDF
        pdfDoc.text('Domain Categories Data:');
        try {
            const categoriesData = await fetchDomainCategories(domain);
            pdfDoc.text(JSON.stringify(categoriesData, null, 2));
        } catch (error) {
            pdfDoc.text('The website\'s JSON format for domain categories data is not applicable.');
        }
        pdfDoc.text('\n');
        pdfDoc.addPage();

        // Add generated screenshot to the PDF
        pdfDoc.text('Screenshot:');
        try {
            const screenshotPath = await takeScreenshot(domain);
            pdfDoc.image(screenshotPath, { width: pdfDoc.page.width - 100 });
        } catch (error) {
            pdfDoc.text('The screenshot for this website is not available.');
        }
        pdfDoc.text('\n');
        pdfDoc.addPage();

        // Include Open Graph data in the PDF
        pdfDoc.text('Open Graph Data:');
        try {
            const openGraphData = await fetchOpenGraphData(domain);
            pdfDoc.text(`Title: ${openGraphData.title || 'N/A'}`);
            pdfDoc.text(`Image URL: ${openGraphData.image || 'N/A'}`);
            if (openGraphData.imagePath) {
                pdfDoc.text('Open Graph Image:');
                pdfDoc.image(openGraphData.imagePath, { width: pdfDoc.page.width - 100 });
            } else {
                pdfDoc.text('No OG image found');
            }
        } catch (error) {
            pdfDoc.text('The website\'s JSON format for Open Graph data is not applicable.');
        }
        pdfDoc.text('\n');

        pdfDoc.end();

        sendEventToClients({ status: 'Analyzed' });

        res.json({ message: 'Report generated successfully.', pdfFileName });
    } catch (error) {
        console.error('Error generating report:', error);
        sendEventToClients({ status: 'Error' });
        res.status(500).json({ error: 'Error generating report.' });
    }
});

// Listen for requests
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
