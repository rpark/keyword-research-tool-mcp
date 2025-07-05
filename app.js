// Step 2: Generate keywords
async function generateKeywords(url, websiteData, businessType, apiKey) {
    const title = websiteData.metadata?.title || 'N/A';
    const description = websiteData.metadata?.description || 'N/A';
    const rawContent = websiteData.markdown || '';
    
    // Clean and filter content to focus on business-relevant text
    const cleanContent = cleanWebsiteContent(rawContent, businessType);
    // Limit content to 500 characters to avoid token limits
    const content = cleanContent.substring(0, 500);

    // Shorter, more focused prompt to avoid token limits
    const prompt = `Analyze this ${businessType} website and generate 30 diverse seed keywords.

Website: ${url}
Business Type: ${businessType}
Title: ${title}
Description: ${description}
Content: ${content}

Generate 30 diverse keywords covering:
- Awareness stage: "what is", "why", industry terms
- Research stage: "best", "review", "comparison" 
- Decision stage: "buy", "hire", "pricing"

Include both short (1-2 words) and long-tail (3+ words) keywords.
Avoid technical terms like "json", "api", "code".

Return ONLY a JSON array of strings:`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
                { role: 'system', content: `You are an SEO expert specializing in ${businessType} businesses. Generate practical, searchable keywords.` },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Perplexity API Error:', response.status, errorText);
        throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content_text = data.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    content_text = content_text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    let keywords = [];
    try {
        keywords = JSON.parse(content_text);
    } catch (e) {
        console.error('Failed to parse JSON, trying text parsing:', e);
        // Parse from text format
        const lines = content_text.split('\n');
        keywords = lines
            .map(line => line.replace(/^[\d\-\*\.\s\[\]"'`]+/, '').replace(/["'\]\[`]/g, '').trim())
            .filter(kw => kw.length > 3 && kw.length < 100 && !kw.toLowerCase().includes('json'))
            .slice(0, 30);
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
        throw new Error('Failed to generate keywords from website content.');
    }

    // Filter out technical terms and irrelevant keywords
    const filteredKeywords = filterTechnicalKeywords(keywords);

    return filteredKeywords.slice(0, 30);
} 