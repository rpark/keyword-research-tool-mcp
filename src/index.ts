#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';

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
  
  // Enhanced logging for Cursor MCP integration
  const credentialSources = {
    firecrawl: args.firecrawlApiKey ? 'parameter' : (process.env.FIRECRAWL_API_KEY ? 'environment' : 'missing'),
    perplexity: args.perplexityApiKey ? 'parameter' : (process.env.PERPLEXITY_API_KEY ? 'environment' : 'missing'),
    dataforSeoUsername: args.dataforSeoUsername ? 'parameter' : (process.env.DATAFORSEO_USERNAME ? 'environment' : 'missing'),
    dataforSeoPassword: args.dataforSeoPassword ? 'parameter' : (process.env.DATAFORSEO_PASSWORD ? 'environment' : 'missing')
  };
  
  const debugInfo = {
    firecrawl: firecrawlApiKey ? 'PROVIDED' : 'MISSING',
    perplexity: perplexityApiKey ? 'PROVIDED' : 'MISSING',
    dataforSeoUsername: dataforSeoUsername ? `${dataforSeoUsername.substring(0, 3)}***` : 'MISSING',
    dataforSeoPassword: dataforSeoPassword ? '***PROVIDED***' : 'MISSING',
    sources: credentialSources,
    envVars: Object.keys(process.env).filter(k => k.includes('DATAFORSEO') || k.includes('FIRECRAWL') || k.includes('PERPLEXITY'))
  };
  
  console.error(`[CURSOR-MCP] API Credentials Check: ${JSON.stringify(debugInfo, null, 2)}`);
  
  return {
    firecrawlApiKey,
    perplexityApiKey,
    dataforSeoUsername,
    dataforSeoPassword,
    debugInfo
  };
}

