using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace versaoCsharp.Models
{
    public sealed class CriarProcessoRequest
    {
        [Required]
        [StringLength(20)]
        public string Numero { get; set; } = string.Empty;

        [Required]
        [StringLength(1600)]
        public string Objeto { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string Modalidade { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        [JsonPropertyName("data_abertura")]
        public string DataAbertura { get; set; } = string.Empty;

        [Required]
        [StringLength(200)]
        public string Competencia { get; set; } = string.Empty;

        [Required]
        [StringLength(100)]
        public string Area { get; set; } = string.Empty;

        [StringLength(100)]
        public string? Gestor { get; set; }
    }
}
