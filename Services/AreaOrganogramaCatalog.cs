using System.Globalization;
using System.Text;

namespace versaoCsharp.Services
{
    public static class AreaOrganogramaCatalog
    {
        public static readonly string[] AreasOficiais =
        [
            "Diretoria de Gestão",
            "Diretoria Administrativo-Financeira",
            "Diretoria de Obras, Projetos e Estudos",
            "Diretoria de Planejamento e Ações Estratégicas",
            "Superintendência Regional AGEVAP",
            "Superintendência Regional AGEDOCE",
            "Superintendência Regional AGEGRANDE",
            "Superintendência Regional AGEGOIÁS",
            "Gerência Administrativa",
            "Gerência Financeira",
            "Gerência de Comunicação",
            "Gerência CEIVAP",
            "Gerência CBHs",
            "Gerência Guandu-BIG",
            "Gerência BG",
            "Gerência PS1/PS2",
            "Gerência de Atendimento aos Comitês - AGEDOCE",
            "Gerência de Atendimento aos Comitês - AGEGRANDE",
            "Gerência de Fundos e Recursos Hídricos",
            "Gerência de Fundos Ambientais",
            "Gerência de Recursos Hídricos",
            "Gerência de Meio Ambiente",
            "Gerência de Obras",
            "Gerência de Projetos",
            "Gerência de Planejamento",
            "Gerência de Ações Estratégicas"
        ];

        private static readonly Dictionary<string, string> AliasMap = BuildAliasMap();
        private static readonly HashSet<string> AreasCanonicas = AreasOficiais
            .Select(NormalizarChave)
            .ToHashSet(StringComparer.Ordinal);

        public static IReadOnlyList<string> ListarAreas() => AreasOficiais;

        public static string? NormalizarArea(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return null;
            }

            var valorCorrigido = CorrigirTextoCorrompido(valor);
            var chave = NormalizarChave(valorCorrigido);
            if (string.IsNullOrWhiteSpace(chave))
            {
                return null;
            }

            if (AliasMap.TryGetValue(chave, out var canonico))
            {
                return canonico;
            }

            return AreasOficiais.FirstOrDefault(area => NormalizarChave(area) == chave);
        }

        public static string? NormalizarAreaOuOriginal(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return null;
            }

