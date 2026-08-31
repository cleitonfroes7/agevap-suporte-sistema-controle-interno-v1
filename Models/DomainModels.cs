using System;
using System.Collections.Generic;

namespace versaoCsharp.Models
{
    public static class PerfisAcesso
    {
        public const string UserAdm = "USER_ADM";
        public const string UserCi = "USER_CI";
        public const string UserPadrao = "USER_PADRAO";

        public static readonly string[] Todos = [UserAdm, UserCi, UserPadrao];
    }

    public static class EmpresasAcesso
    {
        public const string Agevap = "AGEVAP";
        public const string Agedoce = "AGEDOCE";
        public const string Agegrande = "AGEGRANDE";
        public const string Agegoias = "AGEGOIAS";

        public static readonly string[] Todas = [Agevap, Agedoce, Agegrande, Agegoias];
    }

    public class Usuario
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Login { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Senha { get; set; } = string.Empty;
        public string Perfil { get; set; } = PerfisAcesso.UserCi;
        public string Empresa { get; set; } = EmpresasAcesso.Agevap;
        public bool Ativo { get; set; } = true;
    }

    public class Processo
    {
        public int Id { get; set; }
        public string Numero { get; set; } = string.Empty;
        public string Objeto { get; set; } = string.Empty;
        public string DataAbertura { get; set; } = string.Empty;
        public string Modalidade { get; set; } = string.Empty;
        public string Competencia { get; set; } = string.Empty;
        public string? Area { get; set; }
        public string? Gestor { get; set; }

        public ICollection<Checklist> Checklists { get; set; } = new List<Checklist>();
    }

    public class Checklist
    {
        public int Id { get; set; }
        public int ProcessoId { get; set; }
        public string Modalidade { get; set; } = string.Empty;
        public string Tipo { get; set; } = string.Empty;
        public string Status { get; set; } = "em_preenchimento";
        public DateTime? DataCriacao { get; set; }
        public string Competencia { get; set; } = string.Empty;
        public int? CriadoPorUsuarioId { get; set; }
        public string? CriadoPorNome { get; set; }
        public bool AjustesConfirmados { get; set; }
        public DateTime? AjustesConfirmadosEm { get; set; }
        public string? AjustesConfirmadosPor { get; set; }

        public Processo? Processo { get; set; }
        public ICollection<Elemento> Elementos { get; set; } = new List<Elemento>();
        public ICollection<Item> Itens { get; set; } = new List<Item>();
        public ICollection<CronoAnalise> CronoAnalises { get; set; } = new List<CronoAnalise>();
    }

    public class Elemento
    {
        public int Id { get; set; }
        public int ChecklistId { get; set; }
        public string Tipo { get; set; } = string.Empty;
        public string ElementoNome { get; set; } = string.Empty;
        public DateTime? DataElemento { get; set; }
        public string? Nup { get; set; }

        public Checklist? Checklist { get; set; }
        public ICollection<Item> Itens { get; set; } = new List<Item>();
    }

    public class Item
    {
        public int Id { get; set; }
        public int ElementoId { get; set; }
        public int ChecklistId { get; set; }
        public string Pergunta { get; set; } = string.Empty;
        public string? Analise { get; set; }
        public string? Categoria { get; set; }
        public string? Justificativa { get; set; }

        public Elemento? Elemento { get; set; }
        public Checklist? Checklist { get; set; }
    }

    public class CronoAnalise
    {
        public int Id { get; set; }
        public int ChecklistId { get; set; }
        public string Fase { get; set; } = string.Empty;
        public DateTime? DataInicio { get; set; }
        public DateTime? DataFim { get; set; }
        public int? Duracao { get; set; }
        public string? Observacoes { get; set; }

        public Checklist? Checklist { get; set; }
    }

    public class OrganogramaFuncionario
    {
        public int Id { get; set; }
        public string UnidadeId { get; set; } = string.Empty;
        public string UnidadeNome { get; set; } = string.Empty;
        public string Nome { get; set; } = string.Empty;
        public string Cargo { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Local { get; set; } = string.Empty;
        public string Observacoes { get; set; } = string.Empty;
        public DateTime CriadoEm { get; set; }
        public DateTime? AtualizadoEm { get; set; }
        public int? CriadoPorUsuarioId { get; set; }
        public string? CriadoPorNome { get; set; }
    }
}
