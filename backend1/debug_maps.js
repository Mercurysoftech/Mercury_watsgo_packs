const { calculateDistance } = require('./services/googleMapsService');
require('dotenv').config();

async function debugMaps() {
    const origin = "First Floor, Collectorate, Madurai - 625020";
    const destination = "south street, Trichy";
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    console.log(`Testing with API Key: ${apiKey.substring(0, 10)}...`);
    const dist = await calculateDistance(origin, destination, apiKey);
    
    if (dist === null) {
        console.log("Distance calculation FAILED. Please check logs above.");
    } else {
        console.log(`Distance calculation SUCCESS: ${dist}km`);
    }
    process.exit(0);
}

debugMaps();
