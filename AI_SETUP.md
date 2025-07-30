# AI Grid Assistant Setup Guide

## Overview
Your Excel import tool now includes an AI-powered assistant that allows natural language interaction with your data grids. Users can ask questions, request actions, and get insights about their data.

## Setup Instructions

### 1. Get OpenAI API Key
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key (starts with `sk-...`)

### 2. Configure Environment Variables
1. Open the `.env.local` file in your project root
2. Replace `your_openai_api_key_here` with your actual API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the Application
```bash
npm run dev
```

## How to Use

### Opening the AI Assistant
- Look for the floating blue robot icon (🤖) in the bottom-right corner
- Click it to open the AI chat interface

### Example Queries
| What to Say | What It Does |
|-------------|--------------|
| "Sort by description" | Sorts the current grid by description column |
| "Show me duplicates" | Switches to the duplicates view |
| "How many rows?" | Shows the count of rows in current view |
| "Switch to merged view" | Changes to the merged results view |
| "Search for pending" | Searches for "pending" in the current grid |
| "Show unmatched records" | Switches to unmatched records view |

### Available Views
- **Master**: Original master file data
- **Client**: Original client file data  
- **Merged**: Comparison results
- **Unmatched**: Records that couldn't be matched
- **Duplicates**: Duplicate records found

### AI Features
- ✅ Natural language grid navigation
- ✅ Smart view switching
- ✅ Search assistance
- ✅ Data insights and counts
- ✅ Context-aware responses
- 🔄 Advanced sorting (coming soon)
- 🔄 Data analysis and summaries (coming soon)

## Troubleshooting

### Chat Not Opening
- Check browser console for errors
- Verify your API key is correctly set in `.env.local`
- Restart the development server after changing environment variables

### AI Not Responding  
- Check your internet connection
- Verify your OpenAI API key has sufficient credits
- Check the browser's Network tab for failed API requests

### API Errors
- Ensure your API key is valid and has not expired
- Check OpenAI API status at [status.openai.com](https://status.openai.com)

## Architecture

### Components Added
- `/src/app/api/ai/chat/route.ts` - AI service endpoint
- `/src/components/AIChat.tsx` - Chat interface component
- Updated `/src/app/excel-import-clean/page.tsx` - Main page with AI integration

### How It Works
1. User types a query in the chat interface
2. Query is sent to `/api/ai/chat` with current grid context
3. OpenAI GPT-4 processes the query and returns structured intent
4. Intent is executed on the grid (sort, filter, switch views, etc.)
5. User sees the result and AI confirmation message

### Security
- API key is stored server-side in environment variables
- Client never has direct access to the OpenAI API key
- All AI requests go through your Next.js API route

## Cost Considerations
- Each AI query costs approximately $0.01-0.03 USD
- Costs depend on query complexity and response length
- Monitor usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)