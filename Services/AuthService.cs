using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using versaoCsharp.Data;
using versaoCsharp.Models;

namespace versaoCsharp.Services
{
    public class AuthService
    {
        private readonly AppDbContext _db;

        public AuthService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<Usuario?> AutenticarAsync(string emailOuLogin, string senha)
        {
            if (string.IsNullOrWhiteSpace(emailOuLogin) || string.IsNullOrWhiteSpace(senha))
                return null;

            var usuario = await _db.Usuarios
                .FirstOrDefaultAsync(u => u.Email == emailOuLogin || u.Login == emailOuLogin);

            if (usuario == null || !usuario.Ativo)
                return null;

            if (VerificarSenha(usuario.Senha, senha, out var precisaAtualizarHash))
            {
                // Migração progressiva: se o usuário ainda estiver com hash legado,
                // ao autenticar com sucesso regravamos a senha no novo formato PBKDF2.
                if (precisaAtualizarHash)
                {
                    usuario.Senha = HashSenhaPbkdf2(senha);
                    await _db.SaveChangesAsync();
                }

                return usuario;
            }

            return null;
        }

        public async Task<Usuario> CriarUsuarioAsync(string name, string login, string email, string senha, string? perfil = null)
        {
            return await CriarUsuarioAsync(name, login, email, senha, perfil, null);
        }

        public async Task<Usuario> CriarUsuarioAsync(string name, string login, string email, string senha, string? perfil, string? empresa)
        {
            name = name.Trim();
            login = login.Trim();
            email = email.Trim();

            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(login) || string.IsNullOrWhiteSpace(email))
                throw new InvalidOperationException("Nome, login e e-mail são obrigatórios.");

            if (await _db.Usuarios.AnyAsync(u => u.Email == email))
                throw new InvalidOperationException("E-mail já cadastrado");

            if (await _db.Usuarios.AnyAsync(u => u.Login == login))
                throw new InvalidOperationException("Login já cadastrado");

            var perfilNormalizado = NormalizarPerfil(perfil);

            var usuario = new Usuario
            {
                Name = name,
                Login = login,
                Email = email,
                Senha = HashSenhaPbkdf2(senha),
                Perfil = perfilNormalizado,
                Empresa = NormalizarEmpresa(empresa, email),
                Ativo = true
            };

            _db.Usuarios.Add(usuario);
            await _db.SaveChangesAsync();
            return usuario;
        }

        public async Task<List<Usuario>> ListarUsuariosAsync()
        {
            return await _db.Usuarios.AsNoTracking().ToListAsync();
        }

        public async Task<bool> ExisteUsuarioAsync()
        {
            return await _db.Usuarios.AsNoTracking().AnyAsync();
        }

        public async Task<Usuario> BuscarPorIdAsync(int id)
        {
            var usuario = await _db.Usuarios.FindAsync(id);
            if (usuario == null)
                throw new InvalidOperationException("Usuário não encontrado");
            return usuario;
        }

