export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.REACT_APP_ANTHROPIC_API_KEY;
  
  // API Key 확인용 (앞 10자리만)
  const keyPreview = apiKey ? apiKey.substring(0, 15) + '...' : 'NOT FOUND';
  
  try {
    let body = req.body;
    if (typeof body === 'string') {
      body = JSON.parse(body);
    }

    const payload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: body.messages,
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data, 
        keyPreview: keyPreview 
      });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message, keyPreview: keyPreview });
  }
}