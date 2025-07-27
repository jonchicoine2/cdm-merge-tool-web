# Browser Automation Best Practices

## Common Issues and Solutions

### 1. Multiple about:blank Tabs Opening
**Issue**: Browser opens many blank tabs before navigating to the correct URL
**Causes**:
- Multiple navigation attempts without waiting for completion
- Creating new browser contexts/pages without immediate navigation
- Race conditions in automation commands

**Solution**:
```bash
# Always follow this sequence:
1. Start dev server first and wait for it to be ready
2. Check which port it's actually running on (lsof -i :3000)
3. Navigate ONCE to the correct URL
4. Wait for page to load before any other actions
```

### 2. Wrong Port Navigation
**Issue**: Navigating to wrong port (e.g., 3001 instead of 3000)
**Causes**:
- Dev server auto-selecting alternate port when default is busy
- Not checking actual server output for port number
- Hardcoded port assumptions

**Solution**:
- Always check the dev server output for the actual port
- Kill existing processes if needed: `pkill -f "npm run dev"`
- Verify with: `lsof -i :3000 -i :3001 | grep LISTEN`

### 3. Browser Already in Use Errors
**Issue**: "Browser is already in use" errors preventing navigation
**Causes**:
- Previous browser instance not properly closed
- Multiple automation attempts without cleanup
- Zombie browser processes

**Solution**:
```bash
# Clean up sequence:
pkill -f chrome  # Kill all Chrome processes
# Then start fresh with browser automation
```

## Correct Browser Automation Sequence

1. **Start Development Server**
   ```bash
   npm run dev
   # Wait for "Ready" message and note the port
   ```

2. **Verify Server is Running**
   ```bash
   lsof -i :3000 | grep LISTEN
   ```

3. **Navigate to Application**
   - Use mcp__playwright__browser_navigate ONCE
   - Navigate to the exact URL shown in server output
   - Wait for page to fully load

4. **Clean Up When Done**
   - Always close browser properly
   - Kill dev server process when finished

## Key Reminders
- Don't rush - wait for each step to complete
- One navigation per browser session
- Always verify the actual port being used
- Clean up zombie processes before starting new ones