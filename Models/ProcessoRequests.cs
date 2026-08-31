using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace versaoCsharp.Models
{
    public sealed class AtualizarProcessoRequest
    {
        [StringLength(20)]
        public string? Numero { get; set; }

        [StringLength(1600)]
        public string? Objeto { get; set; }

        [StringLength(20)]
        [JsonPropertyName("data_abertura")]
        public string? DataAbertura { get; set; }

        [StringLength(20)]
        public string? Modalidade { get; set; }

        [StringLength(200)]
        public string? Competencia { get; set; }

        [StringLength(100)]
        public string? Area { get; set; }

        [StringLength(100)]
        public string? Gestor { get; set; }
    }
}