            var valorCorrigido = CorrigirTextoCorrompido(valor);
            return NormalizarArea(valorCorrigido) ?? valorCorrigido.Trim();
        }

        public static bool EhAreaOficial(string? valor)
        {
            var normalizada = NormalizarArea(valor);
            return !string.IsNullOrWhiteSpace(normalizada)
                && AreasCanonicas.Contains(NormalizarChave(normalizada));
        }

        public static IReadOnlyList<string> ObterValoresAceitosParaFiltro(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return Array.Empty<string>();
            }

            var original = CorrigirTextoCorrompido(valor).Trim();
            var normalizada = NormalizarArea(original);
            var candidatos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                original
            };

            if (!string.IsNullOrWhiteSpace(normalizada))
            {
                candidatos.Add(normalizada);

                foreach (var alias in AliasMap.Where(pair => pair.Value == normalizada).Select(pair => pair.Key))
                {
                    // AliasMap stores normalized keys, so compare only against known raw official list below.
                }

                foreach (var area in AreasOficiais)
                {
                    if (string.Equals(area, normalizada, StringComparison.OrdinalIgnoreCase))
                    {
                        candidatos.Add(area);
                    }
                }

                foreach (var aliasBruto in ObterAliasesBrutosConhecidos(normalizada))
                {
                    candidatos.Add(aliasBruto);
                }
            }

            return candidatos.ToList();
        }

        private static Dictionary<string, string> BuildAliasMap()
        {
            var map = new Dictionary<string, string>(StringComparer.Ordinal)
            {
                [NormalizarChave("Administrativa")] = "Gerência Administrativa",
                [NormalizarChave("Gerencia Administrativa")] = "Gerência Administrativa",
                [NormalizarChave("Gerência Administrativa")] = "Gerência Administrativa",

                [NormalizarChave("BG")] = "Gerência BG",
                [NormalizarChave("Gerencia BG")] = "Gerência BG",
                [NormalizarChave("Gerência BG")] = "Gerência BG",
                [NormalizarChave("CG INEA BG 67/2022")] = "Gerência BG",
                [NormalizarChave("CG INEA BG 69/2022")] = "Gerência BG",
                [NormalizarChave("Contrato BG")] = "Gerência BG",

                [NormalizarChave("CEIVAP")] = "Gerência CEIVAP",
                [NormalizarChave("Gerencia CEIVAP")] = "Gerência CEIVAP",
                [NormalizarChave("Gerência CEIVAP")] = "Gerência CEIVAP",

                [NormalizarChave("CBHS")] = "Gerência CBHs",
                [NormalizarChave("CBH'S")] = "Gerência CBHs",
                [NormalizarChave("CBHS - UD01")] = "Gerência CBHs",
                [NormalizarChave("CBHS - UD02")] = "Gerência CBHs",
                [NormalizarChave("Gerencia CBHS")] = "Gerência CBHs",
                [NormalizarChave("Gerência CBH'S")] = "Gerência CBHs",
                [NormalizarChave("CBH-BPSI")] = "Gerência CBHs",
                [NormalizarChave("CBH- MPS")] = "Gerência CBHs",

                [NormalizarChave("GUANDU-BIG")] = "Gerência Guandu-BIG",
                [NormalizarChave("Guandu-BIG")] = "Gerência Guandu-BIG",
                [NormalizarChave("GUANDU")] = "Gerência Guandu-BIG",
                [NormalizarChave("Gerencia Guandu")] = "Gerência Guandu-BIG",
                [NormalizarChave("CBH GUANDU")] = "Gerência Guandu-BIG",
                [NormalizarChave("CBH GUANDU - UD06")] = "Gerência Guandu-BIG",
                [NormalizarChave("CG INEA N 068/2022")] = "Gerência Guandu-BIG",
                [NormalizarChave("CG INEA Nº 068/2022")] = "Gerência Guandu-BIG",

                [NormalizarChave("AGEVAP")] = "Superintendência Regional AGEVAP",
                [NormalizarChave("AGEDOCE")] = "Superintendência Regional AGEDOCE",
                [NormalizarChave("AGEGRANDE")] = "Superintendência Regional AGEGRANDE",
                [NormalizarChave("AGEGOIAS")] = "Superintendência Regional AGEGOIÁS",
                [NormalizarChave("Planejamento e Ações Estratégicas")] = "Diretoria de Planejamento e Ações Estratégicas"
            };

            foreach (var area in AreasOficiais)
            {
                map[NormalizarChave(area)] = area;
            }

            return map;
        }

        private static IEnumerable<string> ObterAliasesBrutosConhecidos(string areaCanonica)
        {
            return areaCanonica switch
            {
                "Gerência Administrativa" => ["Administrativa", "Gerencia Administrativa", "Gerência Administrativa"],
                "Gerência BG" => ["BG", "Gerencia BG", "Gerência BG", "CG INEA BG 67/2022", "CG INEA BG 69/2022", "Contrato BG"],
                "Gerência CEIVAP" => ["CEIVAP", "Gerencia CEIVAP", "Gerência CEIVAP"],
                "Gerência CBHs" => ["CBHS", "CBH'S", "CBHS - UD01", "CBHS - UD02", "Gerencia CBHS", "Gerência CBH'S", "CBH-BPSI", "CBH- MPS"],
                "Gerência Guandu-BIG" => ["GUANDU-BIG", "Guandu-BIG", "GUANDU", "Gerencia Guandu", "CBH GUANDU", "CBH GUANDU - UD06", "CG INEA N 068/2022", "CG INEA Nº 068/2022"],
                "Superintendência Regional AGEVAP" => ["AGEVAP"],
                "Superintendência Regional AGEDOCE" => ["AGEDOCE"],
                "Superintendência Regional AGEGRANDE" => ["AGEGRANDE"],
                "Superintendência Regional AGEGOIÁS" => ["AGEGOIAS"],
                "Diretoria de Planejamento e Ações Estratégicas" => ["Planejamento e Ações Estratégicas"],
                _ => [areaCanonica]
            };
        }

        private static string NormalizarChave(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var texto = CorrigirTextoCorrompido(valor).Trim().ToUpperInvariant();
            var sb = new StringBuilder(texto.Length);
            foreach (var ch in texto.Normalize(NormalizationForm.FormD))
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(ch);
                if (unicodeCategory == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                if (char.IsLetterOrDigit(ch))
                {
                    sb.Append(ch);
                    continue;
                }

                if (char.IsWhiteSpace(ch) || ch is '-' or '/' or '_' or '\'')
                {
                    sb.Append(' ');
                }
            }

            return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }

        private static string CorrigirTextoCorrompido(string? valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var texto = valor.Trim();
            if (!PareceTextoCorrompido(texto))
            {
                return texto;
            }

            try
            {
                var latin1 = Encoding.GetEncoding("ISO-8859-1");
                var bytes = latin1.GetBytes(texto);
                var corrigido = Encoding.UTF8.GetString(bytes).Trim();
                return string.IsNullOrWhiteSpace(corrigido) ? texto : corrigido;
            }
            catch
            {
                return texto;
            }
        }

        private static bool PareceTextoCorrompido(string texto)
        {
            return texto.Contains('Ã')
                || texto.Contains('Â')
                || texto.Contains('�')
                || texto.Contains("â€")
                || texto.Contains("â€œ")
                || texto.Contains("â€˜");
        }
    }
}
