'use client';

import React from 'react';
import { LookupResult } from '@/lib/types';

interface ResultTableProps {
  results: LookupResult[];
}

export default function ResultTable({ results }: ResultTableProps) {
  const getStatusColor = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return 'bg-green-100 text-green-800';
      case 'kode_mk':
        return 'bg-blue-100 text-blue-800';
      case 'fuzzy':
        return 'bg-yellow-100 text-yellow-800';
      case 'not_found':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return '✓ Ditemukan';
      case 'kode_mk':
        return '✓ Kode MK';
      case 'fuzzy':
        return '✓ Mirip';
      case 'not_found':
        return '✗ Tidak ditemukan';
      default:
        return matchType;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Hasil Pencarian</h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4">Nama MK</th>
              <th className="text-left py-2 px-4">Kelas</th>
              <th className="text-left py-2 px-4">Kode Enroll</th>
              <th className="text-left py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className="border-b">
                <td className="py-3 px-4">{result.nama_mk}</td>
                <td className="py-3 px-4">{result.kelas}</td>
                <td className="py-3 px-4 font-mono">
                  {result.kode_enroll || '-'}
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.match_type)}`}>
                    {getStatusLabel(result.match_type)}
                  </span>
                  {result.suggestion && (
                    <p className="text-xs text-gray-500 mt-1">{result.suggestion}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
