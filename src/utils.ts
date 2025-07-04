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

export interface SummaryCard {
  title: string;
  value: string;
  description: string;
}

export interface ActionStep {
  title: string;
  description: string;
  category: 'Quick Wins' | 'High Value' | 'Content' | 'Competitors';
}

export interface AnalysisReport {
  summaryCards: SummaryCard[];
  quickWins: KeywordCluster[];
  highValueTargets: KeywordCluster[];
  topKeywordClusters: KeywordCluster[];
  mainCompetitors: { domain: string; frequency: number }[];
  actionPlan: ActionStep[];
  rawData: KeywordCluster[];
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
  console.error(`[DEBUG-COMMERCIAL] Function called with:`, JSON.stringify(keywordData));
  console.error(`[DEBUG-COMMERCIAL] Business type:`, businessType);
  
  const volume = keywordData.search_volume || 100;
  const cpc = keywordData.cpc || 0.5;
  const competition = keywordData.competition || 0.3;
  const keyword = (keywordData.keyword || '').toLowerCase();
  
  console.error(`[DEBUG-COMMERCIAL] Extracted values - Volume: ${volume}, CPC: ${cpc}, Competition: ${competition}, Keyword: ${keyword}`);
  
  let multiplier = 1;
  if (keyword.includes('buy') || keyword.includes('purchase')) multiplier = 2.5;
  else if (keyword.includes('best') || keyword.includes('review')) multiplier = 2;
  else if (keyword.includes('price') || keyword.includes('cost')) multiplier = 1.8;
  else if (keyword.includes('how to')) multiplier = 0.8;
  
  console.error(`[DEBUG-COMMERCIAL] Multiplier: ${multiplier}`);
  
  const calculation = volume * Math.max(0.1, cpc) * multiplier * (1 + competition);
  const result = Math.max(10, Math.round(calculation));
  
  console.error(`[DEBUG-COMMERCIAL] Calculation: ${volume} * ${Math.max(0.1, cpc)} * ${multiplier} * ${1 + competition} = ${calculation}`);
  console.error(`[DEBUG-COMMERCIAL] Final result: ${result}`);
  
  return result;
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
  
  // Sort keywords by commercial score for better cluster formation
  keywords.sort((a, b) => (b.commercial_score || 0) - (a.commercial_score || 0));
  
  keywords.forEach(keyword => {
    if (processed.has(keyword.keyword)) return;
    
    // Find related keywords for this cluster
    const relatedKeywords = [keyword];
    const keywordWords = keyword.keyword.toLowerCase().split(' ');
    const mainTerm = findMainTerm(keyword.keyword);
    
    // Look for similar keywords to group together
    keywords.forEach(otherKeyword => {
      if (processed.has(otherKeyword.keyword) || otherKeyword.keyword === keyword.keyword) return;
      
      const similarity = calculateKeywordSimilarity(keyword.keyword, otherKeyword.keyword);
      const hasMainTerm = otherKeyword.keyword.toLowerCase().includes(mainTerm);
      
      // Group keywords that are similar or contain the main term
      if (similarity > 0.3 || hasMainTerm) {
        relatedKeywords.push(otherKeyword);
        processed.add(otherKeyword.keyword);
      }
    });
    
    // Create cluster with all related keywords
    const totalVolume = relatedKeywords.reduce((sum, kw) => sum + kw.search_volume, 0);
    const avgCpc = relatedKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / relatedKeywords.length;
    const avgDifficulty = relatedKeywords.reduce((sum, kw) => sum + kw.keyword_difficulty, 0) / relatedKeywords.length;
    const totalCommercialScore = relatedKeywords.reduce((sum, kw) => sum + (kw.commercial_score || 0), 0);
    
    // Collect competitor domains from all keywords in cluster
    const allCompetitorDomains = relatedKeywords.flatMap(kw => kw.serp_urls.map(u => u.domain).filter(d => d));
    const uniqueCompetitors = [...new Set(allCompetitorDomains)];
    
    const cluster: KeywordCluster = {
      cluster_id: clusters.length + 1,
      main_keyword: keyword.keyword,
      theme: identifyTheme(keyword.keyword),
      keywords: relatedKeywords,
      total_search_volume: totalVolume,
      avg_cpc: avgCpc,
      avg_difficulty: avgDifficulty,
      total_commercial_score: totalCommercialScore,
      competitor_domains: uniqueCompetitors
    };
    
    processed.add(keyword.keyword);
    clusters.push(cluster);
  });
  
  return clusters.sort((a, b) => b.total_commercial_score - a.total_commercial_score);
}

// Helper function to find the main term in a keyword
function findMainTerm(keyword: string): string {
  const words = keyword.toLowerCase().split(' ');
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'best', 'top', 'how', 'what', 'when', 'where', 'why'];
  
  // Find the longest non-stop word
  const contentWords = words.filter(word => !stopWords.includes(word) && word.length > 2);
  return contentWords.sort((a, b) => b.length - a.length)[0] || words[0] || '';
}

