const axios = require('axios');

exports.handler = async function (event, context, callback) {
  console.log('event', JSON.stringify(event, null, 2));

  // Handle OPTIONS requests for CORS preflight
  if (event.requestContext.http.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
      body: ''
    };
  }

  // Extract the target URL from the path
  const targetUrl = event.requestContext.http.path.slice(1);

  // Convert headers to lowercase for consistency
  const headers = Object.entries(event.headers).reduce((acc, [key, value]) => {
    // Filter out host and other AWS-specific headers
    if (!['host', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-port'].includes(key.toLowerCase())) {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});

  const axiosConfig = {
    method: event.requestContext.http.method,
    url: targetUrl + (event.rawQueryString ? `?${event.rawQueryString}` : ''),
    headers,
    responseType: 'arraybuffer',
    maxRedirects: 5,
    validateStatus: function (status) {
      return status >= 200 && status < 600;
    }
  };

  console.log('Proxying request to:', axiosConfig.url);

  try {
    const response = await axios(axiosConfig);

    const contentType = response.headers['content-type'];

    // Check if the response is an image or binary data
    const isBinary = contentType && (
      contentType.startsWith('image/') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/pdf')
    );

    // Prepare the response
    const responseBody = isBinary
      ? response.data.toString('base64')
      : response.data.toString();

    // Copy relevant response headers
    const responseHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': '*',
      'Content-Type': contentType || 'application/json',
      ...Object.entries(response.headers)
        .filter(([key]) => !['set-cookie', 'transfer-encoding'].includes(key.toLowerCase()))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    };

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
      isBase64Encoded: isBinary
    };
  }
  catch (error) {
    console.log('Error:', error);

    return {
      statusCode: error.response?.status || 500,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: error.message,
        details: error.response?.data?.toString()
      })
    };
  }
};
