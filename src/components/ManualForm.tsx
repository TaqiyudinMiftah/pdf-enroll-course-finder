'use client';

import React, { useState } from 'react';
import { Course } from '@/lib/types';

interface ManualFormProps {
  onSubmit: (courses: Course[]) => void;
}

const PRODI_OPTIONS = ['Informatika', 'Sistem Informasi', 'Teknologi Informasi'];

export default function ManualForm({ onSubmit }: ManualFormProps) {
  const [courses, setCourses] = useState<Course[]>([
    { nama_mk: '', kelas: '', prodi: 'Informatika' },
  ]);

  const handleChange = (index: number, field: keyof Course, value: string) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };
    setCourses(updated);
  };

  const handleAdd = () => {
    setCourses([...courses, { nama_mk: '', kelas: '', prodi: 'Informatika' }]);
  };

  const handleRemove = (index: number) => {
    const updated = courses.filter((_, i) => i !== index);
    setCourses(updated);
  };

  const handleSubmit = () => {
    const validCourses = courses.filter((c) => c.nama_mk.trim() && c.kelas.trim());
    if (validCourses.length > 0) {
      onSubmit(validCourses);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
      <div className="space-y-6">
        {/* Column Labels (Desktop Only) */}
        <div className="hidden md:grid grid-cols-12 gap-6 px-2">
          <div className="col-span-5">
            <span className="font-label text-label text-on-surface-variant uppercase tracking-wider">
              Nama Mata Kuliah
            </span>
          </div>
          <div className="col-span-2">
            <span className="font-label text-label text-on-surface-variant uppercase tracking-wider">Kelas</span>
          </div>
          <div className="col-span-4">
            <span className="font-label text-label text-on-surface-variant uppercase tracking-wider">Program Studi</span>
          </div>
          <div className="col-span-1" />
        </div>

        {courses.map((course, index) => (
          <div
            key={index}
            className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end border-b border-outline-variant pb-6 md:border-none md:pb-0"
          >
            <div className="col-span-1 md:col-span-5">
              <label className="block md:hidden font-label text-label text-on-surface-variant mb-1">Nama Mata Kuliah</label>
              <input
                type="text"
                value={course.nama_mk}
                onChange={(e) => handleChange(index, 'nama_mk', e.target.value)}
                placeholder="Contoh: Algoritma & Pemrograman"
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block md:hidden font-label text-label text-on-surface-variant mb-1">Kelas</label>
              <input
                type="text"
                value={course.kelas}
                onChange={(e) => handleChange(index, 'kelas', e.target.value)}
                placeholder="IF-44-01"
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20"
              />
            </div>
            <div className="col-span-1 md:col-span-4">
              <label className="block md:hidden font-label text-label text-on-surface-variant mb-1">Program Studi</label>
              <select
                value={course.prodi || ''}
                onChange={(e) => handleChange(index, 'prodi', e.target.value)}
                className="w-full px-4 py-3 bg-white border border-outline-variant rounded-lg font-body-md transition-all focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 appearance-none"
              >
                {PRODI_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
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
          className="flex-1 bg-primary-container text-on-primary py-4 rounded-xl font-h3 text-[18px] flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-md active:scale-[0.98]"
        >
          Cari Kode Enroll
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
