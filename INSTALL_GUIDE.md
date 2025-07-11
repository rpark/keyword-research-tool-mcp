# SEO Keyword Research DXT - Installation Guide

This guide will help you install and configure the SEO Keyword Research extension for Claude Desktop.

## What You'll Get

After installation, you'll have access to a powerful SEO keyword research tool directly in Claude Desktop that can:

- Analyze any website for SEO opportunities
- Generate AI-powered keyword suggestions
- Provide search volume, CPC, and competition data
- Create keyword clusters by theme
- Identify competitor strategies
- Generate comprehensive SEO reports

## Installation Steps

### 1. Download the Extension

The extension file is: `seo-keyword-research.dxt` (5.4MB)

### 2. Install in Claude Desktop

1. **Open Claude Desktop**
2. **Navigate to Extensions**:
   - Click on the gear icon (⚙️) in the top-right corner
   - Select "Extensions" from the menu
3. **Install the Extension**:
   - Click "Install Extension" or the "+" button
   - Browse and select the `seo-keyword-research.dxt` file
   - Click "Install"

### 3. Configure API Keys

After installation, Claude Desktop will prompt you to configure the required API keys. You'll need accounts with these services:

#### Required API Services

**1. Firecrawl (Website Scraping)**
- Website: https://firecrawl.dev
- Sign up for an account
- Go to your dashboard to get your API key
- Format: `fc-xxxxxxxxxxxxxxxx`
- Cost: ~$0.01 per website analysis

**2. Perplexity (AI Keyword Generation)**
- Website: https://www.perplexity.ai/settings/api
- Sign up for an account
- Navigate to API settings
- Generate an API key
- Format: `pplx-xxxxxxxxxxxxxxxx`
- Cost: ~$0.02 per analysis

**3. DataForSEO (Keyword Metrics & SERP Data)**
- Website: https://dataforseo.com
- Sign up for an account
- Note your login email and password
- These will be your username/password for the API
- Cost: ~$0.50-1.00 per analysis

**Total estimated cost per analysis: $0.53-1.03**

#### Entering API Keys

When prompted by Claude Desktop, enter:

1. **Firecrawl API Key**: Your fc-xxxxxxxx key
2. **Perplexity API Key**: Your pplx-xxxxxxxx key  
3. **DataForSEO Username**: Your DataForSEO email address
4. **DataForSEO Password**: Your DataForSEO password

**Security Note**: All API keys are stored securely in your OS keychain and never shared.

## Using the Extension

Once installed and configured, you can use the tool in any Claude conversation:

### Basic Usage

```
Analyze the website https://example.com for SEO keywords. The business type is E-commerce.
```

### Business Types

Choose the business type that best matches the website:
- **E-commerce**: Online stores, retail websites
- **SaaS**: Software as a Service companies
- **Service Business**: Consultants, agencies, professional services
- **Blog/Content**: Content websites, blogs, media sites
- **Education**: Schools, courses, educational platforms
- **Other**: General businesses

### Example Analysis Request

```
Please analyze https://shopify.com for SEO opportunities. This is a SaaS business.
```

## What You'll Receive

The analysis will provide:

### 📊 Analysis Summary
- Total keywords analyzed
- Number of keyword clusters found
- Monthly search volume potential
- Estimated traffic opportunity
- Average cost-per-click across keywords

### 🎯 Quick Wins
- Low-competition keywords you can target immediately
- Keywords with high search volume but manageable difficulty
- Specific recommendations for quick SEO improvements

### 💰 High-Value Opportunities
- Keywords with high commercial potential
- Strategic long-term targets
- Revenue-generating keyword opportunities

### 🏗️ Keyword Clusters
- Keywords grouped by theme/topic
- Search volume and difficulty for each cluster
- Competitor analysis for each theme
- Content recommendations

### 🏆 Competitor Insights
- Top competing domains
- SERP competitors by keyword
- AI-powered competitor analysis
- Strategic positioning opportunities

### 📋 Action Plan
- **Immediate Actions**: Steps you can take today
- **Medium-term Goals**: 1-3 month objectives
- **Long-term Strategy**: 6-12 month planning

### 📁 Report Files
Reports are automatically saved locally:
- **JSON Report**: Machine-readable data for further analysis
- **Text Report**: Human-readable comprehensive summary

## Troubleshooting

### Common Issues

**"API keys are not configured"**
- Go to Claude Desktop Settings → Extensions → SEO Keyword Research
- Verify all 4 API keys are entered correctly
- Check that keys have the correct format (fc-, pplx-, etc.)

**"Failed to scrape website"**
- Ensure the website URL is correct and accessible
- Check that the URL includes https:// or http://
- Verify the website is publicly accessible

**"Analysis failed"**
- Check your API key balances/credits
- Ensure you have sufficient funds in each API service
- Verify network connectivity

**"Invalid API key"**
- Double-check each API key in the extension settings
- Regenerate keys if necessary from each service dashboard
- Ensure no extra spaces or characters in the keys

### Getting Help

1. **Check API Service Status**:
   - Firecrawl status: https://status.firecrawl.dev
   - Perplexity status: Check their website
   - DataForSEO status: https://status.dataforseo.com

2. **Verify API Credits**:
   - Log into each service dashboard
   - Check remaining credits/balance
   - Top up if necessary

3. **Test Individual Services**:
   - Try a simple request on each API service's website
   - Verify your account status with each provider

## Extension Information

- **Name**: seo-keyword-research
- **Version**: 1.0.0
- **File Size**: 5.4MB
- **Total Files**: 767 files included
- **Architecture**: Node.js with built-in runtime
- **Security**: All API keys stored in OS keychain

## Cost Management

To keep costs manageable:

1. **Start Small**: Test with smaller websites first
2. **Monitor Usage**: Check API service dashboards regularly
3. **Set Limits**: Configure spending limits in each API service
4. **Target Quality**: Focus on high-value websites for analysis

The extension is designed to provide comprehensive SEO insights while maintaining cost-effective usage of third-party APIs.

---

**Ready to get started?** Install the extension and begin analyzing your first website for SEO opportunities! 