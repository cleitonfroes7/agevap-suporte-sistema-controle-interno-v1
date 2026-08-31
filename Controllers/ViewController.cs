using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using versaoCsharp.Models;

namespace versaoCsharp.Controllers
{
    [Authorize]
    public class ViewController : Controller
    {
        [AllowAnonymous]
        [HttpGet("/health")]
        public IActionResult Health()
        {
            return Json(new { status = "ok" });
        }

        [HttpGet("/TELA-LISTA-PROCESSO")]
        [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
        public IActionResult ListaProcesso()
        {
            return View("TELA-LISTA-PROCESSO");
        }

        [HttpGet("/TELA-LISTA-CHECKLIST")]
        [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
        public IActionResult ListaChecklist()
        {
            return View("TELA-LISTA-CHECKLIST");
        }

        [HttpGet("/editar-checklist/{checklistId:int}")]
        [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
        public IActionResult EditarChecklist(int checklistId)
        {
            ViewData["ChecklistId"] = checklistId;
            return View("editar-checklist");
        }

        [HttpGet("/detalhes-checklist/{checklistId:int}")]
        [Authorize(Roles = PerfisAcesso.UserAdm + "," + PerfisAcesso.UserCi)]
        public IActionResult DetalhesChecklist(int checklistId)
        {
            ViewData["ChecklistId"] = checklistId;
            return View("detalhe-checklist");
        }

        [HttpGet("/GuiaUsuario")]
        public IActionResult GuiaUsuario()
        {
            return View("GuiaUsuario");
        }

        [HttpGet("/FluxoArvore")]
        public IActionResult FluxoArvore()
        {
            return View("FluxoArvore");
        }

        [HttpGet("/Organograma")]
        public IActionResult Organograma()
        {
            return View("Organograma");
        }
    }
}
