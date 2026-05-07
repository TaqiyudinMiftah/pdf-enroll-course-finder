'use client';

import React, { useState } from 'react';
import UploadZone from '@/components/UploadZone';
import ExtractedList from '@/components/ExtractedList';
import ResultTable from '@/components/ResultTable';
import ManualForm from '@/components/ManualForm';
import CopyAllButton from '@/components/CopyAllButton';
import { Course, ExtractResponse, LookupResponse, LookupResult } from '@/lib/types';

type AppState = 'idle' | 'manual' | 'extracting' | 'reviewing' | 'looking_up' | 'done';

const MAX_WIDTH = 1200;
const QUALITY = 0.85;

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
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
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrl);
      } catch {
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch {
          reject(new Error('Canvas toDataURL failed'));
        }
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}

function StepIndicator({ activeStep }: { activeStep: number }) {
  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Periksa hasil' },
    { num: 3, label: 'Kode enroll' },
  ];

  return (
    <div className="flex items-center justify-center mb-12 gap-4 md:gap-8">
      {steps.map((step, idx) => {
        const isActive = step.num === activeStep;
        const isPast = step.num < activeStep;
        return (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div className="h-px w-8 md:w-12 bg-slate-200" />
            )}
            <div className={`flex items-center gap-2 ${isActive ? 'text-primary' : 'text-slate-400'}`}>
              <span
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  isActive
                    ? 'bg-primary text-white'
                    : isPast
                    ? 'bg-primary text-white'
                    : 'border border-slate-300'
                }`}
              >
                {step.num}
              </span>
              <span className="font-h3 text-body-sm font-semibold">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TopAppBar({ state }: { state: AppState }) {
  const isReviewOrDone = state === 'reviewing' || state === 'looking_up' || state === 'done';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="flex justify-between items-center h-16 w-full max-w-[1280px] mx-auto px-6 md:px-12">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-700 text-2xl">school</span>
          <span className="text-xl font-bold tracking-tight text-slate-900 font-h2">Cari Kode Enroll</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a
            className={`text-sm font-medium py-5 transition-colors ${
              state === 'idle' || state === 'manual'
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            href="#"
          >
            Beranda
          </a>
          <a
            className={`text-sm font-medium py-5 transition-colors ${
              isReviewOrDone
                ? 'text-blue-700 border-b-2 border-blue-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            href="#"
          >
            Riwayat
          </a>
          <a className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors py-5" href="#">
            Panduan
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500 text-[20px]">account_circle</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-12 w-full max-w-[1280px] mx-auto px-6 md:px-12">
        <p className="font-body-sm text-slate-500">Sistem Akademik Fakultas — tidak menyimpan data apapun</p>
        <div className="flex gap-8">
          <a className="font-body-sm text-slate-500 hover:text-blue-600 transition-colors" href="#">
            Kebijakan Privasi
          </a>
          <a className="font-body-sm text-slate-500 hover:text-blue-600 transition-colors" href="#">
            Bantuan
          </a>
        </div>
      </div>
    </footer>
  );
}

function FeatureBadges() {
  const badges = [
    { icon: 'bolt', label: 'Proses Instan' },
    { icon: 'verified_user', label: 'Aman & Privat' },
    { icon: 'auto_awesome', label: 'Deteksi Otomatis' },
  ];

  return (
    <div className="mt-20 flex flex-wrap justify-center gap-2">
      {badges.map((b) => (
        <div key={b.icon} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full">
          <span className="material-symbols-outlined text-primary text-[18px]">{b.icon}</span>
          <span className="text-label text-slate-600">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function ExtractingView({ fileName }: { fileName?: string }) {
  return (
    <main className="flex-grow flex flex-col items-center px-6 py-20">
      <div className="max-w-[800px] w-full">
        <div className="bg-white border border-outline-variant rounded-xl p-6 md:p-10 shadow-sm">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container/10 mb-6">
              <span className="material-symbols-outlined text-primary text-3xl animate-pulse">sync</span>
            </div>
            <h2 className="font-h2 text-h2 text-on-background mb-2">Reading your schedule...</h2>
            <p className="font-body-md text-on-surface-variant max-w-[500px] mx-auto">
              Hang tight! We&apos;re analyzing your KRS to identify your courses, lecturers, and class schedules automatically.
            </p>
          </div>

          <div className="bg-surface-container-low rounded-xl p-6 mb-12">
            <div className="flex justify-between items-center mb-1">
              <span className="font-label text-label text-primary uppercase tracking-wider">Extraction Progress</span>
              <span className="font-label text-label text-on-surface">65%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-3 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full rounded-full transition-all duration-1000 ease-out w-[65%]" />
            </div>
            <p className="mt-3 text-center font-body-sm text-on-surface-variant italic">
              &quot;Almost there! We&apos;re identifying your subjects and classes...&quot;
            </p>
          </div>

          {fileName && (
            <div className="border border-outline-variant border-dashed rounded-lg p-6 bg-background flex items-center gap-6">
              <div className="w-20 h-24 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center">
                <span className="material-symbols-outlined text-outline text-3xl">description</span>
              </div>
              <div className="flex-grow">
                <div className="font-label text-label text-outline mb-1 uppercase">Uploaded File</div>
                <h3 className="font-h3 text-body-lg text-on-background">{fileName}</h3>
                <div className="flex items-center gap-2 text-on-surface-variant text-body-sm">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>Upload successful</span>
                </div>
              </div>
              <div className="hidden md:block">
                <span className="material-symbols-outlined text-outline">more_vert</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="flex flex-col items-center text-center p-6">
            <span className="material-symbols-outlined text-primary mb-3">security</span>
            <h4 className="font-h3 text-body-md mb-1">Secure Processing</h4>
            <p className="text-body-sm text-on-surface-variant">Your data is processed locally and never stored on our servers.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6">
            <span className="material-symbols-outlined text-primary mb-3">bolt</span>
            <h4 className="font-h3 text-body-md mb-1">Fast Extraction</h4>
            <p className="text-body-sm text-on-surface-variant">OCR technology identifies courses in under 5 seconds.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6">
            <span className="material-symbols-outlined text-primary mb-3">edit_note</span>
            <h4 className="font-h3 text-body-md mb-1">Manual Review</h4>
            <p className="text-body-sm text-on-surface-variant">You&apos;ll have a chance to review and edit everything before saving.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function LookingUpView() {
  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-[1280px] grid grid-cols-1 lg:grid-cols-12 gap-20 items-center">
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center px-3 py-1 bg-secondary-container text-primary rounded-full text-label uppercase tracking-widest">
            Academic Registry
          </div>
          <h1 className="font-h1 text-h1 text-on-surface">Digital Intelligence for your Academic Journey.</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
            Our AI-powered engine is currently analyzing your semester schedule to extract course codes, credits, and timing for a seamless enrollment experience.
          </p>
          <div className="flex items-center gap-6 pt-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400">person</span>
                </div>
              ))}
            </div>
            <span className="text-label text-on-surface-variant">JOINED BY 2,000+ STUDENTS TODAY</span>
          </div>
        </div>

        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[480px] h-[360px] rounded-xl border-2 border-primary-container bg-white overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-4 right-4 z-20">
              <span className="bg-primary px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-tighter shadow-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                Menggunakan AI Nemotron
              </span>
            </div>
            <div className="relative z-10 bg-white/70 backdrop-blur-sm p-8 rounded-xl flex flex-col items-center text-center shadow-lg border border-white/50">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin-custom" />
              </div>
              <h3 className="font-h3 text-primary mb-1">Membaca jadwal kuliah...</h3>
              <p className="font-body-sm text-slate-500">Biasanya selesai dalam 5–10 detik</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
              <div className="h-full bg-primary w-2/3 transition-all duration-1000 ease-in-out" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>('idle');
  const [courses, setCourses] = useState<Course[]>([]);
  const [results, setResults] = useState<LookupResult[]>([]);
  const [fallbackReason, setFallbackReason] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran file maksimal 5MB');
      return;
    }
    setFileName(file.name);
    setState('extracting');
    setError(null);

    try {
      const imageData = await resizeImage(file);
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data: ExtractResponse = await response.json();

      if (data.success && data.courses.length > 0) {
        setCourses(data.courses);
        setFallbackReason(data.fallback_reason);
        setState('reviewing');
      } else {
        setError('Tidak ada mata kuliah terdeteksi. Silakan gunakan input manual.');
        setState('idle');
      }
    } catch (err) {
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
    setFileName('');
  };

  const handleManualSubmit = (manualCourses: Course[]) => {
    setCourses(manualCourses);
    setState('reviewing');
  };

  const foundCount = results.filter((r) => r.found).length;
  const totalCount = results.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-on-background font-body-md">
      <TopAppBar state={state} />

      {state === 'idle' && (
        <main className="flex-grow flex flex-col items-center justify-center px-6 py-20">
          <div className="max-w-[1280px] w-full flex flex-col items-center text-center">
            <div className="mb-12">
              <h1 className="font-h1 text-h1 text-slate-900 mb-2 max-w-2xl">
                Upload jadwal KRS-mu, dapatkan kode enroll seketika
              </h1>
              <p className="font-body-lg text-body-lg text-slate-600">
                Tidak perlu buka Looker Studio lagi. Cukup foto atau screenshot jadwal.
              </p>
            </div>

            <UploadZone onUpload={handleUpload} onManualClick={() => setState('manual')} />
            <FeatureBadges />
          </div>
        </main>
      )}

      {state === 'manual' && (
        <main className="flex-grow px-6 py-10">
          <div className="max-w-[1000px] mx-auto">
            <button
              onClick={() => setState('idle')}
              className="flex items-center gap-2 text-primary font-body-sm mb-2 hover:opacity-80 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="font-medium">Kembali ke upload</span>
            </button>
            <div className="mb-12">
              <h1 className="font-h2 text-h2 text-on-surface mb-1">Input manual mata kuliah</h1>
              <p className="font-body-md text-on-surface-variant">Ketik nama mata kuliah dan kelas secara langsung</p>
            </div>
            <ManualForm onSubmit={handleManualSubmit} />
          </div>
        </main>
      )}

      {state === 'extracting' && <ExtractingView fileName={fileName} />}

      {state === 'reviewing' && (
        <main className="flex-grow px-6 py-10">
          <div className="max-w-[1280px] mx-auto">
            <StepIndicator activeStep={2} />
            <ExtractedList
              courses={courses}
              onCoursesChange={setCourses}
              onSubmit={() => handleLookup(courses)}
              onReset={handleReset}
              fallbackReason={fallbackReason}
            />
          </div>
        </main>
      )}

      {state === 'looking_up' && <LookingUpView />}

      {state === 'done' && (
        <main className="flex-grow px-6 py-10">
          <div className="max-w-[1280px] mx-auto">
            <StepIndicator activeStep={3} />

            {/* Summary Bar */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 text-white rounded-full p-1 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">check</span>
                </div>
                <p className="font-body-md font-semibold text-green-800">
                  {foundCount} dari {totalCount} mata kuliah berhasil ditemukan
                </p>
              </div>
              <CopyAllButton results={results} />
            </div>

            <ResultTable results={results} />

            <div className="text-center mb-16 mt-8">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 text-primary font-semibold hover:gap-4 transition-all duration-300"
              >
                Cari lagi
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-16">
              <div className="p-8 bg-blue-50 border border-blue-100 rounded-xl">
                <h3 className="font-h3 text-primary mb-4">Butuh bantuan?</h3>
                <p className="text-slate-600 mb-4 font-body-md">
                  Kode enroll berlaku untuk semester ini. Hubungi admin jika ada yang tidak sesuai dengan kurikulum Anda.
                </p>
                <a className="text-blue-700 font-bold border-b-2 border-blue-200 hover:border-blue-700 transition-all" href="#">
                  Lihat Panduan Pendaftaran →
                </a>
              </div>
              <div className="relative rounded-xl overflow-hidden h-[240px] bg-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-300 text-6xl">school</span>
              </div>
            </div>
          </div>
        </main>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
