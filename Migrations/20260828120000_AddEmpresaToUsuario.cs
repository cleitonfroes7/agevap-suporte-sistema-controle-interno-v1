using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace versaoCsharp.Migrations
{
    public partial class AddEmpresaToUsuario : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "empresa",
                table: "usuario",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "AGEVAP")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "empresa",
                table: "usuario");
        }
    }
}
