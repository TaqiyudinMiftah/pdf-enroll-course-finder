'use client';

import React from 'react';
import { Course } from '@/lib/types';

interface ExtractedListProps {
  courses: Course[];
  onCoursesChange: (courses: Course[]) => void;
  onSubmit: () => void;
  onReset: () => void;
  prodi: string;
  onProdiChange: (prodi: string) => void;
  fallbackReason?: string;
}

const PRODI_OPTIONS = [
  'Informatika',
  'Sistem Informasi',
  'Teknologi Informasi',
  'Teknik Komputer',
  'Manajemen Informatika',
];

export default function ExtractedList({
  courses,
  onCoursesChange,
  onSubmit,
  onReset,
  prodi,
  onProdiChange,
  fallbackReason,
}: ExtractedListProps) {
  const handleChange = (index: number, field: keyof Course, value: string) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };
    onCoursesChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = courses.filter((_, i) => i !== index);
    onCoursesChange(updated);
  };

  const handleAdd = () => {
    onCoursesChange([...courses, { nama_mk: '', kelas: '' }]);
  };

  const hasEmptyCourse = courses.some((c) => !c.nama_mk.trim() || !c.kelas.trim());

  return (
    <>
      {/* Info Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 flex items-center gap-6">
        <div className="w-[120px] h-[120px] flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-300 text-5xl">description</span>
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-label uppercase tracking-wider">
              Berhasil dibaca
            </span>
            {fallbackReason && (
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-label uppercase tracking-wider">
                Model alternatif
              </span>
            )}
          </div>
          <h2 className="font-h2 text-h3 text-on-surface mb-1">
            AI berhasil membaca {courses.length} mata kuliah dari jadwalmu
          </h2>
          <p className="text-body-sm text-outline">
            Silakan tinjau data di bawah ini sebelum melanjutkan pencarian kode enroll.
          </p>
        </div>
      </div>

      {/* Program Studi Selector — Global, 1 kolom untuk semua mata kuliah */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8">
        <label className="block font-label text-label text-on-surface-variant uppercase tracking-wider mb-3">
          Program Studi
        </label>
        <p className="text-body-sm text-outline mb-4">
          Pilih program studi yang berlaku untuk semua mata kuliah di bawah ini.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <select
            value={prodi}
            onChange={(e) => onProdiChange(e.target.value)}
            className="w-full sm:w-80 px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none"
          >
            <option value="" disabled>
              Pilih Program Studi
            </option>
            {PRODI_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={prodi}
            onChange={(e) => onProdiChange(e.target.value)}
            placeholder="Atau ketik manual..."
            className="w-full sm:w-80 px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
          />
        </div>
        {!prodi && (
          <p className="mt-2 text-body-sm text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Program studi wajib diisi agar pencarian kode enroll lebih akurat.
          </p>
        )}
      </div>

      {/* Main Editable Table Section — tanpa kolom Program Studi */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-widest w-16">No</th>
                <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-widest">Nama Mata Kuliah</th>
                <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-widest w-32">Kelas</th>
                <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-widest w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courses.map((course, index) => (
                <tr key={index} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5 text-body-md text-outline">{index + 1}</td>
                  <td className="px-6 py-5">
                    <input
                      type="text"
                      value={course.nama_mk}
                      onChange={(e) => handleChange(index, 'nama_mk', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary/20 rounded px-2 -mx-2 font-body-md text-on-surface hover:bg-slate-50"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <input
                      type="text"
                      value={course.kelas}
                      onChange={(e) => handleChange(index, 'kelas', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary/20 rounded px-2 -mx-2 font-body-md text-on-surface hover:bg-slate-50"
                    />
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-slate-400 hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-center">
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 text-primary font-medium hover:underline py-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tambah mata kuliah
          </button>
        </div>
      </div>

      {/* Manual Input Note */}
      <div className="mt-6 flex justify-center">
        <div className="bg-blue-50 text-blue-800 px-6 py-3 rounded-full flex items-center gap-3 border border-blue-100 text-body-sm shadow-sm">
          <span className="material-symbols-outlined text-[20px]">info</span>
          <span>
            Hasil tidak akurat?{' '}
            <button onClick={onReset} className="font-bold underline decoration-2 underline-offset-2">
              Coba input manual
            </button>
          </span>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="mt-12 flex flex-col items-center gap-4 max-w-md mx-auto">
        <button
          onClick={onSubmit}
          disabled={courses.length === 0 || hasEmptyCourse || !prodi.trim()}
          className="w-full bg-primary-container text-on-primary py-4 rounded-xl font-h3 text-[18px] flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cari Kode Enroll
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <button
          onClick={onReset}
          className="text-slate-500 hover:text-primary transition-colors font-medium"
        >
          Ulangi upload
        </button>
      </div>
    </>
  );
}
