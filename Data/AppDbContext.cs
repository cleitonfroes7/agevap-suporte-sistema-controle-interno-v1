using Microsoft.EntityFrameworkCore;
using versaoCsharp.Models;

namespace versaoCsharp.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Usuario> Usuarios => Set<Usuario>();
        public DbSet<Processo> Processos => Set<Processo>();
        public DbSet<Checklist> Checklists => Set<Checklist>();
        public DbSet<Elemento> Elementos => Set<Elemento>();
        public DbSet<Item> Itens => Set<Item>();
        public DbSet<CronoAnalise> CronoAnalises => Set<CronoAnalise>();
        public DbSet<OrganogramaFuncionario> OrganogramaFuncionarios => Set<OrganogramaFuncionario>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Usuario>(entity =>
            {
                entity.ToTable("usuario");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Email).IsUnique().HasDatabaseName("ix_usuario_email");
                entity.HasIndex(e => e.Login).IsUnique().HasDatabaseName("ix_usuario_login");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Login).HasColumnName("login").HasMaxLength(50).IsRequired();
                entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(100).IsRequired();
                entity.Property(e => e.Senha).HasColumnName("senha").HasMaxLength(255).IsRequired();
                entity.Property(e => e.Perfil).HasColumnName("perfil").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Empresa).HasColumnName("empresa").HasMaxLength(30).IsRequired();
                entity.Property(e => e.Ativo).HasColumnName("ativo").IsRequired();
            });

            modelBuilder.Entity<Processo>(entity =>
            {
                entity.ToTable("processo");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.Numero).IsUnique().HasDatabaseName("ix_processo_numero");
                entity.HasIndex(e => e.Area).HasDatabaseName("ix_processo_area");
                entity.HasIndex(e => e.Modalidade).HasDatabaseName("ix_processo_modalidade");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Numero).HasColumnName("numero").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Objeto).HasColumnName("objeto").HasColumnType("text").IsRequired();
                entity.Property(e => e.DataAbertura).HasColumnName("data_abertura").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Modalidade).HasColumnName("modalidade").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Competencia).HasColumnName("competencia").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Area).HasColumnName("area").HasMaxLength(100);
                entity.Property(e => e.Gestor).HasColumnName("gestor").HasMaxLength(100);
            });

            modelBuilder.Entity<Checklist>(entity =>
            {
                entity.ToTable("checklist");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.ProcessoId).HasDatabaseName("ix_checklist_processo_id");
                entity.HasIndex(e => e.Status).HasDatabaseName("ix_checklist_status");
                entity.HasIndex(e => e.Modalidade).HasDatabaseName("ix_checklist_modalidade");
                entity.HasIndex(e => e.DataCriacao).HasDatabaseName("ix_checklist_data_criacao");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ProcessoId).HasColumnName("processo_id");
                entity.Property(e => e.Modalidade).HasColumnName("modalidade").HasMaxLength(20).IsRequired();
                entity.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(255).IsRequired();
                entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
                entity.Property(e => e.DataCriacao).HasColumnName("data_criacao");
                entity.Property(e => e.Competencia).HasColumnName("competencia").HasMaxLength(200).IsRequired();
                entity.Property(e => e.CriadoPorUsuarioId).HasColumnName("criado_por_usuario_id");
                entity.Property(e => e.CriadoPorNome).HasColumnName("criado_por_nome").HasMaxLength(120);
                entity.Property(e => e.AjustesConfirmados).HasColumnName("ajustes_confirmados").IsRequired();
                entity.Property(e => e.AjustesConfirmadosEm).HasColumnName("ajustes_confirmados_em");
                entity.Property(e => e.AjustesConfirmadosPor).HasColumnName("ajustes_confirmados_por").HasMaxLength(120);

                entity.HasOne(e => e.Processo)
                    .WithMany(p => p.Checklists)
                    .HasForeignKey(e => e.ProcessoId);
            });

            modelBuilder.Entity<Elemento>(entity =>
            {
                entity.ToTable("elemento");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.ChecklistId).HasDatabaseName("ix_elemento_checklist_id");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChecklistId).HasColumnName("checklist_id");
                entity.Property(e => e.Tipo).HasColumnName("tipo").HasMaxLength(255).IsRequired();
                entity.Property(e => e.ElementoNome).HasColumnName("elemento").HasMaxLength(200).IsRequired();
                entity.Property(e => e.DataElemento).HasColumnName("data_elemento");
                entity.Property(e => e.Nup).HasColumnName("nup").HasMaxLength(100);

                entity.HasOne(e => e.Checklist)
                    .WithMany(c => c.Elementos)
                    .HasForeignKey(e => e.ChecklistId);
            });

            modelBuilder.Entity<Item>(entity =>
            {
                entity.ToTable("item");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.ElementoId).HasDatabaseName("ix_item_elemento_id");
                entity.HasIndex(e => e.ChecklistId).HasDatabaseName("ix_item_checklist_id");
                entity.HasIndex(e => e.Analise).HasDatabaseName("ix_item_analise");
                entity.HasIndex(e => e.Categoria).HasDatabaseName("ix_item_categoria");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ElementoId).HasColumnName("elemento_id");
                entity.Property(e => e.ChecklistId).HasColumnName("checklist_id");
                entity.Property(e => e.Pergunta).HasColumnName("pergunta").HasMaxLength(200).IsRequired();
                entity.Property(e => e.Analise).HasColumnName("analise").HasMaxLength(2000);
                entity.Property(e => e.Categoria).HasColumnName("categoria").HasMaxLength(100);
                entity.Property(e => e.Justificativa).HasColumnName("justificativa").HasMaxLength(10000);

                entity.HasOne(i => i.Elemento)
                    .WithMany(e => e.Itens)
                    .HasForeignKey(i => i.ElementoId);

                entity.HasOne(i => i.Checklist)
                    .WithMany(c => c.Itens)
                    .HasForeignKey(i => i.ChecklistId);
            });

            modelBuilder.Entity<CronoAnalise>(entity =>
            {
                entity.ToTable("crono_analise");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.ChecklistId).HasDatabaseName("ix_crono_analise_checklist_id");
                entity.HasIndex(e => e.Fase).HasDatabaseName("ix_crono_analise_fase");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.ChecklistId).HasColumnName("checklist_id");
                entity.Property(e => e.Fase).HasColumnName("fase").HasMaxLength(100).IsRequired();
                entity.Property(e => e.DataInicio).HasColumnName("data_inicio");
                entity.Property(e => e.DataFim).HasColumnName("data_fim");
                entity.Property(e => e.Duracao).HasColumnName("duracao");
                entity.Property(e => e.Observacoes).HasColumnName("observacoes").HasMaxLength(500);

                entity.HasOne(c => c.Checklist)
                    .WithMany(c => c.CronoAnalises)
                    .HasForeignKey(c => c.ChecklistId);
            });

            modelBuilder.Entity<OrganogramaFuncionario>(entity =>
            {
                entity.ToTable("organograma_funcionario");
                entity.HasKey(e => e.Id);
                entity.HasIndex(e => e.UnidadeId).HasDatabaseName("ix_org_funcionario_unidade_id");
                entity.HasIndex(e => e.UnidadeNome).HasDatabaseName("ix_org_funcionario_unidade_nome");
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UnidadeId).HasColumnName("unidade_id").HasMaxLength(120).IsRequired();
                entity.Property(e => e.UnidadeNome).HasColumnName("unidade_nome").HasMaxLength(180).IsRequired();
                entity.Property(e => e.Nome).HasColumnName("nome").HasMaxLength(180).IsRequired();
                entity.Property(e => e.Cargo).HasColumnName("cargo").HasMaxLength(180).IsRequired();
                entity.Property(e => e.Telefone).HasColumnName("telefone").HasMaxLength(80).IsRequired();
                entity.Property(e => e.Email).HasColumnName("email").HasMaxLength(180).IsRequired();
                entity.Property(e => e.Local).HasColumnName("local").HasMaxLength(180).IsRequired();
                entity.Property(e => e.Observacoes).HasColumnName("observacoes").HasMaxLength(1000).IsRequired();
                entity.Property(e => e.CriadoEm).HasColumnName("criado_em").IsRequired();
                entity.Property(e => e.AtualizadoEm).HasColumnName("atualizado_em");
                entity.Property(e => e.CriadoPorUsuarioId).HasColumnName("criado_por_usuario_id");
                entity.Property(e => e.CriadoPorNome).HasColumnName("criado_por_nome").HasMaxLength(120);
            });
        }
    }
}