        public async Task<Usuario> AtualizarUsuarioAsync(int id, Dictionary<string, string?> dados)
        {
            var usuario = await _db.Usuarios.FindAsync(id)
                          ?? throw new InvalidOperationException("Usuário não encontrado");

            var emailInformado = dados.TryGetValue("email", out var emailValor) ? emailValor?.Trim() : null;
            var loginInformado = dados.TryGetValue("login", out var loginValor) ? loginValor?.Trim() : null;
            var nomeInformado = dados.TryGetValue("name", out var nomeValor) ? nomeValor?.Trim() : null;

            if (!string.IsNullOrWhiteSpace(emailInformado) && emailInformado != usuario.Email)
            {
                var jaExiste = await _db.Usuarios.AnyAsync(u => u.Email == emailInformado && u.Id != id);
                if (jaExiste)
                    throw new InvalidOperationException("E-mail já cadastrado");
                usuario.Email = emailInformado;
            }

            if (!string.IsNullOrWhiteSpace(loginInformado) && loginInformado != usuario.Login)
            {
                var jaExiste = await _db.Usuarios.AnyAsync(u => u.Login == loginInformado && u.Id != id);
                if (jaExiste)
                    throw new InvalidOperationException("Login já cadastrado");
                usuario.Login = loginInformado;
            }

            if (!string.IsNullOrWhiteSpace(nomeInformado))
            {
                usuario.Name = nomeInformado;
            }

            string? perfilSelecionado = null;
            if (dados.TryGetValue("perfil", out var perfil) && !string.IsNullOrWhiteSpace(perfil))
            {
                perfilSelecionado = NormalizarPerfil(perfil);
                usuario.Perfil = perfilSelecionado;
            }

            string? empresaSelecionada = null;
            if (dados.TryGetValue("empresa", out var empresa) && !string.IsNullOrWhiteSpace(empresa))
            {
                empresaSelecionada = NormalizarEmpresa(empresa, emailInformado ?? usuario.Email);
                usuario.Empresa = empresaSelecionada;
            }

            if (dados.TryGetValue("ativo", out var ativo) && !string.IsNullOrWhiteSpace(ativo))
            {
                usuario.Ativo = ativo.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                                ativo.Equals("1", StringComparison.OrdinalIgnoreCase);
            }

            if (dados.TryGetValue("senha", out var senha) && !string.IsNullOrWhiteSpace(senha))
            {
                usuario.Senha = HashSenhaPbkdf2(senha);
            }

            await _db.SaveChangesAsync();

            if (perfilSelecionado != null)
            {
                await _db.Usuarios
                    .Where(u => u.Id == id)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(u => u.Perfil, perfilSelecionado));

                await _db.Entry(usuario).ReloadAsync();
                if (!string.Equals(usuario.Perfil, perfilSelecionado, StringComparison.Ordinal))
                    throw new InvalidOperationException("O banco de dados não confirmou o perfil selecionado.");
            }

            if (empresaSelecionada != null)
            {
                await _db.Usuarios
                    .Where(u => u.Id == id)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(u => u.Empresa, empresaSelecionada));

