'use client';

import { useState, useEffect } from 'react';

interface ErrorLog {
  id: string;
  message: string;
  type: string;
  component: string;
  url: string;
  session_id: string;
  timestamp: string;
  metadata: any;
}

interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  byComponent: Record<string, number>;
  critical: number;
}

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchErrorLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/error-log?days=7&limit=50');
      
      if (!response.ok) {
        throw new Error('Failed to fetch error logs');
      }

      const data = await response.json();
      setErrors(data.errors || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrorLogs();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'auth':
        return 'bg-red-100 text-red-800';
      case 'client-side':
      case 'application-error':
        return 'bg-orange-100 text-orange-800';
      case 'network':
        return 'bg-blue-100 text-blue-800';
      case 'validation':
        return 'bg-yellow-100 text-yellow-800';
      case 'game-logic':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Загрузка логов ошибок...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Логи ошибок</h1>
        <button 
          onClick={fetchErrorLogs}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Обновить
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Всего ошибок</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Критические</div>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Клиентские</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.byType['client-side'] || stats.byType['application-error'] || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Сетевые</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.byType['network'] || 0}
            </div>
          </div>
        </div>
      )}

      {/* Таблица ошибок */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Детали ошибок</h2>
        </div>
        
        {errors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Ошибок не найдено
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Время
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Тип
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сообщение
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Компонент
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {errors.map((error) => (
                  <tr key={error.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTimestamp(error.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(error.type)}`}>
                        {error.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md">
                      <div className="truncate" title={error.message}>
                        {error.message}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {error.component || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="truncate max-w-32" title={error.url}>
                        {error.url || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 