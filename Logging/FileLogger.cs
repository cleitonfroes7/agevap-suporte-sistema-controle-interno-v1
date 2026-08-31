using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Extensions.Logging;

namespace versaoCsharp.Logging
{
    internal sealed class FileLogger : ILogger
    {
        private readonly string _category;
        private readonly FileLoggerProvider _provider;

        public FileLogger(string category, FileLoggerProvider provider)
        {
            _category = category;
            _provider = provider;
        }

        public IDisposable BeginScope<TState>(TState state) where TState : notnull
        {
            return _provider.ScopeProvider?.Push(state) ?? NullScope.Instance;
        }

        public bool IsEnabled(LogLevel logLevel)
        {
            return logLevel >= _provider.Options.MinLevel;
        }

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var message = formatter(state, exception);
            if (string.IsNullOrEmpty(message) && exception == null)
            {
                return;
            }

            var sb = new StringBuilder();
            sb.Append(DateTimeOffset.Now.ToString("yyyy-MM-ddTHH:mm:ss.fffzzz"));
            sb.Append(" ").Append(logLevel);
            sb.Append(" ").Append(_category).Append(" ");
            if (eventId.Id != 0)
            {
                sb.Append("[").Append(eventId.Id).Append("] ");
            }
            sb.Append(message);

            if (exception != null)
            {
                sb.Append(" ").Append(exception);
            }

            if (_provider.Options.IncludeScopes)
            {
                var scopes = new List<string>();
                _provider.ScopeProvider?.ForEachScope((scope, list) =>
                {
                    list.Add(FormatScope(scope));
                }, scopes);

                if (scopes.Count > 0)
                {
                    sb.Append(" | ");
                    sb.Append(string.Join(" ", scopes.Where(s => !string.IsNullOrWhiteSpace(s))));
                }
            }

            _provider.WriteLine(sb.ToString());
        }

        private static string FormatScope(object? scope)
        {
            if (scope == null)
            {
                return string.Empty;
            }

            if (scope is IEnumerable<KeyValuePair<string, object?>> kvps)
            {
                var parts = kvps.Select(kvp => $"{kvp.Key}={kvp.Value}");
                return string.Join(" ", parts);
            }

            return scope.ToString() ?? string.Empty;
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose()
            {
            }
        }
    }
}
