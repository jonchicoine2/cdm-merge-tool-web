import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Netlify function configuration
export const runtime = 'nodejs';
export const maxDuration = 15; // 15 seconds timeout for Netlify

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000, // 25 seconds timeout
  maxRetries: 2, // Retry failed requests twice
});

interface GridContext {
  columns: string[];
  rowCount: number;
  sampleData: Record<string, unknown>[];
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
  selectedRowId: number | string | null;
  selectedRowData: Record<string, unknown> | null;
  selectedHcpcs: string | null;
  selectedRowCount: number;
}

interface AIIntent {
  type: 'query' | 'action' | 'filter' | 'sort' | 'analysis' | 'documentation';
  action?: 'sort' | 'filter' | 'search' | 'summarize' | 'count' | 'show' | 'switch' | 'clear_filters' | 'export' | 'explain' | 'duplicate' | 'delete' | 'add';
  parameters?: {
    column?: string;
    value?: string;
    direction?: 'asc' | 'desc';
    condition?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
    view?: string;
    filename?: string;
    topic?: string;
    rowId?: number | string;
    rowData?: {[key: string]: string | number | undefined};
  };
  response: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { message, gridContext }: { message: string; gridContext: GridContext } = await request.json();
    
    // Optimize gridContext to reduce payload size
    const optimizedGridContext = {
      ...gridContext,
      // Limit sample data to reduce request size
      sampleData: gridContext.sampleData.slice(0, 2),
    };
    
    console.log('[AI API DEBUG] Received request:', {
      message,
      selectedGrid: gridContext.selectedGrid,
      selectedRowId: gridContext.selectedRowId,
      selectedHcpcs: gridContext.selectedHcpcs,
      selectedRowCount: gridContext.selectedRowCount,
      selectedRowData: gridContext.selectedRowData ? 'present' : 'null',
      hasRowSelection: !!gridContext.selectedRowId,
      rowCount: gridContext.rowCount,
      requestSize: JSON.stringify({ message, gridContext: optimizedGridContext }).length
    });
    

