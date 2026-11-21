const axios = require('axios');

/**
 * Calculate distance between two addresses using Google Distance Matrix API
 */
async function calculateDistance(origin, destination, apiKey) {
    if (!apiKey) {
        console.warn('Google Maps API Key missing for distance calculation');
        return null;
    }
    if (!origin || !destination) {
        console.warn('Origin or Destination missing for distance calculation');
        return null;
    }

    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${apiKey}`;
        const res = await axios.get(url);
        
        console.log(`[Google Maps API] Response Status: ${res.data.status}`);

        if (res.data.status === 'OK' && res.data.rows[0].elements[0].status === 'OK') {
            const distanceValue = res.data.rows[0].elements[0].distance.value / 1000; // meters to km
            const roundedDist = Number(distanceValue.toFixed(2));
            console.log(`[Google Maps API] Success: ${roundedDist}km`);
            return roundedDist;
        } else {
            console.error('[Google Maps API] Failed:', {
                api_status: res.data.status,
                element_status: res.data.rows[0]?.elements[0]?.status,
                error_message: res.data.error_message
            });
            return null;
        }
    } catch (err) {
        console.error('Google Maps API Error:', err.message);
        return null;
    }
}

/**
 * Calculate delivery charge based on distance and settings
 */
function calculateDeliveryCharge(distanceKm, settings) {
    if (distanceKm === null || distanceKm === undefined) return 0;
    
    const freeKm = Number(settings.delivery_free_km || 3);
    const pricePerKm = Number(settings.delivery_price_per_km || 0);

    const extraCharge = Math.max(0, (distanceKm - freeKm) * pricePerKm);
    return Number(extraCharge.toFixed(2));
}

module.exports = {
    calculateDistance,
    calculateDeliveryCharge
};
