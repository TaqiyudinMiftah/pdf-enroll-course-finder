'use client';

import React, { useCallback } from 'react';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  isLoading?: boolean;
  onManualClick?: () => void;
}

export default function UploadZone({ onUpload, isLoading = false, onManualClick }: UploadZoneProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  return (
    <div className="w-full max-w-[480px] bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`w-full border-2 border-dashed border-primary-container rounded-xl bg-surface-container-low p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container transition-colors group ${
          isLoading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          className="hidden"
          id="file-upload"
          disabled={isLoading}
        />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-primary text-[32px]">cloud_upload</span>
          </div>
          <p className="font-body-md font-semibold text-slate-900 mb-1 text-center">
            Drag & drop screenshot jadwal, atau klik untuk pilih file
          </p>
          <p className="text-body-sm text-slate-500">JPG, PNG, WebP · Maks 5MB</p>
        </label>
      </div>

      {/* Separator */}
      <div className="w-full flex items-center gap-4 my-6">
        <div className="h-[1px] flex-grow bg-slate-200" />
        <span className="text-label text-slate-400 font-medium">atau</span>
        <div className="h-[1px] flex-grow bg-slate-200" />
      </div>

      {/* Manual Link */}
      <button
        onClick={onManualClick}
        className="font-body-md font-semibold text-primary hover:underline flex items-center gap-1 transition-all"
      >
        Input manual
        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </div>
  );
}
