import { useState, useCallback, useEffect, useRef } from 'react';

export interface AIIntegrationState {
  isChatOpen: boolean;
  chatWidth: number;
  selectedGrid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates';
  isProcessing: boolean;
  lastResponse: string | null;
  error: string | null;
  chatHistory: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    intent?: string;
    action?: string;
    parameters?: any;
    gridContext?: string;
    affectedRows?: number[];
  };
}

export interface AIActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  modifiedRows?: number[];
}

export interface UseAIIntegrationReturn extends AIIntegrationState {
  // Chat management
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  setChatWidth: (width: number) => void;
  setSelectedGrid: (grid: 'master' | 'client' | 'merged' | 'unmatched' | 'duplicates') => void;
  
  // Message handling
  sendMessage: (message: string, overrideMessage?: string) => Promise<void>;
  clearChatHistory: () => void;
  addSystemMessage: (message: string) => void;
  
  // AI Actions
  executeAIAction: (action: any) => Promise<AIActionResult>;
  
  // State management
  setIsProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Context management
  getGridContext: () => {
    currentGrid: string;
    dataCount: number;
    selectedRows: number;
    searchTerm: string;
  };
  
  // Persistence
  saveChatHistory: () => void;
  loadChatHistory: () => void;
  
  // Utility functions
  formatAIResponse: (response: string) => string;
  generateSuggestedQueries: () => string[];
  isValidAIAction: (action: any) => boolean;
}

