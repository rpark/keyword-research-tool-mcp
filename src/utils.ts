// Essential types
export interface KeywordData {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  competition_level: string;
  keyword_difficulty: number;
  serp_urls: Array<{ url: string; title: string; domain: string; position: number; }>;
  commercial_score: number;
  is_seed: boolean;
}

export interface KeywordCluster {
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

export interface AnalysisReport {
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

// Content cleaning function
export function cleanWebsiteContent(content: string, businessType: string): string {
  if (!content) return '';
  
  const technicalTerms = ['json', 'api', 'javascript', 'html', 'css', 'code', 'function', 'github', 'npm'];
  const sentences = content.split(/[.!?]+/).filter(sentence => {
    const lower = sentence.toLowerCase();
    const techCount = technicalTerms.filter(term => lower.includes(term)).length;
    return techCount <= 2 && sentence.trim().length >= 20 && !lower.includes('{') && !lower.includes('```');
  });
  
  const businessKeywords: Record<string, string[]> = {
    'E-commerce': ['product', 'shop', 'buy', 'sell', 'store', 'customer'],
    'SaaS': ['software', 'solution', 'platform', 'tool', 'service', 'feature'],
    'Service Business': ['service', 'help', 'support', 'expert', 'professional'],
    'Blog/Content': ['article', 'guide', 'tips', 'learn', 'tutorial'],
    'Education': ['course', 'learn', 'training', 'education', 'student']
  };
  
  const keywords = businessKeywords[businessType] || [];
  return sentences
    .sort((a, b) => keywords.filter(k => b.toLowerCase().includes(k)).length - keywords.filter(k => a.toLowerCase().includes(k)).length)
    .slice(0, 10)
    .join('. ');
}

// Filter technical keywords
export function filterTechnicalKeywords(keywords: string[]): string[] {
  const techTerms = ['json', 'api', 'javascript', 'html', 'css', 'code', 'github', 'npm', 'react'];
  return keywords.filter(kw => {
    const lower = kw.toLowerCase();
    return !techTerms.some(term => lower.includes(term)) && 
           !/[{}[\]<>()=+\-*/\\|&^%$#@!~`]/.test(kw) && 
           kw.length > 2;
  });
}

// Calculate commercial score
export function calculateCommercialScore(keywordData: any, businessType: string): number {
  const volume = keywordData.search_volume || 100;
  const cpc = keywordData.cpc || 0.5;
  const competition = keywordData.competition || 0.3;
  const keyword = (keywordData.keyword || '').toLowerCase();
  
  let multiplier = 1;
  if (keyword.includes('buy') || keyword.includes('purchase')) multiplier = 2.5;
  else if (keyword.includes('best') || keyword.includes('review')) multiplier = 2;
  else if (keyword.includes('price') || keyword.includes('cost')) multiplier = 1.8;
  else if (keyword.includes('how to')) multiplier = 0.8;
  
  return Math.max(10, Math.round(volume * Math.max(0.1, cpc) * multiplier * (1 + competition)));
}

// Extract domain from URL
export function extractDomain(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    const parts = url.split('/');
    return parts.length >= 3 ? parts[2].replace('www.', '') : '';
  }
}

// Calculate difficulty
export function calculateDifficulty(organicResults: any[]): number {
  if (!organicResults?.length) return 0;
  
  const highAuthority = ['wikipedia.org', 'amazon.com', 'youtube.com', 'linkedin.com'];
  let difficulty = 0;
  
  organicResults.slice(0, 10).forEach((result, index) => {
    const domain = extractDomain(result.url);
    const weight = (10 - index) / 10;
    const score = highAuthority.some(d => domain.includes(d)) ? 35 : 15;
    difficulty += score * weight;
  });
  
  return Math.min(100, Math.round(difficulty));
}

// Estimate difficulty from metrics
export function estimateDifficultyFromMetrics(data: any): number {
  const level = data.competition_level?.toUpperCase();
  let difficulty = level === 'HIGH' ? 70 : level === 'MEDIUM' ? 45 : 25;
  
  if (data.search_volume > 100000) difficulty += 15;
  else if (data.search_volume > 10000) difficulty += 10;
  
  if (data.cpc > 5) difficulty += 10;
  else if (data.cpc > 2) difficulty += 5;
  
  return Math.min(100, Math.max(15, difficulty));
}

// Create clusters
export function createClusters(keywords: KeywordData[]): KeywordCluster[] {
  const clusters: KeywordCluster[] = [];
  const processed = new Set<string>();
  
  keywords.sort((a, b) => b.commercial_score - a.commercial_score).forEach(keyword => {
    if (processed.has(keyword.keyword)) return;
    
    const cluster: KeywordCluster = {
      cluster_id: clusters.length + 1,
      main_keyword: keyword.keyword,
      theme: identifyTheme(keyword.keyword),
      keywords: [keyword],
      total_search_volume: keyword.search_volume,
      avg_cpc: keyword.cpc,
      avg_difficulty: keyword.keyword_difficulty,
      total_commercial_score: keyword.commercial_score,
      competitor_domains: [...new Set(keyword.serp_urls.map(u => u.domain).filter(d => d))]
    };
    
    processed.add(keyword.keyword);
    clusters.push(cluster);
  });
  
  return clusters.slice(0, 15);
}

// Identify theme
export function identifyTheme(keyword: string): string {
  const kw = keyword.toLowerCase();
  if (kw.includes('buy') || kw.includes('purchase')) return '💰 Purchase Intent';
  if (kw.includes('best') || kw.includes('review')) return '🔍 Research & Comparison';
  if (kw.includes('how to') || kw.includes('guide')) return '📚 Educational';
  if (kw.includes('price') || kw.includes('cost')) return '💲 Price Research';
  return '🎯 General';
}

// Generate report
export function generateReport(url: string, businessType: string, clusters: KeywordCluster[]): AnalysisReport {
  const totalVolume = clusters.reduce((sum, c) => sum + c.total_search_volume, 0);
  const avgCPC = clusters.reduce((sum, c) => sum + c.avg_cpc, 0) / clusters.length;
  
  const allCompetitors = [...new Set(clusters.flatMap(c => 
    [...c.competitor_domains, ...(c.ai_competitors || [])]
  ))].filter(d => d);

  return {
    analysis_summary: {
      source_website: url,
      business_type: businessType,
      analysis_date: new Date().toISOString(),
      total_keywords_analyzed: clusters.reduce((sum, c) => sum + c.keywords.length, 0),
      clusters_identified: clusters.length,
      total_monthly_search_volume: totalVolume,
      estimated_monthly_traffic_potential: Math.round(totalVolume * 0.3),
      avg_cpc: avgCPC
    },
    clusters,
    quick_wins: clusters.filter(c => c.avg_difficulty < 40).slice(0, 8),
    high_value: clusters.filter(c => c.total_commercial_score > 1000).slice(0, 8),
    competitors: allCompetitors.slice(0, 15)
  };
} 