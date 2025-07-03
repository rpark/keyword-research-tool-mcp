# SEO Keyword Research Tool - MCP Server

A Model Context Protocol (MCP) server that provides comprehensive SEO keyword research and analysis using Firecrawl, Perplexity AI, and DataForSEO APIs.

## Features

- **Complete Website Analysis**: Scrapes website content and generates targeted keywords
- **AI-Powered Research**: Uses Perplexity AI for intelligent keyword generation
- **Comprehensive Data**: Gets search volume, competition, and CPC data from DataForSEO
- **Smart Clustering**: Groups related keywords into actionable clusters
- **Actionable Reports**: Provides quick wins, high-value targets, and competitor analysis

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

You have two options for configuring your API keys:

#### Option A: Environment Variables (Recommended)

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```env
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxx
DATAFORSEO_USERNAME=your-username
DATAFORSEO_PASSWORD=your-password
```

#### Option B: MCP Client Configuration

Add environment variables to your MCP client configuration:

```json
{
  "mcpServers": {
    "seo-keyword-research": {
      "command": "node",
      "args": ["path/to/keyword-research-tool-mcp/dist/index.js"],
      "env": {
        "FIRECRAWL_API_KEY": "fc-xxxxxxxxxxxxxxxxxxxxxxxxxx",
        "PERPLEXITY_API_KEY": "pplx-xxxxxxxxxxxxxxxxxxxxxxxxxx",
        "DATAFORSEO_USERNAME": "your-username",
        "DATAFORSEO_PASSWORD": "your-password"
      }
    }
  }
}
```

If you are running a tool like Cursor or Windsurf, you may need to remind it to search for API keys in the above JSON file.

### 3. Build the Server

```bash
npm run build
```

## Tool Available

### `analyze-website`

Complete SEO analysis for a website.

**Required Parameters:**
- `websiteUrl`: Website URL to analyze
- `businessType`: Type of business (E-commerce, SaaS, Service Business, Blog/Content, Education)

**Optional Parameters (will use environment variables if not provided):**
- `firecrawlApiKey`: Your Firecrawl API key
- `perplexityApiKey`: Your Perplexity API key
- `dataforSeoUsername`: Your DataForSEO username
- `dataforSeoPassword`: Your DataForSEO password

**Returns:** Complete analysis report with keyword clusters, quick wins, high-value targets, and competitor analysis.

## Usage Examples

### With Environment Variables (Recommended)

```javascript
// Analyze a website (API keys from environment)
const report = await mcp.callTool('analyze-website', {
  websiteUrl: 'https://example.com',
  businessType: 'E-commerce'
});
```

### With API Keys as Parameters

```javascript
// Analyze a website (API keys as parameters)
const report = await mcp.callTool('analyze-website', {
  websiteUrl: 'https://example.com',
  businessType: 'E-commerce',
  firecrawlApiKey: 'fc-xxxxxxxxxx',
  perplexityApiKey: 'pplx-xxxxxxxxxx',
  dataforSeoUsername: 'your-username',
  dataforSeoPassword: 'your-password'
});
```

## Development

```bash
# Build in watch mode
npm run dev

# Clean build files
npm run clean

# Run the server
npm start
```

## Cost Estimates

Per analysis:
- Firecrawl: ~$0.01 per website scrape
- Perplexity: ~$0.02 per keyword generation  
- DataForSEO: ~$0.50-1.00 per analysis
- **Total: ~$0.53-1.03 per analysis**

## License

MIT 