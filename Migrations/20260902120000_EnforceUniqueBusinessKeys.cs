using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using versaoCsharp.Data;

#nullable disable

namespace versaoCsharp.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260902120000_EnforceUniqueBusinessKeys")]
    public partial class EnforceUniqueBusinessKeys : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A rotina de compatibilidade cria os índices após verificar o esquema legado.
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
