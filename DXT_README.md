# SEO Keyword Research - Claude Desktop Extension

A comprehensive SEO keyword research and analysis tool for Claude Desktop, packaged as a Desktop Extension (DXT).

## Features

- **Website Content Analysis**: Automatically scrapes and analyzes website content
- **AI-Powered Keyword Generation**: Uses Perplexity AI to generate relevant keywords
- **SERP Data Analysis**: Retrieves search volume, CPC, and competition data
- **Keyword Clustering**: Groups related keywords into themed clusters
- **Competitor Analysis**: Identifies competing domains and strategies
- **Actionable Insights**: Provides quick wins and high-value opportunities
- **Detailed Reports**: Generates comprehensive JSON and text reports

## Installation

1. Download the `.dxt` file from the releases
2. Open Claude Desktop
3. Go to Extensions → Install Extension
4. Select the downloaded `.dxt` file
5. Configure your API keys in the extension settings

## API Key Requirements

This extension requires API keys from the following services:

### Required APIs

1. **Firecrawl API** (Website Scraping)
   - Sign up at: https://firecrawl.dev
   - Format: `fc-xxxxxxxxxx`
   - Cost: ~$0.01 per website scrape

2. **Perplexity API** (AI Keyword Generation)
   - Sign up at: https://www.perplexity.ai/settings/api
   - Format: `pplx-xxxxxxxxxx`
   - Cost: ~$0.02 per keyword generation

3. **DataForSEO API** (Keyword Metrics & SERP Data)
   - Sign up at: https://dataforseo.com
   - Requires username (email) and password
   - Cost: ~$0.50-1.00 per analysis

**Total estimated cost per analysis: $0.53-1.03**

## Configuration

When you install the extension, Claude Desktop will prompt you to configure:

- **Firecrawl API Key**: Your Firecrawl API key
- **Perplexity API Key**: Your Perplexity API key  
- **DataForSEO Username**: Your DataForSEO email address
- **DataForSEO Password**: Your DataForSEO password

All API keys are stored securely in your OS keychain and are never shared.

## Usage

Once installed and configured, you can use the keyword research tool in any Claude conversation:

```
Analyze the website https://example.com for SEO keywords. The business type is E-commerce.
```

The tool will:
1. Scrape the website content
2. Generate relevant keywords using AI
3. Fetch search volumes, CPC, and competition data
4. Analyze SERP competitors
5. Create keyword clusters by theme
6. Identify quick wins and high-value opportunities
7. Generate comprehensive reports

## Business Types Supported

- **E-commerce**: Online stores and retail businesses
- **SaaS**: Software as a Service companies
- **Service Business**: Professional services and consultants
- **Blog/Content**: Content websites and blogs
- **Education**: Educational institutions and courses
- **Other**: General businesses

## Output

The analysis provides:

### Analysis Summary
- Total keywords analyzed
- Keyword clusters identified
- Monthly search volume potential
- Estimated traffic potential
- Average cost-per-click

### Keyword Clusters
- Themed keyword groups
- Search volume and difficulty metrics
- Commercial scores
- Competitor analysis

### Quick Wins
- Low-competition opportunities
- High-volume keywords with manageable difficulty

### High-Value Opportunities
- Keywords with high commercial potential
- Strategic long-term targets

### Action Plan
- Immediate actions to take
- Medium-term goals
- Long-term strategy recommendations

## File Output

Reports are automatically saved to the `reports/` directory in your project:
- **JSON Report**: Machine-readable data
- **Text Report**: Human-readable summary

## Error Handling

The extension includes comprehensive error handling for:
- Invalid API keys
- Network connectivity issues
- API rate limits
- Invalid website URLs
- Insufficient API credits

## Security

- All API keys are stored securely using OS keychain
- No data is shared with third parties
- All API calls are made directly to service providers
- Reports are stored locally only

## Support

For issues or questions:
1. Check that all API keys are valid and have sufficient credits
2. Ensure the website URL is accessible
3. Verify network connectivity
4. Check API service status pages

## License

MIT License - See LICENSE file for details. 