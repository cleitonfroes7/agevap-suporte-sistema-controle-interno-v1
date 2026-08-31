using Microsoft.Extensions.Logging;

namespace versaoCsharp.Logging
{
    public sealed class FileLoggerOptions
    {
        public string Path { get; set; } = "Logs/app.log";
        public LogLevel MinLevel { get; set; } = LogLevel.Information;
        public bool IncludeScopes { get; set; } = true;
        public long MaxFileSizeBytes { get; set; } = 10 * 1024 * 1024;
        public int MaxRetainedFiles { get; set; } = 5;
    }
}
