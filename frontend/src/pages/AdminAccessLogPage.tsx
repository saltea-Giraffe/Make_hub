import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock } from 'lucide-react';
import { fetchAccessStats } from '../api/client';
import type { AppAccessStat } from '../types';

export default function AdminAccessLogPage() {
  const [stats, setStats]   = useState<AppAccessStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccessStats()
      .then(r => setStats(r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = stats[0]?.total_count ?? 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">アクセスログ</h1>
        <p className="text-sm text-gray-500 mt-0.5">アプリのクリック数集計（ログインユーザーのアクセスのみ）</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">読み込み中...</p>
      ) : stats.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">データがありません</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">アプリ</th>
                <th className="px-4 py-3 font-medium text-gray-500 w-32 sm:w-48">
                  <span className="flex items-center gap-1"><BarChart2 className="w-3.5 h-3.5" />アクセス数</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-24">
                  <span className="flex items-center justify-end gap-1"><TrendingUp className="w-3.5 h-3.5" />7日間</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 w-40 hidden sm:table-cell">
                  <span className="flex items-center justify-end gap-1"><Clock className="w-3.5 h-3.5" />最終アクセス</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(s.total_count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{s.total_count}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.week_count}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400 hidden sm:table-cell">
                    {s.last_accessed_at
                      ? new Date(s.last_accessed_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
