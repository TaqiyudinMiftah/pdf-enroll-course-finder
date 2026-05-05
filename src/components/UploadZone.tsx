'use client';

import React, { useCallback } from 'react';

interface UploadZoneProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
  modelLabel?: string;
}

export default function UploadZone({ onUpload, isLoading, modelLabel = 'AI' }: UploadZoneProps) {
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
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isLoading
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-blue-500'
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
      <label htmlFor="file-upload" className="cursor-pointer block">
        {isLoading ? (
          <>
            <div className="animate-spin text-4xl mb-4 inline-block">⚙️</div>
            <p className="text-lg font-medium text-blue-700 mb-2">
              Membaca jadwal dengan {modelLabel}...
            </p>
            <p className="text-sm text-gray-500">
              Proses ini bisa memakan waktu 10-60 detik
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">📤</div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              Klik atau drag & drop screenshot jadwal KRS
            </p>
            <p className="text-sm text-gray-500">
              Format: JPG, PNG, WebP (maks 5MB)
            </p>
          </>
        )}
      </label>
    </div>
  );
}
