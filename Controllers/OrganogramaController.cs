using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using versaoCsharp.Data;
using versaoCsharp.Models;

namespace versaoCsharp.Controllers
{
    [Authorize(Roles = PerfisAcesso.UserAdm)]
    public class OrganogramaController : Controller
    {
        private readonly AppDbContext _db;
        private readonly ILogger<OrganogramaController> _logger;

        public OrganogramaController(AppDbContext db, ILogger<OrganogramaController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet("/api/organograma/funcionarios")]
        public async Task<IActionResult> ListarPorUnidade([FromQuery(Name = "unidade_id")] string unidadeId)
        {
            if (string.IsNullOrWhiteSpace(unidadeId))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Unidade não informada." });
            }

            var funcionarios = await _db.OrganogramaFuncionarios
                .Where(f => f.UnidadeId == unidadeId.Trim())
                .OrderBy(f => f.Nome)
                .ToListAsync();

            return Json(new
            {
                success = true,
                items = funcionarios.Select(f => new
                {
                    id = f.Id,
                    unidade_id = f.UnidadeId,
                    unidade_nome = f.UnidadeNome,
                    nome = f.Nome,
                    cargo = f.Cargo,
                    telefone = f.Telefone,
                    email = f.Email,
                    local = f.Local,
                    observacoes = f.Observacoes,
                    criado_em = f.CriadoEm.ToString("yyyy-MM-dd HH:mm"),
                    atualizado_em = f.AtualizadoEm?.ToString("yyyy-MM-dd HH:mm"),
                    criado_por_nome = f.CriadoPorNome
                })
            });
        }

        [Authorize(Roles = PerfisAcesso.UserAdm)]
        [HttpPost("/api/organograma/funcionarios")]
        public async Task<IActionResult> Criar([FromBody] OrganogramaFuncionarioRequest request)
        {
            if (!ValidarRequest(request, out var erro))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = erro });
            }

            var usuarioId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : (int?)null;
            var usuarioNome = User.FindFirstValue(ClaimTypes.Name)
                ?? User.Identity?.Name
                ?? "Controle Interno - SEDE";

            var funcionario = new OrganogramaFuncionario
            {
                UnidadeId = request.UnidadeId.Trim(),
                UnidadeNome = request.UnidadeNome.Trim(),
                Nome = request.Nome.Trim(),
                Cargo = request.Cargo.Trim(),
                Telefone = request.Telefone.Trim(),
                Email = request.Email.Trim(),
                Local = request.Local.Trim(),
                Observacoes = (request.Observacoes ?? string.Empty).Trim(),
                CriadoEm = DateTime.Now,
                CriadoPorUsuarioId = usuarioId,
                CriadoPorNome = usuarioNome
            };

            _db.OrganogramaFuncionarios.Add(funcionario);
            await _db.SaveChangesAsync();

            return Json(new { success = true, message = "Funcionário salvo com sucesso.", id = funcionario.Id });
        }

        [Authorize(Roles = PerfisAcesso.UserAdm)]
        [HttpPut("/api/organograma/funcionarios/{id:int}")]
        public async Task<IActionResult> Atualizar(int id, [FromBody] OrganogramaFuncionarioRequest request)
        {
            if (!ValidarRequest(request, out var erro))
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = erro });
            }

            var funcionario = await _db.OrganogramaFuncionarios.FirstOrDefaultAsync(f => f.Id == id);
            if (funcionario == null)
            {
                Response.StatusCode = 404;
                return Json(new { success = false, message = "Funcionário não encontrado." });
            }

            funcionario.UnidadeId = request.UnidadeId.Trim();
            funcionario.UnidadeNome = request.UnidadeNome.Trim();
            funcionario.Nome = request.Nome.Trim();
            funcionario.Cargo = request.Cargo.Trim();
            funcionario.Telefone = request.Telefone.Trim();
            funcionario.Email = request.Email.Trim();
            funcionario.Local = request.Local.Trim();
            funcionario.Observacoes = (request.Observacoes ?? string.Empty).Trim();
            funcionario.AtualizadoEm = DateTime.Now;

            await _db.SaveChangesAsync();

            return Json(new { success = true, message = "Funcionário atualizado com sucesso." });
        }

        [Authorize(Roles = PerfisAcesso.UserAdm)]
        [HttpDelete("/api/organograma/funcionarios/{id:int}")]
        public async Task<IActionResult> Remover(int id)
        {
            var funcionario = await _db.OrganogramaFuncionarios.FirstOrDefaultAsync(f => f.Id == id);
            if (funcionario == null)
            {
                Response.StatusCode = 404;
                return Json(new { success = false, message = "Funcionário não encontrado." });
            }

            _db.OrganogramaFuncionarios.Remove(funcionario);
            await _db.SaveChangesAsync();

            return Json(new { success = true, message = "Funcionário removido com sucesso." });
        }

        private static bool ValidarRequest(OrganogramaFuncionarioRequest request, out string erro)
        {
            if (string.IsNullOrWhiteSpace(request.UnidadeId) || string.IsNullOrWhiteSpace(request.UnidadeNome))
            {
                erro = "Unidade do organograma não informada.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Nome))
            {
                erro = "Informe o nome do funcionário.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Cargo))
            {
                erro = "Informe o cargo do funcionário.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Telefone))
            {
                erro = "Informe o telefone do funcionário.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Email))
            {
                erro = "Informe o e-mail do funcionário.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Local))
            {
                erro = "Informe o local do funcionário.";
                return false;
            }

            erro = string.Empty;
            return true;
        }

        public sealed class OrganogramaFuncionarioRequest
        {
            public string UnidadeId { get; set; } = string.Empty;
            public string UnidadeNome { get; set; } = string.Empty;
            public string Nome { get; set; } = string.Empty;
            public string Cargo { get; set; } = string.Empty;
            public string Telefone { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string Local { get; set; } = string.Empty;
            public string? Observacoes { get; set; }
        }
    }
}

