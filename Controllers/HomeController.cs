using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using versaoCsharp.Models;

namespace versaoCsharp.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        if (User?.Identity?.IsAuthenticated ?? false)
        {
            return Redirect("/DASHBOARD-CONF");
        }

        return Redirect("/login");
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
