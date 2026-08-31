using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;
using versaoCsharp.Models;
using versaoCsharp.Services;

namespace versaoCsharp.Controllers
{
    [Authorize]
    public class AuthController : Controller
    {
        private readonly AuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(AuthService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        [HttpGet("/login")]
        [AllowAnonymous]
        public IActionResult Login()
        {
            return View();
        }

        [HttpPost("/login")]
        [AllowAnonymous]
        [EnableRateLimiting("login")]
        public async Task<IActionResult> LoginPost()
        {
            var email = Request.Form["email"].ToString();
            var senha = Request.Form["password"].ToString();
            var rememberFlag = Request.Form["remember"].ToString();
            var remember = !string.IsNullOrEmpty(rememberFlag) &&
                           (rememberFlag == "true" || rememberFlag == "on" || rememberFlag == "1");

            var usuario = await _authService.AutenticarAsync(email, senha);
            if (usuario == null)
            {
                Response.StatusCode = 401;
                return Json(new { success = false, message = "E-mail ou senha inválidos" });
            }

            var principal = CriarPrincipal(usuario);

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = remember
                });

            var nextPage = "/DASHBOARD-CONF";
            var accept = Request.Headers["Accept"].ToString() ?? string.Empty;
            if (accept.Contains("application/json"))
            {
                return Json(new { success = true, redirect = nextPage });
            }

            return Redirect(nextPage);
        }

        [HttpGet("/logout")]
        public IActionResult LogoutGet()
        {
            return StatusCode(405);
        }

        [HttpPost("/logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

            var accept = Request.Headers["Accept"].ToString() ?? string.Empty;
            if (accept.Contains("application/json"))
            {
                return Json(new { success = true, redirect = "/login" });
            }

            return Redirect("/login");
        }

        [HttpGet("/novo-usuario")]
        [Authorize(Roles = PerfisAcesso.UserAdm)]
        public IActionResult NovoUsuario()
        {
            return View("novo_usuario");
        }

        [HttpGet("/meu-perfil")]
        public IActionResult MeuPerfil()
        {
            ViewData["ActiveNav"] = "perfil";
            return View("meu_perfil");
        }

        [HttpPost("/novo-usuario")]
        [Authorize(Roles = PerfisAcesso.UserAdm)]
        public async Task<IActionResult> NovoUsuarioPost([FromBody] CriarUsuarioRequest dados)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Os dados do usuário são inválidos." });
                }

                var senha = dados.Senha ?? string.Empty;
                if (string.IsNullOrWhiteSpace(senha))
                {
                    senha = _authService.GerarSenhaTemporaria();
                }

                var usuario = await _authService.CriarUsuarioAsync(
                    dados.Name,
                    dados.Login,
                    dados.Email,
                    senha,
                    dados.Perfil,
                    dados.Empresa
                );

