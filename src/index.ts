#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';

import {
  cleanWebsiteContent,
  filterTechnicalKeywords,
  calculateCommercialScore,
  extractDomain,
  calculateDifficulty,
  estimateDifficultyFromMetrics,
  createClusters,
  generateReport,
  KeywordData,
  type AnalysisReport
} from './utils.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'analyze-website',
    description: 'Complete SEO keyword analysis for a website. Scrapes content, generates keywords with AI, gets search data, clusters keywords, and creates a comprehensive report.',
    inputSchema: {
      type: 'object',
      properties: {
        websiteUrl: {
          type: 'string',
          description: 'The website URL to analyze (e.g., https://example.com)'
        },
        businessType: {
          type: 'string',
          enum: ['E-commerce', 'SaaS', 'Service Business', 'Blog/Content', 'Education'],
          description: 'The type of business for targeted keyword generation'
        },
        firecrawlApiKey: {
          type: 'string',
          description: 'Firecrawl API key (optional - will use FIRECRAWL_API_KEY env var if not provided)'
        },
        perplexityApiKey: {
          type: 'string',
          description: 'Perplexity API key (optional - will use PERPLEXITY_API_KEY env var if not provided)'
        },
        dataforSeoUsername: {
          type: 'string',
          description: 'DataForSEO username (optional - will use DATAFORSEO_USERNAME env var if not provided)'
        },
        dataforSeoPassword: {
          type: 'string',
          description: 'DataForSEO password (optional - will use DATAFORSEO_PASSWORD env var if not provided)'
        }
      },
      required: ['websiteUrl', 'businessType']
    }
  }
];

// Helper function to get API credentials
function getApiCredentials(args: any) {
  const firecrawlApiKey = args.firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
  const perplexityApiKey = args.perplexityApiKey || process.env.PERPLEXITY_API_KEY;
  const dataforSeoUsername = args.dataforSeoUsername || process.env.DATAFORSEO_USERNAME;
  const dataforSeoPassword = args.dataforSeoPassword || process.env.DATAFORSEO_PASSWORD;

  return {
    firecrawlApiKey,
    perplexityApiKey,
    dataforSeoUsername,
    dataforSeoPassword
  };
}

// API Functions
async function scrapeWebsite(url: string, apiKey: string) {
  if (!apiKey) {
    throw new Error('Firecrawl API key is required. Set FIRECRAWL_API_KEY environment variable or pass firecrawlApiKey parameter.');
  }

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: url,
      formats: ['markdown'],
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p'],
      excludeTags: ['script', 'style', 'nav', 'footer', 'code', 'pre'],
      onlyMainContent: true,
      waitFor: 2000
    })
  });

  if (!response.ok) {
    throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error('Failed to scrape website. Please check the URL and try again.');
  }

  return data.data;
}

