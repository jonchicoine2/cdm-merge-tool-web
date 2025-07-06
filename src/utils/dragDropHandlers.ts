import React from 'react';

interface DragDropCallbacks {
  setDragOverMaster: (isDragOver: boolean) => void;
  setDragOverClient: (isDragOver: boolean) => void;
  handleFileUpload: (file: File, which: "Master" | "Client") => void;
}

export const createDragDropHandlers = (callbacks: DragDropCallbacks) => {
  const handleDragEnter = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") callbacks.setDragOverMaster(true);
    else callbacks.setDragOverClient(true);
  };

  const handleDragLeave = (which: "Master" | "Client") => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (which === "Master") callbacks.setDragOverMaster(false);
    else callbacks.setDragOverClient(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master") callbacks.setDragOverMaster(false);
    else callbacks.setDragOverClient(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      callbacks.handleFileUpload(files[0], which);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, which: "Master" | "Client") => {
    e.preventDefault();
    if (which === "Master" && callbacks.setDragOverMaster) callbacks.setDragOverMaster(true);
    if (which === "Client" && callbacks.setDragOverClient) callbacks.setDragOverClient(true);
  };

  return {
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragOver
  };
};