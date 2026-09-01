using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using versaoCsharp.Data;
using versaoCsharp.Models;

namespace versaoCsharp.Services
{
    public class ProcessoService
    {
        private readonly AppDbContext _db;

        public ProcessoService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<Processo> CriarProcessoAsync(Dictionary<string, string?> dados)
        {
            var areaNormalizada = AreaOrganogramaCatalog.NormalizarArea(dados.GetValueOrDefault("area"));

            var processo = new Processo
            {
                Numero = dados.GetValueOrDefault("numero") ?? string.Empty,
                Objeto = dados.GetValueOrDefault("objeto") ?? string.Empty,
                DataAbertura = dados.GetValueOrDefault("data_abertura") ?? string.Empty,
                Modalidade = dados.GetValueOrDefault("modalidade") ?? string.Empty,
                Competencia = dados.GetValueOrDefault("competencia") ?? string.Empty,
                Area = areaNormalizada,
                Gestor = dados.GetValueOrDefault("gestor")
            };

            if (string.IsNullOrWhiteSpace(processo.Area) || !AreaOrganogramaCatalog.EhAreaOficial(processo.Area))
            {
                throw new InvalidOperationException("Informe uma área válida da lista oficial do organograma.");
            }

            if (!string.IsNullOrWhiteSpace(processo.Numero))
            {
                var existe = await _db.Processos.AnyAsync(p => p.Numero == processo.Numero);
                if (existe)
                {
                    throw new InvalidOperationException("Processo já cadastrado");
                }
            }

            _db.Processos.Add(processo);
            await _db.SaveChangesAsync();
            return processo;
        }

        public async Task<List<Processo>> ListarProcessosAsync()
        {
            return await _db.Processos
                .Include(p => p.Checklists)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Processo> BuscarPorIdAsync(int id)
        {
            var processo = await _db.Processos
                .Include(p => p.Checklists)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (processo == null)
                throw new InvalidOperationException("Processo não encontrado");

            return processo;
        }

        public async Task<Processo> AtualizarProcessoAsync(int id, Dictionary<string, string?> dados)
        {
            var processo = await _db.Processos
                .AsTracking()
                .FirstOrDefaultAsync(p => p.Id == id)
                ?? throw new InvalidOperationException("Processo não encontrado");

            if (dados.TryGetValue("numero", out var novoNumero) && !string.IsNullOrWhiteSpace(novoNumero))
            {
                var duplicado = await _db.Processos.AnyAsync(p => p.Numero == novoNumero && p.Id != id);
                if (duplicado)
                {
                    throw new InvalidOperationException("Processo já cadastrado");
                }
            }

            void SetIfPresent(string key, Action<string?> setter)
            {
                if (dados.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
                    setter(val);
            }

            SetIfPresent("numero", v => processo.Numero = v!);
            SetIfPresent("objeto", v => processo.Objeto = v!);
            SetIfPresent("data_abertura", v => processo.DataAbertura = v!);
            SetIfPresent("modalidade", v => processo.Modalidade = v!);
            SetIfPresent("competencia", v => processo.Competencia = v!);
            SetIfPresent("gestor", v => processo.Gestor = v);

            if (dados.ContainsKey("area"))
            {
                var areaNormalizada = AreaOrganogramaCatalog.NormalizarArea(dados.GetValueOrDefault("area"));
                if (string.IsNullOrWhiteSpace(areaNormalizada) || !AreaOrganogramaCatalog.EhAreaOficial(areaNormalizada))
                {
                    throw new InvalidOperationException("Informe uma área válida da lista oficial do organograma.");
                }

                processo.Area = areaNormalizada;
            }

            await _db.SaveChangesAsync();
            return processo;
        }

        public async Task DeletarProcessoAsync(int id)
        {
            var processo = await _db.Processos.FindAsync(id)
                           ?? throw new InvalidOperationException("Processo não encontrado");
            _db.Processos.Remove(processo);
            await _db.SaveChangesAsync();
        }
    }
}
