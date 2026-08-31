using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using versaoCsharp.Data;

#nullable disable

namespace versaoCsharp.Migrations
{
    [DbContext(typeof(AppDbContext))]
    partial class AppDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
            modelBuilder
                .HasAnnotation("ProductVersion", "8.0.10")
                .HasAnnotation("Relational:MaxIdentifierLength", 64);

            modelBuilder.Entity("versaoCsharp.Models.Checklist", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<bool>("AjustesConfirmados")
                    .HasColumnType("tinyint(1)")
                    .HasColumnName("ajustes_confirmados");

                b.Property<DateTime?>("AjustesConfirmadosEm")
                    .HasColumnType("datetime(6)")
                    .HasColumnName("ajustes_confirmados_em");

                b.Property<string>("AjustesConfirmadosPor")
                    .HasMaxLength(120)
                    .HasColumnType("varchar(120)")
                    .HasColumnName("ajustes_confirmados_por");

                b.Property<string>("Competencia")
                    .IsRequired()
                    .HasMaxLength(200)
                    .HasColumnType("varchar(200)")
                    .HasColumnName("competencia");

                b.Property<DateTime?>("DataCriacao")
                    .HasColumnType("datetime(6)")
                    .HasColumnName("data_criacao");

                b.Property<string>("Modalidade")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("modalidade");

                b.Property<int>("ProcessoId")
                    .HasColumnType("int")
                    .HasColumnName("processo_id");

                b.Property<string>("Status")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("status");

                b.Property<string>("Tipo")
                    .IsRequired()
                    .HasMaxLength(255)
                    .HasColumnType("varchar(255)")
                    .HasColumnName("tipo");

                b.HasKey("Id");
                b.HasIndex("DataCriacao").HasDatabaseName("ix_checklist_data_criacao");
                b.HasIndex("Modalidade").HasDatabaseName("ix_checklist_modalidade");
                b.HasIndex("ProcessoId").HasDatabaseName("ix_checklist_processo_id");
                b.HasIndex("Status").HasDatabaseName("ix_checklist_status");
                b.ToTable("checklist");
            });

            modelBuilder.Entity("versaoCsharp.Models.CronoAnalise", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<int>("ChecklistId")
                    .HasColumnType("int")
                    .HasColumnName("checklist_id");

                b.Property<DateTime?>("DataFim")
                    .HasColumnType("datetime(6)")
                    .HasColumnName("data_fim");

                b.Property<DateTime?>("DataInicio")
                    .HasColumnType("datetime(6)")
                    .HasColumnName("data_inicio");

                b.Property<int?>("Duracao")
                    .HasColumnType("int")
                    .HasColumnName("duracao");

                b.Property<string>("Fase")
                    .IsRequired()
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("fase");

                b.Property<string>("Observacoes")
                    .HasMaxLength(500)
                    .HasColumnType("varchar(500)")
                    .HasColumnName("observacoes");

                b.HasKey("Id");
                b.HasIndex("ChecklistId").HasDatabaseName("ix_crono_analise_checklist_id");
                b.HasIndex("Fase").HasDatabaseName("ix_crono_analise_fase");
                b.ToTable("crono_analise");
            });

            modelBuilder.Entity("versaoCsharp.Models.Elemento", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<int>("ChecklistId")
                    .HasColumnType("int")
                    .HasColumnName("checklist_id");

                b.Property<DateTime?>("DataElemento")
                    .HasColumnType("datetime(6)")
                    .HasColumnName("data_elemento");

                b.Property<string>("ElementoNome")
                    .IsRequired()
                    .HasMaxLength(200)
                    .HasColumnType("varchar(200)")
                    .HasColumnName("elemento");

                b.Property<string>("Nup")
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("nup");

                b.Property<string>("Tipo")
                    .IsRequired()
                    .HasMaxLength(255)
                    .HasColumnType("varchar(255)")
                    .HasColumnName("tipo");

                b.HasKey("Id");
                b.HasIndex("ChecklistId").HasDatabaseName("ix_elemento_checklist_id");
                b.ToTable("elemento");
            });

            modelBuilder.Entity("versaoCsharp.Models.Item", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<string>("Analise")
                    .HasMaxLength(2000)
                    .HasColumnType("varchar(2000)")
                    .HasColumnName("analise");

                b.Property<string>("Categoria")
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("categoria");

                b.Property<int>("ChecklistId")
                    .HasColumnType("int")
                    .HasColumnName("checklist_id");

                b.Property<int>("ElementoId")
                    .HasColumnType("int")
                    .HasColumnName("elemento_id");

                b.Property<string>("Justificativa")
                    .HasMaxLength(10000)
                    .HasColumnType("varchar(10000)")
                    .HasColumnName("justificativa");

                b.Property<string>("Pergunta")
                    .IsRequired()
                    .HasMaxLength(200)
                    .HasColumnType("varchar(200)")
                    .HasColumnName("pergunta");

                b.HasKey("Id");
                b.HasIndex("Analise").HasDatabaseName("ix_item_analise");
                b.HasIndex("Categoria").HasDatabaseName("ix_item_categoria");
                b.HasIndex("ChecklistId").HasDatabaseName("ix_item_checklist_id");
                b.HasIndex("ElementoId").HasDatabaseName("ix_item_elemento_id");
                b.ToTable("item");
            });

            modelBuilder.Entity("versaoCsharp.Models.Processo", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<string>("Area")
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("area");

                b.Property<string>("Competencia")
                    .IsRequired()
                    .HasMaxLength(200)
                    .HasColumnType("varchar(200)")
                    .HasColumnName("competencia");

                b.Property<string>("DataAbertura")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("data_abertura");

                b.Property<string>("Gestor")
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("gestor");

                b.Property<string>("Modalidade")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("modalidade");

                b.Property<string>("Numero")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("numero");

                b.Property<string>("Objeto")
                    .IsRequired()
                    .HasColumnType("text")
                    .HasColumnName("objeto");

                b.HasKey("Id");
                b.HasIndex("Area").HasDatabaseName("ix_processo_area");
                b.HasIndex("Modalidade").HasDatabaseName("ix_processo_modalidade");
                b.HasIndex("Numero").HasDatabaseName("ix_processo_numero");
                b.ToTable("processo");
            });

            modelBuilder.Entity("versaoCsharp.Models.Usuario", b =>
            {
                b.Property<int>("Id")
                    .ValueGeneratedOnAdd()
                    .HasColumnType("int")
                    .HasColumnName("id");

                b.Property<bool>("Ativo")
                    .HasColumnType("tinyint(1)")
                    .HasColumnName("ativo");

                b.Property<string>("Email")
                    .IsRequired()
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("email");

                b.Property<string>("Empresa")
                    .IsRequired()
                    .HasMaxLength(30)
                    .HasColumnType("varchar(30)")
                    .HasColumnName("empresa");

                b.Property<string>("Login")
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasColumnType("varchar(50)")
                    .HasColumnName("login");

                b.Property<string>("Name")
                    .IsRequired()
                    .HasMaxLength(100)
                    .HasColumnType("varchar(100)")
                    .HasColumnName("name");

                b.Property<string>("Perfil")
                    .IsRequired()
                    .HasMaxLength(20)
                    .HasColumnType("varchar(20)")
                    .HasColumnName("perfil");

                b.Property<string>("Senha")
                    .IsRequired()
                    .HasMaxLength(255)
                    .HasColumnType("varchar(255)")
                    .HasColumnName("senha");

                b.HasKey("Id");
                b.HasIndex("Email").HasDatabaseName("ix_usuario_email");
                b.HasIndex("Login").HasDatabaseName("ix_usuario_login");
                b.ToTable("usuario");
            });

            modelBuilder.Entity("versaoCsharp.Models.Checklist", b =>
            {
                b.HasOne("versaoCsharp.Models.Processo", "Processo")
                    .WithMany("Checklists")
                    .HasForeignKey("ProcessoId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Processo");
            });

            modelBuilder.Entity("versaoCsharp.Models.CronoAnalise", b =>
            {
                b.HasOne("versaoCsharp.Models.Checklist", "Checklist")
                    .WithMany("CronoAnalises")
                    .HasForeignKey("ChecklistId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Checklist");
            });

            modelBuilder.Entity("versaoCsharp.Models.Elemento", b =>
            {
                b.HasOne("versaoCsharp.Models.Checklist", "Checklist")
                    .WithMany("Elementos")
                    .HasForeignKey("ChecklistId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Checklist");
            });

            modelBuilder.Entity("versaoCsharp.Models.Item", b =>
            {
                b.HasOne("versaoCsharp.Models.Checklist", "Checklist")
                    .WithMany("Itens")
                    .HasForeignKey("ChecklistId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.HasOne("versaoCsharp.Models.Elemento", "Elemento")
                    .WithMany("Itens")
                    .HasForeignKey("ElementoId")
                    .OnDelete(DeleteBehavior.Cascade)
                    .IsRequired();

                b.Navigation("Checklist");
                b.Navigation("Elemento");
            });
        }
    }
}