export function useAIIntegration(): UseAIIntegrationReturn {
  // Core state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatWidth, setChatWidthState] = useState(320);
  const [selectedGrid, setSelectedGrid] = useState<'master' | 'client' | 'merged' | 'unmatched' | 'duplicates'>('merged');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Refs for stable callbacks
  const abortController = useRef<AbortController | null>(null);

  // Load chat state from localStorage on mount
  useEffect(() => {
    const savedChatOpen = localStorage.getItem('aiChatOpen');
    const savedChatWidth = localStorage.getItem('aiChatWidth');
    const savedSelectedGrid = localStorage.getItem('aiSelectedGrid');

    if (savedChatOpen === 'true') {
      setIsChatOpen(true);
    }
    if (savedChatWidth) {
      const width = parseInt(savedChatWidth, 10);
      if (width >= 280 && width <= 800) {
        setChatWidthState(width);
      }
    }
    if (savedSelectedGrid && ['master', 'client', 'merged', 'unmatched', 'duplicates'].includes(savedSelectedGrid)) {
      setSelectedGrid(savedSelectedGrid as any);
    }
  }, []);

  // Save chat state to localStorage
  useEffect(() => {
    localStorage.setItem('aiChatOpen', isChatOpen.toString());
  }, [isChatOpen]);

  useEffect(() => {
    localStorage.setItem('aiChatWidth', chatWidth.toString());
  }, [chatWidth]);

  useEffect(() => {
    localStorage.setItem('aiSelectedGrid', selectedGrid);
  }, [selectedGrid]);

  // Chat management
  const openChat = useCallback(() => {
    setIsChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => !prev);
  }, []);

  const setChatWidth = useCallback((width: number) => {
    const clampedWidth = Math.max(280, Math.min(800, width));
    setChatWidthState(clampedWidth);
  }, []);

  // Message handling
  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addMessage = useCallback((message: Omit<ChatMessage, 'id'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: generateMessageId(),
    };
    setChatHistory(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  const addSystemMessage = useCallback((message: string) => {
    addMessage({
      timestamp: new Date(),
      type: 'system',
      content: message,
    });
  }, [addMessage]);

  const sendMessage = useCallback(async (message: string, overrideMessage?: string) => {
    if (isProcessing) return;

    const actualMessage = overrideMessage || message;
    
    // Add user message to history
    addMessage({
      timestamp: new Date(),
      type: 'user',
      content: actualMessage,
      metadata: {
        gridContext: selectedGrid,
      },
    });

    setIsProcessing(true);
    setError(null);

    try {
      // Cancel any existing request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: actualMessage,
          context: {
            selectedGrid,
            chatHistory: chatHistory.slice(-10), // Send last 10 messages for context
          },
        }),
        signal: abortController.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let assistantMessage = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMessage += data.content;
              }
              if (data.done) {
                // Add complete assistant message
                addMessage({
                  timestamp: new Date(),
                  type: 'assistant',
                  content: assistantMessage,
                  metadata: data.metadata,
                });
                setLastResponse(assistantMessage);
                return;
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      const errorMessage = error.message || 'Failed to get AI response';
      setError(errorMessage);
      addMessage({
        timestamp: new Date(),
        type: 'system',
        content: `Error: ${errorMessage}`,
      });
    } finally {
      setIsProcessing(false);
      abortController.current = null;
    }
  }, [isProcessing, selectedGrid, chatHistory, addMessage]);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
    setLastResponse(null);
    setError(null);
  }, []);

  // AI Actions
  const executeAIAction = useCallback(async (action: any): Promise<AIActionResult> => {
    try {
      setIsProcessing(true);
      
      // This would typically call the parent component's action handlers
      // For now, we'll return a mock result
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
      
      addSystemMessage(`Executed action: ${action.type || 'unknown'}`);
      
      return {
        success: true,
        message: `Successfully executed ${action.type || 'action'}`,
        data: action,
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to execute AI action';
      setError(errorMessage);
      
      return {
        success: false,
        message: 'Action failed',
        error: errorMessage,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [addSystemMessage]);

  // State management
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context management
  const getGridContext = useCallback(() => {
    // This would typically get data from the parent component
    // For now, return mock data
    return {
      currentGrid: selectedGrid,
      dataCount: 0,
      selectedRows: 0,
      searchTerm: '',
    };
  }, [selectedGrid]);

  // Persistence
  const saveChatHistory = useCallback(() => {
    try {
      const historyToSave = chatHistory.slice(-50); // Keep only last 50 messages
      localStorage.setItem('aiChatHistory', JSON.stringify(historyToSave));
    } catch (error) {
      console.warn('Failed to save chat history:', error);
    }
  }, [chatHistory]);

  const loadChatHistory = useCallback(() => {
    try {
      const savedHistory = localStorage.getItem('aiChatHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setChatHistory(parsedHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })));
      }
    } catch (error) {
      console.warn('Failed to load chat history:', error);
    }
  }, []);

  // Auto-save chat history
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (chatHistory.length > 0) {
        saveChatHistory();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [chatHistory, saveChatHistory]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Utility functions
  const formatAIResponse = useCallback((response: string) => {
    // Basic formatting for AI responses
    return response
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }, []);

  const generateSuggestedQueries = useCallback(() => {
    const baseQueries = [
      "Show me records with missing HCPCS codes",
      "Find duplicate entries in the current data",
      "Count rows by procedure type",
      "Export selected records to Excel",
      "Filter records from the last month",
    ];

    const gridSpecificQueries = {
      master: [
        "Show master data statistics",
        "Find incomplete master records",
      ],
      client: [
        "Show client data overview",
        "Validate client data format",
      ],
      merged: [
        "Show merge statistics",
        "Find records that didn't match",
      ],
      unmatched: [
        "Why didn't these records match?",
        "Show matching suggestions",
      ],
      duplicates: [
        "Remove duplicate records",
        "Show duplicate patterns",
      ],
    };

    return [
      ...baseQueries,
      ...(gridSpecificQueries[selectedGrid] || []),
    ];
  }, [selectedGrid]);

  const isValidAIAction = useCallback((action: any) => {
    if (!action || typeof action !== 'object') return false;
    
    const validTypes = ['query', 'action', 'filter', 'sort', 'analysis', 'documentation'];
    return validTypes.includes(action.type);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    // State
    isChatOpen,
    chatWidth,
    selectedGrid,
    isProcessing,
    lastResponse,
    error,
    chatHistory,

    // Chat management
    openChat,
    closeChat,
    toggleChat,
    setChatWidth,
    setSelectedGrid,

    // Message handling
    sendMessage,
    clearChatHistory,
    addSystemMessage,

    // AI Actions
    executeAIAction,

    // State management
    setIsProcessing,
    setError,
    clearError,

    // Context management
    getGridContext,

    // Persistence
    saveChatHistory,
    loadChatHistory,

    // Utility functions
    formatAIResponse,
    generateSuggestedQueries,
    isValidAIAction,
  };
}