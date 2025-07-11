import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

// Types based on the original app.js
interface KeywordData {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  competition_level: string;
  keyword_difficulty: number;
  serp_urls: SerpUrl[];
  commercial_score: number;
  is_seed: boolean;
}

interface SerpUrl {
  url: string;
  title: string;
  domain: string;
  position: number;
}

interface KeywordCluster {
  cluster_id: number;
  main_keyword: string;
  theme: string;
  keywords: KeywordData[];
  total_search_volume: number;
  avg_cpc: number;
  avg_difficulty: number;
  total_commercial_score: number;
  competitor_domains: string[];
  ai_competitors?: string[];
}

interface AnalysisReport {
  analysis_summary: {
    source_website: string;
    business_type: string;
    analysis_date: string;
    total_keywords_analyzed: number;
    clusters_identified: number;
    total_monthly_search_volume: number;
    estimated_monthly_traffic_potential: number;
    avg_cpc: number;
  };
  clusters: KeywordCluster[];
  quick_wins: KeywordCluster[];
  high_value: KeywordCluster[];
  competitors: string[];
}

// Update the AnalysisArgs interface to only require website_url and business_type
interface AnalysisArgs {
  website_url: string;
  business_type: string;
}

// Complete implementation adapted from app.js
export class KeywordResearchTool {
  // Step 1: Scrape website
  async scrapeWebsite(url: string, apiKey: string) {
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

    const data = await response.json() as any;
    
    if (!data.success) {
      throw new Error('Failed to scrape website. Please check the URL and try again.');
    }

    return data.data;
  }

  // FIXED: Commercial score calculation with proper competition handling
  calculateCommercialScore(keywordData: any, businessType: string): number {
    const volume = keywordData.search_volume || 0;
    const cpc = keywordData.cpc || 0;
    
    // FIX for Problem #1: Handle DataForSEO string competition levels
    let competition = keywordData.competition || 0;
    const competitionLevel = keywordData.competition_level || 'unknown';
    
    // Convert string competition levels to numeric values
    if (typeof competition !== 'number') {
      switch (competitionLevel.toUpperCase()) {
        case 'HIGH':
          competition = 0.8;
          break;
        case 'MEDIUM':
          competition = 0.5;
          break;
        case 'LOW':
          competition = 0.2;
          break;
        default:
          competition = 0.3; // Default fallback
      }
    }
    
    const keyword = (keywordData.keyword || '').toLowerCase();
    
    let intentMultiplier = 1;
    
    if (keyword.includes('buy') || keyword.includes('purchase') || keyword.includes('order')) {
      intentMultiplier = 2.5;
    } else if (keyword.includes('best') || keyword.includes('top') || keyword.includes('review')) {
      intentMultiplier = 2;
    } else if (keyword.includes('price') || keyword.includes('cost') || keyword.includes('cheap')) {
      intentMultiplier = 1.8;
    } else if (keyword.includes('hire') || keyword.includes('service') || keyword.includes('company')) {
      intentMultiplier = 1.6;
    } else if (keyword.includes('how to') || keyword.includes('what is')) {
      intentMultiplier = 0.8;
    }
    
    const validVolume = isNaN(volume) ? 100 : volume;
    const validCpc = isNaN(cpc) ? 0.5 : cpc;
    const validCompetition = isNaN(competition) ? 0.3 : competition;
    
    const score = Math.round(validVolume * Math.max(0.1, validCpc) * intentMultiplier * (1 + validCompetition));
    return isNaN(score) ? 100 : Math.max(10, score);
  }