// Helper function to generate formatted report text
function generateFormattedReport(report: AnalysisReport, websiteUrl: string, businessType: string): string {
  const domain = extractDomain(websiteUrl);
  const totalClusters = report.topKeywordClusters.length;
  const totalVolume = report.summaryCards.find(card => card.title === 'Total Search Volume')?.value || '0';
  const avgDifficulty = report.summaryCards.find(card => card.title === 'Average Difficulty')?.value || '0/100';
  const totalKeywords = report.summaryCards.find(card => card.title === 'Total Keywords')?.value || '0';
  
  // Calculate estimated traffic (roughly 30% of search volume)
  const volumeNum = parseInt(totalVolume.replace(/,/g, '')) || 0;
  const estimatedTraffic = Math.round(volumeNum * 0.3);
  
  // Calculate average CPC
  const avgCpc = report.topKeywordClusters.length > 0 
    ? report.topKeywordClusters.reduce((sum, cluster) => sum + cluster.avg_cpc, 0) / report.topKeywordClusters.length 
    : 0;

  let formattedReport = `🔍 SEO Keyword Research Tool
Discover high-value keyword opportunities for your website

${totalClusters}
Keyword Clusters
${totalVolume}
Monthly Search Volume
${estimatedTraffic.toLocaleString()}
Est. Monthly Traffic
$${avgCpc.toFixed(2)}
Average CPC

🚀 Quick Wins (Low Competition)
`;

  // Add Quick Wins section
  report.quickWins.forEach(cluster => {
    const mainKeyword = cluster.keywords[0];
    formattedReport += `${cluster.main_keyword}
📊 ${cluster.total_search_volume.toLocaleString()} searches/month
💰 $${cluster.avg_cpc.toFixed(2)} CPC
🎯 ${cluster.avg_difficulty}/100 difficulty

`;
  });

  // Add High-Value Targets section
  if (report.highValueTargets.length > 0) {
    formattedReport += `💎 High-Value Targets
`;
    report.highValueTargets.forEach(cluster => {
      formattedReport += `${cluster.main_keyword}
📊 ${cluster.total_search_volume.toLocaleString()} searches/month
💰 $${cluster.avg_cpc.toFixed(2)} CPC
💎 ${cluster.total_commercial_score?.toLocaleString() || 'N/A'} commercial score

`;
    });
  }

  // Add Top Keyword Clusters section
  formattedReport += `📊 Top Keyword Clusters
`;

  report.topKeywordClusters.slice(0, 10).forEach((cluster, index) => {
    formattedReport += `${index + 1}. ${cluster.main_keyword}
${cluster.theme}
${cluster.total_search_volume.toLocaleString()}
monthly searches
$${cluster.avg_cpc.toFixed(2)}
Avg CPC
${cluster.avg_difficulty}/100
Difficulty
${cluster.keywords.length}
Keywords

Top Keywords:
`;
    
    // Show top 5 keywords in cluster
    cluster.keywords.slice(0, 5).forEach(keyword => {
      formattedReport += `${keyword.keyword}
${keyword.search_volume.toLocaleString()} searches
`;
    });

    formattedReport += `
Complete Keyword List (${cluster.keywords.length} keywords):
`;
    
    // Show all keywords with details
    cluster.keywords.forEach(keyword => {
      formattedReport += `${keyword.keyword}
Vol: ${keyword.search_volume.toLocaleString()}
CPC: $${keyword.cpc.toFixed(2)}
`;
    });
    
    formattedReport += `
`;
  });

  // Add Main Competitors section
  if (report.mainCompetitors.length > 0) {
    formattedReport += `🏆 Main Competitors
All Identified Competitors (${report.mainCompetitors.length})
`;
    
    report.mainCompetitors.forEach(competitor => {
      formattedReport += `🏆
${competitor.domain}
`;
    });
    formattedReport += `
`;
  }

  // Add Action Plan section
  if (report.actionPlan.length > 0) {
    formattedReport += `📝 Action Plan
🚀 Immediate Actions (1-2 weeks)
`;
    
    const immediateActions = report.actionPlan.filter(action => 
      action.category === 'Quick Wins' || action.title.toLowerCase().includes('quick')
    );
    
    immediateActions.forEach(action => {
      formattedReport += `✓
${action.description}
`;
    });

    formattedReport += `
📈 Medium-term Goals (1-3 months)
◯
Build comprehensive content for high-value clusters
◯
Develop internal linking strategy between related keywords
◯
Start building backlinks to target pages

🎯 Long-term Strategy (6-12 months)
◐
Build domain authority through high-quality content
◐
Target high-difficulty, high-value keywords
◐
Expand into related keyword opportunities

`;
  }

  // Add Analysis Summary
  formattedReport += `📊 Analysis Summary
{
  "source_website": "${websiteUrl}",
  "business_type": "${businessType}",
  "analysis_date": "${new Date().toISOString()}",
  "total_keywords_analyzed": ${totalKeywords},
  "clusters_identified": ${totalClusters},
  "total_monthly_search_volume": ${volumeNum},
  "estimated_monthly_traffic_potential": ${estimatedTraffic},
  "avg_cpc": ${avgCpc}
}

🎯 Complete Cluster Analysis (${totalClusters} clusters)
`;

  report.topKeywordClusters.forEach((cluster, index) => {
    formattedReport += `${index + 1}. ${cluster.main_keyword} (${cluster.keywords.length} keywords, ${cluster.total_search_volume.toLocaleString()} monthly searches)
`;
  });

  formattedReport += `
✅ Analysis Complete!
All keyword data, competitor analysis, and detailed metrics are displayed above.

© ${new Date().getFullYear()} SEO Keyword Research Tool. Built with ❤️ for marketers.
`;

  return formattedReport;
}

