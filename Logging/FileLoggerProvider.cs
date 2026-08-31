using System;
using System.IO;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace versaoCsharp.Logging
{
    public sealed class FileLoggerProvider : ILoggerProvider, ISupportExternalScope
    {
        private readonly FileLoggerOptions _options;
        private readonly object _lock = new();
        private IExternalScopeProvider? _scopeProvider;

        public FileLoggerProvider(IOptions<FileLoggerOptions> options)
        {
            _options = options.Value;
            EnsureDirectory();
        }

        public ILogger CreateLogger(string categoryName)
        {
            return new FileLogger(categoryName, this);
        }

        public void Dispose()
        {
        }

        public void SetScopeProvider(IExternalScopeProvider scopeProvider)
        {
            _scopeProvider = scopeProvider;
        }

        internal FileLoggerOptions Options => _options;

        internal IExternalScopeProvider ScopeProvider
        {
            get
            {
                if (_scopeProvider == null)
                {
                    _scopeProvider = new LoggerExternalScopeProvider();
                }

                return _scopeProvider;
            }
        }

        internal void WriteLine(string line)
        {
            lock (_lock)
            {
                RotateIfNeeded();
                File.AppendAllText(_options.Path, line + Environment.NewLine, Encoding.UTF8);
            }
        }

        private void EnsureDirectory()
        {
            var dir = Path.GetDirectoryName(_options.Path);
            if (!string.IsNullOrWhiteSpace(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        private void RotateIfNeeded()
        {
            if (_options.MaxFileSizeBytes <= 0)
            {
                return;
            }

            var info = new FileInfo(_options.Path);
            if (!info.Exists || info.Length <= _options.MaxFileSizeBytes)
            {
                return;
            }

            var maxFiles = Math.Max(_options.MaxRetainedFiles, 1);
            for (var i = maxFiles - 1; i >= 1; i--)
            {
                var src = $"{_options.Path}.{i}";
                var dest = $"{_options.Path}.{i + 1}";
                if (File.Exists(dest))
                {
                    File.Delete(dest);
                }
                if (File.Exists(src))
                {
                    File.Move(src, dest);
                }
            }

            var first = $"{_options.Path}.1";
            if (File.Exists(first))
            {
                File.Delete(first);
            }

            File.Move(_options.Path, first);
        }
    }
}
