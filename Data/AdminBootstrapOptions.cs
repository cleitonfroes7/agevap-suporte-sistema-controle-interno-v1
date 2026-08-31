namespace versaoCsharp.Data
{
    public sealed class AdminBootstrapOptions
    {
        public bool EnableLegacyAdminSeed { get; set; } = true;
        public bool EnableConfiguredAdminPromotion { get; set; }
        public string? ConfiguredAdminEmail { get; set; }
    }
}