// Helper function to save report to file
async function saveReportToFile(report: AnalysisReport, websiteUrl: string, businessType: string): Promise<void> {
  try {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Extract domain name from URL for filename
    const domain = extractDomain(websiteUrl);
    const cleanDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_'); // Clean domain for filename
    
    // Create date-stamped filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
    const baseFilename = `${cleanDomain}_${businessType.toLowerCase().replace(/\s+/g, '-')}_${dateStr}_${timeStr}`;
    
    // Add metadata to the report
    const reportWithMetadata = {
      metadata: {
        generated_at: now.toISOString(),
        website_url: websiteUrl,
        business_type: businessType,
        domain: domain,
        tool_version: '1.0.0'
      },
      ...report
    };
    
    // Save JSON file (for programmatic use)
    const jsonFilePath = path.join(reportsDir, `${baseFilename}.json`);
    fs.writeFileSync(jsonFilePath, JSON.stringify(reportWithMetadata, null, 2), 'utf8');
    
    // Save formatted text file (for human reading)
    const formattedReport = generateFormattedReport(report, websiteUrl, businessType);
    const textFilePath = path.join(reportsDir, `${baseFilename}_formatted.txt`);
    fs.writeFileSync(textFilePath, formattedReport, 'utf8');
    
    console.error(`[REPORT-SAVED] JSON report saved to: ${jsonFilePath}`);
    console.error(`[REPORT-SAVED] Formatted report saved to: ${textFilePath}`);
  } catch (error) {
    console.error(`[REPORT-ERROR] Failed to save report: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw error to avoid breaking the analysis - just log it
  }
}

// Helper function to convert DataForSEO competition strings to numeric values
function convertCompetitionToNumeric(competition: any): number {
  if (typeof competition === 'number') return competition;
  if (typeof competition === 'string') {
    switch (competition.toUpperCase()) {
      case 'LOW': return 0.2;
      case 'MEDIUM': return 0.5;
      case 'HIGH': return 0.8;
      default: return 0.3;
    }
  }
  return 0.3; // default fallback
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

  console.error(`[KEYWORDS] Starting expanded keyword generation for ${businessType} business`);

  // First round: Core business keywords
  const corePrompt = `Analyze this ${businessType} website and generate 100 diverse seed keywords covering different aspects of the business:

Website: ${url}
Business Type: ${businessType}
Title: ${title}
Description: ${description}
Content: ${content}

Generate 100 DIVERSE seed keywords covering the full customer journey:
- Product/service keywords (20)
- Industry keywords (15) 
- Problem-solving keywords (15)
- Comparison keywords (10)
- Educational keywords (10)
- Location-based keywords (10)
- Brand keywords (10)
- Technical keywords (10)

Include awareness, consideration, and decision stage keywords. Mix broad and specific terms.

Return ONLY a JSON array of keyword strings, no explanations:`;

  console.error(`[KEYWORDS] Round 1: Generating core business keywords`);
  const coreKeywords = await callPerplexityForKeywords(corePrompt, apiKey, businessType);
  
  // Second round: Expand with related and long-tail keywords
  const expansionPrompt = `Based on this ${businessType} business analysis, generate 50 additional related and long-tail keywords:

Website: ${url}
Business Type: ${businessType}  
Core Keywords Found: ${coreKeywords.slice(0, 10).join(', ')}...

Generate 50 ADDITIONAL keywords focusing on:
- Long-tail variations of core terms (15)
- Question-based keywords (10)
- Competitor comparison terms (10)
- Feature-specific keywords (10)
- Use case keywords (5)

Return ONLY a JSON array of keyword strings, no explanations:`;

  console.error(`[KEYWORDS] Round 2: Generating expansion keywords`);
  const expansionKeywords = await callPerplexityForKeywords(expansionPrompt, apiKey, businessType);

  // Combine and deduplicate
  const allKeywords = [...new Set([...coreKeywords, ...expansionKeywords])];
  console.error(`[KEYWORDS] Combined total: ${allKeywords.length} unique keywords`);
  
  return filterTechnicalKeywords(allKeywords).slice(0, 100); // Increased from 40 to 100
}

// Helper function for Perplexity API calls
async function callPerplexityForKeywords(prompt: string, apiKey: string, businessType: string): Promise<string[]> {
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
      max_tokens: 1200, // Increased for more keywords
      temperature: 0.3
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
      .slice(0, 100); // Increased limit
  }

  console.error(`[KEYWORDS] Perplexity returned ${keywords.length} keywords`);
  return keywords;
}

async function getKeywordMetrics(keywords: string[], username: string, password: string) {
  if (!username || !password) {
    throw new Error('DataForSEO credentials are required for keyword metrics. Set DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD environment variables or pass dataforSeoUsername and dataforSeoPassword parameters.');
  }

  console.error(`[DEBUG] DataForSEO Keywords API - Username: ${username ? `${username.substring(0, 3)}***` : 'MISSING'}`);
  console.error(`[DEBUG] DataForSEO Keywords API - Password: ${password ? '***PROVIDED***' : 'MISSING'}`);
  console.error(`[DEBUG] DataForSEO Keywords API - Keywords to analyze: ${keywords.length}`);
  console.error(`[DEBUG] DataForSEO Keywords API - Keywords: ${JSON.stringify(keywords.slice(0, 5))}${keywords.length > 5 ? '...' : ''}`);

  const credentials = btoa(`${username}:${password}`);
  
  const requestBody = [{
    keywords: keywords,
    location_code: 2840, // United States
    language_code: 'en',
    include_serp_info: true,
    include_clickstream_data: true
  }];
  
  console.error(`[DEBUG] DataForSEO Keywords API - Request body: ${JSON.stringify(requestBody, null, 2)}`);
  
  const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.error(`[DEBUG] DataForSEO Keywords API - Response status: ${response.status} ${response.statusText}`);
  console.error(`[DEBUG] DataForSEO Keywords API - Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[DEBUG] DataForSEO Keywords API - Error response: ${errorText}`);
    throw new Error(`DataForSEO keyword metrics error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.error(`[DEBUG] DataForSEO Keywords API - Response received, tasks: ${result.tasks?.length || 0}`);
  console.error(`[DEBUG] DataForSEO Keywords API - First task status: ${result.tasks?.[0]?.status_message || 'N/A'}`);
  console.error(`[DEBUG] DataForSEO Keywords API - Results count: ${result.tasks?.[0]?.result?.length || 0}`);
  
  if (result.tasks?.[0]?.result?.length > 0) {
    console.error(`[DEBUG] DataForSEO Keywords API - Sample result: ${JSON.stringify(result.tasks[0].result[0], null, 2)}`);
  }

  return result;
}

// Get SERP data for keywords
async function getSerpData(keywords: string[], credentials: any): Promise<any> {
  if (!credentials.dataforSeoUsername || !credentials.dataforSeoPassword) {
    console.error('[SERP] Missing DataForSEO credentials');
    return { tasks: [] };
  }

  console.error(`[SERP] Starting SERP data collection for ${keywords.length} keywords`);
  const auth = Buffer.from(`${credentials.dataforSeoUsername}:${credentials.dataforSeoPassword}`).toString('base64');
  const serpResults: any[] = [];

  // DataForSEO Live SERP API accepts only ONE keyword per request
  // So we need to make individual calls for each keyword
  for (const keyword of keywords.slice(0, 50)) {
    try {
      console.error(`[SERP] Making API call for keyword: "${keyword}"`);
      
      const requestBody = [{
        keyword: keyword,
        location_code: 2840,
        language_code: 'en',
        device: 'desktop',
        depth: 5
      }];

      console.error(`[SERP] Request body for "${keyword}":`, JSON.stringify(requestBody));

      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error(`[SERP] API call failed for "${keyword}": ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      console.error(`[SERP] API response for "${keyword}":`, {
        status_code: data.status_code,
        tasks_count: data.tasks_count,
        tasks_error: data.tasks_error,
        has_tasks: !!data.tasks,
        tasks_length: data.tasks?.length || 0
      });

      if (data.status_code === 20000 && data.tasks && data.tasks.length > 0) {
        serpResults.push(data.tasks[0]); // Add the single task result
        console.error(`[SERP] Successfully processed "${keyword}"`);
      } else {
        console.error(`[SERP] No valid results for "${keyword}":`, data.status_message);
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`[SERP] Error processing keyword "${keyword}":`, error);
    }
  }

  console.error(`[SERP] Completed SERP collection. Retrieved ${serpResults.length} results out of ${keywords.slice(0, 50).length} attempted`);
  
  return {
    tasks: serpResults
  };
}

// Main analysis function
async function analyzeWebsite(args: any): Promise<AnalysisReport | any> {
  console.error(`[DEBUG] Starting analysis for: ${args.websiteUrl}`);
  console.error(`[DEBUG] Business type: ${args.businessType}`);
  console.error(`[DEBUG] Args received: ${JSON.stringify(Object.keys(args))}`);
  
  const { websiteUrl, businessType } = args;
  const { firecrawlApiKey, perplexityApiKey, dataforSeoUsername, dataforSeoPassword, debugInfo } = getApiCredentials(args);
  
  // Include debug info in response instead of throwing error
  if (!dataforSeoUsername || !dataforSeoPassword) {
    return {
      error: `DataForSEO credentials missing! Username: ${dataforSeoUsername ? 'SET' : 'MISSING'}, Password: ${dataforSeoPassword ? 'SET' : 'MISSING'}`,
      debugInfo,
      analysis_summary: {
        source_website: websiteUrl,
        business_type: businessType,
        error: "Missing API credentials"
      }
    };
  }

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
  console.error(`[DEBUG] Step 1: Starting website scraping for ${cleanUrl}`);
  const websiteData = await scrapeWebsite(cleanUrl, firecrawlApiKey!);
  console.error(`[DEBUG] Step 1: Website scraping completed, got ${Object.keys(websiteData).length} data fields`);
  
  // Step 2: Generate keywords
  console.error(`[DEBUG] Step 2: Starting keyword generation`);
  const seedKeywords = await generateKeywords(cleanUrl, websiteData, businessType, perplexityApiKey!);
  console.error(`[DEBUG] Step 2: Keyword generation completed, got ${seedKeywords.length} keywords`);
  
  // Step 3: Get keyword data
  console.error(`[DEBUG] Starting DataForSEO analysis with ${seedKeywords.length} seed keywords`);
  console.error(`[DEBUG] Seed keywords: ${JSON.stringify(seedKeywords)}`);
  
  const keywordMetrics = await getKeywordMetrics(seedKeywords, dataforSeoUsername!, dataforSeoPassword!);
  
  const serpData = await getSerpData(seedKeywords, { dataforSeoUsername, dataforSeoPassword });
  
  // Step 4: Process and cluster
  const keywordDB = new Map<string, KeywordData>();

  // Process keyword metrics
  const volumeResults = keywordMetrics.tasks?.[0]?.result || [];
  console.error(`[DEBUG] Processing ${volumeResults.length} keyword metrics results`);
  
  volumeResults.forEach((item: any, index: number) => {
    console.error(`[DEBUG] Processing keyword ${index + 1}: ${item.keyword} - Volume: ${item.search_volume}, CPC: ${item.cpc}`);
    if (item.keyword && item.search_volume > 0) {
      const commercialScore = calculateCommercialScore(item, businessType);
      console.error(`[DEBUG] Commercial score for ${item.keyword}: ${commercialScore} (input: ${JSON.stringify({volume: item.search_volume, cpc: item.cpc, competition: item.competition})})`);
      
      keywordDB.set(item.keyword, {
        keyword: item.keyword,
        search_volume: item.search_volume,
        cpc: item.cpc || 0,
        competition: convertCompetitionToNumeric(item.competition),
        competition_level: item.competition_level || 'unknown',
        keyword_difficulty: estimateDifficultyFromMetrics(item),
        serp_urls: [],
        commercial_score: commercialScore,
        is_seed: true
      });
    }
  });
  
  console.error(`[DEBUG] KeywordDB now contains ${keywordDB.size} keywords after processing metrics`);

  // Process SERP data
  const serpResults = serpData.tasks || [];
  console.error(`[DEBUG-SERP] Processing SERP data: ${serpResults.length} tasks received`);
  
  serpResults.forEach((task: any, taskIndex: number) => {
    console.error(`[DEBUG-SERP] Task ${taskIndex + 1}:`, {
      status: task.status_message,
      hasResult: !!task.result,
      resultLength: task.result?.length || 0,
      hasItems: !!task.result?.[0]?.items,
      itemsCount: task.result?.[0]?.items?.length || 0,
      taskData: task.data
    });
    
    if (task.result?.[0]?.items) {
      const keyword = task.data?.[0]?.keyword;
      const items = task.result[0].items;
      
      console.error(`[DEBUG-SERP] Processing keyword: "${keyword}"`);
      console.error(`[DEBUG-SERP] Keyword exists in DB: ${keywordDB.has(keyword)}`);
      console.error(`[DEBUG-SERP] Total items: ${items.length}`);
      
      // Log all item types to see what we're getting
      const itemTypes = items.map((item: any) => item.type);
      console.error(`[DEBUG-SERP] Item types: ${JSON.stringify(itemTypes)}`);
      
      if (keyword && keywordDB.has(keyword)) {
        const organicResults = items.filter((item: any) => item.type === 'organic' && item.url);
        console.error(`[DEBUG-SERP] Organic results found: ${organicResults.length}`);
        
        if (organicResults.length > 0) {
          console.error(`[DEBUG-SERP] First organic result:`, {
            type: organicResults[0].type,
            url: organicResults[0].url,
            title: organicResults[0].title,
            rank_group: organicResults[0].rank_group,
            rank_absolute: organicResults[0].rank_absolute
          });
        }
        
        const topUrls = organicResults.slice(0, 10).map((item: any) => ({
          url: item.url,
          title: item.title || 'No title',
          domain: extractDomain(item.url),
          position: item.rank_group || item.rank_absolute || 0
        })).filter((item: any) => item.domain);
        
        console.error(`[DEBUG-SERP] Top URLs after processing: ${topUrls.length}`);
        console.error(`[DEBUG-SERP] Sample top URL:`, topUrls[0] || 'NONE');
        
        const keywordData = keywordDB.get(keyword)!;
        keywordData.serp_urls = topUrls;
        keywordData.keyword_difficulty = calculateDifficulty(organicResults) || estimateDifficultyFromMetrics(keywordData);
        
        console.error(`[DEBUG-SERP] Updated keyword "${keyword}" with ${topUrls.length} SERP URLs`);
      } else {
        console.error(`[DEBUG-SERP] Skipping keyword "${keyword}" - not in keywordDB or keyword is null`);
      }
    } else {
      console.error(`[DEBUG-SERP] Task ${taskIndex + 1} has no items - Status: ${task.status_message}`);
    }
  });

  // Create clusters
  const keywordsArray = Array.from(keywordDB.values()).filter(kw => kw.search_volume > 20);
  const clusters = createClusters(keywordsArray);
  
  // Generate report
  const report = generateReport(cleanUrl, businessType, clusters);
  
  // Save report to reports directory
  await saveReportToFile(report, cleanUrl, businessType);
  
  return report;
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
  console.error('[DEBUG] Received tools/list request');
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  try {
    console.error(`[DEBUG] Received tool call: ${name} with args:`, JSON.stringify(args));
    
    switch (name) {
      case 'analyze-website': {
        console.error('[DEBUG] Starting analyze-website...');
        const report = await analyzeWebsite(args);
        console.error('[DEBUG] Analysis completed successfully');
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
    console.error('[ERROR] Tool call failed:', error);
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
  try {
    // Log environment variables on startup for Cursor MCP debugging
    const startupEnvCheck = {
      timestamp: new Date().toISOString(),
      firecrawlKey: process.env.FIRECRAWL_API_KEY ? 'LOADED' : 'MISSING',
      perplexityKey: process.env.PERPLEXITY_API_KEY ? 'LOADED' : 'MISSING',
      dataforSeoUsername: process.env.DATAFORSEO_USERNAME ? 'LOADED' : 'MISSING',
      dataforSeoPassword: process.env.DATAFORSEO_PASSWORD ? 'LOADED' : 'MISSING',
      nodeVersion: process.version,
      cwd: process.cwd()
    };
    
    console.error(`[CURSOR-MCP-STARTUP] Environment Check: ${JSON.stringify(startupEnvCheck, null, 2)}`);
    console.error('[DEBUG] Starting MCP server...');
    const transport = new StdioServerTransport();
    
    // Note: StdioServerTransport doesn't expose message events
    
    await server.connect(transport);
    console.error('SEO Keyword Research MCP Server running on stdio');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.error('[DEBUG] Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.error('[DEBUG] Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('[ERROR] Uncaught exception:', error);
      console.error('[ERROR] Stack trace:', error.stack);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[ERROR] Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
    // Add more detailed signal handling
    process.on('SIGTERM', (signal) => {
      console.error('[DEBUG] Received SIGTERM signal:', signal);
      console.error('[DEBUG] Stack trace at SIGTERM:', new Error().stack);
      process.exit(0);
    });
    
    process.on('SIGINT', (signal) => {
      console.error('[DEBUG] Received SIGINT signal:', signal);
      process.exit(0);
    });
    
  } catch (error) {
    console.error('[ERROR] Server failed to start:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Main function failed:', error);
  process.exit(1);
}); 