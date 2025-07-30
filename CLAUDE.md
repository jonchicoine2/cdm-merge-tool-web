# Claude AI Assistant Instructions

## Project Overview
This is a CDM (Charge Description Master) merge tool for comparing and merging healthcare billing spreadsheets. It's a Next.js React application with MUI DataGrid components.

## Development Server
- Start with: `npm run dev`
- Default port: 3000 (check console output for actual port)
- Wait for "Ready" message before attempting browser navigation

## Browser Automation Best Practices
**CRITICAL: Follow this sequence to avoid opening multiple blank tabs**

1. **Start dev server first**
   ```bash
   npm run dev
   # Wait for "Ready" message and note the actual port
   ```

2. **Check server is running**
   ```bash
   lsof -i :3000 | grep LISTEN
   ```

3. **Clean browser state BEFORE navigating**
   - ALWAYS use `mcp__playwright__browser_close` first to cleanly close any existing browser
   - If user has closed Chrome manually, even better!

4. **Navigate ONCE to correct URL**
   - Use mcp__playwright__browser_navigate exactly once
   - Use the port shown in server output (usually 3000)
   - Wait for page to fully load

5. **If browser errors still occur**
   ```bash
   pkill -f chrome  # Kill zombie processes
   pkill -f "npm run dev"  # Kill dev server if needed
   ```

**Never**: Navigate multiple times, assume port numbers, or rush the sequence
**Key insight**: Clean browser close + single navigation = success

## Performance Notes
- All MUI DataGrids have virtualization enabled for performance
- Sample data loading has been optimized (no artificial delays)
- Console logging minimized in render paths

## Key Files
- Main page: `src/app/excel-import-clean/page.tsx`
- AI Chat: `src/components/AIChat.tsx`
- Excel operations: `src/utils/excelOperations.ts`

## Testing
- Click "Load Sample Data" to test with sample Excel files
- Performance should be fast (merge completes in ~6ms)