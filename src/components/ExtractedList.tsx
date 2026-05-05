'use client';

import React from 'react';
import { Course } from '@/lib/types';

interface ExtractedListProps {
  courses: Course[];
  onCoursesChange: (courses: Course[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
  fallbackReason?: string;
}

export default function ExtractedList({
  courses,
  onCoursesChange,
  onSubmit,
  isLoading,
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
    onCoursesChange([...courses, { nama_mk: '', kelas: '', prodi: '' }]);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Hasil Ekstraksi</h2>
        {fallbackReason && (
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
            Model alternatif digunakan
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {courses.map((course, index) => (
          <div key={index} className="flex gap-2 items-start">
            <input
              type="text"
              value={course.nama_mk}
              onChange={(e) => handleChange(index, 'nama_mk', e.target.value)}
              placeholder="Nama Mata Kuliah"
              className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={course.kelas}
              onChange={(e) => handleChange(index, 'kelas', e.target.value)}
              placeholder="Kelas"
              className="w-24 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={course.prodi || ''}
              onChange={(e) => handleChange(index, 'prodi', e.target.value)}
              placeholder="Prodi"
              className="w-32 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleRemove(index)}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          className="px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
        >
          + Tambah Manual
        </button>
        <button
          onClick={onSubmit}
          disabled={isLoading || courses.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Mencari...' : 'Cari Kode Enroll'}
        </button>
      </div>
    </div>
  );
}
