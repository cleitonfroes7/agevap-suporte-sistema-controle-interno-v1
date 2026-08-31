using System.ComponentModel.DataAnnotations;

namespace versaoCsharp.Models
{
    public sealed class CriarUsuarioRequest
    {
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(50)]
        public string Login { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [StringLength(100)]
        public string Email { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Perfil { get; set; }

        [StringLength(30)]
        public string? Empresa { get; set; }

        public string? Senha { get; set; }
    }

    public sealed class AtualizarUsuarioRequest
    {
        [StringLength(100)]
        public string? Name { get; set; }

        [StringLength(50)]
        public string? Login { get; set; }

        [EmailAddress]
        [StringLength(100)]
        public string? Email { get; set; }

        [StringLength(20)]
        public string? Perfil { get; set; }

        [StringLength(30)]
        public string? Empresa { get; set; }

        public string? Ativo { get; set; }

        public string? Senha { get; set; }
    }
}