// Helper function to calculate similarity between keywords
function calculateKeywordSimilarity(keyword1: string, keyword2: string): number {
  const words1 = new Set(keyword1.toLowerCase().split(' '));
  const words2 = new Set(keyword2.toLowerCase().split(' '));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
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

// Helper to generate action plan
function generateActionPlan(clusters: KeywordCluster[], quickWins: KeywordCluster[], highValue: KeywordCluster[], competitors: { domain: string; frequency: number }[]): ActionStep[] {
    const plan: ActionStep[] = [];

    if (quickWins.length > 0) {
        plan.push({
            title: `Target "Quick Win" Keywords`,
            description: `Focus on creating content for low-competition keywords like "${quickWins[0].main_keyword}" to see faster ranking improvements. These are often easier to rank for and can bring initial traffic.`,
            category: 'Quick Wins'
        });
    }

    if (highValue.length > 0) {
        plan.push({
            title: `Pursue High-Value Targets`,
            description: `Develop in-depth, high-quality content for valuable keywords like "${highValue[0].main_keyword}". These may be more competitive but offer significant returns.`,
            category: 'High Value'
        });
    }

    if (clusters.length > 0) {
        plan.push({
            title: `Build Thematic Authority`,
            description: `Create comprehensive content around your primary keyword clusters, starting with the "${clusters[0].theme}" theme, to establish expertise and improve rankings across a group of related terms.`,
            category: 'Content'
        });
    }

    if (competitors.length > 0) {
        plan.push({
            title: `Analyze Top Competitors`,
            description: `Investigate the content strategies of competitors like ${competitors[0].domain}. Analyze their top-ranking pages for your target keywords to find gaps and opportunities.`,
            category: 'Competitors'
        });
    }

    return plan;
}

// Generate report
export function generateReport(url: string, businessType: string, clusters: KeywordCluster[]): AnalysisReport {
  const totalVolume = clusters.reduce((sum, c) => sum + c.total_search_volume, 0);
  const totalKeywords = clusters.reduce((sum, c) => sum + c.keywords.length, 0);
  const avgCPC = clusters.length > 0 ? clusters.reduce((sum, c) => sum + c.avg_cpc, 0) / clusters.length : 0;
  const avgDifficulty = clusters.length > 0 ? clusters.reduce((sum, c) => sum + c.avg_difficulty, 0) / clusters.length : 0;

  // Debug cluster filtering for Quick Wins and High-Value Targets
  console.error(`[DEBUG-FILTER] Analyzing ${clusters.length} clusters for Quick Wins and High-Value Targets:`);
  clusters.forEach((cluster, index) => {
    console.error(`[DEBUG-FILTER] Cluster ${index + 1}: "${cluster.main_keyword}"`);
    console.error(`[DEBUG-FILTER]   - avg_difficulty: ${cluster.avg_difficulty} (Quick Win threshold: < 40)`);
    console.error(`[DEBUG-FILTER]   - total_search_volume: ${cluster.total_search_volume} (Quick Win threshold: > 50)`);
    console.error(`[DEBUG-FILTER]   - total_commercial_score: ${cluster.total_commercial_score} (High Value threshold: > 1000)`);
    console.error(`[DEBUG-FILTER]   - Keywords count: ${cluster.keywords.length}`);
    console.error(`[DEBUG-FILTER]   - Sample commercial scores: ${cluster.keywords.slice(0, 3).map(k => `${k.keyword}:${k.commercial_score}`).join(', ')}`);
  });

  const quickWins = clusters.filter(c => c.avg_difficulty < 40 && c.total_search_volume > 50).sort((a,b) => b.total_commercial_score - a.total_commercial_score).slice(0, 5);
  console.error(`[DEBUG-FILTER] Quick Wins found: ${quickWins.length} clusters`);
  
  const highValueTargets = clusters.filter(c => c.total_commercial_score > 1000 && c.avg_difficulty < 65).sort((a,b) => b.total_commercial_score - a.total_commercial_score).slice(0, 5);
  console.error(`[DEBUG-FILTER] High-Value Targets found: ${highValueTargets.length} clusters`);

  const allCompetitorDomains = clusters.flatMap(c => c.competitor_domains);
  const domainCounts = allCompetitorDomains.reduce((acc, domain) => {
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mainCompetitors = Object.entries(domainCounts)
    .map(([domain, frequency]) => ({ domain, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const summaryCards: SummaryCard[] = [
    { title: 'Total Keywords', value: totalKeywords.toString(), description: 'Total number of relevant keywords analyzed.' },
    { title: 'Total Search Volume', value: totalVolume.toLocaleString(), description: 'Estimated monthly searches for all keywords.' },
    { title: 'Average Difficulty', value: `${Math.round(avgDifficulty)}/100`, description: 'Estimated competition for ranking.' },
    { title: 'Top Competitor', value: mainCompetitors.length > 0 ? mainCompetitors[0].domain : 'N/A', description: 'Most frequently seen competing domain.' }
  ];
  
  const actionPlan = generateActionPlan(clusters, quickWins, highValueTargets, mainCompetitors);

  return {
    summaryCards,
    quickWins,
    highValueTargets,
    topKeywordClusters: clusters.slice(0, 25),
    mainCompetitors,
    actionPlan,
    rawData: clusters
  };
} 