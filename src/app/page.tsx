'use client';

import React, { useState } from 'react';
import UploadZone from '@/components/UploadZone';
import ExtractedList from '@/components/ExtractedList';
import ResultTable from '@/components/ResultTable';
import ManualForm from '@/components/ManualForm';
import CopyAllButton from '@/components/CopyAllButton';
import { Course, ExtractResponse, LookupResponse, LookupResult } from '@/lib/types';

type AppState = 'idle' | 'uploading' | 'extracting' | 'reviewing' | 'looking_up' | 'done';

const MAX_WIDTH = 1200;
const QUALITY = 0.85;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Home() {
  const [state, setState] = useState<AppState>('idle');
  const [courses, setCourses] = useState<Course[]>([]);
  const [results, setResults] = useState<LookupResult[]>([]);
  const [fallbackReason, setFallbackReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>('AI');

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB');
      return;
    }

    setState('extracting');
    setError(null);
    setModelLabel('AI');

    try {
      const imageData = await resizeImage(file);

      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to extract courses from image');
      }

      const data: ExtractResponse = await response.json();

      if (data.fallback_reason) {
        setModelLabel('model alternatif');
      }

      if (data.success && data.courses.length > 0) {
        setCourses(data.courses);
        setFallbackReason(data.fallback_reason);
        setState('reviewing');
      } else {
        setError('Tidak ada mata kuliah terdeteksi. Silakan gunakan input manual.');
        setState('idle');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const msg = err instanceof Error ? err.message : 'Gagal membaca gambar';
      setError(`${msg}. Silakan gunakan input manual.`);
      setState('idle');
    }
  };

  const handleLookup = async (coursesToLookup: Course[]) => {
    setState('looking_up');
    setError(null);

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courses: coursesToLookup }),
      });

      if (!response.ok) {
        throw new Error('Failed to lookup courses');
      }

      const data: LookupResponse = await response.json();
      setResults(data.results);
      setState('done');
    } catch (err) {
      console.error('Lookup error:', err);
      setError('Gagal mencari kode enroll. Silakan coba lagi.');
      setState('reviewing');
    }
  };

  const handleReset = () => {
    setState('idle');
    setCourses([]);
    setResults([]);
    setFallbackReason(undefined);
    setError(null);
    setModelLabel('AI');
  };

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pencari Kode Enroll
          </h1>
          <p className="text-gray-600">
            Upload screenshot jadwal KRS untuk mendapatkan kode enroll otomatis
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {state === 'idle' || state === 'extracting' ? (
          <UploadZone
            onUpload={handleUpload}
            isLoading={state === 'extracting'}
            modelLabel={modelLabel}
          />
        ) : null}

        {state === 'reviewing' && (
          <ExtractedList
            courses={courses}
            onCoursesChange={setCourses}
            onSubmit={() => handleLookup(courses)}
            isLoading={false}
            fallbackReason={fallbackReason}
          />
        )}

        {state === 'looking_up' && (
          <div className="text-center py-12">
            <div className="animate-spin text-4xl mb-4 inline-block">⚙️</div>
            <p className="text-lg text-gray-600">Mencari kode enroll...</p>
          </div>
        )}

        {state === 'done' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <CopyAllButton results={results} />
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Upload Baru
              </button>
            </div>
            <ResultTable results={results} />
          </>
        )}

        {(state === 'idle' || state === 'extracting') && (
          <div className="mt-8">
            <ManualForm
              onSubmit={handleLookup}
              isLoading={false}
            />
          </div>
        )}
      </div>
    </main>
  );
}