  // Content cleaning function
  cleanWebsiteContent(content: string, businessType: string): string {
    if (!content) return '';
    
    const technicalTerms = [
      'json', 'api', 'javascript', 'html', 'css', 'code', 'function', 'variable',
      'array', 'object', 'string', 'boolean', 'null', 'undefined', 'console',
      'log', 'error', 'debug', 'github', 'npm', 'node', 'react', 'vue', 'angular',
      'webpack', 'babel', 'typescript', 'php', 'python', 'java', 'sql', 'database',
      'server', 'localhost', 'http', 'https', 'url', 'endpoint', 'crud', 'rest',
      'graphql', 'oauth', 'jwt', 'cookie', 'session', 'cache', 'cdn', 'aws',
      'docker', 'kubernetes', 'deployment', 'pipeline', 'repository', 'commit'
    ];
    
    const sentences = content.split(/[.!?]+/).filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const techTermCount = technicalTerms.filter(term => lowerSentence.includes(term)).length;
      
      if (techTermCount > 2) return false;
      if (sentence.trim().length < 20) return false;
      if (lowerSentence.includes('{') || lowerSentence.includes('[') || 
          lowerSentence.includes('```') || lowerSentence.includes('function(')) {
        return false;
      }
      return true;
    });
    
    const businessKeywords: Record<string, string[]> = {
      'E-commerce': ['product', 'shop', 'buy', 'sell', 'store', 'customer', 'order', 'payment'],
      'SaaS': ['software', 'solution', 'platform', 'tool', 'service', 'feature', 'plan', 'subscription'],
      'Service Business': ['service', 'help', 'support', 'expert', 'professional', 'consultant', 'solution'],
      'Blog/Content': ['article', 'guide', 'tips', 'learn', 'tutorial', 'information', 'resource'],
      'Education': ['course', 'learn', 'training', 'education', 'student', 'class', 'certification']
    };
    
    const relevantKeywords = businessKeywords[businessType] || [];
    
    const prioritizedSentences = sentences.sort((a, b) => {
      const aScore = relevantKeywords.filter(keyword => a.toLowerCase().includes(keyword)).length;
      const bScore = relevantKeywords.filter(keyword => b.toLowerCase().includes(keyword)).length;
      return bScore - aScore;
    });
    
    return prioritizedSentences.slice(0, 10).join('. ');
  }

  // Filter technical keywords from AI output
  filterTechnicalKeywords(keywords: string[]): string[] {
    const technicalTerms = [
      'json', 'api', 'javascript', 'html', 'css', 'code', 'coding', 'programming',
      'developer', 'development', 'framework', 'library', 'function', 'variable',
      'array', 'object', 'string', 'boolean', 'null', 'undefined', 'console',
      'log', 'error', 'debug', 'github', 'npm', 'node', 'react', 'vue', 'angular',
      'webpack', 'babel', 'typescript', 'php', 'python', 'java', 'sql', 'database',
      'server', 'localhost', 'http', 'https', 'url', 'endpoint', 'crud', 'rest',
      'graphql', 'oauth', 'jwt', 'cookie', 'session', 'cache', 'cdn', 'aws',
      'docker', 'kubernetes', 'deployment', 'pipeline', 'repository', 'commit',
      'markdown', 'syntax', 'script', 'tag', 'element', 'attribute', 'dom',
      'cli', 'terminal', 'command', 'install', 'package', 'module', 'import'
    ];
    
    return keywords.filter(keyword => {
      const lowerKeyword = keyword.toLowerCase().trim();
      const containsTechTerm = technicalTerms.some(term => lowerKeyword.includes(term));
      const looksLikeCode = /[{}[\]<>()=+\-*/\\|&^%$#@!~`]/.test(keyword) ||
                           keyword.includes('```') ||
                           keyword.startsWith('function') ||
                           keyword.startsWith('var ') ||
                           keyword.startsWith('const ') ||
                           keyword.startsWith('let ');
      const genericTerms = ['data', 'information', 'content', 'text', 'format', 'file'];
      const isGeneric = genericTerms.some(term => lowerKeyword === term);
      
      return !containsTechTerm && !looksLikeCode && !isGeneric && keyword.length > 2;
    });
  }

  // Helper to parse JSON from AI responses, with fallbacks
  extractJsonFromAiResponse(content: string): string[] {
    // Attempt to find JSON within markdown code blocks
    const codeBlockMatch = content.match(/```(json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[2]) {
      try {
        // Try parsing the extracted content as a whole
        return JSON.parse(codeBlockMatch[2]);
      } catch (e) {
        // Fallback to parsing line-by-line if main JSON is malformed
        const lines = codeBlockMatch[2].split('\n');
        return lines
          .map(line => line.replace(/^[\d\-\*\.\s\[\]"'`]+/, '').replace(/["'\]\[`,]*$/g, '').trim())
          .filter(kw => kw.length > 2);
      }
    }

    // If no code block, try parsing the entire content
    try {
      return JSON.parse(content);
    } catch (e) {
      // Fallback to parsing the entire content line-by-line
      const lines = content.split('\n');
      return lines
        .map(line => line.replace(/^[\d\-\*\.\s\[\]"'`]+/, '').replace(/["'\]\[`,]*$/g, '').trim())
        .filter(kw => kw.length > 2);
    }
  }

  // Step 2: Generate keywords
  async generateKeywords(url: string, websiteData: any, businessType: string, apiKey: string): Promise<string[]> {
    const title = websiteData.metadata?.title || 'N/A';
    const description = websiteData.metadata?.description || 'N/A';
    const rawContent = websiteData.markdown || '';
    
    const cleanContent = this.cleanWebsiteContent(rawContent, businessType);
    const content = cleanContent.substring(0, 1500);

    const prompt = `Analyze this ${businessType} website and generate 50 diverse seed keywords covering different aspects of the business:

Website: ${url}
Business Type: ${businessType}
Title: ${title}
Description: ${description}
Content: ${content}

Based on this analysis, generate 50 DIVERSE seed keywords covering the full customer journey. Include a mix of:

**AWARENESS STAGE (broad, educational):**
- Industry overview terms
- Problem identification keywords
- "What is", "why do I need" questions
- General category searches

**CONSIDERATION STAGE (research, comparison):**
- "Best", "top", "review" keywords
- Comparison terms ("vs", "alternative to")
- Feature-specific searches
- "How to choose" keywords

**DECISION STAGE (high commercial intent):**
- "Buy", "hire", "get", "order" terms
- Pricing and cost keywords
- Local/immediate need ("near me", "same day")
- Brand + service combinations

**DIVERSITY REQUIREMENTS:**
- Include both broad AND specific terms
- Mix short-tail (1-2 words) and long-tail (3+ words)
- Cover different user expertise levels (beginner to expert)
- Include seasonal/timely variations if relevant
- Add related service/product categories

AVOID technical development terms like "json", "api", "code", etc.
Focus on what REAL CUSTOMERS search for across their entire journey.

Return ONLY a JSON array of keyword strings, no explanations:`;

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
          { role: 'system', content: `You are an expert SEO strategist specializing in ${businessType} businesses.` },
          { role: 'user', content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        url: response.url
      });
      throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as any;
    let content_text = data.choices[0].message.content.trim();
    
    content_text = content_text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    let keywords: string[] = [];
    try {
      keywords = JSON.parse(content_text);
    } catch (e) {
      console.error('Failed to parse JSON, trying text parsing:', e);
      const lines = content_text.split('\n');
      keywords = lines
        .map((line: string) => line.replace(/^[\d\-\*\.\s\[\]"'`]+/, '').replace(/["'\]\[`]/g, '').trim())
        .filter((kw: string) => kw.length > 3 && kw.length < 100 && !kw.toLowerCase().includes('json'))
        .slice(0, 50);
    }

    if (!Array.isArray(keywords) || keywords.length === 0) {
      throw new Error('Failed to generate keywords from website content.');
    }

    const filteredKeywords = this.filterTechnicalKeywords(keywords);
    return filteredKeywords.slice(0, 40);
  }

  // Step 3a: Get keyword metrics
  async getKeywordMetrics(keywords: string[], username: string, password: string) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
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

  // Step 3b: Get related keywords
  async getRelatedKeywords(keywords: string[], username: string, password: string) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        keywords: keywords.slice(0, 20),
        location_code: 2840,
        language_code: 'en',
        include_serp_info: true,
        limit: 1000,
        order_by: ['search_volume,desc']
      }])
    });

    if (!response.ok) {
      throw new Error(`DataForSEO related keywords error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Step 3c: Get SERP data
  async getSerpData(keywords: string[], username: string, password: string) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    // FIX: DataForSEO Live SERP API accepts only ONE keyword per request
    // Make individual requests for each keyword instead of bulk request
    const results = [];
    
    for (const keyword of keywords.slice(0, 15)) {
      try {
        const serpRequest = [{
          keyword: keyword,
          location_code: 2840,
          language_code: 'en',
          device: 'desktop',
          depth: 5
        }];
        
        const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(serpRequest)
        });

        if (!response.ok) {
          console.warn(`DataForSEO SERP error for keyword "${keyword}": ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        results.push(data);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Error fetching SERP data for keyword "${keyword}":`, error);
        continue;
      }
    }
    
    // Return results in the same format as before
    return { tasks: results.flatMap(result => (result as any).tasks || []) };
  }

  extractDomain(url: string): string {
    if (!url) return '';
    
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain && domain !== 'localhost' && domain.includes('.') ? domain : '';
    } catch {
      const parts = url.split('/');
      if (parts.length >= 3) {
        const domain = parts[2].replace('www.', '');
        return domain && domain.includes('.') ? domain : '';
      }
      return '';
    }
  }

  calculateDifficulty(organicResults: any[]): number {
    if (!organicResults || organicResults.length === 0) {
      return 0;
    }
    
    let difficulty = 0;
    const highAuthorityDomains = [
      'wikipedia.org', 'amazon.com', 'youtube.com', 'facebook.com', 'linkedin.com',
      'reddit.com', 'quora.com', 'forbes.com', 'cnn.com', 'bbc.com', 'nytimes.com',
      'yelp.com', 'trustpilot.com', 'glassdoor.com', 'indeed.com'
    ];
    
    const bigBoxDomains = [
      'walmart.com', 'target.com', 'bestbuy.com', 'homedepot.com', 'lowes.com',
      'costco.com', 'ebay.com', 'etsy.com', 'shopify.com'
    ];
    
    organicResults.slice(0, 10).forEach((result, index) => {
      const domain = this.extractDomain(result.url);
      const positionWeight = (10 - index) / 10;
      
      let domainScore = 0;
      
      if (highAuthorityDomains.some(haDomain => domain.includes(haDomain))) {
        domainScore = 35;
      } else if (bigBoxDomains.some(bbDomain => domain.includes(bbDomain))) {
        domainScore = 30;
      } else if (domain.split('.').length > 2) {
        domainScore = 20;
      } else if (domain.length > 15) {
        domainScore = 15;
      } else {
        domainScore = 10;
      }
      
      difficulty += domainScore * positionWeight;
    });
    
    return Math.min(100, Math.round(difficulty));
  }

  estimateDifficultyFromMetrics(keywordData: any): number {
    const search_volume = keywordData.search_volume || 0;
    const cpc = keywordData.cpc || 0;
    const competition = keywordData.competition || 0;
    const competition_level = keywordData.competition_level || 'unknown';
    
    let difficulty = 0;
    
    switch (competition_level.toUpperCase()) {
      case 'HIGH':
        difficulty = 70;
        break;
      case 'MEDIUM':
        difficulty = 45;
        break;
      case 'LOW':
        difficulty = 25;
        break;
      default:
        difficulty = Math.max(20, competition * 100);
    }
    
    if (search_volume > 100000) {
      difficulty += 15;
    } else if (search_volume > 10000) {
      difficulty += 10;
    } else if (search_volume > 1000) {
      difficulty += 5;
    }
    
    if (cpc > 5) {
      difficulty += 10;
    } else if (cpc > 2) {
      difficulty += 5;
    } else if (cpc > 1) {
      difficulty += 3;
    }
    
    const finalDifficulty = Math.min(100, Math.max(15, Math.round(difficulty)));
    return isNaN(finalDifficulty) ? 30 : finalDifficulty;
  }

  createClusters(keywords: KeywordData[]): KeywordCluster[] {
    const clusters: KeywordCluster[] = [];
    const processed = new Set<string>();
    const sortedKeywords = keywords.sort((a, b) => b.commercial_score - a.commercial_score);
    
    sortedKeywords.forEach(keyword => {
      if (processed.has(keyword.keyword)) return;
      
      const cluster: KeywordCluster = {
        cluster_id: clusters.length + 1,
        main_keyword: keyword.keyword,
        theme: this.identifyTheme(keyword.keyword),
        keywords: [keyword],
        total_search_volume: keyword.search_volume || 0,
        avg_cpc: isNaN(keyword.cpc) ? 0.5 : keyword.cpc,
        avg_difficulty: isNaN(keyword.keyword_difficulty) ? 30 : keyword.keyword_difficulty,
        total_commercial_score: isNaN(keyword.commercial_score) ? 100 : keyword.commercial_score,
        competitor_domains: [...new Set(keyword.serp_urls.map(url => url.domain).filter(d => d))]
      };
      
      const mainWords = keyword.keyword.toLowerCase().split(' ');
      sortedKeywords.forEach(otherKeyword => {
        if (processed.has(otherKeyword.keyword) || otherKeyword.keyword === keyword.keyword) return;
        
        const otherWords = otherKeyword.keyword.toLowerCase().split(' ');
        const commonWords = mainWords.filter(word => otherWords.includes(word) && word.length > 3);
        
        if (commonWords.length >= Math.min(mainWords.length, otherWords.length) * 0.5 && cluster.keywords.length < 10) {
          cluster.keywords.push(otherKeyword);
          cluster.total_search_volume += (otherKeyword.search_volume || 0);
          
          const currentCpc = isNaN(cluster.avg_cpc) ? 0 : cluster.avg_cpc;
          const otherCpc = isNaN(otherKeyword.cpc) ? 0 : otherKeyword.cpc;
          cluster.avg_cpc = (currentCpc + otherCpc) / 2;
          
          const currentDiff = isNaN(cluster.avg_difficulty) ? 30 : cluster.avg_difficulty;
          const otherDiff = isNaN(otherKeyword.keyword_difficulty) ? 30 : otherKeyword.keyword_difficulty;
          cluster.avg_difficulty = (currentDiff + otherDiff) / 2;
          
          cluster.total_commercial_score += (otherKeyword.commercial_score || 0);
          
          const otherDomains = otherKeyword.serp_urls.map(url => url.domain).filter(d => d);
          cluster.competitor_domains = [...new Set([...cluster.competitor_domains, ...otherDomains])];
          
          processed.add(otherKeyword.keyword);
        }
      });
      
      processed.add(keyword.keyword);
      clusters.push(cluster);
    });
    
    return clusters.sort((a, b) => b.total_commercial_score - a.total_commercial_score).slice(0, 15);
  }

  identifyTheme(keyword: string): string {
    const kw = keyword.toLowerCase();
    if (kw.includes('buy') || kw.includes('purchase')) return '💰 Purchase Intent';
    if (kw.includes('best') || kw.includes('top') || kw.includes('review')) return '🔍 Research & Comparison';
    if (kw.includes('how to') || kw.includes('guide')) return '📚 Educational';
    if (kw.includes('price') || kw.includes('cost')) return '💲 Price Research';
    return '🎯 General';
  }

  // Step 4: Analyze and cluster keywords
  async analyzeAndCluster(keywordMetrics: any, relatedKeywords: any, serpData: any, businessType: string): Promise<KeywordCluster[]> {
    const keywordDB = new Map<string, KeywordData>();

    // Process keyword metrics
    const volumeResults = keywordMetrics.tasks?.[0]?.result || [];
    volumeResults.forEach((item: any) => {
      if (item.keyword && item.search_volume > 0) {
        const initialDifficulty = this.estimateDifficultyFromMetrics(item);
        keywordDB.set(item.keyword, {
          keyword: item.keyword,
          search_volume: item.search_volume,
          cpc: item.cpc || 0,
          competition: item.competition || 0,
          competition_level: item.competition_level || 'unknown',
          keyword_difficulty: initialDifficulty,
          serp_urls: [],
          commercial_score: this.calculateCommercialScore(item, businessType),
          is_seed: true
        });
      }
    });

    // Add related keywords
    const relatedResults = relatedKeywords.tasks?.[0]?.result || [];
    relatedResults
      .filter((item: any) => item.search_volume > 50)
      .slice(0, 500)
      .forEach((item: any) => {
        if (!keywordDB.has(item.keyword)) {
          const initialDifficulty = this.estimateDifficultyFromMetrics(item);
          keywordDB.set(item.keyword, {
            keyword: item.keyword,
            search_volume: item.search_volume,
            cpc: item.cpc || 0,
            competition: item.competition || 0,
            competition_level: item.competition_level || 'unknown',
            keyword_difficulty: initialDifficulty,
            serp_urls: [],
            commercial_score: this.calculateCommercialScore(item, businessType),
            is_seed: false
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
          
          const topUrls: SerpUrl[] = organicResults.slice(0, 10).map((item: any) => ({
            url: item.url,
            title: item.title || 'No title',
            domain: this.extractDomain(item.url),
            position: item.rank_group || item.rank_absolute || 0
          })).filter((item: SerpUrl) => item.domain && item.domain.length > 0);
          
          const keywordData = keywordDB.get(keyword)!;
          keywordData.serp_urls = topUrls;
          
          const serpDifficulty = this.calculateDifficulty(organicResults);
          const fallbackDifficulty = this.estimateDifficultyFromMetrics(keywordData);
          keywordData.keyword_difficulty = serpDifficulty > 0 ? serpDifficulty : fallbackDifficulty;
        }
      }
    });

    const keywordsArray = Array.from(keywordDB.values()).filter(kw => kw.search_volume > 20);
    return this.createClusters(keywordsArray);
  }

  // Step 5: Research competitors using AI
  async researchCompetitors(clusters: KeywordCluster[], businessType: string, apiKey: string): Promise<KeywordCluster[]> {
    const topClusters = clusters.slice(0, 8);
    
    for (let i = 0; i < topClusters.length; i++) {
      const cluster = topClusters[i];
      
      try {
        const topKeywords = cluster.keywords.slice(0, 5).map(kw => kw.keyword);
        const prompt = `Research the competitive landscape for these ${businessType} keywords: ${topKeywords.join(', ')}

Find the top 8-10 companies/websites that currently dominate these search terms. Focus on:
1. Direct competitors (same business type)
2. Industry leaders and established players
3. Popular platforms in this space
4. Companies that frequently appear in search results

Return ONLY the domain names (like example.com) as a JSON array, no explanations or descriptions. Focus on legitimate business domains, not directories or generic sites.`;

        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
                  body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            { role: 'system', content: `You are a competitive intelligence researcher specializing in ${businessType} markets.` },
            { role: 'user', content: prompt }
          ],
          max_tokens: 300,
          temperature: 0.1
        })
        });

        if (response.ok) {
          const data = await response.json() as any;
          const content = data.choices[0].message.content.trim();
          
          const competitors = this.extractJsonFromAiResponse(content);
          
          if (Array.isArray(competitors) && competitors.length > 0) {
            // Clean and filter the competitors
            const cleanCompetitors = competitors
              .map(domain => {
                // Clean domain format
                return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
              })
              .filter(domain => {
                // Filter out invalid domains
                return domain && 
                       domain.includes('.') && 
                       !domain.includes(' ') &&
                       domain.length > 3 &&
                       domain.length < 50;
              })
              .slice(0, 8);
            
            cluster.ai_competitors = cleanCompetitors;
            // Debug: Found AI competitors for cluster
          } else {
            // Debug: Failed to parse AI competitor response
            cluster.ai_competitors = [];
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        cluster.ai_competitors = [];
      }
    }
    
    return clusters;
  }

  // Generate comprehensive text report matching HTML structure
  generateTextReport(report: AnalysisReport): string {
    const analysisDate = new Date(report.analysis_summary.analysis_date).toLocaleString();
    
    return `
═══════════════════════════════════════════════════════════════════════════════
🔍 SEO KEYWORD RESEARCH ANALYSIS REPORT
═══════════════════════════════════════════════════════════════════════════════

📊 ANALYSIS SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Website:                    ${report.analysis_summary.source_website}
Business Type:              ${report.analysis_summary.business_type}
Analysis Date:              ${analysisDate}
Total Keywords Analyzed:    ${report.analysis_summary.total_keywords_analyzed.toLocaleString()}
Clusters Identified:        ${report.analysis_summary.clusters_identified}
Monthly Search Volume:      ${report.analysis_summary.total_monthly_search_volume.toLocaleString()}
Estimated Traffic Potential: ${report.analysis_summary.estimated_monthly_traffic_potential.toLocaleString()} visits/month
Average CPC:                $${report.analysis_summary.avg_cpc.toFixed(2)}

🚀 QUICK WINS (Low Competition Opportunities)
═══════════════════════════════════════════════════════════════════════════════
${report.quick_wins.length > 0 ? 
  report.quick_wins.map((cluster, i) => 
    `${(i + 1).toString().padStart(2, '0')}. ${cluster.main_keyword}
    📊 ${cluster.total_search_volume.toLocaleString().padStart(10)} searches/month
    💰 $${cluster.avg_cpc.toFixed(2).padStart(5)} CPC
    🎯 ${Math.round(cluster.avg_difficulty).toString().padStart(2)}/100 difficulty
    ${cluster.theme}
    ────────────────────────────────────────────────────────────────────────────`
  ).join('\n') : 
  'Focus on building domain authority first to unlock quick wins.'
}

💎 HIGH-VALUE TARGETS (High Commercial Intent)
═══════════════════════════════════════════════════════════════════════════════
${report.high_value.length > 0 ? 
  report.high_value.map((cluster, i) => 
    `${(i + 1).toString().padStart(2, '0')}. ${cluster.main_keyword}
    📊 ${cluster.total_search_volume.toLocaleString().padStart(10)} searches/month
    💰 $${cluster.avg_cpc.toFixed(2).padStart(5)} CPC
    💎 ${cluster.total_commercial_score.toLocaleString().padStart(8)} commercial score
    ${cluster.theme}
    ────────────────────────────────────────────────────────────────────────────`
  ).join('\n') : 
  'Build content around main clusters to develop high-value opportunities.'
}

📊 TOP KEYWORD CLUSTERS (Detailed Analysis)
═══════════════════════════════════════════════════════════════════════════════
${report.clusters.slice(0, 10).map((cluster, index) => {
  const clusterText = `
┌─ CLUSTER ${(index + 1).toString().padStart(2, '0')}: ${cluster.main_keyword.toUpperCase()}
├─ Theme: ${cluster.theme}
├─ Monthly Search Volume: ${cluster.total_search_volume.toLocaleString()}
├─ Average CPC: $${cluster.avg_cpc.toFixed(2)}
├─ Difficulty Score: ${Math.round(cluster.avg_difficulty)}/100
├─ Commercial Score: ${cluster.total_commercial_score.toLocaleString()}
├─ Keywords in Cluster: ${cluster.keywords.length}
│
├─ TOP KEYWORDS:
${cluster.keywords.slice(0, 5).map(kw => 
  `│  • ${kw.keyword.padEnd(35)} │ ${kw.search_volume.toLocaleString().padStart(8)} searches │ $${kw.cpc.toFixed(2).padStart(5)} CPC`
).join('\n')}
│
${cluster.keywords.length > 5 ? `├─ COMPLETE KEYWORD LIST (${cluster.keywords.length} keywords):
${cluster.keywords.map((kw, i) => 
  `│  ${(i + 1).toString().padStart(2, '0')}. ${kw.keyword.padEnd(40)} │ Vol: ${kw.search_volume.toLocaleString().padStart(8)} │ CPC: $${kw.cpc.toFixed(2).padStart(5)} │ Diff: ${Math.round(kw.keyword_difficulty).toString().padStart(2)}/100`
).join('\n')}
│` : ''}
${cluster.competitor_domains.length > 0 ? `├─ TOP COMPETITORS:
${cluster.competitor_domains.slice(0, 5).map(domain => `│  • ${domain}`).join('\n')}
│` : ''}
${cluster.ai_competitors && cluster.ai_competitors.length > 0 ? `├─ AI-IDENTIFIED COMPETITORS:
${cluster.ai_competitors.slice(0, 5).map(domain => `│  • ${domain}`).join('\n')}
│` : ''}
└─────────────────────────────────────────────────────────────────────────────`;
  return clusterText;
}).join('\n\n')}

🏆 MAIN COMPETITORS (Combined Analysis)
═══════════════════════════════════════════════════════════════════════════════
${report.competitors.length > 0 ? 
  `Total Competitors Identified: ${report.competitors.length}

${report.competitors.slice(0, 20).map((domain, i) => 
  `${(i + 1).toString().padStart(2, '0')}. ${domain}`
).join('\n')}

┌─ COMPETITOR SOURCE BREAKDOWN:
│
├─ 🤖 AI RESEARCH RESULTS:
${report.clusters.filter(c => c.ai_competitors && c.ai_competitors.length > 0).map(cluster => 
  `│  • ${cluster.main_keyword}: ${cluster.ai_competitors!.slice(0, 3).join(', ')}`
).join('\n')}
│
├─ 📊 SERP ANALYSIS RESULTS:
${report.clusters.filter(c => c.competitor_domains && c.competitor_domains.length > 0).map(cluster => 
  `│  • ${cluster.main_keyword}: ${cluster.competitor_domains.slice(0, 3).join(', ')}`
).join('\n')}
│
└─────────────────────────────────────────────────────────────────────────────` : 
  'No major competitors identified in analyzed keywords.'
}

📝 ACTION PLAN (Strategic Recommendations)
═══════════════════════════════════════════════════════════════════════════════

🚀 IMMEDIATE ACTIONS (1-2 weeks)
────────────────────────────────────────────────────────────────────────────
✓ Target quick win keywords with low competition (difficulty < 40)
✓ Create targeted landing pages for main keyword clusters
✓ Analyze competitor content strategies for top domains
✓ Optimize existing pages for high-volume, low-competition keywords
✓ Set up keyword tracking for priority clusters

📈 MEDIUM-TERM GOALS (1-3 months)
────────────────────────────────────────────────────────────────────────────
○ Build comprehensive content for high-value clusters
○ Develop internal linking strategy between related keywords
○ Start building backlinks to target pages
○ Create content hubs around main themes
○ Implement schema markup for better SERP visibility

🎯 LONG-TERM STRATEGY (6-12 months)
────────────────────────────────────────────────────────────────────────────
◐ Build domain authority through high-quality content
◐ Target high-difficulty, high-value keywords
◐ Expand into related keyword opportunities
◐ Develop comprehensive competitor analysis and positioning
◐ Scale content production for semantic keyword coverage

🔍 RAW ANALYSIS DATA (Technical Details)
═══════════════════════════════════════════════════════════════════════════════

📊 ANALYSIS SUMMARY (JSON):
${JSON.stringify(report.analysis_summary, null, 2)}

🎯 COMPLETE CLUSTER ANALYSIS (${report.clusters.length} clusters):
${report.clusters.map((cluster, index) => `
┌─ CLUSTER ${index + 1} DETAILED DATA:
├─ Main Keyword: ${cluster.main_keyword}
├─ Theme: ${cluster.theme}
├─ Total Search Volume: ${cluster.total_search_volume.toLocaleString()}
├─ Average CPC: $${cluster.avg_cpc.toFixed(2)}
├─ Average Difficulty: ${Math.round(cluster.avg_difficulty)}/100
├─ Commercial Score: ${cluster.total_commercial_score.toLocaleString()}
├─ Keywords Count: ${cluster.keywords.length}
├─ Competitor Domains: ${cluster.competitor_domains.length}
├─ AI Competitors: ${cluster.ai_competitors ? cluster.ai_competitors.length : 0}
│
├─ ALL KEYWORDS IN CLUSTER:
${cluster.keywords.map((kw, i) => 
  `│  ${(i + 1).toString().padStart(2, '0')}. ${kw.keyword.padEnd(45)} │ Vol: ${kw.search_volume.toLocaleString().padStart(8)} │ CPC: $${kw.cpc.toFixed(2).padStart(5)} │ Comp: ${(kw.competition * 100).toFixed(0).padStart(2)}% │ Diff: ${Math.round(kw.keyword_difficulty).toString().padStart(2)}/100 │ SERP: ${kw.serp_urls.length}`
).join('\n')}
│
${cluster.competitor_domains.length > 0 ? `├─ COMPETITOR DOMAINS (${cluster.competitor_domains.length}):
${cluster.competitor_domains.map(domain => `│  • ${domain}`).join('\n')}
│` : ''}
${cluster.ai_competitors && cluster.ai_competitors.length > 0 ? `├─ AI COMPETITORS (${cluster.ai_competitors.length}):
${cluster.ai_competitors.map(domain => `│  • ${domain}`).join('\n')}
│` : ''}
└─────────────────────────────────────────────────────────────────────────────`
).join('\n\n')}

═══════════════════════════════════════════════════════════════════════════════
📁 REPORT GENERATION COMPLETE
═══════════════════════════════════════════════════════════════════════════════
Analysis completed: ${analysisDate}
Report contains: ${report.analysis_summary.total_keywords_analyzed.toLocaleString()} keywords across ${report.analysis_summary.clusters_identified} clusters
Estimated analysis cost: ~$0.53-1.03 (Firecrawl + Perplexity + DataForSEO)
Next steps: Review action plan and begin implementation with quick wins

For detailed technical data and further analysis, refer to the JSON report file.
═══════════════════════════════════════════════════════════════════════════════
`.trim();
  }

  // Generate report
  generateReport(url: string, businessType: string, clusters: KeywordCluster[]): AnalysisReport {
    const totalSearchVolume = clusters.reduce((sum, c) => sum + c.total_search_volume, 0);
    const avgCPC = clusters.reduce((sum, c) => sum + c.avg_cpc, 0) / clusters.length;
    const estimatedTraffic = Math.round(totalSearchVolume * 0.3);
    
    const serpCompetitors = [...new Set(clusters.flatMap(c => c.competitor_domains))].filter(d => d && d.length > 0);
    const aiCompetitors = [...new Set(clusters.flatMap(c => c.ai_competitors || []))].filter(d => d && d.length > 0);
    const allCompetitors = [...new Set([...serpCompetitors, ...aiCompetitors])];

    return {
      analysis_summary: {
        source_website: url,
        business_type: businessType,
        analysis_date: new Date().toISOString(),
        total_keywords_analyzed: clusters.reduce((sum, c) => sum + c.keywords.length, 0),
        clusters_identified: clusters.length,
        total_monthly_search_volume: totalSearchVolume,
        estimated_monthly_traffic_potential: estimatedTraffic,
        avg_cpc: avgCPC
      },
      clusters: clusters,
      quick_wins: clusters.filter(c => !isNaN(c.avg_difficulty) && c.avg_difficulty > 0 && c.avg_difficulty < 40).slice(0, 8),
      high_value: clusters.filter(c => !isNaN(c.total_commercial_score) && c.total_commercial_score > 1000).slice(0, 8),
      competitors: allCompetitors.slice(0, 15)
    };
  }

  async saveReportToFile(report: AnalysisReport, websiteUrl: string, businessType: string): Promise<{ jsonFilePath: string | null, textFilePath: string | null, textReport: string, saveError?: string }> {
    const textReport = this.generateTextReport(report);
    
    try {
      // Create reports directory if it doesn't exist
      const reportsDir = path.join(process.cwd(), 'reports');
      
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      // Extract domain name from URL for filename
      const domain = this.extractDomain(websiteUrl);
      const cleanDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '_'); // Clean domain for filename
      
      // Create date-stamped filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
      const baseFilename = `${cleanDomain}_${dateStr}_${timeStr}`;
      
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
      const textFilePath = path.join(reportsDir, `${baseFilename}_formatted.txt`);
      fs.writeFileSync(textFilePath, textReport, 'utf8');

      return { jsonFilePath, textFilePath, textReport };
    } catch (error) {
      // Failed to save files - continue without saving
      return { 
        jsonFilePath: null, 
        textFilePath: null, 
        textReport,
        saveError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async performAnalysis(
    websiteUrl: string,
    businessType: string,
    firecrawlKey: string,
    perplexityKey: string,
    dataforSeoUsername: string,
    dataforSeoPassword: string
  ): Promise<AnalysisReport> {
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
    const websiteData = await this.scrapeWebsite(cleanUrl, firecrawlKey);
    
    // Step 2: Generate keywords
    const seedKeywords = await this.generateKeywords(cleanUrl, websiteData, businessType, perplexityKey);
    
    // Step 3: Get keyword data (parallel API calls)
    const [keywordMetrics, relatedKeywords, serpData] = await Promise.all([
      this.getKeywordMetrics(seedKeywords, dataforSeoUsername, dataforSeoPassword),
      this.getRelatedKeywords(seedKeywords, dataforSeoUsername, dataforSeoPassword),
      this.getSerpData(seedKeywords, dataforSeoUsername, dataforSeoPassword)
    ]);
    
    // Step 4: Analyze and cluster
    const clusters = await this.analyzeAndCluster(keywordMetrics, relatedKeywords, serpData, businessType);
    
    // Step 5: Research competitors using AI
    const enhancedClusters = await this.researchCompetitors(clusters, businessType, perplexityKey);
    
    // Step 6: Generate report
    const report = this.generateReport(cleanUrl, businessType, enhancedClusters);
    
    return report;
  }
}

const server = new Server(
  {
    name: 'keyword-research-tool',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const keywordTool = new KeywordResearchTool();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_website',
        description: 'Perform comprehensive SEO keyword research and analysis for a website. Generates detailed reports with keyword clusters, competitor analysis, and actionable insights.',
        inputSchema: {
          type: 'object',
          properties: {
            website_url: {
              type: 'string',
              description: 'The website URL to analyze (e.g., https://example.com)',
            },
            business_type: {
              type: 'string',
              enum: ['E-commerce', 'SaaS', 'Service Business', 'Blog/Content', 'Education', 'Other'],
              description: 'The type of business for targeted keyword analysis',
            },
          },
          required: [
            'website_url',
            'business_type',
          ],
        },
      } as Tool,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_website') {
    try {
      const {
        website_url,
        business_type,
      } = args as unknown as AnalysisArgs;

      // Read API keys from environment variables (set by DXT runtime)
      const firecrawl_api_key = process.env.FIRECRAWL_API_KEY;
      const perplexity_api_key = process.env.PERPLEXITY_API_KEY;
      const dataforseo_username = process.env.DATAFORSEO_USERNAME;
      const dataforseo_password = process.env.DATAFORSEO_PASSWORD;

      // Validate all required parameters and environment variables
      if (!website_url || !business_type) {
        throw new Error('website_url and business_type are required parameters.');
      }

      if (!firecrawl_api_key || !perplexity_api_key || !dataforseo_username || !dataforseo_password) {
        throw new Error('API keys are not configured. Please ensure all required API keys are set in the extension configuration: FIRECRAWL_API_KEY, PERPLEXITY_API_KEY, DATAFORSEO_USERNAME, and DATAFORSEO_PASSWORD.');
      }

      const report = await keywordTool.performAnalysis(
        website_url,
        business_type,
        firecrawl_api_key,
        perplexity_api_key,
        dataforseo_username,
        dataforseo_password
      );

      const { jsonFilePath, textFilePath, textReport, saveError } = await keywordTool.saveReportToFile(
        report, 
        website_url, 
        business_type
      );

      // Create a comprehensive response with all analysis data
      const responseData = {
        success: true,
        analysis_completed: true,
        metadata: {
          website_url: website_url,
          business_type: business_type,
          analysis_date: report.analysis_summary.analysis_date,
          tool_version: "1.0.0"
        },
        analysis_summary: {
          source_website: report.analysis_summary.source_website,
          business_type: report.analysis_summary.business_type,
          analysis_date: report.analysis_summary.analysis_date,
          total_keywords_analyzed: report.analysis_summary.total_keywords_analyzed,
          clusters_identified: report.analysis_summary.clusters_identified,
          total_monthly_search_volume: report.analysis_summary.total_monthly_search_volume,
          estimated_monthly_traffic_potential: report.analysis_summary.estimated_monthly_traffic_potential,
          average_cpc: Number(report.analysis_summary.avg_cpc.toFixed(2))
        },
        quick_wins: report.quick_wins.map(cluster => ({
          cluster_id: cluster.cluster_id,
          main_keyword: cluster.main_keyword,
          theme: cluster.theme,
          total_search_volume: cluster.total_search_volume,
          avg_cpc: Number(cluster.avg_cpc.toFixed(2)),
          avg_difficulty: Math.round(cluster.avg_difficulty),
          total_commercial_score: cluster.total_commercial_score,
          keywords_count: cluster.keywords.length,
          top_keywords: cluster.keywords.slice(0, 5).map(kw => ({
            keyword: kw.keyword,
            search_volume: kw.search_volume,
            cpc: Number(kw.cpc.toFixed(2)),
            difficulty: Math.round(kw.keyword_difficulty)
          })),
          competitor_domains: cluster.competitor_domains,
          ai_competitors: cluster.ai_competitors || []
        })),
        high_value_opportunities: report.high_value.map(cluster => ({
          cluster_id: cluster.cluster_id,
          main_keyword: cluster.main_keyword,
          theme: cluster.theme,
          total_search_volume: cluster.total_search_volume,
          avg_cpc: Number(cluster.avg_cpc.toFixed(2)),
          avg_difficulty: Math.round(cluster.avg_difficulty),
          total_commercial_score: cluster.total_commercial_score,
          keywords_count: cluster.keywords.length,
          top_keywords: cluster.keywords.slice(0, 5).map(kw => ({
            keyword: kw.keyword,
            search_volume: kw.search_volume,
            cpc: Number(kw.cpc.toFixed(2)),
            commercial_score: kw.commercial_score
          })),
          competitor_domains: cluster.competitor_domains,
          ai_competitors: cluster.ai_competitors || []
        })),
        keyword_clusters: report.clusters.map(cluster => ({
          cluster_id: cluster.cluster_id,
          main_keyword: cluster.main_keyword,
          theme: cluster.theme,
          total_search_volume: cluster.total_search_volume,
          avg_cpc: Number(cluster.avg_cpc.toFixed(2)),
          avg_difficulty: Math.round(cluster.avg_difficulty),
          total_commercial_score: cluster.total_commercial_score,
          keywords_count: cluster.keywords.length,
          keywords: cluster.keywords.map(kw => ({
            keyword: kw.keyword,
            search_volume: kw.search_volume,
            cpc: Number(kw.cpc.toFixed(2)),
            competition: Number((kw.competition * 100).toFixed(0)),
            competition_level: kw.competition_level,
            keyword_difficulty: Math.round(kw.keyword_difficulty),
            commercial_score: kw.commercial_score,
            is_seed: kw.is_seed,
            serp_urls: kw.serp_urls.map(url => ({
              url: url.url,
              title: url.title,
              domain: url.domain,
              position: url.position
            }))
          })),
          competitor_domains: cluster.competitor_domains,
          ai_competitors: cluster.ai_competitors || []
        })),
        competitors: {
          all_competitors: report.competitors,
          total_count: report.competitors.length,
          serp_competitors: [...new Set(report.clusters.flatMap(c => c.competitor_domains))].filter(d => d && d.length > 0),
          ai_competitors: [...new Set(report.clusters.flatMap(c => c.ai_competitors || []))].filter(d => d && d.length > 0),
          by_cluster: report.clusters.map(cluster => ({
            cluster: cluster.main_keyword,
            serp_competitors: cluster.competitor_domains,
            ai_competitors: cluster.ai_competitors || []
          })).filter(c => c.serp_competitors.length > 0 || c.ai_competitors.length > 0)
        },
        action_plan: {
          immediate_actions: [
            "Target quick win keywords with low competition (difficulty < 40)",
            "Create targeted landing pages for main keyword clusters",
            "Analyze competitor content strategies for top domains",
            "Optimize existing pages for high-volume, low-competition keywords",
            "Set up keyword tracking for priority clusters"
          ],
          medium_term_goals: [
            "Build comprehensive content for high-value clusters",
            "Develop internal linking strategy between related keywords",
            "Start building backlinks to target pages",
            "Create content hubs around main themes",
            "Implement schema markup for better SERP visibility"
          ],
          long_term_strategy: [
            "Build domain authority through high-quality content",
            "Target high-difficulty, high-value keywords",
            "Expand into related keyword opportunities",
            "Develop comprehensive competitor analysis and positioning",
            "Scale content production for semantic keyword coverage"
          ]
        },
        performance_metrics: {
          quick_wins_available: report.quick_wins.length,
          high_value_opportunities: report.high_value.length,
          total_potential_traffic: report.analysis_summary.estimated_monthly_traffic_potential,
          average_cpc_across_all: Number(report.analysis_summary.avg_cpc.toFixed(2)),
          total_commercial_value: report.clusters.reduce((sum, c) => sum + c.total_commercial_score, 0)
        },
        files: {
          json_report_path: jsonFilePath || null,
          text_report_path: textFilePath || null,
          files_saved: !!(jsonFilePath && textFilePath),
          save_error: saveError || null
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Analysis Failed:** ${error instanceof Error ? error.message : String(error)}

Please check:
- All API keys are correct and valid
- Website URL is accessible 
- You have sufficient API credits
- Network connectivity

**Expected API Costs per analysis:**
- **Firecrawl**: ~$0.01 per website scrape
- **Perplexity**: ~$0.02 per keyword generation
- **DataForSEO**: ~$0.50-1.00 per analysis

**Total per analysis: ~$0.53-1.03**`,
          },
        ],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
