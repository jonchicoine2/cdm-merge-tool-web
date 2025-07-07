'use client';

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Clear as ClearIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useAIIntegration, ChatMessage } from '../hooks/useAIIntegration';

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

export interface AIChatHandle {
  sendMessage: (message: string, overrideMessage?: string) => void;
}

const AIChat = forwardRef<AIChatHandle, AIChatProps>(({ gridContext, onAction, isOpen, onClose, selectedGrid, onGridChange, onWidthChange }, ref) => {
  const {
    chatHistory: messages,
    isProcessing: isLoading,
    sendMessage,
    clearChatHistory,
    generateSuggestedQueries,
  } = useAIIntegration(onAction);

  const [inputValue, setInputValue] = useState('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [width, setWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [includeContext, setIncludeContext] = useState(false);
  
  // Command history state
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means current input, 0+ means history index
  const [tempInput, setTempInput] = useState(''); // Store current input when navigating history
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotifiedWidthRef = useRef<number>(320);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    sendMessage: (message: string, overrideMessage?: string) => {
      sendMessage(message, overrideMessage, gridContext);
    },
  }));

  // Command history functions
  const addToHistory = (command: string) => {
    if (command.trim() && command !== commandHistory[0]) {
      setCommandHistory(prev => {
        const newHistory = [command, ...prev].slice(0, 10); // Keep only last 10 commands
        console.log('[COMMAND HISTORY] Added command:', command, 'Total commands:', newHistory.length);
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai-chat-history', JSON.stringify(newHistory));
        }
        
        return newHistory;
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

  // Clear timer when loading stops
  useEffect(() => {
    if (!isLoading && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, [isLoading]);

  // Load command history and context setting from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedHistory = localStorage.getItem('ai-chat-history');
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          if (Array.isArray(parsedHistory)) {
            setCommandHistory(parsedHistory);
            console.log('[COMMAND HISTORY] Loaded from localStorage:', parsedHistory.length, 'commands');
          }
        }
        
        const savedContextSetting = localStorage.getItem('ai-chat-include-context');
        if (savedContextSetting !== null) {
          setIncludeContext(savedContextSetting === 'true');
          console.log('[CONTEXT SETTING] Loaded from localStorage:', savedContextSetting);
        }
      } catch (error) {
        console.warn('[CHAT SETTINGS] Error loading from localStorage:', error);
      }
    }
  }, []);

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

  // Cleanup throttle timeout and timer on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleSendMessage = (messageOverride?: string) => {
    const messageToSend = messageOverride || inputValue;
    console.log('[AI CHAT DEBUG] handleSendMessage called with:', { messageOverride, messageToSend });
    
    if (messageToSend.trim()) {
      console.log('[AI CHAT DEBUG] Sending message to AI:', messageToSend);
      
      // Start timer
      const startTime = Date.now();
      setElapsedTime(0);
      
      // Clear any existing timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Start new timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      
      sendMessage(messageToSend, undefined, gridContext);
      addToHistory(messageToSend);
      setInputValue('');
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
    clearChatHistory();
  };

  const handleContextToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setIncludeContext(newValue);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-chat-include-context', newValue.toString());
      console.log('[CONTEXT SETTING] Saved to localStorage:', newValue);
    }
  };

  const suggestedQueries = generateSuggestedQueries();

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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeContext}
                      onChange={handleContextToggle}
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: 'white',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: 'rgba(255,255,255,0.5)',
                        },
                        '& .MuiSwitch-track': {
                          backgroundColor: 'rgba(255,255,255,0.3)',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="caption" sx={{ opacity: 0.8, color: 'white', fontSize: '0.7rem' }}>
                      Include chat context
                    </Typography>
                  }
                  sx={{ margin: 0 }}
                />
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
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>
                {(elapsedTime / 1000).toFixed(1)}s
              </Typography>
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
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                } else {
                  handleKeyDown(event);
                }
              }}
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
});

AIChat.displayName = 'AIChat';

export default AIChat;
