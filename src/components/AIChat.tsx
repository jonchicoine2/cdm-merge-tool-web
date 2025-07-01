'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Minimize as MinimizeIcon,
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
  onMinimize: () => void;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  onGridChange: (grid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => void;
  onWidthChange?: (width: number) => void;
}

export default function AIChat({ gridContext, onAction, isOpen, onClose, onMinimize, selectedGrid, onGridChange, onWidthChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [width, setWidth] = useState(320); // Reduced from 400 to 320
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Notify parent when width changes
  useEffect(() => {
    if (onWidthChange && isOpen) {
      onWidthChange(width);
    }
  }, [width, onWidthChange, isOpen]);

  // Resize functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 250;
      const maxWidth = Math.min(600, window.innerWidth * 0.6);
      
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          gridContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.intent.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Execute the action if provided and callback exists
      if (data.intent && onAction) {
        onAction(data.intent);
      }

    } catch (error) {
      console.error('AI Chat Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleClearChat = () => {
    setMessages([]);
  };

  const suggestedQueries = [
    "What is this app for?",
    "What are modifier settings?",
    "Show me duplicates", 
    "Export the data",
    "How does the matching work?",
    "What are modifiers?",
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
            <IconButton size="small" onClick={onMinimize} sx={{ color: 'white', mr: 1 }} title="Minimize">
              <MinimizeIcon />
            </IconButton>
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
                    onClick={() => setInputValue(query)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <List sx={{ p: 0 }}>
            {messages.map((message) => (
              <ListItem key={message.id} sx={{ px: 1, py: 0.5, display: 'block' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    flexDirection: message.type === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: message.type === 'user' ? 'primary.main' : 'secondary.main',
                    }}
                  >
                    {message.type === 'user' ? <PersonIcon /> : <AIIcon />}
                  </Avatar>
                  <Box
                    sx={{
                      p: 1.5,
                      maxWidth: '75%',
                      bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                      color: message.type === 'user' ? 'white' : 'text.primary',
                      borderRadius: 2,
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
              placeholder="Ask about your data..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              size="small"
            />
            <IconButton
              onClick={handleSendMessage}
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
