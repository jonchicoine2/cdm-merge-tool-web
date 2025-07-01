import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GridContext {
  columns: string[];
  rowCount: number;
  sampleData: Record<string, any>[];
  currentView: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  availableGrids: {
    master: { hasData: boolean; rowCount: number };
    client: { hasData: boolean; rowCount: number };
    merged: { hasData: boolean; rowCount: number };
    unmatched: { hasData: boolean; rowCount: number };
    duplicates: { hasData: boolean; rowCount: number };
  };
  isInCompareMode: boolean;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
}

interface AIIntent {
  type: 'query' | 'action' | 'filter' | 'sort' | 'analysis' | 'documentation';
  action?: 'sort' | 'filter' | 'search' | 'summarize' | 'count' | 'show' | 'switch' | 'clear_filters' | 'export' | 'explain';
  parameters?: {
    column?: string;
    value?: string;
    direction?: 'asc' | 'desc';
    condition?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
    view?: string;
    filename?: string;
    topic?: string;
  };
  response: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, gridContext }: { message: string; gridContext: GridContext } = await request.json();

    console.log('API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('API Key length:', process.env.OPENAI_API_KEY?.length);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Check if multiple grids are visible (ambiguous context)
    const visibleGrids = Object.entries(gridContext.availableGrids)
      .filter(([_, grid]) => grid.hasData)
      .map(([name, _]) => name);
    
    const isAmbiguous = gridContext.isInCompareMode && visibleGrids.length > 1;
    
    // Check if the user's query is ambiguous (doesn't specify which grid)
    const ambiguousQueries = ['how many rows', 'count', 'sort by', 'search for', 'filter', 'what columns', 'hide rows', 'show only', 'remove rows', 'export'];
    const gridKeywords = ['master', 'client', 'merged', 'unmatched', 'duplicates', 'comparison', 'results', 'data', 'file', 'grid'];
    
    const hasAmbiguousQuery = ambiguousQueries.some(query => 
      message.toLowerCase().includes(query.toLowerCase())
    );
    
    const hasGridKeyword = gridKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
    
    const isQueryAmbiguous = hasAmbiguousQuery && !hasGridKeyword;

    // Only ask for clarification if truly ambiguous AND no grid is selected
    if (isAmbiguous && isQueryAmbiguous && !gridContext.selectedGrid) {
      const gridSummary = visibleGrids.map(grid => {
        const gridData = gridContext.availableGrids[grid as keyof typeof gridContext.availableGrids];
        return `• ${grid.toUpperCase()}: ${gridData.rowCount} rows`;
      }).join('\n');

      return NextResponse.json({
        intent: {
          type: 'query',
          response: `I can see multiple grids are visible:\n${gridSummary}\n\nWhich grid would you like me to work with? You can specify:\n• "Hide rows with blank CDMS in the merged grid"\n• "Sort the master data by description"\n• "Filter the client grid"\n• Or just say "master", "client", "merged", "unmatched", or "duplicates"`
        }
      });
    }

    const systemPrompt = `You are an AI assistant for the CDM Merge Tool, a specialized Excel data comparison application for healthcare data management. 

## About CDM Merge Tool

**Purpose**: The CDM Merge Tool processes Clinical Decision-Making (CDM) data by comparing master reference files with client data files to identify matches, duplicates, and discrepancies in healthcare data.

**Key Features**:
- Healthcare data reconciliation and HCPCS code validation
- Duplicate detection and data quality assurance  
- Multi-sheet Excel file support with intelligent column mapping
- Advanced matching algorithms (exact, fuzzy, normalized)
- Comprehensive reporting with matched/unmatched/duplicate categorization

**Matching Rules**: Uses HCPCS codes + modifiers as primary matching criteria. Match key format: "HCPCS Code + Modifier" (e.g., "99213" + "25" = "9921325"). 

**Modifier Settings Control Matching Behavior**:
1. **Ignore Blanks** (TRUE recommended): Whether blank modifiers can match other blank modifiers
2. **Case Sensitive** (FALSE recommended): Whether "RT" matches "rt" 
3. **Require Exact** (FALSE recommended): Whether to allow fuzzy matching for spacing/formatting differences

**Common Use Cases**: Insurance validation (flexible settings), compliance auditing (strict settings), data migration (accommodating format differences).

**Output**: Generates Excel reports with three sheets:
1. **Merged**: All matched records with combined data
2. **Unmatched_Client**: Client records with no master match (need review)  
3. **Duplicate_Client**: Client records with duplicate keys (need deduplication)

**Use Cases**: Healthcare billing validation, compliance auditing, data migration, and quality control for medical procedure codes and billing data.

## Current Data Context:
- Selected grid: ${gridContext.selectedGrid}
- Current view: ${gridContext.currentView}
- Columns: ${gridContext.columns.join(', ')}
- Row count: ${gridContext.rowCount}
- Sample data: ${JSON.stringify(gridContext.sampleData.slice(0, 3))}
- Available grids: ${JSON.stringify(gridContext.availableGrids)}
- In compare mode: ${gridContext.isInCompareMode}

Your job is to interpret user queries and return JSON responses for grid actions, but the "response" field should contain natural, conversational text that directly answers the user's question. Users will only see the "response" text - they will never see the JSON structure.

Available actions:
- sort: Sort by column (asc/desc)
- filter: Filter data by criteria (hide/show rows based on conditions)
- search: Search across all columns
- count: Count rows matching criteria
- summarize: Provide data summary
- show: Display specific data subset
- switch: Switch between views (master, client, merged, unmatched, duplicates)
- clear_filters: Remove all filters from a grid
- export: Export grid data to Excel file (supports custom filename)
- explain: Answer questions about the CDM Merge Tool functionality, purpose, and features

Filter conditions available:
- is_empty: Hide rows where column is blank/empty
- is_not_empty: Show only rows where column has data
- equals: Show only rows where column equals exact value
- not_equals: Hide rows where column equals value
- contains: Show only rows where column contains text
- not_contains: Hide rows where column contains text
- starts_with: Show only rows where column starts with text
- ends_with: Show only rows where column ends with text
- greater_than: Show only rows where column value is greater than number
- less_than: Show only rows where column value is less than number

Return JSON with this structure:
{
  "type": "action|query|analysis",
  "action": "sort|filter|search|count|summarize|show|switch",
  "parameters": {
    "column": "column_name",
    "value": "search_value",
    "direction": "asc|desc",
    "condition": "criteria",
    "view": "master|client|merged|unmatched|duplicates"
  },
  "response": "Human-readable response"
}

IMPORTANT: Always respond with natural, conversational language. Never show JSON examples or technical structures to users.

Example user interactions:
- User: "sort by description" → You respond: "Sorting by description in ascending order"
- User: "show me duplicates" → You respond: "Switching to duplicates view"  
- User: "how many rows in master?" → You respond: "There are [X] rows in the master grid"
- User: "search client data for pending" → You respond: "Searching client data for 'pending'"
- User: "hide rows with blank cdms" → You respond: "Hiding rows where CDMS column is blank"
- User: "export the data" → You respond: "Exporting merged data to Excel file"
- User: "export as monthly_report" → You respond: "Exporting merged data as 'monthly_report.xlsx'"
- User: "what is this app for?" → You respond: "The CDM Merge Tool is designed for healthcare data management. It compares master reference files with client data to validate HCPCS codes, detect duplicates, and ensure data quality for medical billing and compliance."
- User: "what are modifier settings?" → You respond: "Modifier settings control how modifiers are matched: 1) Ignore Blanks (whether blank modifiers match each other), 2) Case Sensitive (whether 'RT' matches 'rt'), 3) Require Exact (whether to allow fuzzy matching for formatting differences). Recommended settings are TRUE, FALSE, FALSE for most use cases."

IMPORTANT: 
- Use the selectedGrid (${gridContext.selectedGrid}) when no specific grid is mentioned in the user's query
- If user specifies a different grid in their query, use that grid instead
- Look for keywords: "master", "client", "merged", "unmatched", "duplicates", "comparison", "results"
- For "hide rows with blank X" or "remove empty X", use condition "is_not_empty"  
- For "show only non-empty X", use condition "is_not_empty"
- For "hide rows where X contains Y", use condition "not_contains"
- For "show only rows where X equals Y", use condition "equals"
- If user says just a grid name like "master" or "merged", switch to that view
- Always specify which grid you're working with in your response
- For export commands, extract filename from phrases like "as filename", "save as filename", "export as filename"
- Export defaults to merged data unless user specifies a different grid
- Add .xlsx extension if user doesn't provide file extension
- For documentation questions about the app (what/how/why questions), use type "documentation" and action "explain"
- Answer questions about app purpose, matching rules, modifiers, problems solved, and technical details
- Documentation responses should be informative but concise, focusing on practical understanding
- NEVER show JSON structure, code examples, or technical syntax to users - only natural conversation
- Users should never see curly braces, quotation marks around field names, or any JSON formatting
- Always write responses as if you're having a normal conversation with a person

Grid detection keywords:
- "master data", "master file", "master grid" → view: "master"
- "client data", "client file", "client grid" → view: "client"  
- "merged data", "merged results", "comparison results", "merged grid" → view: "merged"
- "unmatched", "unmatched records" → view: "unmatched"
- "duplicates", "duplicate records" → view: "duplicates"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
        { role: "system", content: "Remember: Respond with natural conversation only. No JSON, no code, no technical syntax. Just helpful, friendly answers." }
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    try {
      const intent: AIIntent = JSON.parse(responseContent);
      return NextResponse.json({ intent });
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return NextResponse.json({
        intent: {
          type: 'query',
          response: responseContent
        }
      });
    }

  } catch (error) {
    console.error('AI Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}