using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace versaoCsharp.Migrations
{
    public partial class InitialSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "processo",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    numero = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    objeto = table.Column<string>(type: "text", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    data_abertura = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    modalidade = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    competencia = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    area = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    gestor = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_processo", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "usuario",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    login = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    email = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    senha = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    perfil = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ativo = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_usuario", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "checklist",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    processo_id = table.Column<int>(type: "int", nullable: false),
                    modalidade = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    tipo = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    data_criacao = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    competencia = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ajustes_confirmados = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ajustes_confirmados_em = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ajustes_confirmados_por = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_checklist", x => x.id);
                    table.ForeignKey(
                        name: "FK_checklist_processo_processo_id",
                        column: x => x.processo_id,
                        principalTable: "processo",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "crono_analise",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    checklist_id = table.Column<int>(type: "int", nullable: false),
                    fase = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    data_inicio = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    data_fim = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    duracao = table.Column<int>(type: "int", nullable: true),
                    observacoes = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_crono_analise", x => x.id);
                    table.ForeignKey(
                        name: "FK_crono_analise_checklist_checklist_id",
                        column: x => x.checklist_id,
                        principalTable: "checklist",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "elemento",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    checklist_id = table.Column<int>(type: "int", nullable: false),
                    tipo = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    elemento = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    data_elemento = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    nup = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_elemento", x => x.id);
                    table.ForeignKey(
                        name: "FK_elemento_checklist_checklist_id",
                        column: x => x.checklist_id,
                        principalTable: "checklist",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "item",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    elemento_id = table.Column<int>(type: "int", nullable: false),
                    checklist_id = table.Column<int>(type: "int", nullable: false),
                    pergunta = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    analise = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    categoria = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    justificativa = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item", x => x.id);
                    table.ForeignKey(
                        name: "FK_item_checklist_checklist_id",
                        column: x => x.checklist_id,
                        principalTable: "checklist",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_item_elemento_elemento_id",
                        column: x => x.elemento_id,
                        principalTable: "elemento",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "ix_checklist_data_criacao",
                table: "checklist",
                column: "data_criacao");

            migrationBuilder.CreateIndex(
                name: "ix_checklist_modalidade",
                table: "checklist",
                column: "modalidade");

            migrationBuilder.CreateIndex(
                name: "ix_checklist_processo_id",
                table: "checklist",
                column: "processo_id");

            migrationBuilder.CreateIndex(
                name: "ix_checklist_status",
                table: "checklist",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_crono_analise_checklist_id",
                table: "crono_analise",
                column: "checklist_id");

            migrationBuilder.CreateIndex(
                name: "ix_crono_analise_fase",
                table: "crono_analise",
                column: "fase");

            migrationBuilder.CreateIndex(
                name: "ix_elemento_checklist_id",
                table: "elemento",
                column: "checklist_id");

            migrationBuilder.CreateIndex(
                name: "ix_item_analise",
                table: "item",
                column: "analise");

            migrationBuilder.CreateIndex(
                name: "ix_item_categoria",
                table: "item",
                column: "categoria");

            migrationBuilder.CreateIndex(
                name: "ix_item_checklist_id",
                table: "item",
                column: "checklist_id");

            migrationBuilder.CreateIndex(
                name: "ix_item_elemento_id",
                table: "item",
                column: "elemento_id");

            migrationBuilder.CreateIndex(
                name: "ix_processo_area",
                table: "processo",
                column: "area");

            migrationBuilder.CreateIndex(
                name: "ix_processo_modalidade",
                table: "processo",
                column: "modalidade");

            migrationBuilder.CreateIndex(
                name: "ix_processo_numero",
                table: "processo",
                column: "numero");

            migrationBuilder.CreateIndex(
                name: "ix_usuario_email",
                table: "usuario",
                column: "email");

            migrationBuilder.CreateIndex(
                name: "ix_usuario_login",
                table: "usuario",
                column: "login");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "crono_analise");
            migrationBuilder.DropTable(name: "item");
            migrationBuilder.DropTable(name: "usuario");
            migrationBuilder.DropTable(name: "elemento");
            migrationBuilder.DropTable(name: "checklist");
            migrationBuilder.DropTable(name: "processo");
        }
    }
}