    console.log('API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('API Key length:', process.env.OPENAI_API_KEY?.length);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Check if multiple grids are visible (ambiguous context)
    const visibleGrids = Object.entries(gridContext.availableGrids)
      .filter(([, grid]) => grid.hasData)
      .map(([name]) => name);
    
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
- In-place data editing with validation for all grids (master, client, merged)
- Record management: duplicate, delete, and add records via AI commands
- Save/cancel functionality for data edits with change tracking

**Matching Rules**: Uses HCPCS codes + modifiers as primary matching criteria. Match key format: "HCPCS Code + Modifier" (e.g., "99213" + "25" = "9921325"). 

**Modifier Settings Control Root Code Matching**:
The modifier settings dialog allows users to specify which modifier codes should be treated as "root codes" (without the modifier suffix) during matching:

1. **Root 00**: Include codes with modifier "00" - strips "00" modifier for matching
2. **Root 25**: Include codes with modifier "25" - strips "25" modifier for matching  
3. **Root 50**: Include codes with modifier "50" - strips "50" modifier for matching
4. **Root 59**: Include codes with modifier "59" - strips "59" modifier for matching
5. **Root XU**: Include codes with modifier "XU" - strips "XU" modifier for matching
6. **Root 76**: Include codes with modifier "76" - strips "76" modifier for matching
7. **Ignore Trauma**: Excludes trauma team codes (99284, 99285, 99291) with "trauma team" descriptions

**How It Works**: When root modifiers are enabled, codes like "99213-25" will match as just "99213" if Root 25 is checked. This allows modified codes to match their base procedure codes.

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
- Sample data: ${JSON.stringify(optimizedGridContext.sampleData)}
- Available grids: ${JSON.stringify(gridContext.availableGrids)}
- In compare mode: ${gridContext.isInCompareMode}
- Selected row ID: ${gridContext.selectedRowId || 'none'}
- Selected row data: ${gridContext.selectedRowData ? JSON.stringify(gridContext.selectedRowData) : 'none'}

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
- duplicate: Create a copy of an existing record by ID
- delete: Remove a record by ID from the grid
- add: Create a new blank record or record with specific data

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
  "action": "sort|filter|search|count|summarize|show|switch|duplicate|delete|add",
  "parameters": {
    "column": "column_name",
    "value": "search_value",
    "direction": "asc|desc",
    "condition": "criteria",
    "view": "master|client|merged|unmatched|duplicates",
    "rowId": "record_id_to_duplicate_or_delete",
    "rowData": {"column_name": "value"}
  },
  "response": "Human-readable response"
}

CRITICAL: You MUST return proper JSON format for all actions. Examples:

For sort commands:
{
  "type": "action",
  "action": "sort", 
  "parameters": {
    "column": "description",
    "direction": "asc"
  },
  "response": "Sorting by description in ascending order"
}

For duplicate commands:
{
  "type": "action",
  "action": "duplicate",
  "parameters": {
    "rowId": ${gridContext.selectedRowId}
  },
  "response": "Duplicating the currently selected row"
}

IMPORTANT: Always respond with natural, conversational language. Never show JSON examples or technical structures to users.

Example user interactions:
- User: "sort by description" → Return: {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc"}, "response": "Sorting by description in ascending order"}
- User: "sort by hcpcs descending" → Return: {"type": "action", "action": "sort", "parameters": {"column": "hcpcs", "direction": "desc"}, "response": "Sorting by HCPCS in descending order"}
- User: "show me duplicates" → Return: {"type": "action", "action": "switch", "parameters": {"view": "duplicates"}, "response": "Switching to duplicates view"}
- User: "how many rows in master?" → Return: {"type": "query", "response": "There are [X] rows in the master grid"}
- User: "search client data for pending" → Return: {"type": "action", "action": "search", "parameters": {"value": "pending", "view": "client"}, "response": "Searching client data for 'pending'"}
- User: "hide rows with blank cdms" → Return: {"type": "action", "action": "filter", "parameters": {"column": "cdms", "condition": "is_not_empty"}, "response": "Hiding rows where CDMS column is blank"}
- User: "export the data" → Return: {"type": "action", "action": "export", "response": "Exporting merged data to Excel file"}
- User: "export as monthly_report" → Return: {"type": "action", "action": "export", "parameters": {"filename": "monthly_report"}, "response": "Exporting merged data as 'monthly_report.xlsx'"}
- User: "duplicate record 5" → Return: {"type": "action", "action": "duplicate", "parameters": {"rowId": 5}, "response": "Duplicating record ID 5 in the current grid. The duplicated row will be assigned a new ID."}
- User: "duplicate row 3 in client grid" → Return: {"type": "action", "action": "duplicate", "parameters": {"rowId": 3, "view": "client"}, "response": "Duplicating record ID 3 in the client grid. The duplicated row will be assigned a new ID."}
- User: "duplicate the current row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate current row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate the selected row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "duplicate row" → {"type": "action", "action": "duplicate", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Duplicating ${gridContext.selectedHcpcs ? `HCPCS code ${gridContext.selectedHcpcs}` : `row ID ${gridContext.selectedRowId}`}. The duplicated row will be assigned a new ID."}
- User: "delete record 7" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": 7}, "response": "Deleting record 7 from the current grid"}
- User: "remove row 2 from master" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": 2, "view": "master"}, "response": "Deleting record 2 from the master grid"}
- User: "delete the current row" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Deleting the currently selected row"}
- User: "remove the selected row" → Return: {"type": "action", "action": "delete", "parameters": {"rowId": ${gridContext.selectedRowId}}, "response": "Deleting the selected row"}
- User: "delete selected" → Return: {"type": "action", "action": "delete", "response": "Deleting ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "delete selected rows" → Return: {"type": "action", "action": "delete", "response": "Deleting ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "remove selected" → Return: {"type": "action", "action": "delete", "response": "Removing ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "delete all selected" → Return: {"type": "action", "action": "delete", "response": "Deleting all ${gridContext.selectedRowCount} selected row${gridContext.selectedRowCount === 1 ? '' : 's'}"}
- User: "add a new record" → Return: {"type": "action", "action": "add", "response": "Adding a new blank record to the current grid"}
- User: "add new row to merged grid" → Return: {"type": "action", "action": "add", "parameters": {"view": "merged"}, "response": "Adding a new blank record to the merged grid"}
- User: "add record with HCPCS 99213" → Return: {"type": "action", "action": "add", "parameters": {"rowData": {"hcpcs": "99213"}}, "response": "Adding a new record with HCPCS code 99213"}
- User: "what is this app for?" → You respond: "This is VIC's internal CDM Merge Tool - designed specifically for our team to streamline charge master data updates. The app merges Master and Client Excel files by matching HCPCS codes, then updates the Master with CDM data from the Client to create a clean merged dataset for export. Key features include HCPCS matching, configurable modifier settings for VIC's specific data requirements, quality control to identify unmatched records and duplicates, and export-ready output. This tool handles the tedious manual work of CDM merging while ensuring data accuracy and giving you visibility into any potential issues that need attention."
- User: "what are modifier settings?" → You respond: "Modifier settings let you specify which modifier codes should be treated as root codes during matching. For example, if Root 25 is enabled, codes like '99213-25' will match as just '99213'. Available options include Root 00, Root 25, Root 50, Root 59, Root XU, Root 76, and Ignore Trauma (excludes trauma team codes). This allows modified procedure codes to match their base codes when needed."

IMPORTANT: 
- Use the selectedGrid (${gridContext.selectedGrid}) when no specific grid is mentioned in the user's query
- If user specifies a different grid in their query, use that grid instead
- Look for keywords: "master", "client", "merged", "unmatched", "duplicates", "comparison", "results"
- For "current row" or "selected row" requests: Use selectedRowId (${gridContext.selectedRowId}) if available
- If no row is selected and user asks for "current row" operations, respond: "I'm sorry, but there is currently no row selected. Please select a row first by clicking on it in the grid, then I can help you with that operation."
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
- "duplicates", "duplicate records" → view: "duplicates"

Column name mapping instructions:
When the user requests sorting/filtering by a column, you MUST match their request to the actual column names available in the current grid. The available columns are: ${gridContext.columns.join(', ')}.

For sort commands:
- Look for exact matches first (case-insensitive)
- Then look for partial matches where the user's term is contained in a column name
- Common user terms to column mappings:
  * "description" → "description" or any column containing "desc"
  * "code" → "hcpcs" or any column containing "code"
  * "modifier" → "modifier" or "mod"
  * "price" → any column containing "price", "amount", "cost"
  * "quantity" → any column containing "qty", "quantity", "units"
  * "date" → any column containing "date"

CRITICAL: In your JSON response, use the EXACT column field name from the available columns list. Do not guess or approximate column names.

Example: If user says "sort by description" and available columns include "description", use "description" in the parameters.column field.
If user says "sort by desc" and available columns include "procedure_description", use "procedure_description" in the parameters.column field.`;

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    
    try {
      // First attempt with normal timeout
      completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
            { role: "system", content: "CRITICAL: You MUST respond with valid JSON format. Never respond with plain text. Examples:\n- Sort: {\"type\": \"action\", \"action\": \"sort\", \"parameters\": {\"column\": \"description\", \"direction\": \"asc\"}, \"response\": \"Sorting by description\"}\n- Switch: {\"type\": \"action\", \"action\": \"switch\", \"parameters\": {\"view\": \"master\"}, \"response\": \"Switching to master grid\"}" }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
        // Additional timeout safety net for Netlify
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout (9s limit)')), 9000)
        )
      ]) as OpenAI.Chat.Completions.ChatCompletion;
    } catch (timeoutError) {
      // If first attempt times out, try with a shorter, simpler prompt
      console.log('[AI API DEBUG] First attempt timed out, trying simplified prompt');
      const simplifiedPrompt = `You are an AI assistant for the CDM Merge Tool.

Current context: ${optimizedGridContext.selectedGrid} grid with ${optimizedGridContext.rowCount} rows.
Available columns: ${optimizedGridContext.columns.join(', ')}
Available grids: ${Object.entries(optimizedGridContext.availableGrids).filter(([, grid]) => grid.hasData).map(([name, grid]) => `${name}(${grid.rowCount})`).join(', ')}

For user commands, respond with JSON:
- Sort: {"type": "action", "action": "sort", "parameters": {"column": "exact_column_name", "direction": "asc|desc"}, "response": "Sorting by X"}
- Filter: {"type": "action", "action": "filter", "parameters": {"column": "exact_column_name", "condition": "is_empty|equals|contains", "value": "search_value"}, "response": "Filtering..."}
- Switch grid: {"type": "action", "action": "switch", "parameters": {"view": "master|client|merged|unmatched|duplicates"}, "response": "Switching to X grid"}
- Questions: {"type": "query", "response": "Answer text"}

Examples:
- "sort by description" → {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc"}, "response": "Sorting by description"}
- "sort master by description" → {"type": "action", "action": "sort", "parameters": {"column": "description", "direction": "asc", "view": "master"}, "response": "Sorting master grid by description"}
- "show master" → {"type": "action", "action": "switch", "parameters": {"view": "master"}, "response": "Switching to master grid"}`;
      
      completion = await Promise.race([
        openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: simplifiedPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
        // Shorter timeout for retry
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout (6s limit on retry)')), 6000)
        )
      ]) as OpenAI.Chat.Completions.ChatCompletion;
    }

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }
    
    const processingTime = Date.now() - startTime;
    console.log('[AI API DEBUG] Raw AI response:', responseContent);
    console.log('[AI API DEBUG] Processing time:', processingTime + 'ms');

    try {
      // Clean up response if it has extra text around JSON
      let cleanedResponse = responseContent.trim();
      
      // Look for JSON block in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      console.log('[AI API DEBUG] Cleaned response for parsing:', cleanedResponse);
      
      const intent: AIIntent = JSON.parse(cleanedResponse);
      console.log('[AI API DEBUG] Parsed intent:', intent);
      
      // Validate that intent has required fields
      if (!intent.type || !intent.response) {
        throw new Error('Invalid intent structure');
      }
      
      return NextResponse.json({ intent });
    } catch (error) {
      console.log('[AI API DEBUG] JSON parsing failed:', error);
      console.log('[AI API DEBUG] Falling back to query response');
      
      // Enhanced fallback - try to extract action from the response text
      const lowerMessage = message.toLowerCase();
      const lowerResponse = responseContent.toLowerCase();
      
      // Try to detect common actions in the response
      if (lowerMessage.includes('sort') && (lowerMessage.includes('description') || lowerResponse.includes('description'))) {
        return NextResponse.json({
          intent: {
            type: 'action',
            action: 'sort',
            parameters: {
              column: 'description',
              direction: lowerMessage.includes('desc') && !lowerMessage.includes('description') ? 'desc' : 'asc',
              ...(lowerMessage.includes('master') && { view: 'master' }),
              ...(lowerMessage.includes('client') && { view: 'client' })
            },
            response: `Sorting by description ${lowerMessage.includes('desc') && !lowerMessage.includes('description') ? 'descending' : 'ascending'}`
          }
        });
      }
      
      if (lowerMessage.includes('master') && (lowerMessage.includes('show') || lowerMessage.includes('switch'))) {
        return NextResponse.json({
          intent: {
            type: 'action',
            action: 'switch',
            parameters: { view: 'master' },
            response: 'Switching to master grid'
          }
        });
      }
      
      // Default fallback
      return NextResponse.json({
        intent: {
          type: 'query',
          response: responseContent
        }
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('AI Chat API Error:', error);
    console.error('Processing time before error:', processingTime + 'ms');
    
    // Provide more specific error messages
    let errorMessage = 'Failed to process AI request';
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('Request timeout')) {
        errorMessage = 'Request timed out - this prompt may be too complex for the deployment environment. Try a simpler command.';
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'OpenAI rate limit exceeded. Please wait a moment and try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error connecting to OpenAI. Please check your connection and try again.';
      }
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
