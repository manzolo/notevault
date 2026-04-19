'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Attachment } from '@/lib/types';

interface PasteAndDropOptions {
  uploadAttachment: (file: File) => Promise<Attachment>;
  onMultipleFiles: (files: File[]) => void;
  uploadLabel: string;
}

export function usePasteAndDrop({ uploadAttachment, onMultipleFiles, uploadLabel }: PasteAndDropOptions) {
  const [pasteFile, setPasteFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pastePreviewUrl, setPastePreviewUrl] = useState('');
  const [pasteUploading, setPasteUploading] = useState(false);
  const [pasteUploadFiles, setPasteUploadFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const openPasteModal = useCallback((file: File) => {
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const defaultName = `pasted-image-${Date.now()}.${ext}`;
    setPasteName(defaultName);
    setPastePreviewUrl(URL.createObjectURL(file));
    setPasteFile(file);
    setTimeout(() => filenameInputRef.current?.select(), 50);
  }, []);

  const handlePasteConfirm = useCallback(async () => {
    if (!pasteFile) return;
    setPasteUploading(true);
    try {
      const namedFile = new File([pasteFile], pasteName, { type: pasteFile.type });
      await uploadAttachment(namedFile);
      toast.success(`${pasteName} ${uploadLabel}`);
    } catch {
      toast.error('Failed to upload pasted image');
    } finally {
      setPasteUploading(false);
      URL.revokeObjectURL(pastePreviewUrl);
      setPasteFile(null);
      setPastePreviewUrl('');
    }
  }, [pasteFile, pasteName, pastePreviewUrl, uploadAttachment, uploadLabel]);

  const handlePasteCancel = useCallback(() => {
    URL.revokeObjectURL(pastePreviewUrl);
    setPasteFile(null);
    setPasteName('');
    setPastePreviewUrl('');
  }, [pastePreviewUrl]);

  // Document-level paste listener
  useEffect(() => {
    const handleDocumentPaste = (e: ClipboardEvent) => {
      if (filenameInputRef.current && document.activeElement === filenameInputRef.current) return;
      if (pasteFile) return;
      if (document.activeElement?.closest('[data-image-paste-zone]')) return;

      const pastedFiles: File[] = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (pastedFiles.length === 0) {
        pastedFiles.push(...Array.from(e.clipboardData?.files ?? []));
      }
      if (pastedFiles.length === 0) return;
      e.preventDefault();

      if (pastedFiles.length === 1 && pastedFiles[0].type.startsWith('image/')) {
        openPasteModal(pastedFiles[0]);
      } else {
        setPasteUploadFiles(pastedFiles);
        onMultipleFiles(pastedFiles);
      }
    };

    document.addEventListener('paste', handleDocumentPaste);
    return () => document.removeEventListener('paste', handleDocumentPaste);
  }, [pasteFile, openPasteModal, onMultipleFiles]);

  // Document-level drag-and-drop listener
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setIsDragging(true);
    };
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };
    const handleDragLeave = () => {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setIsDragging(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
      if (droppedFiles.length === 0) return;
      if (droppedFiles.length === 1 && droppedFiles[0].type.startsWith('image/')) {
        openPasteModal(droppedFiles[0]);
      } else {
        setPasteUploadFiles(droppedFiles);
        onMultipleFiles(droppedFiles);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [openPasteModal, onMultipleFiles]);

  return {
    pasteFile,
    pasteName,
    setPasteName,
    pastePreviewUrl,
    pasteUploading,
    pasteUploadFiles,
    setPasteUploadFiles,
    isDragging,
    filenameInputRef,
    handlePasteConfirm,
    handlePasteCancel,
  };
}
