namespace versaoCsharp.Data
{
    public sealed class DatabaseInitializationOptions
    {
        public bool ApplyMigrations { get; set; }
        public bool EnsureCreatedIfNoTables { get; set; } = true;
        public bool RunCompatibilityPatches { get; set; } = true;
    }
}
