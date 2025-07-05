# Keyword Research Tool MCP Server

An MCP (Model Context Protocol) server that provides comprehensive SEO keyword research and analysis capabilities. This server adapts the functionality from the original [boringmarketer/keyword-research-tool](https://github.com/boringmarketer/keyword-research-tool) into a single, powerful MCP tool.

## Features

🔍 **Comprehensive Analysis**
- Website content crawling and analysis using Firecrawl
- AI-powered seed keyword generation with Perplexity
- Search volume and competition data via DataForSEO
- Smart keyword clustering and competitor analysis
- Timestamped report generation

📊 **Detailed Reports**
- Keyword clusters with commercial intent scoring  
- Quick wins (low competition opportunities)
- High-value targets (commercial keywords)
- Competitor domain analysis with AI research
- Actionable SEO strategy recommendations
- Dual format: JSON (technical) + Text (human-readable)
- Professional text reports matching original HTML tool format

🎯 **Business-Focused**
- Auto-detects and optimizes for business type
- Commercial intent scoring for ROI focus
- Industry-specific keyword suggestions
- Professional report format

## Prerequisites

You'll need API keys from these services:

### Required APIs
1. **Firecrawl** (Website Scraping)
   - Sign up at: https://firecrawl.dev/
   - Format: `fc-xxxxxxxxxx`
   - Cost: ~$0.01 per website scrape

2. **Perplexity** (AI Keyword Generation)  
   - Sign up at: https://www.perplexity.ai/
   - Format: `pplx-xxxxxxxxxx`
   - Cost: ~$0.02 per keyword generation

3. **DataForSEO** (Keyword & SERP Data)
   - Sign up at: https://dataforseo.com/
   - Uses your login credentials (username/password)
   - Cost: ~$0.50-1.00 per analysis

**Total estimated cost per analysis: ~$0.53-1.03**

## Installation

1. **Clone and install dependencies:**
```bash
git clone <this-repo>
cd keyword-research-tool-mcp
npm install
npm run build
```

2. **Add to your MCP client configuration** (e.g., in Claude Desktop's config):
```json
{
  "mcpServers": {
    "keyword-research-tool": {
      "command": "node",
      "args": ["/path/to/keyword-research-tool-mcp/dist/index.js"]
    }
  }
}
```

## Usage

The server provides one comprehensive tool:

### `analyze_website`

Performs complete SEO keyword research and analysis for any website.

**Parameters:**
- `website_url` (string): Website URL to analyze (e.g., "https://example.com")
- `business_type` (enum): Business type for targeted analysis
  - Options: "E-commerce", "SaaS", "Service Business", "Blog/Content", "Education", "Other"
- `firecrawl_api_key` (string): Firecrawl API key (format: fc-xxxxxxxxxx)
- `perplexity_api_key` (string): Perplexity API key (format: pplx-xxxxxxxxxx) 
- `dataforseo_username` (string): DataForSEO username (your email)
- `dataforseo_password` (string): DataForSEO password

**Example Usage:**
```
analyze_website({
  "website_url": "https://example.com",
  "business_type": "SaaS", 
  "firecrawl_api_key": "fc-your-key-here",
  "perplexity_api_key": "pplx-your-key-here",
  "dataforseo_username": "your@email.com",
  "dataforseo_password": "your_password"
})
```

## Output

The analysis generates:

### Console Output
- **Analysis Summary**: Total keywords, search volume, traffic potential
- **Quick Wins**: Low competition opportunities for immediate targeting
- **High-Value Targets**: Keywords with highest commercial potential  
- **Top Keyword Clusters**: Organized keyword groups with metrics
- **Main Competitors**: Competing domains identified
- **Report Location**: Path to detailed JSON report

### Saved Reports
Timestamped reports are automatically saved to `reports/` directory in two formats:

**JSON Report** (`keyword-research-YYYY-MM-DD_HH-MM-SS.json`):
- Complete analysis data for technical use
- All keyword metrics and search volumes
- Competitor domains and SERP analysis  
- Commercial intent scores
- Clustering analysis
- Raw API response data

**Text Report** (`keyword-research-YYYY-MM-DD_HH-MM-SS.txt`):
- Comprehensive formatted report matching the original HTML tool
- Executive summary with key metrics
- Quick wins section (low competition opportunities)
- High-value targets (commercial keywords)
- Detailed keyword clusters with complete breakdowns
- Competitor analysis with AI and SERP sources
- Strategic action plan (immediate, medium-term, long-term)
- Raw analysis data section
- Professional formatting with ASCII art borders

## Analysis Process

The tool follows the same comprehensive process as the original app.js:

1. **Website Scraping**: Extract content using Firecrawl API
2. **Content Cleaning**: Filter technical terms, focus on business-relevant content  
3. **Keyword Generation**: AI-powered seed keyword creation with Perplexity
4. **Keyword Enhancement**: Get search volumes, competition data via DataForSEO
5. **SERP Analysis**: Analyze top-ranking pages and competitor domains
6. **Clustering**: Group related keywords into themed clusters
7. **Scoring**: Calculate commercial intent and difficulty scores
8. **Report Generation**: Create comprehensive analysis report

## Code Structure

The MCP server is built by adapting the original `app.js` functions:

```
src/index.ts
├── KeywordResearchTool class
│   ├── scrapeWebsite()          # Website content extraction
│   ├── cleanWebsiteContent()    # Content filtering and cleaning  
│   ├── generateKeywords()       # AI keyword generation
│   ├── filterTechnicalKeywords() # Remove irrelevant terms
│   └── performAnalysis()        # Main orchestration function
├── MCP Server setup
│   ├── Tool definition (analyze_website)
│   ├── Request handlers
│   └── Response formatting
└── Report generation and file saving
```

## Key Adaptations from Original

- **Single Tool**: Condensed the multi-step web UI into one comprehensive MCP tool
- **Simplified Flow**: Removed UI progress indicators, kept core analysis logic
- **Enhanced Output**: Structured markdown output plus detailed JSON reports
- **Type Safety**: Full TypeScript implementation with proper interfaces
- **Error Handling**: Comprehensive error messages and validation
- **Report Persistence**: Automatic timestamped report saving

## Development

**Build the project:**
```bash
npm run build
```

**Run in development mode:**
```bash
npm run dev
```

**Start the server:**
```bash
npm start
```

## Troubleshooting

### Common Issues

**"Analysis failed" errors:**
- Verify all API keys are correct and active
- Check API credit balances
- Ensure website URL is accessible
- Test individual API endpoints

**"Failed to scrape website":**
- Check if website blocks crawlers/bots
- Try with different website URL  
- Verify Firecrawl API key format and permissions

**DataForSEO errors:**
- Confirm username/password are correct
- Check account has sufficient credits
- Some keywords may have limited data available

### API Documentation
- **Firecrawl**: https://docs.firecrawl.dev/
- **Perplexity**: https://docs.perplexity.ai/
- **DataForSEO**: https://docs.dataforseo.com/

## License

MIT License - Feel free to use and modify for your SEO research needs.

---

**Built for marketers and SEO professionals who want comprehensive keyword research integrated into their AI workflows.**