                return Json(new { success = true, message = "Usuário criado com sucesso", usuario_id = usuario.Id, senha_temporaria = senha });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Falha de validação ao criar usuário");
                Response.StatusCode = 400;
                return Json(new { success = false, message = ex.Message });
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Erro ao criar usuário");
                Response.StatusCode = 400;
                return Json(new { success = false, message = "Erro ao criar usuário" });
            }
        }

        [HttpGet("/api/usuarios")]
        public async Task<IActionResult> ListarUsuarios()
        {
            Response.Headers.CacheControl = "no-store, no-cache";
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
            {
                Response.StatusCode = 401;
                return Json(new { success = false, message = "Não autenticado" });
            }

            try
            {
                if (User.IsInRole(PerfisAcesso.UserAdm))
                {
                    var usuarios = await _authService.ListarUsuariosAsync();
                    return Json(new
                    {
                        success = true,
                        usuarios = usuarios.Select(usuario => new
                        {
                            id = usuario.Id,
                            name = usuario.Name,
                            login = usuario.Login,
                            email = usuario.Email,
                            perfil = usuario.Perfil,
                            empresa = usuario.Empresa,
                            ativo = usuario.Ativo,
                            is_admin = usuario.Perfil == PerfisAcesso.UserAdm
                        })
                    });
                }

                var usuario = await _authService.BuscarPorIdAsync(currentUserId.Value);
                return Json(new
                {
                    success = true,
                    usuarios = new[]
                    {
                        new
                        {
                            id = usuario.Id,
                            name = usuario.Name,
                            login = usuario.Login,
                            email = usuario.Email,
                            perfil = usuario.Perfil,
                            empresa = usuario.Empresa,
                            ativo = usuario.Ativo
                        }
                    }
                });
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Erro ao listar usuários");
                Response.StatusCode = 500;
                return Json(new { success = false, message = "Não foi possível carregar os usuários." });
            }
        }

        [HttpGet("/api/usuarios/{id:int}")]
        public async Task<IActionResult> ObterUsuario(int id)
        {
            if (!CanManageUser(id))
            {
                Response.StatusCode = 403;
                return Json(new { success = false, message = "Acesso negado" });
            }

            try
            {
                var u = await _authService.BuscarPorIdAsync(id);
                return Json(new
                {
                    success = true,
                    usuario = new { id = u.Id, name = u.Name, login = u.Login, email = u.Email, perfil = u.Perfil, empresa = u.Empresa, ativo = u.Ativo }
                });
            }
            catch (System.Exception ex)
            {
                _logger.LogWarning(ex, "Usuário não encontrado ou indisponível: {UsuarioId}", id);
                Response.StatusCode = 404;
                return Json(new { success = false, message = "Usuário não encontrado." });
            }
        }

        [HttpPut("/api/usuarios/{id:int}")]
        public async Task<IActionResult> AtualizarUsuario(int id, [FromBody] AtualizarUsuarioRequest dados)
        {
            if (!CanManageUser(id))
            {
                Response.StatusCode = 403;
                return Json(new { success = false, message = "Acesso negado" });
            }

            try
            {
                if (!ModelState.IsValid)
                {
                    Response.StatusCode = 400;
                    return Json(new { success = false, message = "Os dados do usuário são inválidos." });
                }

                var dadosAtualizacao = new Dictionary<string, string?>
                {
                    ["name"] = dados.Name,
                    ["login"] = dados.Login,
                    ["email"] = dados.Email,
                    ["perfil"] = dados.Perfil,
                    ["empresa"] = dados.Empresa,
                    ["ativo"] = dados.Ativo,
                    ["senha"] = dados.Senha
                };

                if (!User.IsInRole(PerfisAcesso.UserAdm))
                {
                    dadosAtualizacao = new Dictionary<string, string?> { ["senha"] = dados.Senha };
                }

                var u = await _authService.AtualizarUsuarioAsync(id, dadosAtualizacao);

                if (IsCurrentUser(id))
                {
                    await HttpContext.SignInAsync(
                        CookieAuthenticationDefaults.AuthenticationScheme,
                        CriarPrincipal(u),
                        new AuthenticationProperties
                        {
                            IsPersistent = User.Identity?.IsAuthenticated ?? false
                        });
                }

                return Json(new
                {
                    success = true,
                    message = "Usuário atualizado com sucesso",
                    usuario = new { id = u.Id, name = u.Name, login = u.Login, email = u.Email, perfil = u.Perfil, empresa = u.Empresa, ativo = u.Ativo }
                });
            }
            catch (System.Exception ex)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpDelete("/api/usuarios/{id:int}")]
        [Authorize(Roles = PerfisAcesso.UserAdm)]
        public async Task<IActionResult> DeletarUsuario(int id)
        {
            if (!CanManageUser(id))
            {
                Response.StatusCode = 403;
                return Json(new { success = false, message = "Acesso negado" });
            }

            try
            {
                await _authService.DeletarUsuarioAsync(id);
                return Json(new { success = true, message = "Usuário deletado com sucesso" });
            }
            catch (System.Exception ex)
            {
                Response.StatusCode = 400;
                return Json(new { success = false, message = ex.Message });
            }
        }

        [HttpGet("/api/usuario-atual")]
        public async Task<IActionResult> UsuarioAtual()
        {
            if (!User.Identity?.IsAuthenticated ?? true)
            {
                Response.StatusCode = 401;
                return Json(new { success = false, message = "Não autenticado" });
            }

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                Response.StatusCode = 401;
                return Json(new { success = false, message = "Não autenticado" });
            }

            try
            {
                var usuario = await _authService.BuscarPorIdAsync(userId.Value);
                return Json(new
                {
                    success = true,
                    usuario = new
                    {
                        id = usuario.Id,
                        name = usuario.Name,
                        login = usuario.Login,
                        email = usuario.Email,
                        perfil = usuario.Perfil,
                        empresa = usuario.Empresa
                    }
                });
            }
            catch (System.Exception ex)
            {
                Response.StatusCode = 404;
                return Json(new { success = false, message = ex.Message });
            }
        }

        private static ClaimsPrincipal CriarPrincipal(Usuario usuario)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, usuario.Name),
                new Claim("login", usuario.Login),
                new Claim(ClaimTypes.Email, usuario.Email),
                new Claim("perfil", usuario.Perfil),
                new Claim("empresa", usuario.Empresa),
                new Claim(ClaimTypes.Role, usuario.Perfil)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            return new ClaimsPrincipal(identity);
        }

        private int? GetCurrentUserId()
        {
            var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idStr, out var id))
            {
                return id;
            }

            return null;
        }

        private bool IsCurrentUser(int id)
        {
            var currentId = GetCurrentUserId();
            return currentId.HasValue && currentId.Value == id;
        }

        private bool CanManageUser(int id)
        {
            return User.IsInRole(PerfisAcesso.UserAdm) || IsCurrentUser(id);
        }
    }
}
