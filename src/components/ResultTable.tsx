'use client';

import React from 'react';
import { LookupResult } from '@/lib/types';

interface ResultTableProps {
  results: LookupResult[];
}

export default function ResultTable({ results }: ResultTableProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-wider">Nama Mata Kuliah</th>
              <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-wider">Kelas</th>
              <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-wider">Kode Enroll</th>
              <th className="px-6 py-4 font-label text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map((result, index) => {
              const isFound = result.found;
              return (
                <tr
                  key={index}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    !isFound ? 'bg-red-50/40 hover:bg-red-50/60' : ''
                  }`}
                >
                  <td className="px-6 py-5">
                    <p className="font-body-md font-semibold text-slate-900">{result.nama_mk}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-slate-600">{result.kelas}</span>
                  </td>
                  <td className="px-6 py-5">
                    {isFound && result.kode_enroll ? (
                      <span className="inline-block bg-slate-100 px-3 py-1.5 rounded font-mono text-lg text-slate-700 tracking-wider">
                        {result.kode_enroll}
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-mono text-lg text-slate-400">—</span>
                        <span className="text-[10px] text-red-600 font-bold uppercase tracking-tighter">
                          Hubungi admin
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    {isFound ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Ditemukan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        Tidak ditemukan
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
