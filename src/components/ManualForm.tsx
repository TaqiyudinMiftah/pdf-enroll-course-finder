'use client';

import React, { useState } from 'react';
import { Course } from '@/lib/types';

interface ManualFormProps {
  onSubmit: (courses: Course[]) => void;
}

const PRODI_OPTIONS = [
  'Informatika',
  'Sistem Informasi',
  'Teknologi Informasi',
  'Teknik Komputer',
  'Manajemen Informatika',
];

export default function ManualForm({ onSubmit }: ManualFormProps) {
  const [courses, setCourses] = useState<Course[]>([
    { nama_mk: '', kelas: '' },
  ]);
  const [prodi, setProdi] = useState<string>('');

  const handleChange = (index: number, field: keyof Course, value: string) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };
    setCourses(updated);
  };

  const handleAdd = () => {
    setCourses([...courses, { nama_mk: '', kelas: '' }]);
  };

  const handleRemove = (index: number) => {
    const updated = courses.filter((_, i) => i !== index);
    setCourses(updated);
  };

  const handleSubmit = () => {
    const validCourses = courses
      .filter((c) => c.nama_mk.trim() && c.kelas.trim())
      .map((c) => ({ ...c, prodi }));
    if (validCourses.length > 0 && prodi.trim()) {
      onSubmit(validCourses);
    }
  };

  const hasEmptyRow = courses.some((c) => !c.nama_mk.trim() || !c.kelas.trim());

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      {/* Program Studi — Global 1 kolom */}
      <div className="mb-8">
        <label className="block font-label text-label text-on-surface-variant uppercase tracking-wider mb-3">
          Program Studi
        </label>
        <p className="text-body-sm text-outline mb-4">
          Program studi ini akan berlaku untuk semua mata kuliah yang kamu masukkan.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <select
            value={prodi}
            onChange={(e) => setProdi(e.target.value)}
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
            onChange={(e) => setProdi(e.target.value)}
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

      <div className="space-y-6">
        {/* Column Labels (Desktop Only) */}
        <div className="hidden md:grid grid-cols-12 gap-6 px-2">
          <div className="col-span-6">
            <span className="font-label text-label text-on-surface-variant uppercase tracking-wider">
              Nama Mata Kuliah
            </span>
          </div>
          <div className="col-span-4">
            <span className="font-label text-label text-on-surface-variant uppercase tracking-wider">Kelas</span>
          </div>
          <div className="col-span-2" />
        </div>

        {courses.map((course, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border-b border-outline-variant pb-6 md:border-none md:pb-0"
          >
            <div className="col-span-1 md:col-span-6">
              <label className="block md:hidden font-label text-label text-on-surface-variant mb-1">
                Nama Mata Kuliah
              </label>
              <input
                type="text"
                value={course.nama_mk}
                onChange={(e) => handleChange(index, 'nama_mk', e.target.value)}
                placeholder="Contoh: Algoritma & Pemrograman"
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
              />
            </div>
            <div className="col-span-1 md:col-span-4">
              <label className="block md:hidden font-label text-label text-on-surface-variant mb-1">Kelas</label>
              <input
                type="text"
                value={course.kelas}
                onChange={(e) => handleChange(index, 'kelas', e.target.value)}
                placeholder="IF-44-01"
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
              />
            </div>
            <div className="col-span-1 md:col-span-2 flex justify-end md:justify-center">
              <button
                onClick={() => handleRemove(index)}
                className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-full hover:bg-error/5"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <button
        onClick={handleAdd}
        className="mt-6 flex items-center gap-2 text-primary font-body-md font-semibold hover:opacity-80 transition-all"
      >
        <span className="material-symbols-outlined">add</span>
        Tambah baris
      </button>

      {/* Submit */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleSubmit}
          disabled={courses.length === 0 || hasEmptyRow || !prodi.trim()}
          className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-h3 text-[18px] flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cari Kode Enroll
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
