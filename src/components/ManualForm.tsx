'use client';

import React, { useState } from 'react';
import { Course } from '@/lib/types';

interface ManualFormProps {
  onSubmit: (courses: Course[]) => void;
  isLoading: boolean;
}

export default function ManualForm({ onSubmit, isLoading }: ManualFormProps) {
  const [courses, setCourses] = useState<Course[]>([
    { nama_mk: '', kelas: '', prodi: '' },
  ]);

  const handleChange = (index: number, field: keyof Course, value: string) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };
    setCourses(updated);
  };

  const handleAdd = () => {
    setCourses([...courses, { nama_mk: '', kelas: '', prodi: '' }]);
  };

  const handleRemove = (index: number) => {
    const updated = courses.filter((_, i) => i !== index);
    setCourses(updated);
  };

  const handleSubmit = () => {
    const validCourses = courses.filter(
      (c) => c.nama_mk.trim() && c.kelas.trim()
    );
    if (validCourses.length > 0) {
      onSubmit(validCourses);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Input Manual</h2>
      <p className="text-gray-600 mb-4">
        Masukkan data mata kuliah secara manual jika ekstraksi gagal.
      </p>

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
              placeholder="Prodi (opsional)"
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
          + Tambah
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isLoading ? 'Mencari...' : 'Cari Kode Enroll'}
        </button>
      </div>
    </div>
  );
}
