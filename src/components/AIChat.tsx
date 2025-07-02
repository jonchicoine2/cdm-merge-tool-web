'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  Avatar,
  Chip,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  Button,
  Drawer,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

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
  type: 'query' | 'action' | 'filter' | 'sort' | 'analysis';
  action?: 'sort' | 'filter' | 'search' | 'summarize' | 'count' | 'show' | 'switch';
  parameters?: {
    column?: string;
    value?: string;
    direction?: 'asc' | 'desc';
    condition?: string;
    view?: string;
  };
  response: string;
}

interface AIChatProps {
  gridContext: GridContext;
  onAction?: (intent: AIIntent) => void;
  isOpen: boolean;
  onClose: () => void;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  onGridChange: (grid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => void;
  onWidthChange?: (width: number) => void;
}

export default function AIChat({ gridContext, onAction, isOpen, onClose, selectedGrid, onGridChange, onWidthChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(320); // Reduced from 400 to 320
  const [isResizing, setIsResizing] = useState(false);
  
  // Command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current input, 0+ means history index
  const [tempInput, setTempInput] = useState(''); // Store current input when navigating history
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotifiedWidthRef = useRef<number>(320);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Command history functions
  const addToHistory = (command: string) => {
    if (command.trim() && command !== commandHistory[0]) {
      setCommandHistory(prev => {
        const newHistory = [command, ...prev];
        console.log('[COMMAND HISTORY] Added command:', command, 'Total commands:', newHistory.length);
        return newHistory.slice(0, 10); // Keep only last 10 commands
      });
    }
    setHistoryIndex(-1);
    setTempInput('');
  };

  const navigateHistory = (direction: 'up' | 'down') => {
    if (commandHistory.length === 0) return;
    
    if (direction === 'up') {
      if (historyIndex === -1) {
        // Starting navigation, save current input
        setTempInput(inputValue);
        setHistoryIndex(0);
        setInputValue(commandHistory[0]);
      } else if (historyIndex < commandHistory.length - 1) {
        // Go further back in history
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } else if (direction === 'down') {
      if (historyIndex > 0) {
        // Go forward in history
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        // Return to current input
        setHistoryIndex(-1);
        setInputValue(tempInput);
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Throttled width change notification
  const notifyWidthChange = useCallback((newWidth: number) => {
    if (!onWidthChange || !isOpen) return;
    
    // Clear any existing timeout
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
    }
    
    // Only notify if width has changed significantly (more than 5px)
    if (Math.abs(newWidth - lastNotifiedWidthRef.current) < 5) return;
    
    // Throttle notifications to every 16ms (60fps)
    throttleTimeoutRef.current = setTimeout(() => {
      onWidthChange(newWidth);
      lastNotifiedWidthRef.current = newWidth;
    }, 16);
  }, [onWidthChange, isOpen]);

  // Notify parent when width changes (initial and final)
  useEffect(() => {
    if (onWidthChange && isOpen && !isResizing) {
      onWidthChange(width);
      lastNotifiedWidthRef.current = width;
    }
  }, [width, onWidthChange, isOpen, isResizing]);

  // Resize functionality with optimized performance
  useEffect(() => {
    let animationFrameId: number | null = null;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Use requestAnimationFrame for smooth updates
      animationFrameId = requestAnimationFrame(() => {
        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 250;
        const maxWidth = Math.min(600, window.innerWidth * 0.6);
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        setWidth(constrainedWidth);
        notifyWidthChange(constrainedWidth);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Send final width update
      if (onWidthChange && isOpen) {
        onWidthChange(width);
        lastNotifiedWidthRef.current = width;
      }
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isResizing, notifyWidthChange, onWidthChange, isOpen, width]);

  // Cleanup throttle timeout on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleSendMessage = async (messageOverride?: string) => {
    const messageToSend = messageOverride?.trim() || inputValue.trim();
    if (!messageToSend || isLoading) return;
    
    // Add to command history
    addToHistory(messageToSend);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create AI message for streaming updates (declare outside try block)
    const aiMessageId = (Date.now() + 1).toString();

    try {
      console.log('[AI CHAT DEBUG] Full gridContext received:', gridContext);
      console.log('[AI CHAT DEBUG] Sending to API:', {
        message: messageToSend,
        selectedGrid: gridContext.selectedGrid,
        selectedRowId: gridContext.selectedRowId,
        selectedRowData: gridContext.selectedRowData,
        availableGrids: gridContext.availableGrids,
        rowCount: gridContext.rowCount
      });

      // Add client-side timeout for streaming compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for streaming
      const aiMessage: Message = {
        id: aiMessageId,
        type: 'ai',
        content: '',
        timestamp: new Date(),
      };

      // Add empty AI message to show streaming is starting
      setMessages(prev => [...prev, aiMessage]);

      let streamingContent = '';
      let fullResponse = '';
      
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageToSend,
            gridContext,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          console.log('[AI CHAT DEBUG] Starting to read stream...');
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log('[AI CHAT DEBUG] Stream reading completed');
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  console.log('[AI CHAT DEBUG] Received data chunk:', data);
                  
                  if (data.error) {
                    throw new Error(data.error);
                  }
                  
                  if (data.complete) {
                    // Stream is complete, parse full response for actions
                    fullResponse = data.fullResponse;
                    console.log('[AI CHAT DEBUG] Full AI response received from server:', fullResponse);

                    // The message content is already finalized from the streaming process.
                    // We just need to parse the full response to find and execute the action.
                    if (fullResponse && onAction) {
                      try {
                        // Clean up response if it has extra text around JSON
                        let cleanedResponse = fullResponse.trim();

                        // Look for JSON block in the response
                        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
                        if (!jsonMatch) return; // Not a JSON response, no action to take.

                        cleanedResponse = jsonMatch[0];
                        console.log('[AI CHAT DEBUG] Parsing action from:', cleanedResponse);
                        const intent = JSON.parse(cleanedResponse);

                        // Validate that intent has required fields and execute action
                        if (intent.type && intent.response) {
                          onAction(intent);
                        }
                      } catch (parseError) {
                        console.log('[AI CHAT DEBUG] Action parsing failed:', parseError);
                      }
                    }
                  } else if (data.content) {
                    // Stream chunk received, update the message content
                    streamingContent += data.content;
                    
                    // Update the AI message with new content
                    setMessages(prev => prev.map(msg =>
                      msg.id === aiMessageId
                        ? { ...msg, content: streamingContent }
                        : msg
                    ));
                  }
                } catch (parseError) {
                  console.warn('Failed to parse streaming data:', parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      console.error('AI Chat Error:', error);
      
      let errorContent = 'Sorry, I encountered an error. ';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          errorContent = 'The request timed out. This might happen with complex prompts on the deployed version. Try a simpler command or break your request into smaller parts.';
        } else if (error.message.includes('timeout')) {
          errorContent = 'The request timed out. Try using shorter, simpler commands.';
        } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
          errorContent = 'Rate limit exceeded. Please wait a moment before trying again.';
        } else if (error.message.includes('network') || error.message.includes('fetch failed')) {
          errorContent = 'Network connection error. Please check your internet connection and try again.';
        } else {
          errorContent += error.message;
        }
      } else {
        errorContent += 'Unknown error occurred.';
      }
      
      // Update the existing AI message with error content, or remove it if empty
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, content: errorContent }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateHistory('up');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateHistory('down');
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const suggestedQueries = [
    "What is this app for?",
    "What are modifier settings?",
    "Duplicate Row",
    "Show me duplicates",
    "Export the data",
    "How does the matching work?",
  ];

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      variant="persistent"
      sx={{
        width: isOpen ? { xs: '90vw', sm: width } : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: { xs: '90vw', sm: width },
          maxWidth: 'none',
        },
      }}
    >
      {/* Resize Handle */}
      <Box
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'ew-resize',
          backgroundColor: 'transparent',
          zIndex: 1000,
          '&:hover': {
            backgroundColor: 'rgba(25, 118, 210, 0.3)',
          },
          display: { xs: 'none', sm: 'block' }, // Hide on mobile
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'rgba(25, 118, 210, 0.6)',
            fontSize: '12px',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          <DragIcon sx={{ fontSize: '16px' }} />
        </Box>
      </Box>

      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'primary.main',
            color: 'white',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <AIIcon />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">AI Assistant</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Working with:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={selectedGrid}
                    onChange={(e) => onGridChange(e.target.value as typeof selectedGrid)}
                    sx={{
                      color: 'white',
                      fontSize: '0.75rem',
                      height: '24px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                    }}
                  >
                    {Object.entries(gridContext.availableGrids).map(([grid, data]) => (
                      data.hasData && (
                        <MenuItem key={grid} value={grid}>
                          {grid.toUpperCase()} ({data.rowCount})
                        </MenuItem>
                      )
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>
          <Box>
            <IconButton size="small" onClick={onClose} sx={{ color: 'white' }} title="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 1,
          }}
        >
          {messages.length === 0 && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Box sx={{ 
                mb: 2, 
                p: 2, 
                border: '2px solid #1976d2', 
                borderRadius: 2,
                backgroundColor: 'rgba(25, 118, 210, 0.05)'
              }}>
                <Typography variant="body2" color="primary" fontWeight="bold" gutterBottom>
                  🎯 Currently focused on: {selectedGrid.toUpperCase()} grid
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This grid will glow with a blue border and commands will apply to it by default
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Ask me about your data OR about the CDM Merge Tool itself! Try:
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                {suggestedQueries.map((query, index) => (
                  <Chip
                    key={index}
                    label={query}
                    size="small"
                    variant="outlined"
                    onClick={() => handleSendMessage(query)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <List sx={{ p: 0 }}>
            {messages.map((message) => (
              <ListItem key={message.id} sx={{ px: 0.5, py: 0.5, display: 'block' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 0.75,
                    flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      bgcolor: message.type === 'user' ? 'primary.main' : 'secondary.main',
                      fontSize: '0.9rem',
                    }}
                  >
                    {message.type === 'user' ? <PersonIcon /> : <AIIcon />}
                  </Avatar>
                  <Box
                    sx={{
                      p: 1.5,
                      maxWidth: '95%',
                      bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                      color: message.type === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
                      flex: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {message.content}
                    </Typography>
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>

          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid #e0e0e0',
          }}
        >
          {messages.length > 0 && (
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClearChat}
              sx={{ fontSize: '0.75rem', py: 0.25, mb: 1, minHeight: '28px' }}
            >
              Clear Chat
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              placeholder={historyIndex >= 0 ? "Navigating history (↑↓ to browse)" : "Ask about your data..."}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Reset history navigation when user types
                if (historyIndex >= 0) {
                  setHistoryIndex(-1);
                  setTempInput('');
                }
              }}
              onKeyPress={handleKeyPress}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: historyIndex >= 0 ? '#f5f5f5' : 'inherit',
                  '& fieldset': {
                    borderColor: historyIndex >= 0 ? '#1976d2' : undefined,
                  }
                }
              }}
            />
            <IconButton
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              color="primary"
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