                await _db.Entry(usuario).ReloadAsync();
                if (!string.Equals(usuario.Empresa, empresaSelecionada, StringComparison.Ordinal))
                    throw new InvalidOperationException("O banco de dados não confirmou a empresa selecionada.");
            }

            return usuario;
        }

        public async Task DeletarUsuarioAsync(int id)
        {
            var usuario = await _db.Usuarios.FindAsync(id)
                          ?? throw new InvalidOperationException("Usuário não encontrado");
            _db.Usuarios.Remove(usuario);
            await _db.SaveChangesAsync();
        }

        private static bool VerificarSenha(string? hashArmazenado, string senhaFornecida, out bool precisaAtualizarHash)
        {
            precisaAtualizarHash = false;

            if (string.IsNullOrWhiteSpace(hashArmazenado))
                return false;

            // Formato moderno do Werkzeug: pbkdf2:sha256[:iteracoes]$salt$hashHex
            if (hashArmazenado.StartsWith("pbkdf2:", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var partes = hashArmazenado.Split('$');
                    if (partes.Length != 3)
                        return false;

                    var metodo = partes[0];
                    var salt = partes[1];
                    var hashHex = partes[2];

                    var metodoParts = metodo.Split(':');
                    if (metodoParts.Length < 2)
                        return false;

                    var algoritmo = metodoParts[0];
                    var hashName = metodoParts[1];
                    var iteracoes = 260000;
                    if (metodoParts.Length >= 3 && !int.TryParse(metodoParts[2], out iteracoes))
                    {
                        iteracoes = 260000;
                    }

                    if (!string.Equals(algoritmo, "pbkdf2", StringComparison.OrdinalIgnoreCase) ||
                        !string.Equals(hashName, "sha256", StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    var saltBytes = Encoding.UTF8.GetBytes(salt);
                    var hashBytesArmazenado = HexToBytes(hashHex);

                    using var pbkdf2 = new Rfc2898DeriveBytes(
                        senhaFornecida,
                        saltBytes,
                        iteracoes,
                        HashAlgorithmName.SHA256);

                    var hashGerado = pbkdf2.GetBytes(hashBytesArmazenado.Length);
                    return CryptographicOperations.FixedTimeEquals(hashGerado, hashBytesArmazenado);
                }
                catch
                {
                    return false;
                }
            }

            // Compatibilidade mínima: senhas SHA256 hex simples (formato legado).
            // Se validar com sucesso, sinalizamos que o hash deve ser atualizado
            // para o novo formato PBKDF2.
            if (Regex.IsMatch(hashArmazenado, "^[a-fA-F0-9]{64}$"))
            {
                var hashSenha = HashSenhaSha256(senhaFornecida);
                var ok = CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(hashSenha),
                    Encoding.UTF8.GetBytes(hashArmazenado.ToLowerInvariant()));

                if (ok)
                {
                    precisaAtualizarHash = true;
                }

                return ok;
            }

            // Outros formatos (por exemplo scrypt) ainda não são suportados aqui.
            return false;
        }

        private static string HashSenhaPbkdf2(string senha)
        {
            const int iteracoes = 260000;
            var saltBytes = new byte[16];
            RandomNumberGenerator.Fill(saltBytes);
            var salt = Convert.ToBase64String(saltBytes);

            using var pbkdf2 = new Rfc2898DeriveBytes(
                senha,
                Encoding.UTF8.GetBytes(salt),
                iteracoes,
                HashAlgorithmName.SHA256);

            var hash = pbkdf2.GetBytes(32);
            var hashHex = BytesToHex(hash);
            return $"pbkdf2:sha256:{iteracoes}${salt}${hashHex}";
        }

        public string GerarSenhaTemporaria(int tamanho = 12)
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@@#$%&*";
            var bytes = new byte[tamanho];
            RandomNumberGenerator.Fill(bytes);
            var resultado = new StringBuilder(tamanho);
            foreach (var b in bytes)
            {
                resultado.Append(chars[b % chars.Length]);
            }

            return resultado.ToString();
        }

        public static string NormalizarPerfil(string? perfil)
        {
            var valor = (perfil ?? string.Empty).Trim().ToUpperInvariant();
            return valor switch
            {
                PerfisAcesso.UserAdm => PerfisAcesso.UserAdm,
                PerfisAcesso.UserPadrao => PerfisAcesso.UserPadrao,
                _ => PerfisAcesso.UserCi
            };
        }

        public static string NormalizarEmpresa(string? empresa, string? email = null)
        {
            var valor = (empresa ?? string.Empty).Trim().ToUpperInvariant();
            if (EmpresasAcesso.Todas.Contains(valor))
            {
                return valor;
            }

            return InferirEmpresaPorEmail(email);
        }

        public static string InferirEmpresaPorEmail(string? email)
        {
            var valor = (email ?? string.Empty).Trim().ToLowerInvariant();

            if (valor.Contains("@agedoce"))
            {
                return EmpresasAcesso.Agedoce;
            }

            if (valor.Contains("@agegrande"))
            {
                return EmpresasAcesso.Agegrande;
            }

            if (valor.Contains("@agegoias") || valor.Contains("@goias.gov.br"))
            {
                return EmpresasAcesso.Agegoias;
            }

            return EmpresasAcesso.Agevap;
        }

        private static string BytesToHex(byte[] data)
        {
            var sb = new StringBuilder(data.Length * 2);
            foreach (var b in data)
            {
                sb.AppendFormat("{0:x2}", b);
            }
            return sb.ToString();
        }

        private static byte[] HexToBytes(string hex)
        {
            if (string.IsNullOrEmpty(hex))
                return Array.Empty<byte>();

            if (hex.Length % 2 != 0)
                throw new ArgumentException("Hex string com comprimento ímpar.", nameof(hex));

            var bytes = new byte[hex.Length / 2];
            for (int i = 0; i < bytes.Length; i++)
            {
                bytes[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
            }
            return bytes;
        }

        private static string HashSenhaSha256(string senha)
        {
            using var sha = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(senha);
            var hash = sha.ComputeHash(bytes);
            var sb = new StringBuilder(hash.Length * 2);
            foreach (var b in hash)
            {
                sb.AppendFormat("{0:x2}", b);
            }
            return sb.ToString();
        }
    }
}
