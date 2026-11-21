const axios = require('axios');
require('dotenv').config();

/**
 * Send WhatsApp message using WhatsApp Business API
 * @param {string} phone - Phone number
 * @param {string} message - Content
 * @param {string} [apiKey] - Dynamic API Key
 * @param {string} [phoneId] - Dynamic Phone ID
 */
async function sendWhatsApp(phone, message, apiKey, phoneId) {
    try {
        const currentApiKey = apiKey || process.env.WHATSAPP_API_KEY;
        const currentPhoneId = phoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;

        if (!currentApiKey || !currentPhoneId) {
            console.warn('⚠️  WhatsApp API not configured. Missing Key or Phone ID.');
            return { success: false, error: 'WhatsApp service not configured' };
        }

        let formattedPhone = phone.replace(/\D/g, '');
        
        // Remove leading 0 if present (common in manually entered Indian numbers)
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }

        // Add India country code if it's a 10-digit number
        if (formattedPhone.length === 10) {
            formattedPhone = '91' + formattedPhone;
        }


        console.log(`💬 Attempting WhatsApp to ${formattedPhone}...`);

        let payload = {
            messaging_product: 'whatsapp',
            to: formattedPhone
        };

        let isTemplate = false;

        // Auto-detect if message is a JSON string describing a Meta WhatsApp template
        if (typeof message === 'string' && message.trim().startsWith('{') && message.includes('template')) {
            try {
                const parsedMsg = JSON.parse(message);
                if (parsedMsg.type === 'template') {
                    payload.type = 'template';
                    payload.template = parsedMsg.template;
                    isTemplate = true;
                }
            } catch (e) {
                // Not valid JSON, fallback to text
            }
        }

        // Fallback to standard text message if not a template
        if (!isTemplate) {
            payload.type = 'text';
            payload.text = { body: message };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${currentPhoneId}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${currentApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log(`✅ WhatsApp sent successfully to ${formattedPhone}. ID: ${response.data.messages[0].id}`);
        return { success: true, messageId: response.data.messages[0].id };
    } catch (error) {
        const errorData = error.response?.data?.error;
        console.error('❌ WhatsApp Cloud API Error:', {
            status: error.response?.status,
            message: errorData?.message,
            code: errorData?.code,
            details: errorData?.error_data?.details
        });

        return {
            success: false,
            error: errorData?.message || error.message,
            code: errorData?.code
        };
    }
}

module.exports = {
    sendWhatsApp
};