async function generateKeywords(url: string, websiteData: any, businessType: string, apiKey: string): Promise<string[]> {
  if (!apiKey) {
    throw new Error('Perplexity API key is required. Set PERPLEXITY_API_KEY environment variable or pass perplexityApiKey parameter.');
  }

  const title = websiteData.metadata?.title || 'N/A';
  const description = websiteData.metadata?.description || 'N/A';
  const content = cleanWebsiteContent(websiteData.markdown || '', businessType).substring(0, 1500);

  const prompt = `Analyze this ${businessType} website and generate 50 diverse seed keywords covering different aspects of the business:

Website: ${url}
Business Type: ${businessType}
Title: ${title}
Description: ${description}
Content: ${content}

Generate 50 DIVERSE seed keywords covering the full customer journey. Include awareness, consideration, and decision stage keywords. Mix broad and specific terms.

Return ONLY a JSON array of keyword strings, no explanations:`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [
        { role: 'system', content: `You are an expert SEO strategist specializing in ${businessType} businesses.` },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  let content_text = data.choices[0].message.content.trim();
  content_text = content_text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(content_text);
  } catch (e) {
    // Parse from text format
    const lines = content_text.split('\n');
    keywords = lines
      .map((line: string) => line.replace(/^[\d\-\*\.\s\[\]"'`]+/, '').replace(/["'\]\[`]/g, '').trim())
      .filter((kw: string) => kw.length > 3 && kw.length < 100)
      .slice(0, 50);
  }

  return filterTechnicalKeywords(keywords).slice(0, 40);
}

async function getKeywordMetrics(keywords: string[], username: string, password: string) {
  if (!username || !password) {
    throw new Error('DataForSEO credentials are required. Set DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD environment variables or pass as parameters.');
  }

  const credentials = btoa(`${username}:${password}`);
  
  const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      keywords: keywords,
      location_code: 2840, // United States
      language_code: 'en',
      include_serp_info: true,
      include_clickstream_data: true
    }])
  });

  if (!response.ok) {
    throw new Error(`DataForSEO keyword metrics error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function getSerpData(keywords: string[], username: string, password: string) {
  if (!username || !password) {
    throw new Error('DataForSEO credentials are required. Set DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD environment variables or pass as parameters.');
  }

  const credentials = btoa(`${username}:${password}`);
  
  const serpRequests = keywords.slice(0, 15).map(keyword => ({
    keyword: keyword,
    location_code: 2840,
    language_code: 'en',
    device: 'desktop',
    depth: 5
  }));
  
  const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(serpRequests)
  });

  if (!response.ok) {
    throw new Error(`DataForSEO SERP error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Main analysis function
async function analyzeWebsite(args: any): Promise<AnalysisReport> {
  const { websiteUrl, businessType } = args;
  const credentials = getApiCredentials(args);

  // Clean URL
  let cleanUrl = websiteUrl;
  if (!cleanUrl.startsWith('http')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  try {
    new URL(cleanUrl);
  } catch (e) {
    throw new Error('Please enter a valid website URL.');
  }

  // Step 1: Scrape website
  const websiteData = await scrapeWebsite(cleanUrl, credentials.firecrawlApiKey!);
  
  // Step 2: Generate keywords
  const seedKeywords = await generateKeywords(cleanUrl, websiteData, businessType, credentials.perplexityApiKey!);
  
  // Step 3: Get keyword data
  const keywordMetrics = await getKeywordMetrics(seedKeywords, credentials.dataforSeoUsername!, credentials.dataforSeoPassword!);
  const serpData = await getSerpData(seedKeywords, credentials.dataforSeoUsername!, credentials.dataforSeoPassword!);
  
  // Step 4: Process and cluster
  const keywordDB = new Map<string, KeywordData>();

  // Process keyword metrics
  const volumeResults = keywordMetrics.tasks?.[0]?.result || [];
  volumeResults.forEach((item: any) => {
    if (item.keyword && item.search_volume > 0) {
      keywordDB.set(item.keyword, {
        keyword: item.keyword,
        search_volume: item.search_volume,
        cpc: item.cpc || 0,
        competition: item.competition || 0,
        competition_level: item.competition_level || 'unknown',
        keyword_difficulty: estimateDifficultyFromMetrics(item),
        serp_urls: [],
        commercial_score: calculateCommercialScore(item, businessType),
        is_seed: true
      });
    }
  });

  // Process SERP data
  const serpResults = serpData.tasks || [];
  serpResults.forEach((task: any) => {
    if (task.result?.[0]?.items) {
      const keyword = task.data?.[0]?.keyword;
      const items = task.result[0].items;
      
      if (keyword && keywordDB.has(keyword)) {
        const organicResults = items.filter((item: any) => item.type === 'organic' && item.url);
        const topUrls = organicResults.slice(0, 10).map((item: any) => ({
          url: item.url,
          title: item.title || 'No title',
          domain: extractDomain(item.url),
          position: item.rank_group || item.rank_absolute || 0
        })).filter((item: any) => item.domain);
        
        const keywordData = keywordDB.get(keyword)!;
        keywordData.serp_urls = topUrls;
        keywordData.keyword_difficulty = calculateDifficulty(organicResults) || estimateDifficultyFromMetrics(keywordData);
      }
    }
  });

  // Create clusters
  const keywordsArray = Array.from(keywordDB.values()).filter(kw => kw.search_volume > 20);
  const clusters = createClusters(keywordsArray);
  
  // Generate report
  return generateReport(cleanUrl, businessType, clusters);
}

// Create and start server
const server = new Server(
  {
    name: 'seo-keyword-research',
    version: '1.0.0',
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze-website': {
        const report = await analyzeWebsite(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(report, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SEO Keyword Research MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
}); 